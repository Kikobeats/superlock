'use strict'

const LinkedList = require('./linked-list')

module.exports = (slots = 1) => {
  const queue = new LinkedList()

  const freeSlot = () => {
    ++slots
    const waiter = queue.dequeue()
    if (waiter) waiter.acquire()
  }

  const createRelease = () => {
    let released = false
    return () => {
      if (released) return
      released = true
      freeSlot()
    }
  }

  const acquire = resolve => {
    --slots
    resolve(createRelease())
  }

  const lock = signal => {
    if (signal == null && slots !== 0) {
      --slots
      return Promise.resolve(createRelease())
    }

    return new Promise(resolve => {
      if (signal != null && typeof signal.addEventListener !== 'function') {
        throw new TypeError('`signal` needs to be an AbortSignal.')
      }
      if (signal != null && signal.aborted) return resolve(null)
      if (slots !== 0) return acquire(resolve)

      const waiter = { acquire: () => acquire(resolve) }
      const node = queue.enqueue(waiter)

      if (signal != null) {
        const onAbort = () => {
          queue.remove(node)
          resolve(null)
        }
        waiter.acquire = () => {
          signal.removeEventListener('abort', onAbort)
          acquire(resolve)
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }
    })
  }

  lock.isLocked = () => slots === 0

  lock.awaiting = () => queue.size()

  return lock
}
