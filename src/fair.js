'use strict'

const LinkedList = require('./linked-list')

const SHARED = Symbol('shared')

module.exports = (slots = 1) => {
  const keys = new Map()
  const turns = new LinkedList()
  let newestWithoutTurn
  let waiting = 0
  let seq = 0
  let barrier = 0

  const entryOf = key => {
    let entry = keys.get(key)
    if (!entry) {
      entry = { key, queue: new LinkedList(), holders: 0 }
      entry.turnNode = turns.insertAfter(newestWithoutTurn, entry)
      newestWithoutTurn = entry.turnNode
      keys.set(key, entry)
    }
    return entry
  }

  const leaveTurns = entry => {
    if (entry.turnNode === newestWithoutTurn) {
      newestWithoutTurn = entry.turnNode.prev
    }
    turns.remove(entry.turnNode)
  }

  const markTurn = entry => {
    if (entry.turnNode === newestWithoutTurn) {
      newestWithoutTurn = entry.turnNode.prev
    }
    turns.moveToTail(entry.turnNode)
  }

  const forgetIfIdle = entry => {
    if (entry.holders > 0 || entry.queue.size() > 0) return
    leaveTurns(entry)
    keys.delete(entry.key)
  }

  const inRound = entry => entry.queue.head.data.joinSeq <= barrier

  // A smaller holder count does not outrank an older turn.
  const longestWithoutTurn = () => {
    let holding
    for (let node = turns.head; node; node = node.next) {
      const entry = node.data
      if (entry.queue.size() === 0 || !inRound(entry)) continue
      if (entry.holders === 0) return entry
      if (!holding) holding = entry
    }
    return holding
  }

  const nextEntry = () => {
    const entry = longestWithoutTurn()
    if (entry) return entry
    barrier = seq
    return longestWithoutTurn()
  }

  const take = entry => {
    --slots
    entry.holders++
    markTurn(entry)
    let released = false
    return () => {
      if (released) return
      released = true
      entry.holders--
      markTurn(entry)
      forgetIfIdle(entry)
      ++slots
      grant()
    }
  }

  const grant = () => {
    if (waiting === 0) return
    const entry = nextEntry()
    const waiter = entry.queue.dequeue()
    waiting--
    waiter.acquire(take(entry))
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
      if (signal?.aborted) return resolve(null)
      const entry = entryOf(key === undefined ? SHARED : key)
      if (!lock.isLocked()) return resolve(take(entry))

      const waiter = { joinSeq: ++seq, acquire: resolve }
      waiter.node = entry.queue.enqueue(waiter)
      waiting++

      if (signal != null) {
        const onAbort = () => {
          entry.queue.remove(waiter.node)
          waiting--
          forgetIfIdle(entry)
          resolve(null)
        }
        waiter.acquire = release => {
          signal.removeEventListener('abort', onAbort)
          resolve(release)
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }
    })

  lock.isLocked = () => slots === 0

  lock.awaiting = () => waiting

  return lock
}
