'use strict'

const { setTimeout } = require('timers/promises')

const delay = (ms = rand()) => setTimeout(ms, Promise.resolve)

const rand = (min = 0, max = 100) => {
  // find diff
  const difference = max - min
  // generate random number

  let rand = Math.random()

  // multiply with difference
  rand = Math.floor(rand * difference)

  // add with min value
  rand = rand + min

  return rand
}

module.exports = { delay, rand }
