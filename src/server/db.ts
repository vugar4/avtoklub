import 'server-only';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const state = globalThis as unknown as { avtoklubDb?: Database.Database };

export function db() {
  if (state.avtoklubDb) return state.avtoklubDb;
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), '.data', 'avtoklub.sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const instance = new Database(file);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.exec(fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8'));
  state.avtoklubDb = instance;
  return instance;
}

export type Row = Record<string, unknown>;
export function one<T = Row>(sql: string, ...args: unknown[]): T | undefined {
  return db().prepare(sql).get(...args) as T | undefined;
}
export function all<T = Row>(sql: string, ...args: unknown[]): T[] {
  return db().prepare(sql).all(...args) as T[];
}
export function run(sql: string, ...args: unknown[]) {
  return db().prepare(sql).run(...args);
}
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export function jsonArray(value: unknown): string[] {
  try { const a = JSON.parse(String(value || '[]')); return Array.isArray(a) ? a : []; } catch { return []; }
}
