const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const entryPath = path.resolve(__dirname, '../pages/entry/entry.js')
const apiPath = require.resolve('../utils/api.js')

function loadEntry({ loginFails = false, apiError = null, firstLogin = false }) {
  const api = require(apiPath)
  const originalWechatLoginApi = api.wechatLoginApi
  const originalCompleteApi = api.completeWechatNicknameApi
  const storage = {}
  const navigation = []
  const app = { globalData: { token: '', user: null } }
  let submittedCode = ''
  let submittedSetupToken = ''
  let submittedNickname = ''
  let definition

  api.wechatLoginApi = async (code) => {
    submittedCode = code
    if (apiError) throw apiError
    if (firstLogin) return { requiresNickname: true, setupToken: 'setup-token' }
    return {
      requiresNickname: false,
      token: 'test-token',
      user: { id: 7, username: '微信用户TEST', email: '' },
    }
  }
  api.completeWechatNicknameApi = async (setupToken, nickname) => {
    submittedSetupToken = setupToken
    submittedNickname = nickname
    return {
      token: 'completed-token',
      user: { id: 7, username: nickname, email: '' },
    }
  }

  global.getApp = () => app
  global.wx = {
    login(options) {
      if (loginFails) options.fail({ errMsg: 'login:fail' })
      else options.success({ code: 'temporary-code' })
    },
    getStorageSync(key) { return storage[key] || '' },
    setStorageSync(key, value) { storage[key] = value },
    removeStorageSync(key) { delete storage[key] },
    showToast() {},
    switchTab(options) { navigation.push(options.url) },
    reLaunch(options) { navigation.push(options.url) },
  }
  global.Page = (value) => { definition = value }

  delete require.cache[entryPath]
  require(entryPath)

  const page = {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) { Object.assign(this.data, patch) },
  }

  return {
    page,
    storage,
    navigation,
    app,
    getSubmittedCode: () => submittedCode,
    getSubmittedSetupToken: () => submittedSetupToken,
    getSubmittedNickname: () => submittedNickname,
    restore() {
      api.wechatLoginApi = originalWechatLoginApi
      api.completeWechatNicknameApi = originalCompleteApi
      delete require.cache[entryPath]
      delete global.Page
      delete global.wx
      delete global.getApp
    },
  }
}

test('老微信用户：直接保存正式 token 并进入练习页', async (t) => {
  const context = loadEntry({})
  t.after(context.restore)

  await context.page.wechatLogin()

  assert.equal(context.getSubmittedCode(), 'temporary-code')
  assert.equal(context.storage.math_token, 'test-token')
  assert.equal(context.storage.math_user.username, '微信用户TEST')
  assert.equal(context.app.globalData.token, 'test-token')
  assert.deepEqual(context.navigation, ['/pages/setup/setup'])
  assert.equal(context.page.data.wechatLoading, false)
})

test('首次微信用户：先设置符合注册规则的昵称，再保存正式 token', async (t) => {
  const context = loadEntry({ firstLogin: true })
  t.after(context.restore)

  await context.page.wechatLogin()
  assert.equal(context.page.data.wechatSetup, true)
  assert.equal(context.storage.math_token, undefined)
  assert.deepEqual(context.navigation, [])

  context.page.setData({ wechatNickname: '小明2' })
  await context.page.submitWechatNickname()

  assert.equal(context.getSubmittedSetupToken(), 'setup-token')
  assert.equal(context.getSubmittedNickname(), '小明2')
  assert.equal(context.storage.math_token, 'completed-token')
  assert.equal(context.storage.math_user.username, '小明2')
  assert.deepEqual(context.navigation, ['/pages/setup/setup'])
  assert.equal(context.page.data.wechatSetupToken, '')
})

test('首次微信用户：非法昵称不会提交或签发登录态', async (t) => {
  const context = loadEntry({ firstLogin: true })
  t.after(context.restore)

  await context.page.wechatLogin()
  context.page.setData({ wechatNickname: 'a' })
  await context.page.submitWechatNickname()

  assert.match(context.page.data.wechatNicknameError, /2~20/)
  assert.equal(context.getSubmittedNickname(), '')
  assert.equal(context.storage.math_token, undefined)
  assert.deepEqual(context.navigation, [])
})

test('微信登录失败：显示错误，不保存登录态或跳转', async (t) => {
  const context = loadEntry({ loginFails: true })
  t.after(context.restore)

  await context.page.wechatLogin()

  assert.match(context.page.data.errorMsg, /无法调用微信登录/)
  assert.equal(context.getSubmittedCode(), '')
  assert.equal(context.storage.math_token, undefined)
  assert.deepEqual(context.navigation, [])
  assert.equal(context.page.data.wechatLoading, false)
})
