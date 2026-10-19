'use strict'

const { withFairQueue, createLock } = require('superlock')

const cycles = 100_000

const elapsed = async (lock, keys) => {
  const started = process.hrtime.bigint()
  await Promise.all(
    Array.from({ length: cycles }, (_, index) =>
      lock(undefined, keys === 0 ? undefined : index % keys).then(release =>
        release()
      )
    )
  )
  return Number(process.hrtime.bigint() - started) / 1e6
}

const main = async () => {
  const slots = 8
  await elapsed(createLock(slots), 0)
  await elapsed(withFairQueue(slots), 1)
  for (const keys of [1, 10, 1000]) {
    const fifo = await elapsed(createLock(slots), 0)
    const fair = await elapsed(withFairQueue(slots), keys)
    const ratio = fair / fifo
    const budget = keys < 1000 ? 'budget 1.10' : 'recorded'
    console.log(
      `${keys} keys  fifo ${fifo.toFixed(1)}ms  fair ${fair.toFixed(
        1
      )}ms  ${ratio.toFixed(2)}x  ${budget}`
    )
  }
}

main()
