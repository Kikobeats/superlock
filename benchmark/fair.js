'use strict'

const { createFairQueue, createLock } = require('superlock')

const cycles = 100_000
const runs = 7

const elapsed = async (lock, keys) => {
  let errors = 0
  const started = process.hrtime.bigint()
  await Promise.all(
    Array.from({ length: cycles }, (_, index) =>
      lock(undefined, keys === 0 ? undefined : index % keys).then(release => {
        if (typeof release !== 'function') {
          errors++
          return
        }
        release()
      })
    )
  )
  return { ms: Number(process.hrtime.bigint() - started) / 1e6, errors }
}

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const main = async () => {
  const slots = 8
  await elapsed(createLock(slots), 0)
  await elapsed(createFairQueue(slots), 1)
  for (const keys of [1, 10, 1000]) {
    const ratios = []
    let errors = 0
    for (let run = 0; run < runs; run++) {
      const fifo = await elapsed(createLock(slots), 0)
      const fair = await elapsed(createFairQueue(slots), keys)
      errors += fifo.errors + fair.errors
      ratios.push(fair.ms / fifo.ms)
    }
    const med = median(ratios)
    console.log(
      `${keys} keys  median ${med.toFixed(2)}x  range ${Math.min(
        ...ratios
      ).toFixed(2)}-${Math.max(...ratios).toFixed(
        2
      )}  runs ${runs}  grants ${cycles}  errors ${errors}`
    )
  }
}

main()
