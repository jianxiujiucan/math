const { API_BASE } = require('../config')
const { clearAuth, getToken } = require('./auth')
const { normalizeUsername } = require('./validate')

class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

let handlingUnauthorized = false

function request(path, options = {}) {
  const header = { ...(options.header || {}) }
  if (options.body !== undefined) header['Content-Type'] = 'application/json'
  if (options.auth && getToken()) header.Authorization = `Bearer ${getToken()}`

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || 'GET',
      data: options.body,
      header,
      timeout: 15000,
      success(res) {
        const data = res.data || {}
        if (res.statusCode === 401 && options.auth) {
          clearAuth()
          if (!handlingUnauthorized) {
            handlingUnauthorized = true
            wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
            setTimeout(() => {
              handlingUnauthorized = false
              wx.reLaunch({ url: '/pages/entry/entry' })
            }, 300)
          }
          reject(new ApiError(401, data.error?.code || 'UNAUTHORIZED', data.error?.message || '登录已过期，请重新登录'))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new ApiError(
            res.statusCode,
            data.error?.code || 'UNKNOWN',
            data.error?.message || `请求失败 (${res.statusCode})`,
          ))
          return
        }
        resolve(data)
      },
      fail(error) {
        const url = `${API_BASE}${path}`
        console.error('[api] request failed', url, error)
        const reason = error?.errMsg || '未知网络错误'
        reject(new ApiError(0, 'NETWORK_ERROR', `无法连接到服务器：${reason}`))
      },
    })
  })
}

function loginApi(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { username: normalizeUsername(username), password },
  })
}

function registerApi(username, password, email) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { username: normalizeUsername(username), password, email },
  })
}

function wechatLoginApi(code) {
  return request('/api/auth/wechat-login', {
    method: 'POST',
    body: { code, flow: 'nickname-v1' },
  })
}

function completeWechatNicknameApi(setupToken, nickname) {
  return request('/api/auth/wechat-nickname', {
    method: 'POST',
    body: { nickname: normalizeUsername(nickname) },
    header: { Authorization: `Bearer ${setupToken}` },
  })
}

function forgotPasswordApi(email) {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: email.trim().toLowerCase() },
  })
}

function resetPasswordApi(email, code, newPassword) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), code, newPassword },
  })
}

function adminResetPasswordApi(username, newPassword, adminToken) {
  return request('/api/admin/reset-password', {
    method: 'POST',
    body: { username: normalizeUsername(username), newPassword },
    header: { 'X-Admin-Token': adminToken },
  })
}

function saveSessionApi(payload) {
  return request('/api/quiz-sessions', { method: 'POST', body: payload, auth: true })
}

function fetchProfileApi() {
  return request('/api/profile', { auth: true })
}

function updateNicknameApi(nickname) {
  return request('/api/profile/nickname', {
    method: 'POST',
    body: { nickname: normalizeUsername(nickname) },
    auth: true,
  })
}

function fetchSessionsApi(page, pageSize = 10) {
  return request(`/api/profile/sessions?page=${page}&pageSize=${pageSize}`, { auth: true })
}

function fetchSessionDetailApi(id) {
  return request(`/api/profile/sessions/${id}`, { auth: true })
}

function fetchLeaderboardApi(opType) {
  return request(`/api/leaderboard?op_type=${opType}`)
}

module.exports = {
  ApiError,
  adminResetPasswordApi,
  completeWechatNicknameApi,
  fetchLeaderboardApi,
  fetchProfileApi,
  fetchSessionDetailApi,
  fetchSessionsApi,
  forgotPasswordApi,
  loginApi,
  registerApi,
  resetPasswordApi,
  saveSessionApi,
  updateNicknameApi,
  wechatLoginApi,
}
