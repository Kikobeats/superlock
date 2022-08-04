'use strict'

const { createLock } = require('superlock')
const test = require('ava')

const { delay } = require('./helpers')

test('locked when there is no more free slots', async t => {
  t.plan(7)

  const lock = createLock()

  t.false(lock.isLocked())

  const lockPromise = lock()

  t.true(lockPromise instanceof Promise)

  const promise = lockPromise.then(release => {
    t.true(lock.isLocked())
    t.true(typeof release === 'function')
    release()
    return 'one'
  })

  t.true(promise instanceof Promise)
  const result = await promise

  t.is(result, 'one')
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
      return delay(ms).then(() => {
        release()
        return payload
      })
    })

  const promiseOne = createPromise('one', 50)
  const promiseTwo = createPromise('two', 100)
  const promiseThree = createPromise('three', 150)

  t.true(lock.isLocked())
  order.push(await promiseOne)
  t.true(lock.isLocked())
  order.push(await promiseTwo)
  t.true(lock.isLocked())
  order.push(await promiseThree)
  t.false(lock.isLocked())
  t.is(order.length, 3)
})

test('first in, first out', async t => {
  const n = 100

  const lock = createLock()

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  const output = await Promise.all(
    collection.map(async index => {
      await delay()
      const release = await lock()
      release()
      return index
    })
  )

  t.is(lock.isLocked(), false)
  t.is(collection.length, output.length)

  t.deepEqual(
    collection,
    output.slice().sort((a, b) => a - b)
  )
})
