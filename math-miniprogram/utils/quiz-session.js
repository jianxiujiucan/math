const STORAGE_KEY = 'math_current_quiz'

function saveQuizSession(session) {
  wx.setStorageSync(STORAGE_KEY, session)
}

function getQuizSession() {
  return wx.getStorageSync(STORAGE_KEY) || null
}

function clearQuizSession() {
  wx.removeStorageSync(STORAGE_KEY)
}

module.exports = {
  clearQuizSession,
  getQuizSession,
  saveQuizSession,
}
