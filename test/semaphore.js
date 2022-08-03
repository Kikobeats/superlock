'use strict'

const test = require('ava')

const { delay } = require('./helpers')
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

test('first in, first out', async t => {
  const n = 100

  const lock = createLock(2)
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
