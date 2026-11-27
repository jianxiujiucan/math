/* =========================================================
 * 后端环境配置：本地开发和 VPS 均通过环境变量注入。
 * 本地密钥放 .dev.vars（gitignored），生产由进程管理器配置。
 * ========================================================= */

export interface Bindings {
  /** mysql://user:password@host:3306/database */
  DATABASE_URL: string
  JWT_SECRET?: string
  JWT_EXPIRES_IN?: string
  BCRYPT_ROUNDS?: string
  CORS_ORIGINS?: string
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_SECURE?: string
  SMTP_USER?: string
  SMTP_PASS?: string
  MAIL_FROM?: string
  /** 微信小程序 AppID（仅后端用于 code2session） */
  WECHAT_MINIPROGRAM_APPID?: string
  /** 微信小程序 AppSecret（仅后端保存，绝不能下发到小程序） */
  WECHAT_MINIPROGRAM_APPSECRET?: string
  /** 管理口令（重置用户密码接口 /api/admin/* 用；不配置则管理接口关闭） */
  ADMIN_TOKEN?: string
}

import type { Context } from 'hono'
import type { AuthPayload } from './auth'

/** Hono 应用环境：Bindings 为环境变量，Variables 为中间件注入（登录用户） */
export type AppEnv = {
  Bindings: Bindings
  Variables: { user: AuthPayload }
}

export type AppContext = Context<AppEnv>

export function getConfig(env: Bindings) {
  return {
    databaseUrl: env.DATABASE_URL ?? '',
    jwtSecret: env.JWT_SECRET ?? 'dev-only-secret-change-me',
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '7d',
    bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 10),
    corsOrigins: (
      env.CORS_ORIGINS ??
      'https://jianxiujiucan.github.io,http://localhost:5173,http://127.0.0.1:5173'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}
