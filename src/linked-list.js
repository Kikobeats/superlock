'use strict'

class Node {
  constructor (data) {
    this.data = data
  }
}

module.exports = class LinkedList {
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

  prepend (data) {
    const node = new Node(data)
    node.next = this.head
    if (this.head) this.head.prev = node
    else this.tail = node
    this.head = node
    this.length++
    return node
  }

  insertAfter (previous, data) {
    if (!previous) return this.prepend(data)
    const node = new Node(data)
    node.prev = previous
    node.next = previous.next
    if (previous.next) previous.next.prev = node
    else this.tail = node
    previous.next = node
    this.length++
    return node
  }

  moveToTail (node) {
    if (node === this.tail) return
    if (node.prev) node.prev.next = node.next
    else this.head = node.next
    node.next.prev = node.prev
    node.prev = this.tail
    node.next = undefined
    this.tail.next = node
    this.tail = node
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
