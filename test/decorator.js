'use strict'

const { withLock } = require('superlock')
const test = require('ava')

const { delay } = require('./helpers')

test('get a free slot when is possible', async t => {
  t.plan(9)

  const lock = withLock(2)
  t.false(lock.isLocked())

  const order = []

  const createPromise = (payload, ms) =>
    lock(async () => {
      t.true(lock.isLocked())
      await delay(ms)
      return payload
    })

  const promiseOne = createPromise('one', 50)
  const promiseTwo = createPromise('two', 100)
  const promiseThree = createPromise('three', 150)

  t.true(lock.isLocked())
  order.push(await promiseOne)
  t.true(lock.isLocked())
  order.push(await promiseTwo)
  t.false(lock.isLocked())
  order.push(await promiseThree)
  t.false(lock.isLocked())
  t.is(order.length, 3)
})

test('take care about errors', async t => {
  t.plan(2)

  const lock = withLock()

  try {
    await lock(async () => {
      throw new Error('oh no')
    })
  } catch (error) {
    t.is(error.message, 'oh no')
    t.false(lock.isLocked())
  }
})

test('first in, first out', async t => {
  const n = 100

  const lock = withLock(2)

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  const output = await Promise.all(
    collection.map(index =>
      lock(async () => {
        await delay()
        return index
      })
    )
  )

  t.is(lock.isLocked(), false)
  t.is(collection.length, output.length)

  t.deepEqual(
    collection,
    output.slice().sort((a, b) => a - b)
  )
})
