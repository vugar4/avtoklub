export type User = { id: string; name: string; handle: string; avatarUrl?: string | null; coverUrl?: string | null; bio?: string | null; location?: string | null; role?: string; onboarded?: boolean; brands?: string[] };
export type Club = { id: string; name: string; slug: string; brand: string; model?: string | null; description: string; coverUrl?: string | null; memberCount: number; joined: boolean; role?: string | null };
export type Comment = { id: string; body: string; createdAt: string; author: User };
export type Post = { id: string; body: string; category: string; imageUrls: string[]; createdAt: string; updatedAt: string; likesCount: number; commentsCount: number; liked: boolean; saved: boolean; author: User; club?: Pick<Club,"id"|"name"|"slug"> | null; comments?: Comment[] };
export type Vehicle = { id: string; userId: string; brand: string; model: string; year: number; engine?: string | null; fuel: string; transmission: string; color: string; mileage?: number | null; description?: string | null; modifications: string[]; imageUrls: string[]; createdAt: string };
export type Listing = { id: string; sellerId: string; title: string; description: string; category: string; brand?: string | null; model?: string | null; price: number; condition: "new"|"used"; location: string; imageUrls: string[]; status: "active"|"sold"; createdAt: string; seller: User; saved: boolean };
export type Event = { id: string; creatorId: string; clubId?: string | null; title: string; description: string; category: string; startsAt: string; location: string; address?: string | null; latitude?: number | null; longitude?: number | null; coverUrl?: string | null; attendeeCount: number; joined: boolean; createdAt: string; creator: User; club?: Club | null };
export type ApiError = Error & { status?: number };

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers: options?.body instanceof FormData ? options.headers : { "Content-Type": "application/json", ...options?.headers } });
  let payload: { data?: T; error?: string } = {};
  try { payload = await response.json(); } catch { /* server error */ }
  if (!response.ok) { const error = new Error(payload.error || "Əməliyyat alınmadı. Yenidən cəhd edin.") as ApiError; error.status = response.status; throw error; }
  return payload.data as T;
}

export const post = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });
export async function upload(file: File) { const body = new FormData(); body.append("file", file); return api<{url:string}>("/api/media", { method: "POST", body }); }
const azMonths = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
export function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : `${date.getDate()} ${azMonths[date.getMonth()]} ${date.getFullYear()}`; }
export function relativeDate(value: string) { const d = Date.now() - new Date(value).getTime(); if (d < 3600000) return `${Math.max(1,Math.floor(d/60000))} dəq`; if (d < 86400000) return `${Math.floor(d/3600000)} saat`; if (d < 604800000) return `${Math.floor(d/86400000)} gün`; return formatDate(value); }
export function money(value: number) { return new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 0 }).format(value) + " ₼"; }
