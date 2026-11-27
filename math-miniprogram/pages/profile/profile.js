const { fetchProfileApi, fetchSessionsApi, updateNicknameApi } = require('../../utils/api')
const { clearAuth, getToken, updateStoredUsername } = require('../../utils/auth')
const { formatDate, formatDateTime, formatDuration, formatMsPerQ, opTypeLabel } = require('../../utils/format')
const { usernameError } = require('../../utils/validate')

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
    nicknameEditing: false,
    nicknameDraft: '',
    nicknameSaving: false,
    nicknameError: '',
    nicknameFocus: false,
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

  startNicknameEdit() {
    if (!this.data.profile || this.data.nicknameSaving) return
    this.setData({
      nicknameEditing: true,
      nicknameDraft: this.data.profile.user.username,
      nicknameError: '',
      nicknameFocus: true,
    })
  },

  onNicknameInput(event) {
    this.setData({ nicknameDraft: event.detail.value, nicknameError: '' })
  },

  async saveNickname() {
    if (!this.data.profile || this.data.nicknameSaving) return
    const nickname = this.data.nicknameDraft.trim()
    const validationError = usernameError(nickname).replace(/用户名/g, '昵称')
    if (validationError) {
      this.setData({ nicknameError: validationError, nicknameFocus: true })
      return
    }
    if (nickname === this.data.profile.user.username) {
      this.setData({ nicknameEditing: false, nicknameError: '', nicknameFocus: false })
      return
    }

    this.setData({ nicknameSaving: true, nicknameError: '' })
    try {
      const result = await updateNicknameApi(nickname)
      const profile = {
        ...this.data.profile,
        user: { ...this.data.profile.user, username: result.user.username },
      }
      updateStoredUsername(result.user.username)
      this.setData({
        profile,
        nicknameEditing: false,
        nicknameFocus: false,
      })
      wx.showToast({ title: '昵称已更新', icon: 'success' })
    } catch (error) {
      this.setData({ nicknameError: error.message || '昵称保存失败，请稍后再试' })
    } finally {
      this.setData({ nicknameSaving: false })
    }
  },

  goSetup() {
    wx.switchTab({ url: '/pages/setup/setup' })
  },

  logout() {
    clearAuth()
    wx.reLaunch({ url: '/pages/entry/entry' })
  },
})
