import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { withDb } from '../db'
import { requireAuth, signToken, verifyToken } from '../auth'
import { getConfig, type AppEnv } from '../env'
import { httpError } from '../httpError'
import { bodyOf } from '../body'
import { rateLimit } from '../rateLimit'
import { generateRecoveryCode, hashRecoveryCode, recoveryCodesMatch } from '../recovery'
import { sendPasswordResetCode } from '../mail'
import { exchangeWechatCode, publicEmail } from '../wechat'
import { completeWechatNickname, findOrCreateWechatAccount } from '../wechatAccount'
import { isValidEmail, isValidPassword, isValidUsername, normalizeUsername } from '../validate'
import type { ResetRow, UserAuthRow, UserPublicRow } from '../types'

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

/* ---------- 微信小程序 wx.login ---------- */
authRoutes.post('/wechat-login', async (c) => {
  const body = await bodyOf(c)
  const code = String(body.code ?? '').trim()
  if (!code || code.length > 128) {
    throw httpError(400, 'WECHAT_CODE_REQUIRED', '微信登录凭证缺失，请重新点击登录')
  }

  const identity = await exchangeWechatCode(c.env, code)
  const cfg = getConfig(c.env)
  const user = await findOrCreateWechatAccount(c.env, identity, cfg.bcryptRounds)
  // 新小程序显式请求昵称流程；旧小程序不传 flow，部署过渡期间仍可正常登录。
  if (body.flow === 'nickname-v1' && user.requiresNickname) {
    const setupToken = await signToken(
      { uid: user.id, username: user.username, purpose: 'wechat-nickname' },
      cfg.jwtSecret,
      '10m'
    )
    return c.json({ requiresNickname: true, setupToken })
  }

  const token = await signToken(
    { uid: user.id, username: user.username },
    cfg.jwtSecret,
    cfg.jwtExpiresIn
  )
  return c.json({
    requiresNickname: false,
    token,
    user: { id: user.id, username: user.username, email: publicEmail(user.email) },
  })
})

/* ---------- 首次微信登录：设置昵称后才签发正式 token ---------- */
authRoutes.post('/wechat-nickname', async (c) => {
  const cfg = getConfig(c.env)
  const header = c.req.header('authorization') ?? ''
  const setupToken = header.startsWith('Bearer ') ? header.slice(7) : ''
  const setup = setupToken ? await verifyToken(setupToken, cfg.jwtSecret) : null
  if (!setup || setup.purpose !== 'wechat-nickname') {
    throw httpError(401, 'WECHAT_SETUP_TOKEN_INVALID', '昵称设置凭证无效或已过期，请重新微信登录')
  }

  const body = await bodyOf(c)
  const nickname = normalizeUsername(String(body.nickname ?? '').trim())
  if (!isValidUsername(nickname)) {
    throw httpError(400, 'INVALID_USERNAME', '昵称需为 2~20 位文字或数字，不能包含空格或特殊符号')
  }

  const user = await completeWechatNickname(c.env, setup.uid, nickname)
  const token = await signToken(
    { uid: user.id, username: user.username },
    cfg.jwtSecret,
    cfg.jwtExpiresIn
  )
  return c.json({
    token,
    user: { id: user.id, username: user.username, email: publicEmail(user.email) },
  })
})

/* ---------- 当前用户 ---------- */
authRoutes.get('/me', requireAuth, async (c) => {
  const row = await withDb(c.env, async (db) => {
    const [rows] = await db.execute<UserPublicRow[]>(
      'SELECT id, username, email, created_at AS `createdAt` FROM users WHERE id = ?',
      [c.get('user').uid]
    )
    const row = rows[0]
    return row ? { ...row, email: publicEmail(row.email) } : row
  })
  if (!row) throw httpError(401, 'UNAUTHORIZED', '账号不存在，请重新登录')
  return c.json({ user: row })
})

/* ---------- 邮箱验证码找回密码 ---------- */
const recoveryLimiter = rateLimit(5, 10 * 60_000)
const RECOVERY_MESSAGE = '如果邮箱已注册，验证码将会送达，请查收邮件'

