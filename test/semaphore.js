'use strict'

const { createLock } = require('superlock')
const test = require('ava')

const { delay } = require('./helpers')

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

test('first in, first out', async t => {
  const n = 100

  const lock = createLock(2)

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
