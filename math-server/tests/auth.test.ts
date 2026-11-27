import { describe, expect, it, vi } from 'vitest'
import { requireAuth, signToken, verifyToken, type AuthPayload } from '../src/auth'
import type { AppContext } from '../src/env'

const secret = 'auth-test-secret'

function contextWithToken(token: string) {
  return {
    env: { DATABASE_URL: '', JWT_SECRET: secret },
    req: { header: () => `Bearer ${token}` },
    set: vi.fn(),
  } as unknown as AppContext
}

describe('登录凭证用途隔离', () => {
  it('昵称设置凭证可以验签，但不能作为正式登录凭证使用', async () => {
    const payload: AuthPayload = {
      uid: 7,
      username: '微信用户TEST',
      purpose: 'wechat-nickname',
    }
    const token = await signToken(payload, secret, '10m')
    expect((await verifyToken(token, secret))?.purpose).toBe('wechat-nickname')

    const next = vi.fn(async () => {})
    await expect(requireAuth(contextWithToken(token), next))
      .rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
    expect(next).not.toHaveBeenCalled()
  })

  it('正式登录凭证继续正常通过认证中间件', async () => {
    const token = await signToken({ uid: 7, username: '小明' }, secret, '7d')
    const context = contextWithToken(token)
    const next = vi.fn(async () => {})

    await requireAuth(context, next)
    expect(next).toHaveBeenCalledOnce()
    expect(context.set).toHaveBeenCalledWith('user', expect.objectContaining({
      uid: 7,
      username: '小明',
    }))
  })
})
