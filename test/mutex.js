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
      const release = await lock()
      await delay()
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

test('free acquires each take a slot', async t => {
  const lock = createLock(2)

  const releaseFirst = await lock()
  const releaseSecond = await lock(null)

  t.true(lock.isLocked())

  releaseFirst()
  t.false(lock.isLocked())
  releaseSecond()
  t.false(lock.isLocked())
})

test('a second release call does not free a slot held by someone else', async t => {
  const lock = createLock()

  const releaseFirst = await lock()
  releaseFirst()
  const releaseSecond = await lock()
  releaseFirst()

  t.true(lock.isLocked())

  let granted = false
  const third = lock().then(release => {
    granted = true
    return release
  })
  await delay(0)
  t.false(granted)

  releaseSecond()
  const releaseThird = await third
  t.true(granted)
  releaseThird()
  t.false(lock.isLocked())
})

test('a second release call does not raise the concurrency limit', async t => {
  const lock = createLock(2)

  const releaseFirst = await lock()
  releaseFirst()
  releaseFirst()

  const releaseSecond = await lock()
  const releaseThird = await lock()
  t.true(lock.isLocked())

  releaseSecond()
  releaseThird()
  t.false(lock.isLocked())
})

test('a second release call from a queued holder grants only the next waiter', async t => {
  const lock = createLock()
  const controller = new AbortController()

  const releaseHeld = await lock()
  const queued = lock()
  const signaled = lock(controller.signal)
  const last = lock()

  releaseHeld()
  const releaseQueued = await queued
  releaseQueued()
  releaseQueued()

  const releaseSignaled = await signaled
  t.true(lock.isLocked())
  t.is(lock.awaiting(), 1)
  releaseSignaled()
  releaseSignaled()

  const releaseLast = await last
  t.true(lock.isLocked())
  releaseLast()
  releaseLast()
  t.false(lock.isLocked())

  const releaseAgain = await lock()
  t.true(lock.isLocked())
  releaseAgain()
})
