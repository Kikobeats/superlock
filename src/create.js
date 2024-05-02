'use strict'

class Node {
  constructor (data) {
    this.data = data
  }
}

class LinkedList {
  enqueue (data) {
    if (!this.head) {
      this.head = new Node(data)
    } else {
      let current = this.head
      while (current.next) {
        current = current.next
      }
      current.next = new Node(data)
    }
  }

  dequeue () {
    if (!this.head) return
    const data = this.head.data
    this.head = this.head.next
    return data
  }
}

module.exports = (slots = 1) => {
  const queue = new LinkedList()

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
      lock.isLocked() ? queue.enqueue(() => acquire(resolve)) : acquire(resolve)
    )

  lock.isLocked = () => slots === 0

  return lock
}
