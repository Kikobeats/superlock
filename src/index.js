'use strict'

module.exports = () => {
  const queue = []
  let isLocked = false

  const release = () => {
    isLocked = false
    if (queue.length) acquire(queue.shift())
  }

  const acquire = () =>
    new Promise(resolve => {
      if (isLocked) return queue.push(resolve)
      isLocked = true
      return resolve(release)
    })

  acquire.isLocked = () => isLocked

  return acquire
}
