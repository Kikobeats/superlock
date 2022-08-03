'use strict'

module.exports = (slots = 1) => {
  const queue = []

  const release = () => {
    ++slots
    if (queue.length) acquire(queue.shift())
    return true
  }

  const acquire = () => {
    if (acquire.isLocked()) queue.push(Promise.resolve)
    else --slots
    return release
  }

  acquire.isLocked = () => slots === 0

  return acquire
}
