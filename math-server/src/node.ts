import dotenv from 'dotenv'
dotenv.config({ path: '.dev.vars' })

import { serve } from '@hono/node-server'
import app from './worker'
import type { Bindings } from './env'

/**
 * 本地开发入口（Node）：Hono 应用经 @hono/node-server 托管，
 * mysql2 用 DATABASE_URL 连接本机或远程 MySQL。
 */
const bindings = { ...process.env } as unknown as Bindings

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: (req) => app.fetch(req, bindings), port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`)
})
