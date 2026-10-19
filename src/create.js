'use strict'

const LinkedList = require('./linked-list')

module.exports = (slots = 1) => {
  const queue = new LinkedList()

  const release = () => {
    ++slots
    const waiter = queue.dequeue()
    if (waiter) return waiter.acquire()
  }

  const acquire = resolve => {
    --slots
    resolve(release)
  }

  const lock = signal =>
    new Promise(resolve => {
      if (signal != null && typeof signal.addEventListener !== 'function') {
        throw new TypeError('`signal` needs to be an AbortSignal.')
      }
      if (signal?.aborted) return resolve(null)
      if (!lock.isLocked()) return acquire(resolve)

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

  lock.isLocked = () => slots === 0

  lock.awaiting = () => queue.size()

  return lock
}
