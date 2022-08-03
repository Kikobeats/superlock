'use strict'

const test = require('ava')

const { delay } = require('./helpers')
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
  t.plan(12)

  const lock = createLock()

  t.false(lock.isLocked())

  const order = []

  const createPromise = (payload, ms) =>
    lock().then(release => {
      t.true(lock.isLocked())
      t.true(typeof release === 'function')
      order.push(payload)
      return delay(ms).then(release)
    })

  const promiseOne = createPromise('one', 50)
  const promiseTwo = createPromise('two', 100)
  const promiseThree = createPromise('three', 150)

  t.true(lock.isLocked())
  await promiseOne
  t.true(lock.isLocked())
  await promiseTwo
  t.true(lock.isLocked())
  await promiseThree
  t.false(lock.isLocked())
  t.is(order.length, 3)
})

test('first in, first out', async t => {
  const n = 100

  const lock = createLock()
  const output = []

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  await Promise.all(
    collection.map(async index => {
      await delay()
      const release = await lock()
      output.push(index)
      release()
    })
  )

  t.is(lock.isLocked(), false)
  t.is(collection.length, output.length)

  t.deepEqual(
    collection,
    output.slice().sort((a, b) => a - b)
  )
})
