import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:3000';
const dbFile = process.env.DATABASE_PATH || path.join(process.cwd(), '.data', 'avtoklub.sqlite');
function cleanSmokeAccounts() {
  const cleanup = new Database(dbFile);
  cleanup.pragma('foreign_keys = ON');
  const ids = cleanup.prepare("SELECT id FROM users WHERE email LIKE 'qa-%@example.test'").all().map(row => row.id);
  for (const userId of ids) {
    const conversations = cleanup.prepare('SELECT conversation_id id FROM conversation_members WHERE user_id=?').all(userId);
    for (const c of conversations) cleanup.prepare('DELETE FROM conversations WHERE id=?').run(c.id);
    cleanup.prepare('DELETE FROM notifications WHERE actor_id=? OR user_id=?').run(userId, userId);
    cleanup.prepare('DELETE FROM users WHERE id=?').run(userId);
  }
  cleanup.prepare("DELETE FROM notifications WHERE actor_id IS NULL AND (text LIKE 'Yoxlama A %' OR text LIKE 'Yoxlama B %')").run();
  cleanup.prepare("DELETE FROM rate_limits WHERE key LIKE 'auth:%'").run();
  cleanup.close();
}
cleanSmokeAccounts();
let cookieA = '', cookieB = '';
async function request(path, method = 'GET', data, actor = 'a') {
  const cookie = actor === 'a' ? cookieA : cookieB;
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { ...(data ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  const payload = await response.json();
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) { if (actor === 'a') cookieA = setCookie.split(';')[0]; else cookieB = setCookie.split(';')[0]; }
  return { status: response.status, ...payload };
}
const suffix = randomUUID().slice(0, 8);
const a = await request('/auth/register', 'POST', { name: 'Yoxlama A', handle: `qa_a_${suffix}`, email: `qa-a-${suffix}@example.test`, password: 'StrongPass123!' });
const b = await request('/auth/register', 'POST', { name: 'Yoxlama B', handle: `qa_b_${suffix}`, email: `qa-b-${suffix}@example.test`, password: 'StrongPass123!' }, 'b');
assert.equal(a.status, 201); assert.equal(b.status, 201);
assert.equal((await request('/me')).data.user.id, a.data.user.id);
assert.equal((await request('/vehicles')).status, 200);
const vehicle = await request('/vehicles', 'POST', { brand: 'BMW', model: '530i', year: 2002, engine: '3.0', fuel: 'petrol', transmission: 'automatic', color: 'gümüşü' });
assert.equal(vehicle.status, 201); assert.equal(vehicle.data.userId, a.data.user.id);
const vehicleDetail = await request(`/vehicles/${vehicle.data.id}`, 'GET', undefined, 'b');
assert.equal(vehicleDetail.data.owner.id, a.data.user.id);
assert.equal((await request(`/vehicles/${vehicle.data.id}/updates`, 'POST', { title: 'İcazəsiz qeyd', body: 'Bu qeyd yazılmamalıdır.' }, 'b')).status, 403);
const vehicleUpdate = await request(`/vehicles/${vehicle.data.id}/updates`, 'POST', { title: 'İlk servis qeydi', body: 'Yağ və filtr dəyişdirildi.' });
assert.equal(vehicleUpdate.status, 201);
assert.equal((await request(`/vehicles/${vehicle.data.id}/follow`, 'POST', {}, 'b')).data.following, true);
const updatedVehicle = await request(`/vehicles/${vehicle.data.id}`, 'GET', undefined, 'b');
assert.equal(updatedVehicle.data.updates[0].id, vehicleUpdate.data.id);
assert.equal(updatedVehicle.data.followers, 1);
assert.equal((await request(`/vehicles/${vehicle.data.id}/updates/${vehicleUpdate.data.id}`, 'DELETE', undefined, 'b')).status, 403);
const club = await request('/clubs/bmw/join', 'POST', {});
assert.equal(club.status, 200); assert.equal(club.data.joined, true);
const post = await request('/posts', 'POST', { clubId: 'demo-club-bmw', body: 'Soyuq start zamanı titrəmə problemi yaşayan varmı?', category: 'question' });
assert.equal(post.status, 201); assert.equal(post.data.club.id, 'demo-club-bmw');
assert.equal((await request(`/posts/${post.data.id}`, 'DELETE', undefined, 'b')).status, 403);
const comment = await request(`/posts/${post.data.id}/comments`, 'POST', { body: 'Mən də eyni əlaməti görmüşəm.' }, 'b');
assert.equal(comment.status, 201);
const like = await request(`/posts/${post.data.id}/like`, 'POST', {}, 'b');
assert.equal(like.data.liked, true);
const follow = await request(`/users/${a.data.user.id}/follow`, 'POST', {}, 'b');
assert.equal(follow.data.followed, true);
const conversation = await request('/conversations', 'POST', { userId: b.data.user.id });
assert.equal(conversation.status, 201);
const message = await request(`/conversations/${conversation.data.id}/messages`, 'POST', { body: 'Salam, disklər hələ satışdadır?' });
assert.equal(message.status, 201);
const inbox = await request(`/conversations/${conversation.data.id}/messages`, 'GET', undefined, 'b');
assert.equal(inbox.data.items.at(-1).body, message.data.body);
const listing = await request('/listings', 'POST', { title: 'BMW üçün disklər', description: 'Dörd ədəd, təmiz vəziyyətdə orijinal disk.', category: 'Disk və təkərlər', brand: 'BMW', model: 'E39', price: 500, condition: 'used', location: 'Bakı' });
assert.equal(listing.status, 201);
const event = await request('/events', 'POST', { title: 'BMW sahibləri görüşü', description: 'Həftəsonu qəhvə və avtomobil söhbəti üçün görüş.', category: 'Cars & Coffee', startsAt: new Date(Date.now() + 10 * 86400_000).toISOString(), location: 'Bakı', clubId: 'demo-club-bmw' });
assert.equal(event.status, 201);
assert.equal((await request(`/events/${event.data.id}/join`, 'POST', {}, 'b')).data.joined, true);
assert.ok((await request('/search?q=BMW')).data.clubs.length);
assert.ok((await request('/notifications', 'GET', undefined, 'a')).data.length);
assert.equal((await request(`/conversations/${conversation.data.id}/messages`, 'GET', undefined, 'a')).status, 200);
const reported = await request(`/posts/${post.data.id}/report`, 'POST', { reason: 'Yoxlama üçün qayda pozuntusu' }, 'b');
assert.equal(reported.status, 201);
const adminLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'leyla@avtoklub.example', password: 'Avtoklub2026!' }) });
assert.equal(adminLogin.status, 200);
const adminCookie = adminLogin.headers.get('set-cookie').split(';')[0];
const reportsResponse = await fetch(`${base}/api/admin/reports`, { headers: { cookie: adminCookie } });
const reports = (await reportsResponse.json()).data;
const foundReport = reports.find(r => r.targetId === post.data.id);
assert.ok(foundReport);
const moderation = await fetch(`${base}/api/admin/reports/${foundReport.id}/action`, { method: 'POST', headers: { cookie: adminCookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove' }) });
assert.equal(moderation.status, 200);
assert.equal((await request(`/posts/${post.data.id}`)).status, 404);
assert.equal((await request('/auth/change-password', 'POST', { oldPassword: 'StrongPass123!', newPassword: 'AnotherStrong123!' }, 'b')).status, 200);
assert.equal((await request('/auth/logout', 'POST', {}, 'b')).status, 200);
assert.equal((await request('/auth/login', 'POST', { email: `qa-b-${suffix}@example.test`, password: 'StrongPass123!' }, 'b')).status, 401);
assert.equal((await request('/auth/login', 'POST', { email: `qa-b-${suffix}@example.test`, password: 'AnotherStrong123!' }, 'b')).status, 200);
assert.equal((await request('/auth/logout', 'POST', {})).status, 200);
assert.equal((await request('/me')).data.user, null);
cleanSmokeAccounts();
console.log('AVTOKLUB API smoke passed: auth/password change, profile, vehicle detail/journal/follow, club, post, comment, like, follow, messages, listing, event, search, notifications, admin moderation, access control, logout.');
