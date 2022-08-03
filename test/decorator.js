'use strict'

const { withLock } = require('@kikobeats/lock')
const test = require('ava')

const { delay } = require('./helpers')

test('get a free slot when is possible', async t => {
  t.plan(9)

  const lock = withLock(2)
  t.false(lock.isLocked())

  const order = []

  const createPromise = (payload, ms) =>
    lock(async () => {
      t.true(lock.isLocked())
      await delay(ms)
      return payload
    })

  const promiseOne = createPromise('one', 50)
  const promiseTwo = createPromise('two', 100)
  const promiseThree = createPromise('three', 150)

  t.true(lock.isLocked())
  order.push(await promiseOne)
  t.true(lock.isLocked())
  order.push(await promiseTwo)
  t.false(lock.isLocked())
  order.push(await promiseThree)
  t.false(lock.isLocked())
  t.is(order.length, 3)
})

test('take care about errors', async t => {
  t.plan(2)

  const lock = withLock()

  try {
    await lock(async () => {
      throw new Error('oh no')
    })
  } catch (error) {
    t.is(error.message, 'oh no')
    t.false(lock.isLocked())
  }
})
