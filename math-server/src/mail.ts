import nodemailer, { type Transporter } from 'nodemailer'
import type { Bindings } from './env'
import { httpError } from './httpError'

let transporter: Transporter | null = null

function getTransporter(env: Bindings): Transporter {
  if (transporter) return transporter
  const host = env.SMTP_HOST
  const user = env.SMTP_USER
  const pass = env.SMTP_PASS
  if (!host || !user || !pass) {
    throw httpError(503, 'MAIL_NOT_CONFIGURED', '邮件服务尚未配置')
  }
  const port = Number(env.SMTP_PORT ?? 465)
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  return transporter
}

export async function sendPasswordResetCode(env: Bindings, email: string, code: string): Promise<void> {
  const mailer = getTransporter(env)
  await mailer.sendMail({
    from: env.MAIL_FROM || env.SMTP_USER,
    to: email,
    subject: '速算挑战 - 找回密码验证码',
    text: `你正在找回速算挑战账号密码。验证码为 ${code}，15 分钟内有效。如果不是本人操作，请忽略此邮件。`,
    html: `<div style="font-family:sans-serif;line-height:1.7;color:#33475b"><p>你正在找回速算挑战账号密码。</p><p>验证码：</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;color:#3f7392">${code}</p><p>验证码 15 分钟内有效。如果不是本人操作，请忽略此邮件。</p></div>`,
  })
}
