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
    node.prev = this.tail
    if (this.tail) this.tail.next = node
    else this.head = node
    this.tail = node
    this.length++
    return node
  }

  dequeue () {
    if (!this.head) return
    const { data } = this.head
    this.remove(this.head)
    return data
  }

  remove (node) {
    if (node.prev) node.prev.next = node.next
    else this.head = node.next
    if (node.next) node.next.prev = node.prev
    else this.tail = node.prev
    this.length--
  }

  size () {
    return this.length
  }
}

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
      if (signal?.aborted) return resolve(null)
      if (!lock.isLocked()) return acquire(resolve)

      const waiter = { acquire: () => acquire(resolve) }
      const node = queue.enqueue(waiter)

      if (signal !== undefined) {
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
