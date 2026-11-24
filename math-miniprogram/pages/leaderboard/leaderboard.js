const { fetchLeaderboardApi } = require('../../utils/api')
const { formatDate, formatMsPerQ } = require('../../utils/format')
const { opTypeOptions } = require('../../utils/options')

Page({
  data: {
    opTypeOptions,
    opType: 'add',
    list: [],
    loading: false,
    errorMsg: '',
  },

  onLoad() {
    this.requestId = 0
  },

  onShow() {
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.refresh(this.route)
    this.load()
  },

  onTypeChange(event) {
    this.setData({ opType: event.detail.value })
    this.load()
  },

  async load() {
    const requestId = ++this.requestId
    this.setData({ loading: true, errorMsg: '' })
    try {
      const result = await fetchLeaderboardApi(this.data.opType)
      if (requestId !== this.requestId) return
      this.setData({
        list: result.list.map((item) => ({
          ...item,
          avgText: formatMsPerQ(item.avgMs),
          dateText: formatDate(item.createdAt),
        })),
      })
    } catch (error) {
      if (requestId !== this.requestId) return
      this.setData({ list: [], errorMsg: error.message || '加载失败，请稍后再试' })
    } finally {
      if (requestId === this.requestId) this.setData({ loading: false })
    }
  },
})
