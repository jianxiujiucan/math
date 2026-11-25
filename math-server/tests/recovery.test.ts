import { describe, expect, it } from 'vitest'
import { generateRecoveryCode, hashRecoveryCode, recoveryCodesMatch } from '../src/recovery'

describe('邮箱找回验证码', () => {
  it('生成 6 位数字验证码', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateRecoveryCode()).toMatch(/^\d{6}$/)
    }
  })

  it('相同邮箱和验证码得到相同 HMAC，邮箱不区分大小写', () => {
    const left = hashRecoveryCode('User@Example.com', '123456', 'secret')
    const right = hashRecoveryCode('user@example.com', '123456', 'secret')
    expect(left).toBe(right)
    expect(recoveryCodesMatch(left, right)).toBe(true)
  })

  it('不同验证码、邮箱或哈希格式不能通过校验', () => {
    const hash = hashRecoveryCode('user@example.com', '123456', 'secret')
    expect(recoveryCodesMatch(hash, hashRecoveryCode('user@example.com', '654321', 'secret'))).toBe(false)
    expect(recoveryCodesMatch(hash, hashRecoveryCode('other@example.com', '123456', 'secret'))).toBe(false)
    expect(recoveryCodesMatch(hash, 'invalid')).toBe(false)
  })
})
