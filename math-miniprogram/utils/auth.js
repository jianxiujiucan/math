const TOKEN_KEY = 'math_token'
const USER_KEY = 'math_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function getStoredUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function saveAuth(token, user) {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(USER_KEY, user)
  const app = getApp()
  if (app) {
    app.globalData.token = token
    app.globalData.user = user
  }
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
  const app = getApp()
  if (app) {
    app.globalData.token = ''
    app.globalData.user = null
  }
}

function updateStoredUsername(username) {
  const user = getStoredUser()
  if (!user) return
  const updatedUser = { ...user, username }
  wx.setStorageSync(USER_KEY, updatedUser)
  const app = getApp()
  if (app) app.globalData.user = updatedUser
}

module.exports = {
  clearAuth,
  getStoredUser,
  getToken,
  saveAuth,
  updateStoredUsername,
}
