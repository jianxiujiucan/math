const { generateQuestions } = require('../../utils/generator')
const { getToken } = require('../../utils/auth')
const { countOptions, opTypeOptions, operandOptions, rangeOptions } = require('../../utils/options')
const { saveQuizSession } = require('../../utils/quiz-session')

const mulDivTypes = ['mul', 'div', 'muldiv']

Page({
  data: {
    countOptions,
    opTypeOptions,
    operandOptions,
    rangeOptions,
    count: 10,
    opType: 'add',
    range: 20,
    operands: 2,
    carry: false,
    isAddSub: true,
    loggedIn: false,
  },

  onShow() {
    this.setData({ loggedIn: Boolean(getToken()) })
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.refresh(this.route)
  },

  onCountChange(event) {
    this.setData({ count: Number(event.detail.value) })
  },

  onTypeChange(event) {
    const opType = event.detail.value
    const isAddSub = !mulDivTypes.includes(opType)
    const range = isAddSub ? this.data.range : 100
    this.setData({
      opType,
      isAddSub,
      range,
      rangeOptions: rangeOptions.map((option) => ({
        ...option,
        disabled: !isAddSub && option.value !== 100,
      })),
    })
  },

  onRangeChange(event) {
    this.setData({ range: Number(event.detail.value) })
  },

  onOperandsChange(event) {
    this.setData({ operands: Number(event.detail.value) })
  },

  onCarryChange(event) {
    this.setData({ carry: event.detail.value.length > 0 })
  },

  start() {
    const isAddSub = !mulDivTypes.includes(this.data.opType)
    const config = {
      count: this.data.count,
      opType: this.data.opType,
      range: isAddSub ? this.data.range : 100,
      operands: this.data.operands,
      carry: isAddSub && this.data.carry,
    }
    const questions = generateQuestions(config)
    if (!questions.length) {
      wx.showToast({ title: '当前条件无法出题，请调整设置', icon: 'none' })
      return
    }
    saveQuizSession({
      id: Date.now(),
      config,
      questions,
      current: 0,
      correct: 0,
      records: [],
      answer: '',
      answered: false,
      lastRight: false,
      wrong: false,
      mistakeMade: false,
      finished: false,
      durationMs: 0,
      saveState: 'guest',
    })
    wx.navigateTo({ url: '/pages/quiz/quiz' })
  },

  goEntry() {
    wx.switchTab({ url: '/pages/entry/entry' })
  },
})
