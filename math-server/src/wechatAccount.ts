import bcrypt from 'bcryptjs'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { Connection } from 'mysql2/promise'
import { withDb } from './db'
import type { Bindings } from './env'
import { httpError } from './httpError'
import { createWechatAccountDefaults, type WechatIdentity } from './wechat'

export interface WechatAccountUser {
  id: number
  username: string
  email: string
  requiresNickname: boolean
}

type WechatAccountRow = RowDataPacket & Omit<WechatAccountUser, 'requiresNickname'> & {
  unionid: string | null
  nicknameRequired: number | boolean
}

function accountUser(row: WechatAccountRow): WechatAccountUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    requiresNickname: Boolean(row.nicknameRequired),
  }
}

async function findByOpenid(db: Connection, openid: string) {
  const [rows] = await db.execute<WechatAccountRow[]>(
    `SELECT u.id, u.username, u.email, w.unionid,
            w.nickname_required AS \`nicknameRequired\`
     FROM wechat_accounts w
     JOIN users u ON u.id = w.user_id
     WHERE w.openid = ? LIMIT 1`,
    [openid]
  )
  return rows[0]
}

function isDuplicateEntry(error: unknown): boolean {
  const err = error as { code?: string; errno?: number }
  return err.code === 'ER_DUP_ENTRY' || err.errno === 1062
}

/** 首次微信登录创建用户并关联 openid；后续复用同一用户及全部成绩。 */
export async function findOrCreateWechatAccount(
  env: Bindings,
  identity: WechatIdentity,
  bcryptRounds: number
): Promise<WechatAccountUser> {
  return withDb(env, async (db) => {
    const existing = await findByOpenid(db, identity.openid)
    if (existing) {
      if (identity.unionid && identity.unionid !== existing.unionid) {
        await db.execute('UPDATE wechat_accounts SET unionid = ? WHERE user_id = ?', [
          identity.unionid,
          existing.id,
        ])
      }
      return accountUser(existing)
    }

    let lastDuplicate: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const account = createWechatAccountDefaults()
      const passwordHash = await bcrypt.hash(account.password, bcryptRounds)
      await db.beginTransaction()
      try {
        const [userResult] = await db.execute<ResultSetHeader>(
          'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
          [account.username, passwordHash, account.email]
        )
        await db.execute(
          'INSERT INTO wechat_accounts (user_id, openid, unionid) VALUES (?, ?, ?)',
          [userResult.insertId, identity.openid, identity.unionid]
        )
        await db.commit()
        return {
          id: userResult.insertId,
          username: account.username,
          email: account.email,
          requiresNickname: true,
        }
      } catch (error) {
        await db.rollback().catch(() => {})

        // 并发登录时另一个请求可能已创建关联，回滚后直接复用它。
        if (isDuplicateEntry(error)) {
          const linked = await findByOpenid(db, identity.openid)
          if (linked) return accountUser(linked)
          lastDuplicate = error
          continue
        }
        throw error
      }
    }

    // 随机用户名/邮箱冲突概率极低；重试仍失败时保留原始数据库错误。
    throw lastDuplicate
  })
}

/** 首次微信登录设置昵称；普通注册与微信昵称共用 isValidUsername 规则。 */
export async function completeWechatNickname(
  env: Bindings,
  uid: number,
  nickname: string
): Promise<WechatAccountUser> {
  return withDb(env, async (db) => {
    await db.beginTransaction()
    try {
      const [rows] = await db.execute<WechatAccountRow[]>(
        `SELECT u.id, u.username, u.email, w.unionid,
                w.nickname_required AS \`nicknameRequired\`
         FROM wechat_accounts w
         JOIN users u ON u.id = w.user_id
         WHERE w.user_id = ? FOR UPDATE`,
        [uid]
      )
      const row = rows[0]
      if (!row) throw httpError(403, 'WECHAT_ACCOUNT_REQUIRED', '该凭证不是微信昵称设置凭证')
      if (!row.nicknameRequired) {
        throw httpError(409, 'WECHAT_NICKNAME_ALREADY_SET', '昵称已设置，请重新使用微信登录')
      }

      await db.execute('UPDATE users SET username = ? WHERE id = ?', [nickname, uid])
      await db.execute('UPDATE wechat_accounts SET nickname_required = 0 WHERE user_id = ?', [uid])
      await db.commit()
      return { id: uid, username: nickname, email: row.email, requiresNickname: false }
    } catch (error) {
      await db.rollback().catch(() => {})
      if (isDuplicateEntry(error)) {
        throw httpError(409, 'USERNAME_TAKEN', '该昵称已被使用，请换一个')
      }
      throw error
    }
  })
}
