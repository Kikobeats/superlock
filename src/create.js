'use strict'

class Node {
  constructor (data) {
    this.data = data
  }
}

class DoublyLinkedList {
  enqueue (data) {
    const node = new Node(data)
    if (!this.head) {
      this.head = node
      this.tail = node
    } else {
      node.prev = this.tail
      this.tail.next = node
      this.tail = node
    }
  }

  dequeue () {
    if (!this.head) return
    const data = this.head.data
    this.head = this.head.next
    if (this.head) this.head.prev = undefined
    else this.tail = undefined
    return data
  }
}

module.exports = (slots = 1) => {
  const queue = new DoublyLinkedList()

  const release = () => {
    ++slots
    const fn = queue.dequeue()
    if (fn !== undefined) fn()
  }

  const acquire = resolve => {
    --slots
    resolve(release)
  }

  const lock = () =>
    new Promise(resolve =>
      lock.isLocked()
        ? queue.enqueue(acquire.bind(null, resolve))
        : acquire(resolve)
    )

  lock.isLocked = () => slots === 0

  return lock
}
