const { getStoredUser, getToken } = require('./utils/auth')

App({
  globalData: {
    token: '',
    user: null,
  },

  onLaunch() {
    this.globalData.token = getToken()
    this.globalData.user = getStoredUser()
  },
})
