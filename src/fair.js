'use strict'

const LinkedList = require('./linked-list')

const SHARED = Symbol('shared')
const NONE = Symbol('none')

// Map keys use SameValueZero, so NaN is one key and === cannot find it.
const sameKey = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b))

module.exports = (slots = 1) => {
  const queues = new Map()
  const ring = new LinkedList()
  let waiting = 0
  let last = NONE
  let seq = 0
  let barrier = 0
  let barrierFrozen = false

  const drop = entry => {
    const predecessor = entry.ringNode.prev
    ring.remove(entry.ringNode)
    queues.delete(entry.key)
    return predecessor ? predecessor.data : NONE
  }

  const enqueue = (key, waiter) => {
    let entry = queues.get(key)
    if (!entry) {
      // The holder is already the cursor. Joining at the tail would sit
      // behind keys that queued earlier, and the next grant would walk past
      // them into every key that arrives later.
      const ringNode = sameKey(key, last) ? ring.prepend(key) : ring.enqueue(key)
      entry = {
        key,
        queue: new LinkedList(),
        ringNode,
        joinSeq: ++seq
      }
      queues.set(key, entry)
    }
    waiting++
    waiter.entry = entry
    waiter.node = entry.queue.enqueue(waiter)
  }

  const eligible = entry => entry.joinSeq <= barrier

  // Walk the keys after the cursor, then the keys up to and including it.
  // Ineligible keys joined after this round was sealed.
  const selectNode = () => {
    const current = queues.get(last)
    const start = current && current.ringNode.next ? current.ringNode.next : null
    if (start) {
      for (let node = start; node; node = node.next) {
        if (eligible(queues.get(node.data))) return node
      }
    }
    for (let node = ring.head; node; node = node.next) {
      if (eligible(queues.get(node.data))) return node
      if (current && node === current.ringNode) break
    }
  }

  const grant = () => {
    if (ring.size() === 0) {
      barrierFrozen = false
      return
    }
    // Seal the round on the keys already waiting. A key that arrives while
    // this round runs stays ineligible until those keys have had a turn, so
    // a stream of new keys cannot keep a waiter queued forever.
    if (!barrierFrozen) {
      barrier = seq
      barrierFrozen = true
    }
    let node = selectNode()
    if (!node) {
      barrier = seq
      node = selectNode()
    }
    if (!node) return
    const entry = queues.get(node.data)
    const waiter = entry.queue.dequeue()
    waiting--
    // A key that just left the ring must not stay as `last`. The next grant
    // would miss it in the map and restart at the head, skipping whoever
    // was behind it.
    if (entry.queue.size() === 0) last = drop(entry)
    else last = entry.key
    waiter.acquire()
  }

  const release = () => {
    ++slots
    grant()
  }

  const acquire = resolve => {
    --slots
    resolve(release)
  }

  const lock = (signal, key) =>
    new Promise(resolve => {
      if (
        signal != null &&
        (typeof signal.addEventListener !== 'function' ||
          typeof signal.removeEventListener !== 'function' ||
          typeof signal.aborted !== 'boolean')
      ) {
        throw new TypeError('`signal` needs to be an AbortSignal.')
      }
      const id = key === undefined ? SHARED : key
      if (signal?.aborted) return resolve(null)
      if (!lock.isLocked()) {
        last = id
        return acquire(resolve)
      }

      const waiter = { acquire: () => acquire(resolve) }
      enqueue(id, waiter)

      if (signal != null) {
        const onAbort = () => {
          const entry = waiter.entry
          entry.queue.remove(waiter.node)
          waiting--
          if (entry.queue.size() === 0) {
            const current = queues.get(last) === entry
            const cursor = drop(entry)
            if (current) last = cursor
          }
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

  lock.awaiting = () => waiting

  return lock
}
