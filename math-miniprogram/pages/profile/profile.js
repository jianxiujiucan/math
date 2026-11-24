const { fetchProfileApi, fetchSessionsApi } = require('../../utils/api')
const { clearAuth, getToken } = require('../../utils/auth')
const { formatDate, formatDateTime, formatDuration, formatMsPerQ, opTypeLabel } = require('../../utils/format')

const ALL_TYPES = ['add', 'sub', 'addsub', 'mul', 'div', 'muldiv']
const PAGE_SIZE = 10

Page({
  data: {
    profile: null,
    perTypeRows: [],
    sessions: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: true,
    errorMsg: '',
  },

  onShow() {
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.refresh(this.route)
    if (!getToken()) {
      wx.reLaunch({ url: '/pages/entry/entry' })
      return
    }
    this.load()
  },

  async load() {
    this.setData({ loading: true, errorMsg: '' })
    try {
      const [profile, sessionResult] = await Promise.all([
        fetchProfileApi(),
        fetchSessionsApi(this.data.page, PAGE_SIZE),
      ])
      this.setData({
        profile: {
          ...profile,
          createdAtText: formatDate(profile.user.createdAt),
        },
        perTypeRows: this.buildTypeRows(profile.stats.perType),
        sessions: this.formatSessions(sessionResult.list),
        total: sessionResult.total,
        totalPages: Math.max(1, Math.ceil(sessionResult.total / PAGE_SIZE)),
      })
    } catch (error) {
      this.setData({ errorMsg: error.message || '加载失败，请稍后再试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  buildTypeRows(rows) {
    const rowMap = {}
    ;(rows || []).forEach((row) => { rowMap[row.opType] = row })
    return ALL_TYPES.map((type) => {
      const row = rowMap[type]
      return {
        opType: type,
        label: opTypeLabel(type),
        sessions: row && row.sessions ? row.sessions : '-',
        bestAvgText: row ? formatMsPerQ(row.bestAvgMs) : '-',
        bestScore: row && row.bestScore !== null && row.bestScore !== undefined ? row.bestScore : '-',
      }
    })
  },

  formatSessions(list) {
    return list.map((item) => ({
      ...item,
      configText: `${opTypeLabel(item.opType)} · ${item.range}以内 · ${item.count}题`,
      createdAtText: formatDateTime(item.createdAt),
      durationText: formatDuration(item.durationMs),
    }))
  },

  async goPage(event) {
    const page = Number(event.currentTarget.dataset.page)
    if (page < 1 || page > this.data.totalPages || page === this.data.page) return
    this.setData({ page, errorMsg: '' })
    try {
      const result = await fetchSessionsApi(page, PAGE_SIZE)
      this.setData({ sessions: this.formatSessions(result.list), total: result.total })
    } catch (error) {
      this.setData({ errorMsg: error.message || '加载失败，请稍后再试' })
    }
  },

  openSession(event) {
    wx.navigateTo({ url: `/pages/session-detail/session-detail?id=${event.currentTarget.dataset.id}` })
  },

  goSetup() {
    wx.switchTab({ url: '/pages/setup/setup' })
  },

  logout() {
    clearAuth()
    wx.reLaunch({ url: '/pages/entry/entry' })
  },
})
