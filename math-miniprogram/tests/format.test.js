const test = require('node:test')
const assert = require('node:assert/strict')
const { formatDuration, formatMs, formatMsPerQ, formatTimer, opTypeLabel } = require('../utils/format')

test('答题时间格式化', () => {
  assert.equal(formatTimer(0), '00:00')
  assert.equal(formatTimer(65), '01:05')
  assert.equal(formatMs(1234), '1.23 秒')
  assert.equal(formatMsPerQ(null), '-')
  assert.equal(formatMsPerQ(1850), '1.85 秒/题')
  assert.equal(formatDuration(45000), '45秒')
  assert.equal(formatDuration(83000), '1分23秒')
  assert.equal(opTypeLabel('addsub'), '加减混合')
})
