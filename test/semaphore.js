'use strict'

const test = require('ava')

const createLock = require('..')

test('get exclusion', async t => {
  const lock = createLock(2)

  t.false(lock.isLocked())

  const releaseOne = await lock()

  t.false(lock.isLocked())

  const releaseTwo = await lock()

  t.true(lock.isLocked())

  releaseOne()

  t.false(lock.isLocked())

  releaseTwo()

  t.false(lock.isLocked())
})

test('queue petitions in order', async t => {
  const n = 10
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
