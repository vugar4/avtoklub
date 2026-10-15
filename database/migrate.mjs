import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATABASE_PATH || path.join(process.cwd(), '.data', 'avtoklub.sqlite');
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new Database(file);
db.pragma('foreign_keys = ON');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
const version = 1;
if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version)) {
  db.transaction(() => {
    db.exec(fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf8'));
    db.prepare('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)').run(version, new Date().toISOString());
  })();
  console.log(`Miqrasiya ${version} tətbiq edildi: ${file}`);
} else console.log(`Baza güncəldir: ${file}`);
db.close();
