const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const profilePath = path.resolve(__dirname, '../pages/profile/profile.js')
const apiPath = require.resolve('../utils/api.js')

function loadProfile({ updateError = null } = {}) {
  const api = require(apiPath)
  const originals = {
    fetchProfileApi: api.fetchProfileApi,
    fetchSessionsApi: api.fetchSessionsApi,
    updateNicknameApi: api.updateNicknameApi,
  }
  const storage = {
    math_token: 'test-token',
    math_user: { id: 7, username: '旧昵称', email: '' },
  }
  const app = { globalData: { token: 'test-token', user: storage.math_user } }
  const toasts = []
  let submittedNickname = ''
  let definition

  api.fetchProfileApi = async () => { throw new Error('not used') }
  api.fetchSessionsApi = async () => { throw new Error('not used') }
  api.updateNicknameApi = async (nickname) => {
    submittedNickname = nickname
    if (updateError) throw updateError
    return { user: { username: nickname } }
  }

  global.getApp = () => app
  global.wx = {
    getStorageSync(key) { return storage[key] || '' },
    setStorageSync(key, value) { storage[key] = value },
    removeStorageSync(key) { delete storage[key] },
    showToast(options) { toasts.push(options) },
    reLaunch() {},
    switchTab() {},
    navigateTo() {},
  }
  global.Page = (value) => { definition = value }

  delete require.cache[profilePath]
  require(profilePath)

  const page = {
    ...definition,
    data: {
      ...JSON.parse(JSON.stringify(definition.data)),
      profile: {
        user: { username: '旧昵称', email: '', createdAt: '2026-01-01T00:00:00.000Z' },
        stats: {},
        createdAtText: '2026/1/1',
      },
    },
    setData(patch) { Object.assign(this.data, patch) },
  }

  return {
    page,
    storage,
    app,
    toasts,
    getSubmittedNickname: () => submittedNickname,
    restore() {
      Object.assign(api, originals)
      delete require.cache[profilePath]
      delete global.Page
      delete global.wx
      delete global.getApp
    },
  }
}

test('点击编辑图标后显示昵称输入框，确定后同步更新资料', async (t) => {
  const context = loadProfile()
  t.after(context.restore)

  context.page.startNicknameEdit()
  assert.equal(context.page.data.nicknameEditing, true)
  assert.equal(context.page.data.nicknameDraft, '旧昵称')
  assert.equal(context.page.data.nicknameFocus, true)

  context.page.onNicknameInput({ detail: { value: '新昵称' } })
  await context.page.saveNickname()

  assert.equal(context.getSubmittedNickname(), '新昵称')
  assert.equal(context.page.data.profile.user.username, '新昵称')
  assert.equal(context.page.data.nicknameEditing, false)
  assert.equal(context.page.data.nicknameSaving, false)
  assert.equal(context.storage.math_user.username, '新昵称')
  assert.equal(context.app.globalData.user.username, '新昵称')
  assert.equal(context.toasts[0].title, '昵称已更新')
})

test('非法昵称保留编辑状态且不会提交', async (t) => {
  const context = loadProfile()
  t.after(context.restore)

  context.page.startNicknameEdit()
  context.page.onNicknameInput({ detail: { value: 'a' } })
  await context.page.saveNickname()

  assert.match(context.page.data.nicknameError, /昵称需为 2~20/)
  assert.equal(context.page.data.nicknameEditing, true)
  assert.equal(context.getSubmittedNickname(), '')
  assert.equal(context.storage.math_user.username, '旧昵称')
})

test('保存失败时显示后端提示并保留输入内容', async (t) => {
  const context = loadProfile({ updateError: new Error('该昵称已被使用，请换一个') })
  t.after(context.restore)

  context.page.startNicknameEdit()
  context.page.onNicknameInput({ detail: { value: '已占用昵称' } })
  await context.page.saveNickname()

  assert.equal(context.page.data.nicknameError, '该昵称已被使用，请换一个')
  assert.equal(context.page.data.nicknameEditing, true)
  assert.equal(context.page.data.nicknameDraft, '已占用昵称')
  assert.equal(context.page.data.nicknameSaving, false)
  assert.equal(context.page.data.profile.user.username, '旧昵称')
})
