'use strict'

const createLock = require('./create')

const withLock = opts => {
  const lock = createLock(opts)

  const withLock = async fn => {
    const release = await lock()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  withLock.isLocked = lock.isLocked

  return withLock
}

module.exports = { withLock, createLock }
