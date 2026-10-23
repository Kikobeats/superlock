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

test('free acquires share one promise and each takes a slot', async t => {
  const lock = createLock(2)

  const first = lock()
  const second = lock(null)

  t.is(first, second)
  t.true(lock.isLocked())

  const releaseFirst = await first
  const releaseSecond = await second
  t.is(releaseFirst, releaseSecond)

  releaseFirst()
  releaseSecond()
  t.false(lock.isLocked())
})

test('a queued or signaled acquire does not share the free promise', async t => {
  const lock = createLock()
  const held = lock()
  const queued = lock()

  t.not(queued, held)

  const releaseHeld = await held
  releaseHeld()
  const releaseQueued = await queued
  releaseQueued()

  const again = lock()
  t.is(again, held)
  const releaseAgain = await again
  releaseAgain()

  const controller = new AbortController()
  const signaled = lock(controller.signal)
  t.not(signaled, held)
  const releaseSignaled = await signaled
  releaseSignaled()
  t.false(lock.isLocked())
})
