const { adminResetPasswordApi } = require('../../utils/api')
const { passwordError, usernameError } = require('../../utils/validate')

Page({
  data: {
    adminToken: '',
    username: '',
    newPassword: '',
    loading: false,
    errorMsg: '',
    successMsg: '',
  },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value })
  },

  async submit() {
    const { adminToken, username, newPassword } = this.data
    const error = !adminToken ? '请输入管理口令' : usernameError(username.trim()) || passwordError(newPassword)
    this.setData({ errorMsg: error, successMsg: '' })
    if (error || this.data.loading) return

    this.setData({ loading: true })
    try {
      const result = await adminResetPasswordApi(username.trim(), newPassword, adminToken)
      this.setData({ successMsg: result.message, username: '', newPassword: '' })
    } catch (error) {
      this.setData({ errorMsg: error.message || '操作失败，请稍后再试' })
    } finally {
      this.setData({ loading: false })
    }
  },
})
