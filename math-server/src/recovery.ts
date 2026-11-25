import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

export function generateRecoveryCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashRecoveryCode(email: string, code: string, secret: string): string {
  return createHmac('sha256', secret).update(`${email.toLowerCase()}:${code}`).digest('hex')
}

export function recoveryCodesMatch(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) return false
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}
