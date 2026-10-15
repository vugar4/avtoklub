import 'server-only';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { id, now, one, run } from './db';

export const COOKIE = 'avtoklub_session';
export type User = { id: string; name: string; handle: string; email: string; bio: string; location: string; avatar_url: string | null; cover_url: string | null; brands: string; onboarded: number; role: string; created_at: string };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const user = one<User>('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', hash(token), now());
  if (user && one('SELECT 1 FROM user_suspensions WHERE user_id=?', user.id)) return null;
  return user || null;
}
export function publicUser(user: Partial<User> | null | undefined) {
  if (!user) return null;
  return { id: user.id, name: user.name, handle: user.handle, bio: user.bio || '', location: user.location || '', avatarUrl: user.avatar_url || null, coverUrl: user.cover_url || null, brands: JSON.parse(user.brands || '[]'), onboarded: Boolean(user.onboarded), role: user.role || 'user', createdAt: user.created_at };
}
export async function makeSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + 30 * 86400_000);
  run('INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)', id(), userId, hash(token), expires.toISOString(), now());
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires });
}
export async function clearSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) run('DELETE FROM sessions WHERE token_hash=?', hash(token));
  (await cookies()).delete(COOKIE);
}
export const passwordHash = (password: string) => bcrypt.hashSync(password, 12);
export const verifyPassword = (password: string, digest: string) => bcrypt.compareSync(password, digest);
export function rateLimit(key: string, limit: number, seconds: number) {
  const existing = one<{ count: number; reset_at: string }>('SELECT * FROM rate_limits WHERE key=?', key);
  if (!existing || existing.reset_at < now()) {
    run('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,reset_at=excluded.reset_at', key, 1, new Date(Date.now() + seconds * 1000).toISOString());
    return true;
  }
  if (existing.count >= limit) return false;
  run('UPDATE rate_limits SET count=count+1 WHERE key=?', key);
  return true;
}
export function userCounts(userId: string) {
  return {
    posts: one<{ n: number }>('SELECT count(*) n FROM posts WHERE author_id=?', userId)?.n || 0,
    vehicles: one<{ n: number }>('SELECT count(*) n FROM vehicles WHERE user_id=?', userId)?.n || 0,
    followers: one<{ n: number }>('SELECT count(*) n FROM follows WHERE followee_id=?', userId)?.n || 0,
    following: one<{ n: number }>('SELECT count(*) n FROM follows WHERE follower_id=?', userId)?.n || 0,
    clubs: one<{ n: number }>('SELECT count(*) n FROM club_members WHERE user_id=?', userId)?.n || 0,
    unread: one<{ n: number }>('SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL', userId)?.n || 0,
  };
}
export function mutualAllowed(a: string, b: string) {
  return !one('SELECT 1 FROM user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)', a, b, b, a);
}
export function notify(userId: string, actorId: string, type: string, text: string, href: string) {
  if (userId === actorId) return;
  run('INSERT INTO notifications(id,user_id,actor_id,type,text,href,created_at) VALUES(?,?,?,?,?,?,?)', id(), userId, actorId, type, text, href, now());
}
