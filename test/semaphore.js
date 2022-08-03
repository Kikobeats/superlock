'use strict'

const { setImmediate, setTimeout } = require('timers/promises')
const test = require('ava')
const pAll = require('p-all')

const createLock = require('..')

test('get exclusion', async t => {
  const lock = createLock(2)

  t.false(lock.isLocked())

  const releaseOne = await lock()

  t.false(lock.isLocked())

  const releaseTwo = await lock()

  t.true(lock.isLocked())

  t.false(releaseOne() && lock.isLocked())
  t.false(releaseTwo() && lock.isLocked())
})

test('queue petitions in order', async t => {
  const n = 1000
  const concurrency = 2

  const lock = createLock(concurrency)
  let output = []

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  await Promise.all(
    collection.map(async index => {
      const release = await lock(index)
      output.push(index)
      release()
    })
  )

  t.is(lock.isLocked(), false)
  t.deepEqual(collection, output)
})
