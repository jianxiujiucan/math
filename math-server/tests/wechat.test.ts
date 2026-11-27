import { describe, expect, it, vi } from 'vitest'
import type { Bindings } from '../src/env'
import { isValidEmail, isValidUsername } from '../src/validate'
import {
  createWechatAccountDefaults,
  exchangeWechatCode,
  publicEmail,
} from '../src/wechat'

const env: Bindings = {
  DATABASE_URL: '',
  WECHAT_MINIPROGRAM_APPID: 'wx-test-appid',
  WECHAT_MINIPROGRAM_APPSECRET: 'test-secret',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('微信登录 code2session', () => {
  it('从后端交换 code，只保留 openid 和 unionid', async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: unknown) => jsonResponse({
      openid: 'openid-1',
      unionid: 'unionid-1',
      session_key: 'must-not-be-returned',
    }))

    const identity = await exchangeWechatCode(env, 'temporary-code', fetchMock as typeof fetch)
    expect(identity).toEqual({ openid: 'openid-1', unionid: 'unionid-1' })
    expect(identity).not.toHaveProperty('session_key')

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.origin + url.pathname).toBe('https://api.weixin.qq.com/sns/jscode2session')
    expect(url.searchParams.get('appid')).toBe('wx-test-appid')
    expect(url.searchParams.get('secret')).toBe('test-secret')
    expect(url.searchParams.get('js_code')).toBe('temporary-code')
    expect(url.searchParams.get('grant_type')).toBe('authorization_code')
  })

  it('临时 code 无效时返回可重试的登录错误', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ errcode: 40163, errmsg: 'code been used' }))
    await expect(exchangeWechatCode(env, 'used-code', fetchMock as typeof fetch))
      .rejects.toMatchObject({ status: 401, code: 'WECHAT_CODE_INVALID' })
  })

  it('缺少服务端配置或微信服务不可用时不会泄露密钥', async () => {
    await expect(exchangeWechatCode({ DATABASE_URL: '' }, 'code'))
      .rejects.toMatchObject({ status: 503, code: 'WECHAT_LOGIN_NOT_CONFIGURED' })

    const fetchMock = vi.fn(async () => { throw new Error('network down') })
    await expect(exchangeWechatCode(env, 'code', fetchMock as typeof fetch))
      .rejects.toMatchObject({ status: 502, code: 'WECHAT_SERVICE_UNAVAILABLE' })
  })
})

describe('微信用户账号', () => {
  it('生成合法且随机的用户名、占位邮箱和随机密码', () => {
    const first = createWechatAccountDefaults()
    const second = createWechatAccountDefaults()
    expect(isValidUsername(first.username)).toBe(true)
    expect(isValidEmail(first.email)).toBe(true)
    expect(first.password).toHaveLength(43)
    expect(first.username).not.toBe(second.username)
    expect(first.email).not.toBe(second.email)
  })

  it('不会向个人中心暴露内部占位邮箱', () => {
    expect(publicEmail('wx-123@wechat.invalid')).toBe('')
    expect(publicEmail('user@example.com')).toBe('user@example.com')
  })
})
