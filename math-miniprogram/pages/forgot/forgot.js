const { forgotPasswordApi, resetPasswordApi } = require('../../utils/api')
const { emailError, passwordError } = require('../../utils/validate')

Page({
  data: {
    step: 'email',
    email: '',
    code: '',
    newPassword: '',
    confirm: '',
    loading: false,
    cooldown: 0,
    errorMsg: '',
    successMsg: '',
  },

  onUnload() {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer)
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    const value = field === 'code'
      ? event.detail.value.replace(/\D/g, '').slice(0, 6)
      : event.detail.value
    this.setData({ [field]: value })
  },

  startCooldown() {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer)
    this.setData({ cooldown: 60 })
    this.cooldownTimer = setInterval(() => {
      const cooldown = this.data.cooldown - 1
      this.setData({ cooldown: Math.max(0, cooldown) })
      if (cooldown <= 0) {
        clearInterval(this.cooldownTimer)
        this.cooldownTimer = null
      }
    }, 1000)
  },

  async sendCode() {
    const invalid = emailError(this.data.email.trim())
    this.setData({ errorMsg: invalid, successMsg: '' })
    if (invalid || this.data.loading || this.data.cooldown > 0) return
    this.setData({ loading: true })
    try {
      const result = await forgotPasswordApi(this.data.email)
      this.setData({ step: 'reset', successMsg: result.message })
      this.startCooldown()
    } catch (error) {
      this.setData({ errorMsg: error.message || '发送失败，请稍后再试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async resetPassword() {
    const { email, code, newPassword, confirm } = this.data
    let error = ''
    if (!/^\d{6}$/.test(code)) error = '请输入 6 位数字验证码'
    else error = passwordError(newPassword) || (newPassword === confirm ? '' : '两次输入的密码不一致')
    this.setData({ errorMsg: error, successMsg: '' })
    if (error || this.data.loading) return

    this.setData({ loading: true })
    try {
      await resetPasswordApi(email, code, newPassword)
      this.setData({ step: 'done' })
    } catch (error) {
      this.setData({ errorMsg: error.message || '重置失败，请稍后再试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/entry/entry' })
  },

  openAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },
})
