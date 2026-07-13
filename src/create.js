'use strict'

class Node {
  constructor (data) {
    this.data = data
  }
}

class LinkedList {
  constructor () {
    this.length = 0
  }

  enqueue (data) {
    const node = new Node(data)
    if (this.head) this.tail.next = node
    else this.head = node
    this.tail = node
    this.length++
  }

  dequeue () {
    if (!this.head) return
    const data = this.head.data
    this.head = this.head.next
    this.length--
    return data
  }

  size () {
    return this.length
  }
}

module.exports = (slots = 1) => {
  const queue = new LinkedList()
  let cancelled = 0

  const release = () => {
    ++slots
    let waiter
    while ((waiter = queue.dequeue()) !== undefined) {
      if (waiter.cancelled) --cancelled
      else return waiter.acquire()
    }
  }

  const acquire = resolve => {
    --slots
    resolve(release)
  }

  const lock = signal =>
    new Promise(resolve => {
      if (signal?.aborted) return resolve(null)
      if (!lock.isLocked()) return acquire(resolve)

      const waiter = { cancelled: false, acquire: () => acquire(resolve) }

      if (signal !== undefined) {
        const onAbort = () => {
          waiter.cancelled = true
          ++cancelled
          resolve(null)
        }
        waiter.acquire = () => {
          signal.removeEventListener('abort', onAbort)
          acquire(resolve)
        }
        signal.addEventListener('abort', onAbort, { once: true })
      }

      queue.enqueue(waiter)
    })

  lock.isLocked = () => slots === 0

  lock.awaiting = () => queue.size() - cancelled

  return lock
}
