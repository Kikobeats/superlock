'use strict'

const {
  createLock,
  createFairQueue,
  createFairLock,
  withLock,
  withFairQueue
} = require('superlock')
const test = require('ava')
const { inspect } = require('util')

const MESSAGE =
  '`slots` needs to be a positive integer up to 2 ** 53, or Infinity.'

const constructors = {
  createLock,
  createFairQueue,
  createFairLock,
  withLock,
  withFairQueue
}

const invalid = [
  -1,
  0,
  -0,
  1.5,
  NaN,
  -Infinity,
  null,
  false,
  '',
  'abc',
  '1.5',
  '-Infinity',
  '1e309',
  '+1e309',
  ' 1e309 ',
  '\uFEFF1e309',
  {},
  2 ** 53 + 2,
  2 ** 54,
  Number.MAX_VALUE,
  0n,
  -1n,
  2n ** 53n + 1n,
  Symbol('slots')
]

const invalidLabeled = [
  ['Object(2n ** 53n + 1n)', Object(2n ** 53n + 1n)],
  ['2n ** 1024n', 2n ** 1024n],
  ['Object.create(null)', Object.create(null)],
  ['valueOf above the cap', { valueOf: () => 2n ** 53n + 1n }],
  ['valueOf null', { valueOf: () => null }],
  ['valueOf null hides toString', { valueOf: () => null, toString: () => '2' }],
  [
    'valueOf undefined hides toString',
    { valueOf: () => undefined, toString: () => '2' }
  ],
  [
    'valueOf symbol hides toString',
    { valueOf: () => Symbol('s'), toString: () => '2' }
  ],
  ['toString overflow', { toString: () => '1e309' }],
  ['toString null', { valueOf: () => ({}), toString: () => null }],
  ['valueOf symbol', { valueOf: () => Symbol('s') }],
  [
    'no primitive',
    {
      valueOf: () => ({}),
      toString: () => ({})
    }
  ],
  [
    'valueOf object without toString',
    (() => {
      const value = Object.create(null)
      value.valueOf = () => ({})
      return value
    })()
  ],
  [
    'toPrimitive above the cap',
    {
      [Symbol.toPrimitive]: () => 2n ** 53n + 1n,
      valueOf: () => 2
    }
  ],
  [
    'toPrimitive overflow',
    {
      [Symbol.toPrimitive]: () => 2n ** 1024n,
      valueOf: () => 2
    }
  ],
  [
    'toPrimitive overflow text',
    {
      [Symbol.toPrimitive]: () => '1e309',
      valueOf: () => 2
    }
  ],
  [
    'toPrimitive object',
    {
      [Symbol.toPrimitive]: () => ({ valueOf: () => 2 })
    }
  ],
  [
    'toPrimitive not a function',
    {
      [Symbol.toPrimitive]: 1,
      valueOf: () => 2
    }
  ],
  [
    'toPrimitive symbol',
    {
      [Symbol.toPrimitive]: () => Symbol('s'),
      toString: () => '2'
    }
  ]
]

const accepted = [
  undefined,
  1,
  2,
  true,
  2 ** 53,
  Infinity,
  'Infinity',
  '+Infinity',
  ' Infinity ',
  '\nInfinity',
  '\uFEFFInfinity',
  1n,
  2n ** 53n,
  // Number() rounds this into range. Master did the same via `--`.
  '9007199254740993',
  Object(Infinity),
  { valueOf: () => Infinity },
  { toString: () => 'Infinity' },
  { toString: () => true }
]

const likeTwo = [
  ['2', '2'],
  ['" 2 "', ' 2 '],
  ['BOM 2', '\uFEFF2'],
  ['Object(2)', Object(2)],
  ['Object(2n)', Object(2n)],
  ['[2]', [2]],
  ['[2n]', [2n]],
  ['2n', 2n],
  ['valueOf 2', { valueOf: () => 2 }],
  ['valueOf 2n', { valueOf: () => 2n }],
  ['valueOf string 2', { valueOf: () => '2', toString: () => '9' }],
  [
    'toPrimitive 2',
    {
      [Symbol.toPrimitive] (hint) {
        return hint === 'number' ? 2 : 9
      },
      valueOf: () => 9,
      toString: () => '9'
    }
  ],
  [
    'toPrimitive null uses valueOf',
    { [Symbol.toPrimitive]: null, valueOf: () => 2, toString: () => '9' }
  ],
  ['toString 2', { toString: () => '2' }],
  ['toString number 2', { toString: () => 2 }],
  ['toString bigint 2', { toString: () => 2n }],
  [
    'null-prototype toString 2',
    (() => {
      const value = Object.create(null)
      value.toString = () => '2'
      return value
    })()
  ]
]

