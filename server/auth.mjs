import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { assert, fail, uid, now, text } from './core.mjs';
const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${Buffer.from(await scrypt(password, salt, 64)).toString('hex')}`;
}
export async function passwordMatches(password, stored) {
  const candidate = await passwordHash(password, stored.split(':')[0]);
  return candidate.length === stored.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
}
export const userView = row => row ? { ...JSON.parse(row.data), id: row.id, email: row.email, role: row.role, createdAt: row.created_at } : null;
export function authentication(store, production) {
  const attempts = new Map();
  function limit(key) {
    const time = Date.now();
    for (const [k, v] of attempts) if (v.until < time) attempts.delete(k);
    const entry = attempts.get(key) || { count: 0, until: time + 15 * 60_000 };
    if (++entry.count > 25) fail(429, 'RATE_LIMIT', '尝试次数过多，请 15 分钟后再试');
    attempts.set(key, entry);
  }
  function rawToken(req) { return (req.headers.cookie || '').match(/(?:^|;\s*)anikind_session=([a-f0-9]{64})(?:;|$)/)?.[1]; }
  return {
    current(req) {
      const token = rawToken(req); if (!token) return null;
      const row = store.db.prepare('SELECT u.* FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires_at>?').get(digest(token), Date.now());
      return userView(row);
    },
    require(req) { const user = this.current(req); if (!user) fail(401, 'AUTH_REQUIRED', '请先登录，继续保存你的记忆'); return user; },
    async signIn(req, res, data, register) {
      limit(req.socket.remoteAddress);
      const email = text(data.email, 254).toLowerCase();
      const password = typeof data.password === 'string' ? data.password : '';
      assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), '请输入有效邮箱');
      assert(password.length >= 10 && password.length <= 128, '密码需要 10–128 个字符');
      let row = store.db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if (register) {
        assert(data.adult === true, '首版仅向成年用户开放，请确认你已年满 18 周岁');
        if (row) fail(409, 'EMAIL_EXISTS', '邮箱已注册，请直接登录');
        const hash = await passwordHash(password);
        const id = uid();
        try { store.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id, email, hash, 'user', JSON.stringify({ name: text(data.name, 40) || email.split('@')[0], adult: true, processingConsent: false, aiConsent: false, pauseAI: false, hideAI: false, ecoRecommendations: true, notifications: false }), now()); }
        catch (error) { if (String(error).includes('UNIQUE')) fail(409, 'EMAIL_EXISTS', '邮箱已注册，请直接登录'); throw error; }
        row = store.db.prepare('SELECT * FROM users WHERE id=?').get(id);
      } else if (!row || !(await passwordMatches(password, row.password))) fail(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确');
      const token = randomBytes(32).toString('hex');
      store.db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());
      store.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), row.id, Date.now() + 7 * 86400_000);
      res.setHeader('Set-Cookie', `anikind_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${production ? '; Secure' : ''}`);
      return userView(row);
    },
    logout(req, res) {
      const token = rawToken(req); if (token) store.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
      res.setHeader('Set-Cookie', `anikind_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production ? '; Secure' : ''}`);
    },
    async reauth(user, password) {
      const row = store.db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
      limit(`reauth:${user.id}`);
      if (typeof password !== 'string' || password.length > 128 || !await passwordMatches(password, row.password)) fail(401, 'REAUTH_REQUIRED', '请输入当前密码以确认此操作');
    },
    role(user, roles) { if (!roles.includes(user.role)) fail(403, 'ROLE_REQUIRED', '当前账号没有内容管理权限'); }
  };
}
