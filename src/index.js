'use strict'

module.exports = (slots = 1) => {
  const queue = []

  const release = () => {
    ++slots
    if (queue.length) {
      const fn = queue.shift()
      acquire(fn)
    }
  }

  const acquire = () =>
    new Promise(resolve => {
      if (acquire.isLocked()) {
        return new Promise(r => queue.push(r(resolve(release))))
      }

      --slots
      return resolve(release)
    })

  acquire.isLocked = () => slots === 0

  return acquire
}
