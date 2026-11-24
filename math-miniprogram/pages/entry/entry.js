const { loginApi, registerApi } = require('../../utils/api')
const { clearAuth, getStoredUser, saveAuth } = require('../../utils/auth')
const { emailError, passwordError, usernameError } = require('../../utils/validate')

Page({
  data: {
    user: null,
    tab: 'login',
    redirect: '',
    loading: false,
    errorMsg: '',
    login: { username: '', password: '' },
    register: { username: '', email: '', password: '', confirm: '' },
    registerErrors: { username: '', email: '', password: '', confirm: '' },
  },

  onLoad(options) {
    this.setData({
      tab: options.tab === 'register' ? 'register' : 'login',
      redirect: options.redirect || '',
    })
  },

  onShow() {
    this.setData({ user: getStoredUser(), loading: false })
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.refresh(this.route)
  },

  onInput(event) {
    const { form, field } = event.currentTarget.dataset
    this.setData({ [`${form}.${field}`]: event.detail.value })
  },

  switchTab(event) {
    this.setData({ tab: event.currentTarget.dataset.tab, errorMsg: '' })
  },

  validateRegisterField(event) {
    const field = event.currentTarget.dataset.field
    const form = this.data.register
    const errors = { ...this.data.registerErrors }
    if (field === 'confirm') {
      errors.confirm = !form.confirm
        ? '请再次输入密码'
        : form.confirm === form.password ? '' : '两次输入的密码不一致'
    } else {
      const validate = { username: usernameError, email: emailError, password: passwordError }[field]
      errors[field] = validate(form[field])
    }
    this.setData({ registerErrors: errors })
  },

  async submitLogin() {
    if (this.data.loading) return
    const { username, password } = this.data.login
    if (!username || !password) {
      this.setData({ errorMsg: '请输入用户名和密码' })
      return
    }

    this.setData({ loading: true, errorMsg: '' })
    try {
      const result = await loginApi(username.trim(), password)
      saveAuth(result.token, result.user)
      this.afterAuth()
    } catch (error) {
      this.setData({ errorMsg: error.message || '登录失败，请稍后再试', loading: false })
    }
  },

  async submitRegister() {
    if (this.data.loading) return
    const form = this.data.register
    const errors = {
      username: usernameError(form.username.trim()),
      email: emailError(form.email.trim()),
      password: passwordError(form.password),
      confirm: !form.confirm
        ? '请再次输入密码'
        : form.confirm === form.password ? '' : '两次输入的密码不一致',
    }
    this.setData({ registerErrors: errors, errorMsg: '' })
    if (Object.keys(errors).some((key) => errors[key])) return

    this.setData({ loading: true })
    try {
      const result = await registerApi(form.username.trim(), form.password, form.email.trim())
      saveAuth(result.token, result.user)
      this.afterAuth()
    } catch (error) {
      this.setData({ errorMsg: error.message || '注册失败，请稍后再试', loading: false })
    }
  },

  afterAuth() {
    this.setData({ loading: false })
    if (this.data.redirect === 'quiz') {
      wx.reLaunch({ url: '/pages/quiz/quiz' })
      return
    }
    wx.switchTab({ url: '/pages/setup/setup' })
  },

  guestStart() {
    wx.switchTab({ url: '/pages/setup/setup' })
  },

  goForgot() {
    wx.navigateTo({ url: '/pages/forgot/forgot' })
  },

  logout() {
    clearAuth()
    this.setData({ user: null, loading: false, errorMsg: '' })
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.refresh(this.route)
  },
})
