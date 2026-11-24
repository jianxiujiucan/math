const opTypeOptions = [
  { label: '仅加法', value: 'add' },
  { label: '仅减法', value: 'sub' },
  { label: '加减混合', value: 'addsub' },
  { label: '仅乘法', value: 'mul' },
  { label: '仅除法', value: 'div' },
  { label: '乘除混合', value: 'muldiv' },
]

const countOptions = [10, 20, 50, 100].map((value) => ({ label: `${value}题`, value }))
const rangeOptions = [10, 20, 100].map((value) => ({ label: `${value}以内`, value }))
const operandOptions = [
  { label: '两个数', value: 2 },
  { label: '三个数', value: 3 },
]

module.exports = {
  countOptions,
  opTypeOptions,
  operandOptions,
  rangeOptions,
}
