import 'server-only';
import { all, jsonArray, one } from './db';
import { publicUser, User } from './auth';

// SQLite row values are validated and serialized at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
export function club(row: AnyRow, viewer?: string | null) {
  const memberCount = one<{ n: number }>('SELECT count(*) n FROM club_members WHERE club_id=?', row.id)?.n || 0;
  const member = viewer ? one<{ role: string }>('SELECT role FROM club_members WHERE club_id=? AND user_id=?', row.id, viewer) : null;
  return { id: row.id, slug: row.slug, name: row.name, brand: row.brand, model: row.model, description: row.description, coverUrl: row.cover_url, memberCount, joined: Boolean(member), role: member?.role || null };
}
export function vehicle(row: AnyRow) {
  return { id: row.id, userId: row.user_id, brand: row.brand, model: row.model, year: row.year, engine: row.engine, fuel: row.fuel, transmission: row.transmission, color: row.color, mileage: row.mileage, description: row.description, modifications: jsonArray(row.modifications), imageUrls: jsonArray(row.image_urls), createdAt: row.created_at };
}
export function post(row: AnyRow, viewer?: string | null, includeComments = false) {
  const author = one<User>('SELECT * FROM users WHERE id=?', row.author_id);
  const postClub = row.club_id ? one<AnyRow>('SELECT * FROM clubs WHERE id=?', row.club_id) : null;
  const result: AnyRow = {
    id: row.id, body: row.body, category: row.category, imageUrls: jsonArray(row.image_urls), createdAt: row.created_at, updatedAt: row.updated_at,
    likesCount: one<{ n: number }>('SELECT count(*) n FROM post_likes WHERE post_id=?', row.id)?.n || 0,
    commentsCount: one<{ n: number }>('SELECT count(*) n FROM comments WHERE post_id=?', row.id)?.n || 0,
    liked: Boolean(viewer && one('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?', row.id, viewer)),
    saved: Boolean(viewer && one('SELECT 1 FROM post_saves WHERE post_id=? AND user_id=?', row.id, viewer)),
    author: publicUser(author), club: postClub ? { id: postClub.id, name: postClub.name, slug: postClub.slug } : null,
  };
  if (includeComments) result.comments = all<AnyRow>('SELECT * FROM comments WHERE post_id=? ORDER BY created_at ASC LIMIT 100', row.id).map(c => ({ id: c.id, body: c.body, createdAt: c.created_at, author: publicUser(one<User>('SELECT * FROM users WHERE id=?', c.author_id)) }));
  return result;
}
export function listing(row: AnyRow, viewer?: string | null) {
  return { id: row.id, sellerId: row.seller_id, title: row.title, description: row.description, category: row.category, brand: row.brand, model: row.model, price: row.price, condition: row.condition, location: row.location, imageUrls: jsonArray(row.image_urls), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, seller: publicUser(one<User>('SELECT * FROM users WHERE id=?', row.seller_id)), saved: Boolean(viewer && one('SELECT 1 FROM listing_saves WHERE listing_id=? AND user_id=?', row.id, viewer)) };
}
export function event(row: AnyRow, viewer?: string | null) {
  const eventClub = row.club_id ? one<AnyRow>('SELECT * FROM clubs WHERE id=?', row.club_id) : null;
  return { id: row.id, creatorId: row.creator_id, clubId: row.club_id, title: row.title, description: row.description, category: row.category, startsAt: row.starts_at, location: row.location, address: row.address, latitude: row.latitude, longitude: row.longitude, coverUrl: row.cover_url, createdAt: row.created_at, attendeeCount: one<{ n: number }>('SELECT count(*) n FROM event_attendees WHERE event_id=?', row.id)?.n || 0, joined: Boolean(viewer && one('SELECT 1 FROM event_attendees WHERE event_id=? AND user_id=?', row.id, viewer)), creator: publicUser(one<User>('SELECT * FROM users WHERE id=?', row.creator_id)), club: eventClub ? { id: eventClub.id, name: eventClub.name, slug: eventClub.slug } : null };
}
