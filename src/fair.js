'use strict'

const LinkedList = require('./linked-list')

const SHARED = Symbol('shared')
const NONE = Symbol('none')

module.exports = (slots = 1) => {
  const queues = new Map()
  const ring = new LinkedList()
  let waiting = 0
  let last = NONE

  const drop = entry => {
    ring.remove(entry.ringNode)
    queues.delete(entry.key)
  }

  const enqueue = (key, waiter) => {
    let entry = queues.get(key)
    if (!entry) {
      entry = { key, queue: new LinkedList(), ringNode: ring.enqueue(key) }
      queues.set(key, entry)
    }
    waiting++
    waiter.entry = entry
    waiter.node = entry.queue.enqueue(waiter)
  }

  const grant = () => {
    if (ring.size() === 0) return
    const current = queues.get(last)
    const node =
      current && current.ringNode.next ? current.ringNode.next : ring.head
    const entry = queues.get(node.data)
    const waiter = entry.queue.dequeue()
    waiting--
    if (entry.queue.size() === 0) drop(entry)
    last = entry.key
    waiter.acquire()
  }

  const release = () => {
    ++slots
    grant()
  }

  const acquire = (resolve, key) => {
    --slots
    last = key
    resolve(release)
  }

  const lock = (signal, key) =>
    new Promise(resolve => {
      if (signal != null && typeof signal.addEventListener !== 'function') {
        throw new TypeError('`signal` needs to be an AbortSignal.')
      }
      const id = key === undefined ? SHARED : key
      if (signal?.aborted) return resolve(null)
      if (!lock.isLocked()) return acquire(resolve, id)

      const waiter = { acquire: () => acquire(resolve, id) }
      enqueue(id, waiter)

      if (signal != null) {
        const onAbort = () => {
          waiter.entry.queue.remove(waiter.node)
          waiting--
          if (waiter.entry.queue.size() === 0) drop(waiter.entry)
          resolve(null)
        }
        waiter.acquire = () => {
          signal.removeEventListener('abort', onAbort)
          acquire(resolve, id)
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }
    })

  lock.isLocked = () => slots === 0

  lock.awaiting = () => waiting

  return lock
}