authRoutes.post('/forgot-password', recoveryLimiter, async (c) => {
  const body = await bodyOf(c)
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!isValidEmail(email)) throw httpError(400, 'INVALID_EMAIL', '邮箱格式不正确')

  const cfg = getConfig(c.env)
  const code = generateRecoveryCode()
  const codeHash = hashRecoveryCode(email, code, cfg.jwtSecret)
  const expiresAt = new Date(Date.now() + 15 * 60_000)

  // 用户行锁防止同一邮箱并发重复发送；未注册或 60 秒内已发送时同样返回统一文案。
  const resetId = await withDb(c.env, async (db) => {
    await db.beginTransaction()
    try {
      const [users] = await db.execute<(RowDataPacket & { id: number })[]>(
        'SELECT id FROM users WHERE email = ? FOR UPDATE',
        [email]
      )
      if (!users[0]) {
        await db.rollback()
        return null
      }
      const [recent] = await db.execute<(RowDataPacket & { created_at: Date })[]>(
        'SELECT created_at FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1',
        [email]
      )
      if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < 60_000) {
        await db.rollback()
        return null
      }
      await db.execute('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0', [email])
      const [result] = await db.execute<ResultSetHeader>(
        'INSERT INTO password_resets (email, code_hash, expires_at) VALUES (?, ?, ?)',
        [email, codeHash, expiresAt]
      )
      await db.commit()
      return result.insertId
    } catch (error) {
      await db.rollback().catch(() => {})
      throw error
    }
  })

  if (resetId === null) return c.json({ message: RECOVERY_MESSAGE })
  try {
    await sendPasswordResetCode(c.env, email, code)
  } catch (error) {
    await withDb(c.env, (db) => db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [resetId]))
    console.error('[mail] failed to send recovery code', error)
    throw httpError(503, 'MAIL_SEND_FAILED', '验证码发送失败，请稍后重试')
  }
  return c.json({ message: RECOVERY_MESSAGE })
})

authRoutes.post('/reset-password', recoveryLimiter, async (c) => {
  const body = await bodyOf(c)
  const email = String(body.email ?? '').trim().toLowerCase()
  const code = String(body.code ?? '').trim()
  const newPassword = String(body.newPassword ?? '')
  if (!isValidEmail(email)) throw httpError(400, 'INVALID_EMAIL', '邮箱格式不正确')
  if (!/^\d{6}$/.test(code)) throw httpError(400, 'INVALID_CODE', '请输入 6 位数字验证码')
  if (!isValidPassword(newPassword)) {
    throw httpError(400, 'INVALID_PASSWORD', '密码需为 8 位以上字母和数字的组合')
  }

  const row = await withDb(c.env, async (db) => {
    const [rows] = await db.execute<ResetRow[]>(
      `SELECT id, code_hash, attempts, expires_at
       FROM password_resets WHERE email = ? AND used = 0
       ORDER BY id DESC LIMIT 1`,
      [email]
    )
    return rows[0]
  })
  if (!row || row.attempts >= 5) {
    throw httpError(400, 'RESET_CODE_INVALID', '验证码不正确或已过期，请重新获取')
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await withDb(c.env, (db) => db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [row.id]))
    throw httpError(400, 'RESET_CODE_INVALID', '验证码不正确或已过期，请重新获取')
  }

  const expected = hashRecoveryCode(email, code, getConfig(c.env).jwtSecret)
  if (!recoveryCodesMatch(expected, row.code_hash)) {
    await withDb(c.env, (db) => db.execute(
      `UPDATE password_resets
       SET used = IF(attempts + 1 >= 5, 1, used), attempts = attempts + 1
       WHERE id = ?`,
      [row.id]
    ))
    throw httpError(400, 'RESET_CODE_INVALID', '验证码不正确或已过期，请重新获取')
  }

  const passwordHash = await bcrypt.hash(newPassword, getConfig(c.env).bcryptRounds)
  const changed = await withDb(c.env, async (db) => {
    await db.beginTransaction()
    try {
      const [result] = await db.execute<ResultSetHeader>(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [passwordHash, email]
      )
      await db.execute('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0', [email])
      await db.commit()
      return result.affectedRows > 0
    } catch (error) {
      await db.rollback().catch(() => {})
      throw error
    }
  })
  if (!changed) throw httpError(400, 'RESET_CODE_INVALID', '验证码不正确或已过期，请重新获取')
  return c.json({ message: '密码已重置，请使用新密码登录' })
})
