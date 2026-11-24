const { getToken } = require('../utils/auth')

Component({
  data: {
    loggedIn: false,
    selected: -1,
    tabs: [
      { label: '练习', mark: '练', path: '/pages/setup/setup' },
      { label: '排行榜', mark: '榜', path: '/pages/leaderboard/leaderboard' },
      { label: '我的', mark: '我', path: '/pages/profile/profile' },
    ],
  },

  methods: {
    refresh(route) {
      const selected = this.data.tabs.findIndex((tab) => tab.path === `/${route}`)
      this.setData({
        loggedIn: Boolean(getToken()),
        selected: route === 'pages/entry/entry' ? 0 : selected,
      })
    },

    onSwitch(event) {
      const path = event.currentTarget.dataset.path
      if (!path) return
      wx.switchTab({ url: path })
    },
  },
})
