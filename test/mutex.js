'use strict'

const { setTimeout } = require('timers/promises')
const test = require('ava')

const delay = ms => setTimeout(ms, Promise.resolve)

const createLock = require('..')

test('locked when there is no more free slots', async t => {
  t.plan(7)

  const lock = createLock()

  t.false(lock.isLocked())

  const order = []

  const lockPromise = lock()

  t.true(lockPromise instanceof Promise)

  const promise = lockPromise.then(release => {
    t.true(lock.isLocked())
    t.true(typeof release === 'function')
    order.push('one')
    release()
  })

  t.true(promise instanceof Promise)
  await promise

  t.deepEqual(order, ['one'])
  t.false(lock.isLocked())
})

test('get a free slot when is possible', async t => {
  t.plan(7)

  const lock = createLock()

  t.false(lock.isLocked())

  const order = []

  const promiseOne = delay(100)
    .then(lock)
    .then(release => {
      t.true(lock.isLocked())
      t.true(typeof release === 'function')
      order.push('one')
      release()
    })

  const promiseTwo = delay(50)
    .then(lock)
    .then(release => {
      t.true(lock.isLocked())
      t.true(typeof release === 'function')
      order.push('two')
      release()
    })

  await delay(50)
  t.is(order.length, 1)

  await promiseOne
  await promiseTwo

  t.deepEqual(order, ['two', 'one'])
})

test('first in, first out', async t => {
  const n = 1000

  t.plan(n + 3)

  const lock = createLock()
  let output = []

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  for (const index of collection) {
    const release = await lock()
    t.true(lock.isLocked())
    output.push(index)
    release()
  }

  t.is(lock.isLocked(), false)
  t.deepEqual(collection, output)
})
