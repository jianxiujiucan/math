function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatTimer(seconds) {
  return `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)} 秒`
}

function formatMsPerQ(ms) {
  return ms === null || ms === undefined ? '-' : `${(ms / 1000).toFixed(2)} 秒/题`
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes > 0 ? `${minutes}分${pad2(rest)}秒` : `${rest}秒`
}

function parseServerTime(value) {
  const iso = (value.includes('T') ? value : value.replace(' ', 'T')).replace(/([+-]\d{2})$/, '$1:00')
  return new Date(iso)
}

function formatDateTime(value) {
  const date = parseServerTime(value)
  if (Number.isNaN(date.getTime())) return value
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function formatDate(value) {
  const date = parseServerTime(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

const labels = {
  add: '仅加法',
  sub: '仅减法',
  addsub: '加减混合',
  mul: '仅乘法',
  div: '仅除法',
  muldiv: '乘除混合',
}

function opTypeLabel(type) {
  return labels[type] || type
}

module.exports = {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMs,
  formatMsPerQ,
  formatTimer,
  opTypeLabel,
}
