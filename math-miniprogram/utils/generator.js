// 与 math-src/src/utils/generator.ts 保持一致的纯 JavaScript 出题逻辑。

function randInt(min, max) {
  if (max < min) return min
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

function sortedKey(prefix, nums) {
  return prefix + [...nums].sort((a, b) => a - b).join(',')
}

function seqKey(nums, ops) {
  let key = String(nums[0])
  ops.forEach((op, index) => {
    key += op + nums[index + 1]
  })
  return key
}

function tryAdd2(range, minNum, requireCarry) {
  for (let i = 0; i < 300; i++) {
    const a = randInt(minNum, range - 1)
    const maxB = range - a
    if (maxB < minNum) continue
    const b = randInt(minNum, maxB)
    if (requireCarry && (a % 10) + (b % 10) < 10) continue
    return { nums: [a, b], ops: ['+'], answer: a + b }
  }
  return null
}

function trySub2(range, minNum, requireBorrow) {
  for (let i = 0; i < 300; i++) {
    const a = randInt(minNum + 1, range)
    const maxB = a - 1
    if (maxB < minNum) continue
    const b = randInt(minNum, maxB)
    if (requireBorrow && a % 10 >= b % 10) continue
    return { nums: [a, b], ops: ['-'], answer: a - b }
  }
  return null
}

function tryAdd3(range, minNum, requireCarry) {
  for (let i = 0; i < 300; i++) {
    const a = randInt(minNum, range - 2 * minNum)
    const b = randInt(minNum, range - a - minNum)
    const c = randInt(minNum, range - a - b)
    const sum = a + b + c
    if (sum > range) continue
    if (requireCarry && (a % 10) + (b % 10) + (c % 10) < 10) continue
    return { nums: [a, b, c], ops: ['+', '+'], answer: sum }
  }
  return null
}

function trySub3(range, minNum, requireBorrow) {
  for (let i = 0; i < 300; i++) {
    const a = randInt(2 * minNum, range)
    if (a < 2 * minNum) continue
    const b = randInt(minNum, a - minNum)
    const firstResult = a - b
    const c = randInt(minNum, firstResult)
    const answer = firstResult - c
    if (requireBorrow) {
      const firstBorrow = a % 10 < b % 10
      const secondBorrow = firstResult % 10 < c % 10
      if (!firstBorrow && !secondBorrow) continue
    }
    return { nums: [a, b, c], ops: ['-', '-'], answer }
  }
  return null
}

function tryMix3(range, minNum, requireCarryBorrow) {
  for (let i = 0; i < 300; i++) {
    if (Math.random() < 0.5) {
      const a = randInt(minNum, range - minNum)
      const b = randInt(minNum, range - a)
      const sum = a + b
      if (sum > range || sum < minNum) continue
      const c = randInt(minNum, sum)
      const answer = sum - c
      if (requireCarryBorrow) {
        const carry = (a % 10) + (b % 10) >= 10
        const borrow = sum % 10 < c % 10
        if (!carry && !borrow) continue
      }
      return { nums: [a, b, c], ops: ['+', '-'], answer }
    }

    const a = randInt(minNum + 1, range)
    if (a < minNum + 1) continue
    const b = randInt(minNum, a - 1)
    const result = a - b
    if (range - result < minNum) continue
    const c = randInt(minNum, range - result)
    const answer = result + c
    if (answer > range) continue
    if (requireCarryBorrow) {
      const borrow = a % 10 < b % 10
      const carry = (result % 10) + (c % 10) >= 10
      if (!borrow && !carry) continue
    }
    return { nums: [a, b, c], ops: ['-', '+'], answer }
  }
  return null
}

function tryRandom(config, minNum, want) {
  const { opType, range, operands } = config
  let question = null

  if (opType === 'add') {
    question = operands === 2
      ? tryAdd2(range, minNum, want)
      : tryAdd3(range, minNum, want)
  } else if (opType === 'sub') {
    question = operands === 2
      ? trySub2(range, minNum, want)
      : trySub3(range, minNum, want)
  } else if (operands === 2) {
    question = Math.random() < 0.5
      ? tryAdd2(range, minNum, want) || trySub2(range, minNum, want)
      : trySub2(range, minNum, want) || tryAdd2(range, minNum, want)
  } else {
    const generators = shuffle([tryAdd3, trySub3, tryMix3])
    for (const generate of generators) {
      question = generate(range, minNum, want)
      if (question) break
    }
  }

  if (!question) return null
  const key = question.ops.every((op) => op === '+')
    ? sortedKey('A', question.nums)
    : seqKey(question.nums, question.ops)
  return { ...question, key }
}

function genRandomOne(config) {
  const minNum = config.carry ? 4 : 1
  const want = config.carry ? Math.random() < 0.75 : false
  let question = tryRandom(config, minNum, want)
  if (!question && config.carry) {
    question = tryRandom(config, 1, Math.random() < 0.75) || tryRandom(config, 1, false)
  }
  return question
}

function mulCandidates(range, operands) {
  const list = []
  if (operands === 2) {
    for (let a = 2; a <= 9; a++) {
      for (let b = a; b <= 9; b++) {
        if (a * b <= range) {
          list.push({ nums: [a, b], ops: ['×'], answer: a * b, key: sortedKey('M', [a, b]) })
        }
      }
    }
  } else {
    for (let a = 2; a <= 9; a++) {
      for (let b = a; b <= 9; b++) {
        for (let c = b; c <= 9; c++) {
          const product = a * b * c
          if (product <= range) {
            list.push({
              nums: [a, b, c],
              ops: ['×', '×'],
              answer: product,
              key: sortedKey('M', [a, b, c]),
            })
          }
        }
      }
    }
  }
  return list
}

function divCandidates(range, operands) {
  const list = []
  if (operands === 2) {
    for (let b = 2; b <= 9; b++) {
      for (let c = 2; c <= 9; c++) {
        const a = b * c
        if (a <= range) {
          list.push({ nums: [a, b], ops: ['÷'], answer: c, key: seqKey([a, b], ['÷']) })
        }
      }
    }
  } else {
    for (let b = 2; b <= 9; b++) {
      for (let c = 2; c <= 9; c++) {
        for (let k = 2; k <= 9; k++) {
          const a = b * c * k
          if (a <= range) {
            list.push({
              nums: [a, b, c],
              ops: ['÷', '÷'],
              answer: k,
              key: seqKey([a, b, c], ['÷', '÷']),
            })
          }
        }
      }
    }
  }
  return list
}

function mulDivCandidates(range, operands) {
  if (operands === 2) return [...mulCandidates(range, 2), ...divCandidates(range, 2)]

  const list = [...mulCandidates(range, 3), ...divCandidates(range, 3)]
  for (let a = 2; a <= 9; a++) {
    for (let b = 2; b <= 9; b++) {
      const product = a * b
      if (product > range) continue
      for (let c = 2; c <= 9; c++) {
        if (product % c !== 0) continue
        list.push({
          nums: [a, b, c],
          ops: ['×', '÷'],
          answer: product / c,
          key: seqKey([a, b, c], ['×', '÷']),
        })
      }
    }
  }

  for (let b = 2; b <= 9; b++) {
    for (let k = 2; k <= 9; k++) {
      const a = b * k
      if (a > range) continue
      for (let c = 2; c <= 9; c++) {
        const result = k * c
        if (result > range) continue
        list.push({
          nums: [a, b, c],
          ops: ['÷', '×'],
          answer: result,
          key: seqKey([a, b, c], ['÷', '×']),
        })
      }
    }
  }
  return list
}

function generateQuestions(config) {
  const { count, opType } = config
  if (opType === 'add' || opType === 'sub' || opType === 'addsub') {
    const questions = []
    const used = new Set()
    let attempts = 0
    while (questions.length < count && attempts < count * 400) {
      attempts++
      const question = genRandomOne(config)
      if (!question || used.has(question.key)) continue
      used.add(question.key)
      questions.push(question)
    }

    let guard = 0
    while (questions.length < count && guard < count * 100) {
      guard++
      const question = genRandomOne(config)
      if (question) questions.push(question)
    }
    return questions
  }

  const pool = opType === 'mul'
    ? mulCandidates(config.range, config.operands)
    : opType === 'div'
      ? divCandidates(config.range, config.operands)
      : mulDivCandidates(config.range, config.operands)
  const questions = []
  let deck = shuffle([...pool])
  while (questions.length < count && pool.length > 0) {
    if (deck.length === 0) deck = shuffle([...pool])
    questions.push(deck.pop())
  }
  return questions
}

function exprText(question) {
  let text = String(question.nums[0])
  question.ops.forEach((op, index) => {
    text += ` ${op} ${question.nums[index + 1]}`
  })
  return text
}

module.exports = {
  exprText,
  generateQuestions,
}