const throwsSlots = (t, create, slots) => {
  t.throws(() => create(slots), { instanceOf: TypeError, message: MESSAGE })
}

for (const [name, create] of Object.entries(constructors)) {
  for (const slots of invalid) {
    test(`${name}(${inspect(slots)}) throws`, t => {
      throwsSlots(t, create, slots)
    })
  }

  for (const [label, slots] of invalidLabeled) {
    test(`${name}(${label}) throws`, t => {
      throwsSlots(t, create, slots)
    })
  }

  test(`${name} lets valueOf and toString throw their own errors`, t => {
    const boom = new TypeError('nope')
    t.is(
      t.throws(() =>
        create({
          valueOf: () => {
            throw boom
          }
        })
      ),
      boom
    )
    const fromPrimitive = new TypeError('hint')
    t.is(
      t.throws(() =>
        create({
          get [Symbol.toPrimitive] () {
            throw fromPrimitive
          }
        })
      ),
      fromPrimitive
    )
    const fromToString = new Error('boom')
    t.is(
      t.throws(() =>
        create({
          valueOf: () => ({}),
          toString: () => {
            throw fromToString
          }
        })
      ),
      fromToString
    )
  })

  test(`${name} accepts finite counts, bigint, and Infinity tokens`, t => {
    for (const slots of accepted) t.notThrows(() => create(slots))
  })
}

for (const [label, slots] of likeTwo) {
  test(`createLock(${label}) holds two slots like createLock(2)`, async t => {
    const lock = createLock(slots)
    const releaseFirst = await lock()
    t.false(lock.isLocked())
    const releaseSecond = await lock()
    t.true(lock.isLocked())
    releaseFirst()
    releaseSecond()
    t.false(lock.isLocked())
  })

  test(`createFairQueue(${label}) holds two slots like createFairQueue(2)`, async t => {
    const queue = createFairQueue(slots)
    const releaseFirst = await queue()
    t.false(queue.isLocked())
    const releaseSecond = await queue()
    t.true(queue.isLocked())
    releaseFirst()
    releaseSecond()
    t.false(queue.isLocked())
  })
}

const unlimited = [
  ['Infinity', Infinity],
  ['"Infinity"', 'Infinity'],
  ['"+Infinity"', '+Infinity'],
  ['" Infinity "', ' Infinity '],
  ['newline Infinity', '\nInfinity'],
  ['BOM Infinity', '\uFEFFInfinity'],
  ['Object(Infinity)', Object(Infinity)],
  ['valueOf Infinity', { valueOf: () => Infinity }],
  ['toString Infinity', { toString: () => 'Infinity' }],
  [
    'toPrimitive Infinity',
    { [Symbol.toPrimitive]: () => 'Infinity', valueOf: () => 2 }
  ]
]

for (const [label, slots] of unlimited) {
  test(`createLock(${label}) never locks`, async t => {
    const lock = createLock(slots)
    const releases = await Promise.all([lock(), lock(), lock()])
    t.false(lock.isLocked())
    t.is(lock.awaiting(), 0)
    releases.forEach(release => release())
    t.false(lock.isLocked())
  })

  test(`createFairQueue(${label}) never locks`, async t => {
    const queue = createFairQueue(slots)
    const releases = await Promise.all([
      queue(),
      queue(),
      queue(undefined, 'a')
    ])
    t.false(queue.isLocked())
    t.is(queue.awaiting(), 0)
    releases.forEach(release => release())
    t.false(queue.isLocked())
  })
}

test('withLock("Infinity") does not queue', async t => {
  const lock = withLock('Infinity')
  let running = 0
  const releases = []
  const pending = [1, 2, 3].map(() =>
    lock(async () => {
      running++
      await new Promise(resolve => releases.push(resolve))
      running--
    })
  )
  await new Promise(resolve => setImmediate(resolve))
  t.is(running, 3)
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
  while (releases.length) releases.shift()()
  await Promise.all(pending)
  t.is(running, 0)
})

test('withFairQueue(2n) holds two slots', async t => {
  const queue = withFairQueue(2n)
  let running = 0
  const releases = []
  const pending = ['a', 'b', 'c'].map(key =>
    queue(async () => {
      running++
      await new Promise(resolve => releases.push(resolve))
      running--
    }, key)
  )
  await new Promise(resolve => setImmediate(resolve))
  t.is(running, 2)
  t.is(queue.awaiting(), 1)
  t.true(queue.isLocked())
  releases.shift()()
  await new Promise(resolve => setImmediate(resolve))
  t.is(running, 2)
  t.is(queue.awaiting(), 0)
  while (releases.length) releases.shift()()
  await Promise.all(pending)
  t.is(running, 0)
  t.false(queue.isLocked())
})
