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

  const drop = entry => {
    const predecessor = entry.ringNode.prev
    ring.remove(entry.ringNode)
    queues.delete(entry.key)
    return predecessor ? predecessor.data : NONE
  }

  const enqueue = (key, waiter) => {
    let entry = queues.get(key)
    if (!entry) {
      // The holder is the cursor and is not on the ring yet. Put that key
      // at the head so the next grant starts on the keys already waiting
      // and reaches the holder last. At the tail, the cursor would step
      // into keys that arrive later and skip the ones already in front.
      const ringNode = sameKey(key, last)
        ? ring.prepend(key)
        : ring.enqueue(key)
      entry = { key, queue: new LinkedList(), ringNode }
      queues.set(key, entry)
    }
    waiting++
    waiter.entry = entry
    waiter.joinSeq = ++seq
    waiter.node = entry.queue.enqueue(waiter)
  }

  // The key's oldest waiter decides. A later waiter on a key that joined
  // this round has a newer sequence and must not inherit the round.
  const eligible = entry => entry.queue.head.data.joinSeq <= barrier

  // Start just after the cursor and wrap once. Stop is required: the
  // ring is not circular, so the walk jumps from the tail back to the head.
  const selectNode = () => {
    const current = queues.get(last)
    const start =
      current && current.ringNode.next ? current.ringNode.next : ring.head
    let node = start
    do {
      if (eligible(queues.get(node.data))) return node
      node = node.next || ring.head
    } while (node !== start)
  }

  const grant = () => {
    if (ring.size() === 0) return
    // Waiters past the barrier stay out until every earlier waiter has
    // been served. When none of those remain, move the barrier up.
    let node = selectNode()
    if (!node) {
      barrier = seq
      node = selectNode()
    }
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
