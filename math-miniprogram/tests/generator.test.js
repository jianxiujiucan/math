const test = require('node:test')
const assert = require('node:assert/strict')
const { exprText, generateQuestions } = require('../utils/generator')

function evaluate(question) {
  let value = question.nums[0]
  question.ops.forEach((op, index) => {
    const operand = question.nums[index + 1]
    if (op === '+') value += operand
    else if (op === '-') value -= operand
    else if (op === '×') value *= operand
    else if (op === '÷') {
      assert.equal(value % operand, 0, `非整除：${exprText(question)}`)
      value /= operand
    }
  })
  return value
}

const types = ['add', 'sub', 'addsub', 'mul', 'div', 'muldiv']
const ranges = [10, 20, 100]
const addSubTypes = ['add', 'sub', 'addsub']
const mulDivTypes = ['mul', 'div', 'muldiv']

for (const opType of types) {
  for (const range of ranges) {
    for (const operands of [2, 3]) {
      for (const carry of [false, true]) {
        if (carry && mulDivTypes.includes(opType)) continue
        test(`${opType} / ${range}以内 / ${operands}个数 / carry=${carry}`, () => {
          const questions = generateQuestions({ count: 100, opType, range, operands, carry })
          assert.equal(questions.length, 100)

          if (addSubTypes.includes(opType) && range >= 20 && !carry) {
            assert.equal(new Set(questions.map((question) => question.key)).size, 100)
          }

          for (const question of questions) {
            const actual = evaluate(question)
            const expression = exprText(question)
            assert.equal(actual, question.answer, expression)
            assert.ok(Number.isInteger(actual) && actual >= 0, expression)
            assert.ok(actual <= range, expression)

            const isAddSub = question.ops.every((op) => op === '+' || op === '-')
            if (isAddSub) {
              question.nums.forEach((number) => assert.ok(number >= 1, expression))
              if (carry) {
                const relaxed = opType === 'add' && operands === 3 && range < 12
                if (!relaxed) question.nums.forEach((number) => assert.ok(number >= 4, expression))
              }
            }
            if (question.ops.length === 1 && question.ops[0] === '-') {
              assert.notEqual(question.answer, 0, expression)
            }
            if (!isAddSub) {
              question.ops.forEach((_, index) => {
                const right = question.nums[index + 1]
                assert.ok(right >= 2 && right <= 9, expression)
              })
              assert.ok(question.nums[0] >= 2 && question.nums[0] <= range, expression)
            }
          }
        })
      }
    }
  }
}

test('进位和退位题占比不低于 55%', () => {
  const additions = generateQuestions({ count: 100, opType: 'add', range: 100, operands: 2, carry: true })
  const carryCount = additions.filter((q) => (q.nums[0] % 10) + (q.nums[1] % 10) >= 10).length
  assert.ok(carryCount >= 55)

  const subtractions = generateQuestions({ count: 100, opType: 'sub', range: 100, operands: 2, carry: true })
  const borrowCount = subtractions.filter((q) => q.nums[0] % 10 < q.nums[1] % 10).length
  assert.ok(borrowCount >= 55)
})
