import { Hono } from 'hono'
import { withDb } from '../db'
import { requireAuth } from '../auth'
import { bodyOf } from '../body'
import { httpError } from '../httpError'
import { isValidUsername, normalizeUsername } from '../validate'
import type { AppEnv } from '../env'
import type { CountRow, PerTypeRow, QuestionRow, SessionRow, TotalsRow, UserPublicRow } from '../types'
import { publicEmail } from '../wechat'

export const profileRoutes = new Hono<AppEnv>()

profileRoutes.use('*', requireAuth)

/* ---------- 用户信息 + 统计 ---------- */
profileRoutes.get('/', async (c) => {
  const uid = c.get('user').uid

  return withDb(c.env, async (db) => {
    const [users] = await db.execute<UserPublicRow[]>(
      'SELECT username, email, created_at AS `createdAt` FROM users WHERE id = ?',
      [uid]
    )
    const row = users[0]
    if (!row) throw httpError(401, 'UNAUTHORIZED', '账号不存在，请重新登录')
    const user = { ...row, email: publicEmail(row.email) }

    const [totals] = await db.execute<TotalsRow[]>(
      `SELECT COUNT(*) AS \`totalSessions\`,
              COALESCE(SUM(total), 0) AS \`totalQuestions\`,
              COALESCE(SUM(correct), 0) AS \`totalCorrect\`
       FROM quiz_sessions WHERE user_id = ?`,
      [uid]
    )
    const t = totals[0]
    const totalQuestions = Number(t.totalQuestions)
    const totalCorrect = Number(t.totalCorrect)

    const [perTypeRows] = await db.execute<PerTypeRow[]>(
      `SELECT s.op_type AS \`opType\`,
              COUNT(DISTINCT s.id) AS sessions,
              ROUND(MIN(CASE
                WHEN s.correct * 10 >= s.total * 9 THEN a.avg_ms
                ELSE NULL
              END)) AS \`bestAvgMs\`,
              MAX(s.score) AS \`bestScore\`
       FROM quiz_sessions s
       JOIN (
         SELECT session_id, AVG(time_ms) AS avg_ms
         FROM question_records GROUP BY session_id
       ) a ON a.session_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.op_type`,
      [uid]
    )

    return c.json({
      user,
      stats: {
        totalSessions: Number(t.totalSessions),
        totalQuestions,
        totalCorrect,
        accuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        perType: perTypeRows.map((r) => ({
          opType: r.opType,
          sessions: Number(r.sessions),
          bestAvgMs: r.bestAvgMs === null ? null : Number(r.bestAvgMs),
          bestScore: r.bestScore,
        })),
      },
    })
  })
})

/* ---------- 修改昵称 ---------- */
profileRoutes.post('/nickname', async (c) => {
  const uid = c.get('user').uid
  const body = await bodyOf(c)
  const nickname = normalizeUsername(String(body.nickname ?? '').trim())
  if (!isValidUsername(nickname)) {
    throw httpError(400, 'INVALID_USERNAME', '昵称需为 2~20 位文字或数字，不能包含空格或特殊符号')
  }

  return withDb(c.env, async (db) => {
    try {
      await db.execute('UPDATE users SET username = ? WHERE id = ?', [nickname, uid])
      return c.json({ user: { username: nickname } })
    } catch (error) {
      const err = error as { code?: string; errno?: number }
      if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
        throw httpError(409, 'USERNAME_TAKEN', '该昵称已被使用，请换一个')
      }
      throw error
    }
  })
})

/* ---------- 答题记录列表（分页） ---------- */
profileRoutes.get('/sessions', async (c) => {
  const uid = c.get('user').uid
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1)
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(c.req.query('pageSize') ?? '10', 10) || 10))
  const offset = (page - 1) * pageSize

  return withDb(c.env, async (db) => {
    const [list] = await db.execute<SessionRow[]>(
      `SELECT id, op_type AS \`opType\`, count_opt AS \`count\`, range_limit AS \`range\`,
              operands, carry, total, correct, score,
              duration_ms AS \`durationMs\`, created_at AS \`createdAt\`
       FROM quiz_sessions
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [uid, pageSize, offset]
    )
    const [cnt] = await db.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM quiz_sessions WHERE user_id = ?',
      [uid]
    )
    return c.json({
      list: list.map((row) => ({ ...row, carry: Boolean(row.carry) })),
      total: Number(cnt[0].total),
      page,
      pageSize,
    })
  })
})

/* ---------- 单场详情（非本人返回 404，不泄露记录是否存在） ---------- */
profileRoutes.get('/sessions/:id', async (c) => {
  const uid = c.get('user').uid
  const id = Number.parseInt(c.req.param('id'), 10)
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'NOT_FOUND', '记录不存在')

  return withDb(c.env, async (db) => {
    const [sessions] = await db.execute<SessionRow[]>(
      `SELECT id, op_type AS \`opType\`, count_opt AS \`count\`, range_limit AS \`range\`,
              operands, carry, total, correct, score,
              duration_ms AS \`durationMs\`, created_at AS \`createdAt\`
       FROM quiz_sessions WHERE id = ? AND user_id = ?`,
      [id, uid]
    )
    if (sessions.length === 0) throw httpError(404, 'NOT_FOUND', '记录不存在')

    const [questions] = await db.execute<QuestionRow[]>(
      `SELECT seq, expr, user_answer AS \`userAnswer\`, correct_answer AS \`correctAnswer\`,
              is_correct AS \`isCorrect\`, time_ms AS \`timeMs\`
       FROM question_records WHERE session_id = ? ORDER BY seq ASC`,
      [id]
    )
    const session = { ...sessions[0], carry: Boolean(sessions[0].carry) }
    return c.json({
      session,
      questions: questions.map((row) => ({ ...row, isCorrect: Boolean(row.isCorrect) })),
    })
  })
})
