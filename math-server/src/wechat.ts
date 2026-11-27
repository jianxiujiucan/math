import { randomBytes, randomUUID } from 'node:crypto'
import type { Bindings } from './env'
import { httpError } from './httpError'

export interface WechatIdentity {
  openid: string
  unionid: string | null
}

interface WechatCodeResponse {
  openid?: unknown
  session_key?: unknown
  unionid?: unknown
  errcode?: unknown
  errmsg?: unknown
}

/** 微信登录专用账号的本地占位邮箱，不会用于发送邮件。 */
export function publicEmail(email: string): string {
  return email.endsWith('@wechat.invalid') ? '' : email
}

export function createWechatAccountDefaults() {
  return {
    username: `微信用户${randomBytes(6).toString('hex').toUpperCase()}`,
    email: `wx-${randomUUID()}@wechat.invalid`,
    // 只保存此随机密码的 bcrypt 哈希；微信用户仍通过微信身份登录。
    password: randomBytes(32).toString('base64url'),
  }
}

/**
 * 服务端用临时 code 换取微信身份。session_key 只在响应中出现，
 * 不返回给路由、不写日志、不持久化。
 */
export async function exchangeWechatCode(
  env: Bindings,
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<WechatIdentity> {
  const appId = env.WECHAT_MINIPROGRAM_APPID?.trim()
  const appSecret = env.WECHAT_MINIPROGRAM_APPSECRET?.trim()
  if (!appId || !appSecret) {
    throw httpError(503, 'WECHAT_LOGIN_NOT_CONFIGURED', '微信登录尚未配置，请使用用户名登录')
  }

  // URLSearchParams 会正确编码凭证；不要打印此 URL，因为其中含 AppSecret。
  const query = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  })

  let response: Awaited<ReturnType<typeof fetch>>
  let payload: WechatCodeResponse
  try {
    response = await fetchImpl(
      `https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data: unknown = await response.json()
    payload = data && typeof data === 'object' ? data as WechatCodeResponse : {}
  } catch {
    throw httpError(502, 'WECHAT_SERVICE_UNAVAILABLE', '暂时无法连接微信登录服务，请稍后重试')
  }

  if (!response.ok) {
    throw httpError(502, 'WECHAT_SERVICE_UNAVAILABLE', '微信登录服务暂时不可用，请稍后重试')
  }

  const errcode = Number(payload.errcode ?? 0)
  if (errcode !== 0) {
    if (errcode === 40029 || errcode === 40163) {
      throw httpError(401, 'WECHAT_CODE_INVALID', '微信登录凭证无效或已过期，请重新点击登录')
    }
    console.error('[wechat] code2session rejected', { errcode, errmsg: payload.errmsg })
    throw httpError(502, 'WECHAT_LOGIN_FAILED', '微信登录失败，请稍后重试')
  }

  if (typeof payload.openid !== 'string' || !payload.openid || payload.openid.length > 128) {
    throw httpError(502, 'WECHAT_LOGIN_FAILED', '微信登录返回异常，请稍后重试')
  }

  return {
    openid: payload.openid,
    unionid: typeof payload.unionid === 'string' && payload.unionid ? payload.unionid : null,
  }
}
