const { fetchSessionDetailApi } = require('../../utils/api')
const { formatDateTime, formatDuration, formatMs, opTypeLabel } = require('../../utils/format')

Page({
  data: {
    detail: null,
    loading: true,
    errorMsg: '',
  },

  async onLoad(options) {
    try {
      const detail = await fetchSessionDetailApi(Number(options.id))
      this.setData({
        detail: {
          ...detail,
          configText: `${opTypeLabel(detail.session.opType)} · ${detail.session.range}以内 · ${detail.session.count}题`,
          durationText: formatDuration(detail.session.durationMs),
          createdAtText: formatDateTime(detail.session.createdAt),
          questions: detail.questions.map((question) => ({
            ...question,
            timeText: formatMs(question.timeMs),
          })),
        },
      })
    } catch (error) {
      this.setData({ errorMsg: error.message || '加载失败，请稍后再试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/profile/profile' })
  },
})
