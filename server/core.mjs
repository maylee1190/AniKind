import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const now = () => new Date().toISOString();
export const uid = () => randomUUID();
export class ApiError extends Error {
  constructor(status, code, message, fields) { super(message); Object.assign(this, { status, code, fields }); }
}
export const fail = (status, code, message, fields) => { throw new ApiError(status, code, message, fields); };
export function assert(condition, message, code = 'VALIDATION_ERROR') { if (!condition) fail(422, code, message); }
export const text = (value, max = 5000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const count = value => [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(value)].length;
export function date(value) {
  if (!value) return null;
  const parsed = new Date(value);
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, '请填写有效日期');
  return value;
}
export function secureURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function openStore(directory = process.env.DATA_DIR || resolve(ROOT, 'data')) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(resolve(directory, 'anikind.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', data TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, type TEXT NOT NULL, owner_id TEXT, pet_id TEXT, status TEXT, version INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_owner_type ON records(owner_id, type);
    CREATE INDEX IF NOT EXISTS records_pet ON records(pet_id);
    CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE, bytes BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS idempotency (owner_id TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, result_id TEXT NOT NULL, PRIMARY KEY(owner_id,key));
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, object_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const unpack = r => r ? { ...JSON.parse(r.data), id: r.id, type: r.type, ownerId: r.owner_id, petId: r.pet_id, status: r.status, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at } : null;
  const store = {
    db, directory,
    get: id => unpack(db.prepare('SELECT * FROM records WHERE id=?').get(id)),
    list(type, owner) { return db.prepare(owner === undefined ? 'SELECT * FROM records WHERE type=? ORDER BY created_at DESC' : 'SELECT * FROM records WHERE type=? AND owner_id=? ORDER BY created_at DESC').all(...(owner === undefined ? [type] : [type, owner])).map(unpack); },
    create(type, data, { owner = null, pet = null, status = null, id = uid() } = {}) {
      const time = now();
      db.prepare('INSERT INTO records VALUES(?,?,?,?,?,1,?,?,?)').run(id, type, owner, pet, status, JSON.stringify(data), time, time);
      return store.get(id);
    },
    update(id, data, version, status) {
      const old = store.get(id);
      if (!old) fail(404, 'NOT_FOUND', '内容不存在或已删除');
      if (version !== undefined && version !== old.version) fail(409, 'VERSION_CONFLICT', '内容已更新，请重新打开后再修改', { currentVersion: old.version });
      const { id: _, type, ownerId, petId, createdAt, updatedAt, status: oldStatus, version: oldVersion, ...body } = old;
      db.prepare('UPDATE records SET data=?,version=version+1,status=?,updated_at=? WHERE id=?').run(JSON.stringify({ ...body, ...data }), status === undefined ? oldStatus : status, now(), id);
      return store.get(id);
    },
    remove: id => db.prepare('DELETE FROM records WHERE id=?').run(id),
    owned(id, owner, type) { const r = store.get(id); if (!r || r.ownerId !== owner || r.type !== type) fail(404, 'NOT_FOUND', '内容不存在或无权访问'); return r; },
    tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const value = fn(); db.exec('COMMIT'); return value; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    audit(actor, action, object, detail = {}) { db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(uid(), actor, action, object, JSON.stringify(detail), now()); },
    setting(key, fallback = null) { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return r ? JSON.parse(r.value) : fallback; },
    setSetting(key, value) { db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value)); }
  };
  return store;
}
