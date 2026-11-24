const test = require('node:test')
const assert = require('node:assert/strict')
const {
  emailError,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  passwordError,
} = require('../utils/validate')

test('用户名校验与 NFC 规范化', () => {
  for (const value of ['AB', '小明', 'XIAOMING01', 'a1', 'たろう']) {
    assert.equal(isValidUsername(value), true, value)
  }
  for (const value of ['', 'a', 'a b', 'a-b', 'a@b', 'abc'.repeat(7)]) {
    assert.equal(isValidUsername(value), false, value)
  }
  assert.equal(normalizeUsername('か\u3099A'), 'がA')
})

test('密码必须同时包含字母和数字', () => {
  assert.equal(isValidPassword('abc12345'), true)
  for (const value of ['', 'short1', 'abcdefgh', '12345678', 'abc12345!']) {
    assert.equal(isValidPassword(value), false, value)
  }
  assert.equal(passwordError('abc12345'), '')
})

test('邮箱校验', () => {
  assert.equal(emailError('name@example.com'), '')
  assert.notEqual(emailError('not-an-email'), '')
})
