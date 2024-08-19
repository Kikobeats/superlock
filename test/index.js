'use strict'

const { createLock } = require('superlock')
const test = require('ava')

test('.awaiting', async t => {
  const n = 100

  const lock = createLock(1)

  t.is(lock.isLocked(), false)

  const collection = [...Array(n).keys()]

  const promise = Promise.all(
    collection.map(async index => {
      const release = await lock()
      release()
      return index
    })
  )

  t.is(lock.awaiting(), 99)

  await promise

  t.is(lock.awaiting(), 0)
})
