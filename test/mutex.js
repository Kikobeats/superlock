'use strict'

const { setImmediate } = require('timers/promises')
const test = require('ava')

const createLock = require('..')

test('get exclusion', async t => {
  const lock = createLock()
  let used = false

  t.false(lock.isLocked())

  const release = await lock()

  t.true(lock.isLocked())
  t.false(used)

  await setImmediate(
    (() => {
      used = true
      release()
    })()
  )

  t.false(lock.isLocked())
  t.true(used)
})

test('queue petitions in order', async t => {
  const n = 1000

  t.plan(n + 3)

  const lock = createLock()
  let output = []

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  for (const index of collection) {
    const release = await lock()

    t.true(lock.isLocked())

    await setImmediate(
      (() => {
        output.push(index)
        release()
      })()
    )
  }

  t.is(lock.isLocked(), false)
  t.deepEqual(collection, output)
})
