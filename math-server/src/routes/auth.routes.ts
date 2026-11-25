import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { ResultSetHeader } from 'mysql2'
import { withDb } from '../db'
import { requireAuth, signToken } from '../auth'
import { getConfig, type AppEnv } from '../env'
import { httpError } from '../httpError'
import { bodyOf } from '../body'
import { isValidEmail, isValidPassword, isValidUsername, normalizeUsername } from '../validate'
import type { UserAuthRow, UserPublicRow } from '../types'

export const authRoutes = new Hono<AppEnv>()

// bcryptjs 随机源兜底
bcrypt.setRandomFallback((len: number) => {
  const buf = new Uint8Array(len)
  crypto.getRandomValues(buf)
  return [...buf]
})

/**
 * 用户不存在时也做一次 bcrypt.compare，拉平响应时间（缓解时序侧信道枚举）。
 * 注意必须懒计算，避免服务启动时生成随机值。
 */
let dummyHash: string | null = null
function getDummyHash(): string {
  dummyHash ??= bcrypt.hashSync('timing-dummy', 10)
  return dummyHash
}

/* ---------- 注册 ---------- */
authRoutes.post('/register', async (c) => {
  const body = await bodyOf(c)
  // 用户名经 NFC 规范化后存储；utf8mb4_unicode_ci 唯一索引保证大小写不敏感
  const username = normalizeUsername(String(body.username ?? '').trim())
  const password = String(body.password ?? '')
  const email = String(body.email ?? '').trim().toLowerCase()
  const cfg = getConfig(c.env)

  if (!isValidUsername(username)) {
    throw httpError(400, 'INVALID_USERNAME', '用户名需为 2~20 位文字或数字，不能包含空格或特殊符号')
  }
  if (!isValidPassword(password)) {
    throw httpError(400, 'INVALID_PASSWORD', '密码需为 8 位以上字母和数字的组合')
  }
  if (!isValidEmail(email)) {
    throw httpError(400, 'INVALID_EMAIL', '邮箱格式不正确')
  }

  const hash = await bcrypt.hash(password, cfg.bcryptRounds)
  try {
    const id = await withDb(c.env, async (db) => {
      const [result] = await db.execute<ResultSetHeader>(
        'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
        [username, hash, email]
      )
      return result.insertId
    })
    const user = { id, username, email }
    const token = await signToken({ uid: id, username }, cfg.jwtSecret, cfg.jwtExpiresIn)
    return c.json({ token, user }, 201)
  } catch (e) {
    // MySQL ER_DUP_ENTRY：按约束名区分别名与邮箱冲突
    const err = e as { code?: string; errno?: number; sqlMessage?: string }
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      if (err.sqlMessage?.includes('uk_users_email') || err.sqlMessage?.includes('email')) {
        throw httpError(409, 'EMAIL_TAKEN', '该邮箱已被注册')
      }
      throw httpError(409, 'USERNAME_TAKEN', '该用户名已被注册')
    }
    throw e
  }
})

/* ---------- 登录（用户名大小写不敏感） ---------- */
authRoutes.post('/login', async (c) => {
  const body = await bodyOf(c)
  const username = normalizeUsername(String(body.username ?? '').trim())
  const password = String(body.password ?? '')
  if (!username || !password) throw httpError(400, 'MISSING_FIELDS', '请输入用户名和密码')

  const row = await withDb(c.env, async (db) => {
    const [rows] = await db.execute<UserAuthRow[]>(
      'SELECT id, username, email, password_hash FROM users WHERE LOWER(username) = LOWER(?)',
      [username]
    )
    return rows[0]
  })
  const ok = await bcrypt.compare(password, row ? row.password_hash : getDummyHash())
  if (!row || !ok) throw httpError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确')

  const cfg = getConfig(c.env)
  const token = await signToken({ uid: row.id, username: row.username }, cfg.jwtSecret, cfg.jwtExpiresIn)
  return c.json({ token, user: { id: row.id, username: row.username, email: row.email } })
})

/* ---------- 当前用户 ---------- */
authRoutes.get('/me', requireAuth, async (c) => {
  const row = await withDb(c.env, async (db) => {
    const [rows] = await db.execute<UserPublicRow[]>(
      'SELECT id, username, email, created_at AS `createdAt` FROM users WHERE id = ?',
      [c.get('user').uid]
    )
    return rows[0]
  })
  if (!row) throw httpError(401, 'UNAUTHORIZED', '账号不存在，请重新登录')
  return c.json({ user: row })
})
