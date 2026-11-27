const {
  completeWechatNicknameApi,
  loginApi,
  registerApi,
  wechatLoginApi,
} = require('../../utils/api')
const { getStoredUser, saveAuth } = require('../../utils/auth')
const { emailError, passwordError, usernameError } = require('../../utils/validate')

Page({
  data: {
    user: null,
    tab: 'login',
    redirect: '',
    loading: false,
    wechatLoading: false,
    wechatSetup: false,
    wechatSetupToken: '',
    wechatNickname: '',
    wechatNicknameError: '',
    nicknameLoading: false,
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
    if (getStoredUser()) {
      this.afterAuth()
      return
    }
    this.setData({ user: null, loading: false, wechatLoading: false })
    const tabBar = this.getTabBar()
    if (tabBar) tabBar.refresh(this.route)
  },

  async wechatLogin() {
    if (this.data.loading || this.data.wechatLoading) return
    this.setData({ wechatLoading: true, errorMsg: '' })
    try {
      const code = await new Promise((resolve, reject) => {
        wx.login({
          success(result) {
            if (result.code) {
              resolve(result.code)
            } else {
              reject(new Error('微信未返回登录凭证，请重试'))
            }
          },
          fail() {
            reject(new Error('无法调用微信登录，请检查网络后重试'))
          },
        })
      })
      const result = await wechatLoginApi(code)
      if (result.requiresNickname) {
        if (!result.setupToken) throw new Error('微信登录返回异常，请重试')
        this.setData({
          wechatLoading: false,
          wechatSetup: true,
          wechatSetupToken: result.setupToken,
          wechatNickname: '',
          wechatNicknameError: '',
          errorMsg: '',
        })
        return
      }
      saveAuth(result.token, result.user)
      wx.showToast({ title: '微信登录成功', icon: 'success' })
      this.afterAuth()
    } catch (error) {
      this.setData({
        errorMsg: error.message || '微信登录失败，请稍后再试',
        wechatLoading: false,
      })
    }
  },

  onWechatNicknameInput(event) {
    this.setData({
      wechatNickname: event.detail.value,
      wechatNicknameError: '',
    })
  },

  async submitWechatNickname() {
    if (this.data.nicknameLoading || !this.data.wechatSetupToken) return
    const nickname = this.data.wechatNickname.trim()
    const nicknameError = usernameError(nickname).replace(/用户名/g, '昵称')
    if (nicknameError) {
      this.setData({ wechatNicknameError: nicknameError })
      return
    }

    this.setData({ nicknameLoading: true, wechatNicknameError: '' })
    try {
      const result = await completeWechatNicknameApi(this.data.wechatSetupToken, nickname)
      saveAuth(result.token, result.user)
      this.setData({
        wechatSetup: false,
        wechatSetupToken: '',
        wechatNickname: '',
      })
      wx.showToast({ title: '昵称设置成功', icon: 'success' })
      this.afterAuth()
    } catch (error) {
      this.setData({
        wechatNicknameError: error.message || '昵称设置失败，请稍后再试',
        nicknameLoading: false,
      })
    }
  },

  cancelWechatSetup() {
    this.setData({
      wechatSetup: false,
      wechatSetupToken: '',
      wechatNickname: '',
      wechatNicknameError: '',
      nicknameLoading: false,
      wechatLoading: false,
    })
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
    if (this.data.loading || this.data.wechatLoading) return
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
    if (this.data.loading || this.data.wechatLoading) return
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
    this.setData({
      loading: false,
      wechatLoading: false,
      wechatSetup: false,
      wechatSetupToken: '',
      wechatNickname: '',
      wechatNicknameError: '',
      nicknameLoading: false,
    })
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

})
