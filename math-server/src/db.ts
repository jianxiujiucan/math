import mysql, { type Connection } from 'mysql2/promise'
import { schemaStatements } from './schema'
import type { Bindings } from './env'

let ready: Promise<void> | null = null

/**
 * 每次请求新建连接（用完即关）。
 * DATETIME 统一按 UTC 处理，接口序列化为 ISO 时间，前端转换为本地时区。
 */
export async function withDb<T>(env: Bindings, fn: (client: Connection) => Promise<T>): Promise<T> {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL 未配置，请填写 mysql:// 连接串')
  if (!env.DATABASE_URL.startsWith('mysql://')) {
    throw new Error('DATABASE_URL 格式不正确，必须以 mysql:// 开头')
  }
  const client = await mysql.createConnection({
    uri: env.DATABASE_URL,
    dateStrings: false,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
    decimalNumbers: true,
  })
  try {
    await client.query("SET time_zone = '+00:00'")
    return await fn(client)
  } finally {
    await client.end().catch(() => {})
  }
}

/** 每个实例首次请求时执行一次幂等建表 */
export function ensureDb(env: Bindings): Promise<void> {
  ready ??= withDb(env, async (db) => {
    for (const ddl of schemaStatements) {
      await db.query(ddl)
    }
    console.log('[db] tables ready')
  })
  return ready
}
