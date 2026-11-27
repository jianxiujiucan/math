import type { Connection } from 'mysql2/promise'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signToken } from '../src/auth'
import type { Bindings } from '../src/env'

const dbMock = vi.hoisted(() => ({ execute: vi.fn() }))

vi.mock('../src/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/db')>()
  return {
    ...actual,
    ensureDb: vi.fn(async () => {}),
    withDb: async <T>(_env: Bindings, fn: (client: Connection) => Promise<T>): Promise<T> =>
      fn(dbMock as unknown as Connection),
  }
})

import app from '../src/worker'

const secret = 'profile-test-secret'
const env: Bindings = {
  DATABASE_URL: 'mysql://user:password@localhost:3306/math',
  JWT_SECRET: secret,
}

async function requestNickname(nickname: unknown) {
  const token = await signToken({ uid: 7, username: '旧昵称' }, secret, '7d')
  return app.request('/api/profile/nickname', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nickname }),
  }, env)
}

describe('个人中心修改昵称', () => {
  beforeEach(() => {
    dbMock.execute.mockReset()
  })

  it('校验并规范化昵称后只更新当前用户', async () => {
    dbMock.execute.mockResolvedValueOnce([{ affectedRows: 1 }])

    const response = await requestNickname('  新昵称  ')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ user: { username: '新昵称' } })
    expect(dbMock.execute).toHaveBeenCalledWith(
      'UPDATE users SET username = ? WHERE id = ?',
      ['新昵称', 7]
    )
  })

  it('非法昵称不会执行数据库更新', async () => {
    const response = await requestNickname('a')
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_USERNAME' },
    })
    expect(dbMock.execute).not.toHaveBeenCalled()
  })

  it('昵称重复时返回可展示的冲突提示', async () => {
    dbMock.execute.mockRejectedValueOnce(Object.assign(new Error('duplicate'), {
      code: 'ER_DUP_ENTRY',
    }))

    const response = await requestNickname('已占用昵称')
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'USERNAME_TAKEN', message: '该昵称已被使用，请换一个' },
    })
  })
})
