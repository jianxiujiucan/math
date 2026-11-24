const PASSWORD_RE = /^[A-Za-z0-9]{8,64}$/
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

function normalizeUsername(value) {
  const text = String(value || '')
  return typeof text.normalize === 'function' ? text.normalize('NFC') : text
}

function isValidUsername(value) {
  const normalized = normalizeUsername(value)
  if (Array.from(normalized).length < 2 || Array.from(normalized).length > 20) return false
  try {
    return new RegExp('^[\\p{L}\\p{N}]+$', 'u').test(normalized)
  } catch (e) {
    return /^[A-Za-z0-9\u3400-\u9fff]+$/.test(normalized)
  }
}

function isValidPassword(value) {
  return PASSWORD_RE.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value)
}

function usernameError(value) {
  if (!value) return '请输入用户名'
  if (!isValidUsername(value)) return '用户名需为 2~20 位文字或数字，不能包含空格或特殊符号'
  return ''
}

function passwordError(value) {
  if (!value) return '请输入密码'
  if (value.length < 8) return '密码至少 8 位'
  if (value.length > 64) return '密码最多 64 位'
  if (!PASSWORD_RE.test(value)) return '密码只能包含字母和数字'
  if (!isValidPassword(value)) return '密码必须同时包含字母和数字'
  return ''
}

function emailError(value) {
  if (!value) return '请输入邮箱'
  if (!EMAIL_RE.test(value)) return '邮箱格式不正确'
  return ''
}

module.exports = {
  emailError,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  passwordError,
  usernameError,
}
