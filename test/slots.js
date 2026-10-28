'use strict'

const {
  createLock,
  createFairQueue,
  withLock,
  withFairQueue
} = require('superlock')
const test = require('ava')
const { inspect } = require('util')

const constructors = { createLock, createFairQueue, withLock, withFairQueue }

const invalid = [-1, 0, -0, 1.5, NaN, -Infinity, null, '', 'abc', '1.5', {}]

for (const [name, create] of Object.entries(constructors)) {
  for (const slots of invalid) {
    test(`${name}(${inspect(slots)}) throws`, t => {
      t.throws(() => create(slots), {
        instanceOf: TypeError,
        message: '`slots` needs to be a positive integer or Infinity.'
      })
    })
  }

  test(`${name} accepts the default, positive integers and Infinity`, t => {
    for (const slots of [undefined, 1, 2, Infinity]) {
      t.notThrows(() => create(slots))
    }
  })
}

for (const slots of ['2', Object(2), [2], 2n, { valueOf: () => 2 }]) {
  test(`createLock(${inspect(
    slots
  )}) holds two slots like createLock(2)`, async t => {
    const lock = createLock(slots)
    const releaseFirst = await lock()
    t.false(lock.isLocked())
    const releaseSecond = await lock()
    t.true(lock.isLocked())
    releaseFirst()
    releaseSecond()
    t.false(lock.isLocked())
  })

  test(`createFairQueue(${inspect(
    slots
  )}) holds two slots like createFairQueue(2)`, async t => {
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

test('an Infinity lock never locks', async t => {
  const lock = createLock(Infinity)
  const releases = await Promise.all([lock(), lock(), lock()])
  t.false(lock.isLocked())
  t.is(lock.awaiting(), 0)
  releases.forEach(release => release())
  t.false(lock.isLocked())
})

test('an Infinity fair queue never locks', async t => {
  const queue = createFairQueue(Infinity)
  const releases = await Promise.all([queue(), queue(), queue(undefined, 'a')])
  t.false(queue.isLocked())
  t.is(queue.awaiting(), 0)
  releases.forEach(release => release())
  t.false(queue.isLocked())
})
