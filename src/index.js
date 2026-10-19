'use strict'

const createFairQueue = require('./fair')
const createLock = require('./create')

const withLock = opts => {
  const lock = createLock(opts)

  const withLock = async (fn, signal) => {
    const release = await lock(signal)
    if (!release) return
    try {
      return await fn()
    } finally {
      release()
    }
  }

  withLock.isLocked = lock.isLocked
  withLock.awaiting = lock.awaiting

  return withLock
}

const withFairQueue = opts => {
  const lock = createFairQueue(opts)

  const withFairQueue = async (fn, key, signal) => {
    const release = await lock(signal, key)
    if (!release) return
    try {
      return await fn()
    } finally {
      release()
    }
  }

  withFairQueue.isLocked = lock.isLocked
  withFairQueue.awaiting = lock.awaiting

  return withFairQueue
}

module.exports = {
  withLock,
  createLock,
  withFairQueue,
  createFairQueue,
  createFairLock: createFairQueue
}
