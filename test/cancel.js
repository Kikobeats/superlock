'use strict'

const { createLock, withLock } = require('superlock')
const test = require('ava')

test('aborting a queued acquire resolves to null', async t => {
  const lock = createLock(1)
  const releaseA = await lock() // A holds the only slot

  const controller = new AbortController()
  const pending = lock(controller.signal)

  t.true(lock.isLocked())
  t.is(lock.awaiting(), 1)

  controller.abort()
  t.is(await pending, null)

  releaseA()
  t.false(lock.isLocked())
})

test('an already-aborted signal resolves to null without taking a slot', async t => {
  const lock = createLock(1)
  const controller = new AbortController()
  controller.abort()

  t.is(await lock(controller.signal), null)

  // slot was never consumed: still fully acquirable
  t.false(lock.isLocked())
  const release = await lock()
  t.true(lock.isLocked())
  release()
})

test('a cancelled waiter does not steal the slot from a live one', async t => {
  const lock = createLock(1)
  const releaseA = await lock() // A holds the slot

  const controller = new AbortController()
  const order = []

  const pB = lock(controller.signal) // queued first
  const pC = lock().then(release => {
    order.push('C')
    return release
  })

  t.is(lock.awaiting(), 2)

  controller.abort()
  t.is(await pB, null)

  releaseA() // frees the slot: must skip cancelled B and hand it to C
  const releaseC = await pC

  t.deepEqual(order, ['C'])
  t.is(lock.awaiting(), 0) // both B and C drained from the queue

  releaseC()
  t.false(lock.isLocked())
})

test('aborting after the slot was granted is a no-op', async t => {
  const lock = createLock(1)
  const releaseA = await lock()

  const controller = new AbortController()
  const pB = lock(controller.signal) // queued

  releaseA() // B acquires now; its abort listener is dropped
  const releaseB = await pB
  t.truthy(releaseB) // got a real release, not null

  controller.abort() // must not settle again or free the slot
  t.true(lock.isLocked())

  releaseB()
  t.false(lock.isLocked())
})

test('awaiting() stops counting a cancelled waiter before it is drained', async t => {
  const lock = createLock(1)
  const releaseA = await lock() // A holds the slot

  const controller = new AbortController()
  const cancelled = lock(controller.signal) // queued
  const live = lock() // queued behind it

  t.is(lock.awaiting(), 2)

  controller.abort()
  t.is(await cancelled, null)
  t.is(lock.awaiting(), 1) // cancelled entry no longer counted, though still in the queue

  releaseA()
  const releaseLive = await live
  t.is(lock.awaiting(), 0)

  releaseLive()
  t.false(lock.isLocked())
})

test('a signal that never aborts behaves like a plain acquire', async t => {
  const lock = createLock(2)
  const controller = new AbortController()

  const r1 = await lock(controller.signal)
  const r2 = await lock(controller.signal)
  t.true(lock.isLocked())

  r1()
  r2()
  t.false(lock.isLocked())
})

test('FIFO order is preserved once a cancelled waiter is skipped', async t => {
  const lock = createLock(1)
  const releaseA = await lock()

  const controller = new AbortController()
  const order = []

  const first = lock().then(r => {
    order.push('first')
    return r
  })
  const cancelled = lock(controller.signal)
  const last = lock().then(r => {
    order.push('last')
    return r
  })

  t.is(lock.awaiting(), 3)

  controller.abort()
  t.is(await cancelled, null)

  releaseA()
  const r1 = await first
  r1()
  const r2 = await last

  t.deepEqual(order, ['first', 'last'])
  r2()
  t.false(lock.isLocked())
})

test('withLock forwards a signal and skips the fn when aborted while queued', async t => {
  const guarded = withLock(1)

  let releaseHeld
  const held = guarded(
    () =>
      new Promise(resolve => {
        releaseHeld = resolve
      })
  )

  const controller = new AbortController()
  let ran = false
  const pending = guarded(() => {
    ran = true
    return Promise.resolve('ran')
  }, controller.signal)

  controller.abort()
  t.is(await pending, undefined) // aborted while queued: fn skipped, resolves undefined

  releaseHeld()
  await held

  t.false(ran)
})
