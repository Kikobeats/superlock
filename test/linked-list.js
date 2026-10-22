'use strict'

const test = require('ava')
const LinkedList = require('../src/linked-list')

const valuesOf = list => {
  const values = []
  for (let node = list.head; node; node = node.next) values.push(node.data)
  return values
}

test('insertAfter the tail appends', t => {
  const list = new LinkedList()
  const first = list.enqueue('a')
  list.insertAfter(first, 'b')
  list.enqueue('c')
  t.deepEqual(valuesOf(list), ['a', 'b', 'c'])
  t.is(list.tail.data, 'c')
  t.is(list.size(), 3)
})

test('moveToTail keeps every other node in order', t => {
  const list = new LinkedList()
  const first = list.enqueue('a')
  list.enqueue('b')
  const last = list.enqueue('c')
  list.moveToTail(first)
  list.moveToTail(last)
  t.deepEqual(valuesOf(list), ['b', 'a', 'c'])
  t.is(list.head.prev, undefined)
  t.is(list.tail.next, undefined)
})
