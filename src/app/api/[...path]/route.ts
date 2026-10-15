import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser, makeSession, clearSession, passwordHash, verifyPassword, publicUser, rateLimit, userCounts, mutualAllowed, notify, User } from '@/server/auth';
import { db, all, id, now, one, run } from '@/server/db';
import { club, event, listing, post, vehicle } from '@/server/models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// SQLite rows and parsed request bodies have independently validated dynamic fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type R = Record<string, any>;
const ok = (data: unknown, status = 200) => NextResponse.json({ data }, { status });
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const body = async (req: NextRequest) => { try { return await req.json() as R; } catch { return {}; } };
const text = (v: unknown, max = 10000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const images = (v: unknown) => Array.isArray(v) ? v.filter(x => typeof x === 'string' && (x.startsWith('/api/media/') || x.startsWith('/photos/') || x.startsWith('https://'))).slice(0, 8) : [];
const image = (v: unknown) => images([v])[0] || null;
const page = (req: NextRequest) => Math.max(1, Math.min(1000, Number(req.nextUrl.searchParams.get('page')) || 1));
const limit = 20;
function paginator(rows: R[], total: number, p: number, transform: (r: R) => unknown) { return { items: rows.map(transform), total, hasMore: p * limit < total }; }
function report(reporter: User, type: string, target: string, reason: string) {
  if (!reason || reason.length < 8) return fail('Şikayət səbəbini yazın.');
  if (one('SELECT 1 FROM reports WHERE reporter_id=? AND target_type=? AND target_id=? AND status=?', reporter.id, type, target, 'open')) return fail('Bu məzmun artıq şikayət edilib.', 409);
  run('INSERT INTO reports(id,reporter_id,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?)', id(), reporter.id, type, target, reason.slice(0, 500), now());
  return ok({ reported: true }, 201);
}
function toggle(table: string, a: string, av: string, b: string, bv: string) {
  const found = one(`SELECT 1 FROM ${table} WHERE ${a}=? AND ${b}=?`, av, bv);
  if (found) { run(`DELETE FROM ${table} WHERE ${a}=? AND ${b}=?`, av, bv); return false; }
  run(`INSERT INTO ${table}(${a},${b},created_at) VALUES(?,?,?)`, av, bv, now()); return true;
}

async function dispatch(req: NextRequest, parts: string[]): Promise<NextResponse> {
  const method = req.method;
  const [section, key, action] = parts;
  const viewer = await currentUser();
  const q = text(req.nextUrl.searchParams.get('q'), 100);
  const p = page(req);
  if (method !== 'GET') {
    const origin = req.headers.get('origin');
    if (origin && origin !== req.nextUrl.origin) return fail('Etibarsız sorğu.', 403);
    if (req.headers.get('sec-fetch-site') === 'cross-site') return fail('Etibarsız sorğu.', 403);
  }

  if (section === 'auth') {
    if (method !== 'POST') return fail('İcazə verilmir.', 405);
    const b = await body(req);
    if (key === 'logout') { await clearSession(); return ok({ success: true }); }
    if (key === 'change-password') {
      if (!viewer) return fail('Daxil olun.', 401);
      const account = one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=?', viewer.id);
      if (!account || !verifyPassword(String(b.oldPassword || ''), account.password_hash)) return fail('Cari parol yanlışdır.', 401);
      if (typeof b.newPassword !== 'string' || b.newPassword.length < 8 || b.newPassword.length > 128) return fail('Yeni parol ən azı 8 simvol olmalıdır.');
      run('UPDATE users SET password_hash=? WHERE id=?', passwordHash(b.newPassword), viewer.id);
      run('DELETE FROM sessions WHERE user_id=?', viewer.id);
      await makeSession(viewer.id);
      return ok({ changed: true });
    }
    const accountKey = text(b.email, 320).toLowerCase();
    if (!rateLimit(`auth:account:${accountKey}`, 10, 900)) return fail('Bir az sonra yenidən cəhd edin.', 429);
    if (!rateLimit(`auth:ip:${req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'local'}`, 60, 900)) return fail('Bir az sonra yenidən cəhd edin.', 429);
    if (key === 'register') {
      const schema = z.object({ name: z.string().trim().min(2).max(80), handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/), email: z.email().transform(x => x.toLowerCase()), password: z.string().min(8).max(128) });
      const result = schema.safeParse(b);
      if (!result.success) return fail('Ad, istifadəçi adı, e-poçt və parolu yoxlayın.');
      const x = result.data;
      if (one('SELECT 1 FROM users WHERE email=? OR handle=?', x.email, x.handle)) return fail('E-poçt və ya istifadəçi adı artıq istifadə olunur.', 409);
      const uid = id();
      run('INSERT INTO users(id,name,handle,email,password_hash,created_at) VALUES(?,?,?,?,?,?)', uid, x.name, x.handle, x.email, passwordHash(x.password), now());
      await makeSession(uid);
      return ok({ user: publicUser(one<User>('SELECT * FROM users WHERE id=?', uid)) }, 201);
    }
    if (key === 'login') {
      const email = text(b.email, 320).toLowerCase();
      const user = one<User & { password_hash: string }>('SELECT * FROM users WHERE email=?', email);
      if (!user || !verifyPassword(String(b.password || ''), user.password_hash)) return fail('E-poçt və ya parol yanlışdır.', 401);
      if (one('SELECT 1 FROM user_suspensions WHERE user_id=?', user.id)) return fail('Hesab müvəqqəti məhdudlaşdırılıb.', 403);
      await makeSession(user.id);
      return ok({ user: publicUser(user) });
    }
    return fail('Tapılmadı.', 404);
  }

  if (section === 'media' && key && method === 'GET') {
    const media = one<{ mime_type: string; bytes: Buffer }>('SELECT mime_type,bytes FROM media WHERE id=?', key);
    if (!media) return fail('Şəkil tapılmadı.', 404);
    return new NextResponse(new Uint8Array(media.bytes), { headers: { 'content-type': media.mime_type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  }
  if (section === 'media' && !key && method === 'POST') {
    if (!viewer) return fail('Daxil olun.', 401);
    if (!rateLimit(`media:${viewer.id}`, 30, 3600)) return fail('Çox sayda fayl göndərilib.', 429);
    const data = await req.formData();
    const file = data.get('file');
    if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000 || file.size < 100) return fail('JPEG, PNG və ya WebP şəkli seçin (maksimum 5 MB).');
    const bytes = Buffer.from(await file.arrayBuffer());
    const sig = bytes.subarray(0, 12);
    const valid = (file.type === 'image/jpeg' && sig[0] === 255 && sig[1] === 216 && sig[2] === 255) || (file.type === 'image/png' && sig.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') || (file.type === 'image/webp' && sig.subarray(0, 4).toString() === 'RIFF' && sig.subarray(8, 12).toString() === 'WEBP');
    if (!valid) return fail('Şəkil faylı etibarsızdır.');
    const mid = id(); run('INSERT INTO media(id,owner_id,mime_type,bytes,created_at) VALUES(?,?,?,?,?)', mid, viewer.id, file.type, bytes, now());
    return ok({ url: `/api/media/${mid}` }, 201);
  }

  if (section === 'me') {
    if (!viewer) return method === 'GET' ? ok({ user: null, counts: null }) : fail('Daxil olun.', 401);
    if (method === 'GET') return ok({ user: publicUser(viewer), counts: userCounts(viewer.id) });
    if (method === 'PATCH') {
      const b = await body(req);
      const name = b.name === undefined ? viewer.name : text(b.name, 80);
      const handle = b.handle === undefined ? viewer.handle : text(b.handle, 24).toLowerCase();
      if (name.length < 2 || !/^[a-z0-9_]{3,24}$/.test(handle)) return fail('Ad və istifadəçi adını yoxlayın.');
      if (one('SELECT 1 FROM users WHERE handle=? AND id<>?', handle, viewer.id)) return fail('İstifadəçi adı tutulub.', 409);
      const brands = Array.isArray(b.brands) ? b.brands.filter((x: unknown) => typeof x === 'string').slice(0, 20) : JSON.parse(viewer.brands);
      run('UPDATE users SET name=?,handle=?,bio=?,location=?,avatar_url=?,cover_url=?,brands=?,onboarded=? WHERE id=?', name, handle, b.bio === undefined ? viewer.bio : text(b.bio, 500), b.location === undefined ? viewer.location : text(b.location, 100), b.avatarUrl === undefined ? viewer.avatar_url : image(b.avatarUrl), b.coverUrl === undefined ? viewer.cover_url : image(b.coverUrl), JSON.stringify(brands), b.onboarded === undefined ? viewer.onboarded : Number(Boolean(b.onboarded)), viewer.id);
      return ok({ user: publicUser(one<User>('SELECT * FROM users WHERE id=?', viewer.id)) });
    }
    return fail('İcazə verilmir.', 405);
  }

  if (section === 'feed' && method === 'GET') {
    const mode = req.nextUrl.searchParams.get('mode') || 'discover';
    const where = mode === 'mine' && viewer ? 'WHERE p.author_id=? OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id=?) OR p.club_id IN (SELECT club_id FROM club_members WHERE user_id=?)' : '';
    const args = where ? [viewer!.id, viewer!.id, viewer!.id] : [];
    const total = one<{ n: number }>(`SELECT count(*) n FROM posts p ${where}`, ...args)?.n || 0;
    const rows = all<R>(`SELECT p.* FROM posts p ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, ...args, limit, (p - 1) * limit);
    return ok(paginator(rows, total, p, x => post(x, viewer?.id)));
  }

  if (section === 'saved' && method === 'GET') {
    if (!viewer) return fail('Daxil olun.', 401);
    return ok({
      posts: all<R>('SELECT p.* FROM posts p JOIN post_saves s ON s.post_id=p.id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 100', viewer.id).map(x => post(x, viewer.id)),
      listings: all<R>('SELECT l.* FROM listings l JOIN listing_saves s ON s.listing_id=l.id WHERE s.user_id=? ORDER BY s.created_at DESC LIMIT 100', viewer.id).map(x => listing(x, viewer.id)),
    });
  }

  if (section === 'posts') {
    if (!key && method === 'POST') {
      if (!viewer) return fail('Daxil olun.', 401);
      if (!rateLimit(`post:${viewer.id}`, 20, 3600)) return fail('Bir az sonra paylaşın.', 429);
      const b = await body(req); const content = text(b.body, 5000); const pics = images(b.imageUrls);
      if (!content && !pics.length) return fail('Mətn və ya şəkil əlavə edin.');
      const clubId = b.clubId || null;
      if (clubId && !one('SELECT 1 FROM club_members WHERE club_id=? AND user_id=?', clubId, viewer.id)) return fail('Klubda paylaşmaq üçün üzv olun.', 403);
      const pid = id(); const t = now();
      run('INSERT INTO posts(id,author_id,club_id,body,category,image_urls,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', pid, viewer.id, clubId, content, text(b.category, 60) || 'Adi paylaşım', JSON.stringify(pics), t, t);
      return ok(post(one<R>('SELECT * FROM posts WHERE id=?', pid)!, viewer.id), 201);
    }
    const item = key ? one<R>('SELECT * FROM posts WHERE id=?', key) : null;
    if (!item) return fail('Paylaşım tapılmadı.', 404);
    if (!action && method === 'GET') return ok(post(item, viewer?.id, true));
    if (!viewer) return fail('Daxil olun.', 401);
    if (!action && method === 'PATCH') {
      if (item.author_id !== viewer.id) return fail('İcazə yoxdur.', 403);
      const b = await body(req); const content = text(b.body, 5000); const pics = images(b.imageUrls);
      if (!content && !pics.length) return fail('Mətn və ya şəkil əlavə edin.');
      run('UPDATE posts SET body=?,category=?,image_urls=?,updated_at=? WHERE id=?', content, text(b.category, 60) || item.category, JSON.stringify(pics), now(), key);
      return ok(post(one<R>('SELECT * FROM posts WHERE id=?', key)!, viewer.id, true));
    }
    if (!action && method === 'DELETE') {
      const moderator = item.club_id && one<{ role: string }>('SELECT role FROM club_members WHERE club_id=? AND user_id=?', item.club_id, viewer.id);
      if (item.author_id !== viewer.id && viewer.role !== 'admin' && !['admin', 'moderator'].includes(moderator?.role || '')) return fail('İcazə yoxdur.', 403);
      run('DELETE FROM posts WHERE id=?', key); return ok({ deleted: true });
    }
    if (action === 'like' && method === 'POST') {
      const active = toggle('post_likes', 'post_id', key, 'user_id', viewer.id);
      if (active) notify(item.author_id, viewer.id, 'like', `${viewer.name} paylaşımını bəyəndi`, `/posts/${key}`);
      return ok({ liked: active, likesCount: one<{ n: number }>('SELECT count(*) n FROM post_likes WHERE post_id=?', key)?.n || 0 });
    }
    if (action === 'save' && method === 'POST') return ok({ saved: toggle('post_saves', 'post_id', key, 'user_id', viewer.id) });
    if (action === 'report' && method === 'POST') return report(viewer, 'post', key, text((await body(req)).reason, 500));
    if (action === 'comments' && method === 'POST') {
      if (!rateLimit(`comment:${viewer.id}`, 60, 3600)) return fail('Bir az sonra şərh yazın.', 429);
      const content = text((await body(req)).body, 1000); if (!content) return fail('Şərh yazın.');
      const cid = id(); run('INSERT INTO comments(id,post_id,author_id,body,created_at) VALUES(?,?,?,?,?)', cid, key, viewer.id, content, now());
      notify(item.author_id, viewer.id, 'comment', `${viewer.name} paylaşımına şərh yazdı`, `/posts/${key}`);
      return ok({ id: cid, body: content, author: publicUser(viewer), createdAt: now() }, 201);
    }
  }

  if (section === 'clubs') {
    if (!key && method === 'GET') return ok(all<R>('SELECT * FROM clubs WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? ORDER BY CASE WHEN model IS NULL THEN 0 ELSE 1 END,name LIMIT 100', `%${q}%`, `%${q}%`, `%${q}%`).map(x => club(x, viewer?.id)));
    const item = key ? one<R>('SELECT * FROM clubs WHERE id=? OR slug=?', key, key) : null;
    if (!item) return fail('Klub tapılmadı.', 404);
    if (method === 'GET') {
      const posts = all<R>('SELECT * FROM posts WHERE club_id=? ORDER BY created_at DESC LIMIT 30', item.id).map(x => post(x, viewer?.id));
      const members = all<User & { club_role: string }>('SELECT u.*,cm.role club_role FROM club_members cm JOIN users u ON u.id=cm.user_id WHERE cm.club_id=? ORDER BY cm.created_at DESC LIMIT 40', item.id).map(u => ({ ...publicUser(u), clubRole: u.club_role }));
      const events = all<R>('SELECT * FROM events WHERE club_id=? ORDER BY starts_at LIMIT 10', item.id).map(x => event(x, viewer?.id));
      const listings = all<R>('SELECT * FROM listings WHERE status=? AND brand=? ORDER BY created_at DESC LIMIT 10', 'active', item.brand).map(x => listing(x, viewer?.id));
      return ok({ ...club(item, viewer?.id), posts, members, events, listings });
    }
    if (!viewer) return fail('Daxil olun.', 401);
    if (action === 'join' && method === 'POST') {
      const joined = toggle('club_members', 'club_id', item.id, 'user_id', viewer.id);
      if (joined) {
        const leaders = all<{ user_id: string }>("SELECT user_id FROM club_members WHERE club_id=? AND role IN ('admin','moderator')", item.id);
        for (const leader of leaders) notify(leader.user_id, viewer.id, 'club', `${viewer.name} ${item.name} klubuna qoşuldu`, `/clubs/${item.slug}`);
      }
      return ok({ joined, memberCount: club(item, viewer.id).memberCount });
    }
    if (action === 'members' && parts[3] && method === 'POST') {
      const ownRole = one<{ role: string }>('SELECT role FROM club_members WHERE club_id=? AND user_id=?', item.id, viewer.id)?.role;
      const member = one<{ role: string }>('SELECT role FROM club_members WHERE club_id=? AND user_id=?', item.id, parts[3]);
      if (!member || (!['admin', 'moderator'].includes(ownRole || '') && viewer.role !== 'admin')) return fail('İcazə yoxdur.', 403);
      if (member.role === 'admin' && viewer.role !== 'admin') return fail('Klub rəhbərini çıxarmaq mümkün deyil.', 403);
      const b = await body(req);
      if (b.role === 'remove') { run('DELETE FROM club_members WHERE club_id=? AND user_id=?', item.id, parts[3]); return ok({ removed: true }); }
      if (!['member', 'moderator'].includes(b.role) || (ownRole !== 'admin' && viewer.role !== 'admin')) return fail('İcazə yoxdur.', 403);
      run('UPDATE club_members SET role=? WHERE club_id=? AND user_id=?', b.role, item.id, parts[3]);
      return ok({ role: b.role });
    }
  }

  if (section === 'vehicles') {
    if (!key && method === 'GET') { if (!viewer) return fail('Daxil olun.', 401); return ok(all<R>('SELECT * FROM vehicles WHERE user_id=? ORDER BY created_at DESC', viewer.id).map(vehicle)); }
    if (!viewer) return fail('Daxil olun.', 401);
    if (!key && method === 'POST') {
      const b = await body(req); const brand = text(b.brand, 60), model = text(b.model, 80), year = Number(b.year);
      if (!brand || !model || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) return fail('Marka, model və ili yoxlayın.');
      const vid = id();
      run('INSERT INTO vehicles(id,user_id,brand,model,year,engine,fuel,transmission,color,mileage,description,modifications,image_urls,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', vid, viewer.id, brand, model, year, text(b.engine, 80), text(b.fuel, 40), text(b.transmission, 40), text(b.color, 40), b.mileage === '' || b.mileage == null ? null : Math.max(0, Number(b.mileage)), text(b.description, 2000), JSON.stringify(Array.isArray(b.modifications) ? b.modifications.filter((x: unknown) => typeof x === 'string').slice(0, 30) : []), JSON.stringify(images(b.imageUrls)), now());
      return ok(vehicle(one<R>('SELECT * FROM vehicles WHERE id=?', vid)!), 201);
    }
    const item = key ? one<R>('SELECT * FROM vehicles WHERE id=?', key) : null;
    if (!item) return fail('Avtomobil tapılmadı.', 404);
    if (!mutualAllowed(viewer.id, item.user_id)) return fail('Bu avtomobilə giriş yoxdur.', 403);
    if (method === 'GET' && !action) {
      const owner = one<User>('SELECT * FROM users WHERE id=?', item.user_id);
      const updates = all<R>('SELECT * FROM vehicle_updates WHERE vehicle_id=? ORDER BY created_at DESC LIMIT 50', key).map(x => ({ id: x.id, title: x.title, body: x.body, imageUrls: images(JSON.parse(x.image_urls)), createdAt: x.created_at }));
      const followers = one<{ n: number }>('SELECT count(*) n FROM vehicle_follows WHERE vehicle_id=?', key)?.n || 0;
      return ok({ ...vehicle(item), owner: publicUser(owner), updates, followers, following: Boolean(one('SELECT 1 FROM vehicle_follows WHERE vehicle_id=? AND user_id=?', key, viewer.id)) });
    }
    if (action === 'follow' && method === 'POST') {
      if (item.user_id === viewer.id) return fail('Öz avtomobilini izləmək mümkün deyil.');
      const following = toggle('vehicle_follows', 'vehicle_id', key!, 'user_id', viewer.id);
      if (following) notify(item.user_id, viewer.id, 'vehicle', `${viewer.name} ${item.brand} ${item.model} avtomobilini izləməyə başladı`, `/vehicles/${key}`);
      return ok({ following, followers: one<{ n: number }>('SELECT count(*) n FROM vehicle_follows WHERE vehicle_id=?', key)?.n || 0 });
    }
    if (action === 'updates' && method === 'POST') {
      if (item.user_id !== viewer.id) return fail('İcazə yoxdur.', 403);
      const b = await body(req); const title = text(b.title, 120), content = text(b.body, 3000), pics = images(b.imageUrls);
      if (title.length < 3 || (!content && !pics.length)) return fail('Başlıq və qeyd və ya şəkil əlavə edin.');
      if (!rateLimit(`vehicle-update:${viewer.id}`, 20, 3600)) return fail('Bir az sonra yenidən cəhd edin.', 429);
      const updateId = id();
      run('INSERT INTO vehicle_updates(id,vehicle_id,author_id,title,body,image_urls,created_at) VALUES(?,?,?,?,?,?,?)', updateId, key, viewer.id, title, content, JSON.stringify(pics), now());
      return ok({ id: updateId }, 201);
    }
    if (action === 'updates' && parts[3] && method === 'DELETE') {
      if (item.user_id !== viewer.id) return fail('İcazə yoxdur.', 403);
      const deleted = run('DELETE FROM vehicle_updates WHERE id=? AND vehicle_id=?', parts[3], key);
      return deleted.changes ? ok({ deleted: true }) : fail('Qeyd tapılmadı.', 404);
    }
    if (item.user_id !== viewer.id) return fail('İcazə yoxdur.', 403);
    if (method === 'DELETE') { run('DELETE FROM vehicles WHERE id=?', key); return ok({ deleted: true }); }
    if (method === 'PATCH') {
      const b = await body(req); const year = b.year === undefined ? item.year : Number(b.year);
      if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) return fail('İli yoxlayın.');
      run('UPDATE vehicles SET brand=?,model=?,year=?,engine=?,fuel=?,transmission=?,color=?,mileage=?,description=?,modifications=?,image_urls=? WHERE id=?', b.brand === undefined ? item.brand : text(b.brand, 60), b.model === undefined ? item.model : text(b.model, 80), year, b.engine === undefined ? item.engine : text(b.engine, 80), b.fuel === undefined ? item.fuel : text(b.fuel, 40), b.transmission === undefined ? item.transmission : text(b.transmission, 40), b.color === undefined ? item.color : text(b.color, 40), b.mileage === undefined ? item.mileage : b.mileage === '' ? null : Math.max(0, Number(b.mileage)), b.description === undefined ? item.description : text(b.description, 2000), b.modifications === undefined ? item.modifications : JSON.stringify(Array.isArray(b.modifications) ? b.modifications : []), b.imageUrls === undefined ? item.image_urls : JSON.stringify(images(b.imageUrls)), key);
      return ok(vehicle(one<R>('SELECT * FROM vehicles WHERE id=?', key)!));
    }
  }

  if (section === 'users' && key) {
    const person = one<User>('SELECT * FROM users WHERE id=? OR handle=?', key, key);
    if (!person) return fail('İstifadəçi tapılmadı.', 404);
    if (!action && method === 'GET') return ok({ ...publicUser(person), counts: userCounts(person.id), followed: Boolean(viewer && one('SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?', viewer.id, person.id)), blocked: Boolean(viewer && one('SELECT 1 FROM user_blocks WHERE blocker_id=? AND blocked_id=?', viewer.id, person.id)), posts: all<R>('SELECT * FROM posts WHERE author_id=? ORDER BY created_at DESC LIMIT 30', person.id).map(x => post(x, viewer?.id)), vehicles: all<R>('SELECT * FROM vehicles WHERE user_id=? ORDER BY created_at DESC', person.id).map(vehicle), clubs: all<R>('SELECT c.* FROM clubs c JOIN club_members cm ON cm.club_id=c.id WHERE cm.user_id=? ORDER BY c.name', person.id).map(x => club(x, viewer?.id)) });
    if (!viewer) return fail('Daxil olun.', 401);
    if (viewer.id === person.id) return fail('Bu əməliyyat öz profilinizdə mümkün deyil.', 400);
    if (action === 'follow' && method === 'POST') {
      if (!mutualAllowed(viewer.id, person.id)) return fail('İcazə yoxdur.', 403);
      const followed = toggle('follows', 'follower_id', viewer.id, 'followee_id', person.id);
      if (followed) notify(person.id, viewer.id, 'follow', `${viewer.name} səni izləməyə başladı`, `/profile/${viewer.id}`);
      return ok({ followed, followers: userCounts(person.id).followers });
    }
    if (action === 'block' && method === 'POST') {
      const blocked = toggle('user_blocks', 'blocker_id', viewer.id, 'blocked_id', person.id);
      if (blocked) run('DELETE FROM follows WHERE (follower_id=? AND followee_id=?) OR (follower_id=? AND followee_id=?)', viewer.id, person.id, person.id, viewer.id);
      return ok({ blocked });
    }
    if (action === 'report' && method === 'POST') return report(viewer, 'user', person.id, text((await body(req)).reason, 500));
  }

  return dispatchMore(req, parts, viewer, q, p);
}

async function dispatchMore(req: NextRequest, parts: string[], viewer: User | null, q: string, p: number): Promise<NextResponse> {
  const method = req.method;
  const [section, key, action] = parts;
  if (section === 'conversations') {
    if (!viewer) return fail('Daxil olun.', 401);
    if (!key && method === 'GET') {
      const rows = all<R>('SELECT c.* FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id WHERE cm.user_id=? ORDER BY c.updated_at DESC LIMIT 100', viewer.id);
      return ok(rows.map(c => {
        const other = one<User>('SELECT u.* FROM conversation_members cm JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=? AND cm.user_id<>?', c.id, viewer.id);
        const last = one<R>('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 1', c.id);
        const member = one<R>('SELECT * FROM conversation_members WHERE conversation_id=? AND user_id=?', c.id, viewer.id);
        const unread = one<{ n: number }>('SELECT count(*) n FROM messages WHERE conversation_id=? AND sender_id<>? AND created_at>?', c.id, viewer.id, member?.last_read_at || '')?.n || 0;
        return { id: c.id, other: publicUser(other), lastMessage: last ? { id: last.id, body: last.body, senderId: last.sender_id, createdAt: last.created_at } : null, unread, updatedAt: c.updated_at, listingId: c.listing_id };
      }));
    }
    if (!key && method === 'POST') {
      const b = await body(req);
      const other = one<User>('SELECT * FROM users WHERE id=?', b.userId);
      if (!other || other.id === viewer.id) return fail('İstifadəçi tapılmadı.', 404);
      if (!mutualAllowed(viewer.id, other.id)) return fail('Bu istifadəçiyə mesaj göndərmək mümkün deyil.', 403);
      const listingId = b.listingId ? String(b.listingId) : null;
      if (listingId && !one('SELECT 1 FROM listings WHERE id=? AND seller_id=?', listingId, other.id)) return fail('Elan tapılmadı.', 404);
      const existing = one<R>('SELECT c.* FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=? JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=? WHERE c.listing_id IS ? LIMIT 1', viewer.id, other.id, listingId);
      if (existing) return ok({ id: existing.id });
      const cid = id(); const t = now();
      db().transaction(() => {
        run('INSERT INTO conversations(id,listing_id,created_at,updated_at) VALUES(?,?,?,?)', cid, listingId, t, t);
        run('INSERT INTO conversation_members(conversation_id,user_id,last_read_at) VALUES(?,?,?)', cid, viewer.id, t);
        run('INSERT INTO conversation_members(conversation_id,user_id,last_read_at) VALUES(?,?,?)', cid, other.id, t);
      })();
      return ok({ id: cid }, 201);
    }
    const conv = key ? one<R>('SELECT * FROM conversations WHERE id=?', key) : null;
    if (!conv || !one('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id=?', key, viewer.id)) return fail('Söhbət tapılmadı.', 404);
    const other = one<User>('SELECT u.* FROM conversation_members cm JOIN users u ON u.id=cm.user_id WHERE cm.conversation_id=? AND cm.user_id<>?', key, viewer.id);
    if (!other || !mutualAllowed(viewer.id, other.id)) return fail('Bu söhbətə giriş yoxdur.', 403);
    if (action === 'messages' && method === 'GET') {
      run('UPDATE conversation_members SET last_read_at=? WHERE conversation_id=? AND user_id=?', now(), key, viewer.id);
      const rows = all<R>('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 100 OFFSET ?', key, (p - 1) * 100).reverse();
      return ok({ conversation: { id: key, other: publicUser(other), listingId: conv.listing_id }, items: rows.map(m => ({ id: m.id, body: m.body, senderId: m.sender_id, createdAt: m.created_at, read: Boolean(one('SELECT 1 FROM conversation_members WHERE conversation_id=? AND user_id<>? AND last_read_at>=?', key, m.sender_id, m.created_at)) })), hasMore: rows.length === 100 });
    }
    if (action === 'messages' && method === 'POST') {
      if (!rateLimit(`message:${viewer.id}`, 100, 3600)) return fail('Bir az sonra mesaj göndərin.', 429);
      const content = text((await body(req)).body, 4000); if (!content) return fail('Mesaj yazın.');
      const mid = id(); const t = now();
      db().transaction(() => { run('INSERT INTO messages(id,conversation_id,sender_id,body,created_at) VALUES(?,?,?,?,?)', mid, key, viewer.id, content, t); run('UPDATE conversations SET updated_at=? WHERE id=?', t, key); run('UPDATE conversation_members SET last_read_at=? WHERE conversation_id=? AND user_id=?', t, key, viewer.id); })();
      notify(other.id, viewer.id, 'message', `${viewer.name} sənə mesaj göndərdi`, `/messages/${key}`);
      return ok({ id: mid, body: content, senderId: viewer.id, createdAt: t, read: false }, 201);
    }
  }

  if (section === 'listings' || section === 'marketplace') {
    if (!key && method === 'GET') {
      const filters: string[] = ['1=1']; const args: unknown[] = [];
      const params = req.nextUrl.searchParams;
      if (q) { filters.push('(l.title LIKE ? OR l.description LIKE ? OR l.brand LIKE ? OR l.model LIKE ?)'); args.push(...Array(4).fill(`%${q}%`)); }
      for (const field of ['category', 'brand', 'model', 'condition', 'status'] as const) { const value = params.get(field); if (value) { filters.push(`l.${field}=?`); args.push(value); } }
      if (!params.get('status')) filters.push("l.status='active'");
      const min = Number(params.get('minPrice')), max = Number(params.get('maxPrice'));
      if (params.get('minPrice') && Number.isFinite(min)) { filters.push('l.price>=?'); args.push(min); }
      if (params.get('maxPrice') && Number.isFinite(max)) { filters.push('l.price<=?'); args.push(max); }
      const where = `WHERE ${filters.join(' AND ')}`;
      const total = one<{ n: number }>(`SELECT count(*) n FROM listings l ${where}`, ...args)?.n || 0;
      const rows = all<R>(`SELECT l.* FROM listings l ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, ...args, limit, (p - 1) * limit);
      return ok(paginator(rows, total, p, x => listing(x, viewer?.id)));
    }
    if (!key && method === 'POST') {
      if (!viewer) return fail('Daxil olun.', 401);
      if (!rateLimit(`listing:${viewer.id}`, 30, 86400)) return fail('Bir az sonra elan yerləşdirin.', 429);
      const b = await body(req); const title = text(b.title, 120), description = text(b.description, 4000), price = Number(b.price);
      if (title.length < 5 || description.length < 10 || !Number.isInteger(price) || price < 0 || price > 10_000_000 || !text(b.category, 60) || !text(b.location, 100) || !['new', 'used'].includes(b.condition)) return fail('Elan məlumatlarını yoxlayın.');
      const lid = id(), t = now();
      run('INSERT INTO listings(id,seller_id,title,description,category,brand,model,price,condition,location,image_urls,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', lid, viewer.id, title, description, text(b.category, 60), text(b.brand, 60) || null, text(b.model, 80) || null, price, b.condition, text(b.location, 100), JSON.stringify(images(b.imageUrls)), t, t);
      return ok(listing(one<R>('SELECT * FROM listings WHERE id=?', lid)!, viewer.id), 201);
    }
    const item = key ? one<R>('SELECT * FROM listings WHERE id=?', key) : null;
    if (!item) return fail('Elan tapılmadı.', 404);
    if (!action && method === 'GET') return ok(listing(item, viewer?.id));
    if (!viewer) return fail('Daxil olun.', 401);
    if (!action && method === 'PATCH') {
      if (item.seller_id !== viewer.id) return fail('İcazə yoxdur.', 403);
      const b = await body(req); const price = b.price === undefined ? item.price : Number(b.price);
      if (!Number.isInteger(price) || price < 0 || price > 10_000_000) return fail('Qiyməti yoxlayın.');
      const status = b.status === undefined ? item.status : b.status; if (!['active', 'sold'].includes(status)) return fail('Statusu yoxlayın.');
      run('UPDATE listings SET title=?,description=?,category=?,brand=?,model=?,price=?,condition=?,location=?,image_urls=?,status=?,updated_at=? WHERE id=?', b.title === undefined ? item.title : text(b.title, 120), b.description === undefined ? item.description : text(b.description, 4000), b.category === undefined ? item.category : text(b.category, 60), b.brand === undefined ? item.brand : text(b.brand, 60) || null, b.model === undefined ? item.model : text(b.model, 80) || null, price, b.condition === undefined ? item.condition : b.condition, b.location === undefined ? item.location : text(b.location, 100), b.imageUrls === undefined ? item.image_urls : JSON.stringify(images(b.imageUrls)), status, now(), key);
      return ok(listing(one<R>('SELECT * FROM listings WHERE id=?', key)!, viewer.id));
    }
    if (action === 'save' && method === 'POST') return ok({ saved: toggle('listing_saves', 'listing_id', key, 'user_id', viewer.id) });
    if (action === 'report' && method === 'POST') return report(viewer, 'listing', key, text((await body(req)).reason, 500));
  }

  if (section === 'events') {
    if (!key && method === 'GET') {
      const filters = ['e.starts_at>=?']; const args: unknown[] = [new Date(Date.now() - 86400_000).toISOString()];
      if (q) { filters.push('(e.title LIKE ? OR e.location LIKE ? OR e.description LIKE ?)'); args.push(...Array(3).fill(`%${q}%`)); }
      for (const field of ['category', 'club_id'] as const) { const value = req.nextUrl.searchParams.get(field === 'club_id' ? 'clubId' : field); if (value) { filters.push(`e.${field}=?`); args.push(value); } }
      const where = `WHERE ${filters.join(' AND ')}`;
      const total = one<{ n: number }>(`SELECT count(*) n FROM events e ${where}`, ...args)?.n || 0;
      const rows = all<R>(`SELECT e.* FROM events e ${where} ORDER BY e.starts_at ASC LIMIT ? OFFSET ?`, ...args, limit, (p - 1) * limit);
      return ok(paginator(rows, total, p, x => event(x, viewer?.id)));
    }
    if (!key && method === 'POST') {
      if (!viewer) return fail('Daxil olun.', 401);
      if (!rateLimit(`event:${viewer.id}`, 10, 86400)) return fail('Bir az sonra tədbir yaradın.', 429);
      const b = await body(req); const title = text(b.title, 120), description = text(b.description, 4000), date = new Date(b.startsAt);
      if (title.length < 5 || description.length < 10 || !text(b.category, 60) || !text(b.location, 100) || !Number.isFinite(date.getTime()) || date.getTime() < Date.now()) return fail('Tədbir məlumatlarını yoxlayın.');
      if (b.clubId && !one('SELECT 1 FROM club_members WHERE club_id=? AND user_id=?', b.clubId, viewer.id)) return fail('Klubda tədbir yaratmaq üçün üzv olun.', 403);
      const eid = id(), t = now();
      run('INSERT INTO events(id,creator_id,club_id,title,description,category,starts_at,location,address,latitude,longitude,cover_url,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', eid, viewer.id, b.clubId || null, title, description, text(b.category, 60), date.toISOString(), text(b.location, 100), text(b.address, 200) || null, b.latitude == null ? null : Number(b.latitude), b.longitude == null ? null : Number(b.longitude), image(b.coverUrl), t, t);
      run('INSERT INTO event_attendees(event_id,user_id,created_at) VALUES(?,?,?)', eid, viewer.id, t);
      return ok(event(one<R>('SELECT * FROM events WHERE id=?', eid)!, viewer.id), 201);
    }
    const item = key ? one<R>('SELECT * FROM events WHERE id=?', key) : null;
    if (!item) return fail('Tədbir tapılmadı.', 404);
    if (!action && method === 'GET') return ok({ ...event(item, viewer?.id), attendees: all<User>('SELECT u.* FROM event_attendees ea JOIN users u ON u.id=ea.user_id WHERE ea.event_id=? ORDER BY ea.created_at LIMIT 40', key).map(publicUser) });
    if (!viewer) return fail('Daxil olun.', 401);
    if (action === 'join' && method === 'POST') {
      const joined = toggle('event_attendees', 'event_id', key, 'user_id', viewer.id);
      if (joined) notify(item.creator_id, viewer.id, 'event', `${viewer.name} tədbirinə qoşuldu`, `/events/${key}`);
      return ok({ joined, attendeeCount: event(item, viewer.id).attendeeCount });
    }
    if (!action && method === 'PATCH') {
      if (item.creator_id !== viewer.id) return fail('İcazə yoxdur.', 403);
      const b = await body(req); const date = b.startsAt === undefined ? new Date(item.starts_at) : new Date(b.startsAt);
      if (!Number.isFinite(date.getTime())) return fail('Tarixi yoxlayın.');
      run('UPDATE events SET title=?,description=?,category=?,starts_at=?,location=?,address=?,cover_url=?,updated_at=? WHERE id=?', b.title === undefined ? item.title : text(b.title, 120), b.description === undefined ? item.description : text(b.description, 4000), b.category === undefined ? item.category : text(b.category, 60), date.toISOString(), b.location === undefined ? item.location : text(b.location, 100), b.address === undefined ? item.address : text(b.address, 200), b.coverUrl === undefined ? item.cover_url : image(b.coverUrl), now(), key);
      const attendees = all<{ user_id: string }>('SELECT user_id FROM event_attendees WHERE event_id=?', key);
      for (const attendee of attendees) notify(attendee.user_id, viewer.id, 'event', `${viewer.name} tədbir məlumatlarını yenilədi`, `/events/${key}`);
      return ok(event(one<R>('SELECT * FROM events WHERE id=?', key)!, viewer.id));
    }
    if (action === 'report' && method === 'POST') return report(viewer, 'event', key, text((await body(req)).reason, 500));
  }

  if (section === 'notifications') {
    if (!viewer) return fail('Daxil olun.', 401);
    if (!key && method === 'GET') return ok(all<R>('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', viewer.id).map(n => ({ id: n.id, type: n.type, text: n.text, href: n.href, read: Boolean(n.read_at), createdAt: n.created_at, actor: n.actor_id ? publicUser(one<User>('SELECT * FROM users WHERE id=?', n.actor_id)) : null })));
    if (key && action === 'read' && method === 'POST') { run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?', now(), key, viewer.id); return ok({ read: true }); }
  }

  if (section === 'search' && method === 'GET') {
    if (q.length < 2) return ok({ people: [], clubs: [], posts: [], listings: [], events: [] });
    const pattern = `%${q}%`;
    return ok({
      people: all<User>('SELECT * FROM users WHERE name LIKE ? OR handle LIKE ? LIMIT 8', pattern, pattern).map(publicUser),
      clubs: all<R>('SELECT * FROM clubs WHERE name LIKE ? OR brand LIKE ? OR model LIKE ? LIMIT 8', pattern, pattern, pattern).map(x => club(x, viewer?.id)),
      posts: all<R>('SELECT * FROM posts WHERE body LIKE ? ORDER BY created_at DESC LIMIT 8', pattern).map(x => post(x, viewer?.id)),
      listings: all<R>("SELECT * FROM listings WHERE status='active' AND (title LIKE ? OR brand LIKE ? OR model LIKE ?) ORDER BY created_at DESC LIMIT 8", pattern, pattern, pattern).map(x => listing(x, viewer?.id)),
      events: all<R>('SELECT * FROM events WHERE title LIKE ? OR location LIKE ? ORDER BY starts_at LIMIT 8', pattern, pattern).map(x => event(x, viewer?.id)),
    });
  }

  if (section === 'admin' && key === 'reports') {
    if (!viewer || viewer.role !== 'admin') return fail('İcazə yoxdur.', 403);
    if (!action && method === 'GET') return ok(all<R>('SELECT r.*, u.name reporter_name FROM reports r JOIN users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 100').map(r => ({ id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason, status: r.status, reporterName: r.reporter_name, createdAt: r.created_at })));
    if (action && parts[3] === 'resolve' && method === 'POST') {
      const status = (await body(req)).status;
      if (!['resolved', 'dismissed'].includes(status)) return fail('Statusu yoxlayın.');
      run('UPDATE reports SET status=?,resolved_at=? WHERE id=?', status, now(), action);
      return ok({ status });
    }
    if (action && parts[3] === 'action' && method === 'POST') {
      const item = one<R>('SELECT * FROM reports WHERE id=?', action);
      if (!item) return fail('Şikayət tapılmadı.', 404);
      if (item.status !== 'open') return fail('Şikayət artıq bağlanıb.', 409);
      const decision = (await body(req)).action;
      if (!['dismiss', 'remove', 'suspend'].includes(decision)) return fail('Əməliyyatı yoxlayın.');
      if (decision === 'remove') {
        const tables: Record<string, string> = { post: 'posts', listing: 'listings', event: 'events' };
        const table = tables[item.target_type];
        if (!table) return fail('Bu məzmunu silmək mümkün deyil.');
        run(`DELETE FROM ${table} WHERE id=?`, item.target_id);
      }
      if (decision === 'suspend') {
        if (item.target_type !== 'user' || item.target_id === viewer.id) return fail('Hesabı məhdudlaşdırmaq mümkün deyil.');
        run('INSERT OR IGNORE INTO user_suspensions(user_id,created_at,reason) VALUES(?,?,?)', item.target_id, now(), item.reason);
        run('DELETE FROM sessions WHERE user_id=?', item.target_id);
      }
      run('UPDATE reports SET status=?,resolved_at=? WHERE id=?', decision === 'dismiss' ? 'dismissed' : 'resolved', now(), action);
      return ok({ status: decision === 'dismiss' ? 'dismissed' : 'resolved', action: decision });
    }
  }
  return fail('Tapılmadı.', 404);
}

type Context = { params: Promise<{ path: string[] }> };
async function route(req: NextRequest, context: Context) {
  try { return await dispatch(req, (await context.params).path); }
  catch (error) {
    console.error('AVTOKLUB API error:', error);
    return fail('Sorğu icra edilmədi. Bir az sonra yenidən cəhd edin.', 500);
  }
}
export const GET = route;
export const POST = route;
export const PATCH = route;
export const DELETE = route;
