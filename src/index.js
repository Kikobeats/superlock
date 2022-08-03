'use strict'

module.exports = (maxConcurrency = 1) => {
  const queue = []
  let concurrency = 0

  const isLocked = () => concurrency === maxConcurrency

  const release = () => {
    --concurrency
    if (queue.length) acquire(queue.shift())
  }

  const acquire = () =>
    new Promise(resolve => {
      if (isLocked()) return queue.push(resolve)
      ++concurrency
      return resolve(release)
    })

  acquire.isLocked = isLocked

  return acquire
}
