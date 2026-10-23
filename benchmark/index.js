'use strict'

const { createLock, withLock } = require('superlock')

const RUNS = 7
const FREE_OPS = 1_000_000
const WRAP_OPS = 200_000
const BURSTS = 200
const DEPTH = 1000

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[(sorted.length / 2) | 0]
}

const sample = async work => {
  const samples = []
  let errors = 0
  for (let run = 0; run < RUNS; run++) {
    const started = process.hrtime.bigint()
    try {
      await work()
    } catch (error) {
      errors++
      console.error(error)
    }
    samples.push(Number(process.hrtime.bigint() - started) / 1e6)
  }
  return {
    med: median(samples),
    min: Math.min(...samples),
    max: Math.max(...samples),
    errors
  }
}

const report = (name, result, work) => {
  console.log(
    `${name}  median ${result.med.toFixed(1)}ms  range ${result.min.toFixed(
      1
    )}-${result.max.toFixed(1)}  work ${work}  errors ${result.errors}  runs ${RUNS}`
  )
}

const main = async () => {
  const free = await sample(async () => {
    const lock = createLock()
    for (let i = 0; i < FREE_OPS; i++) {
      const release = await lock()
      if (typeof release !== 'function') throw new Error('missing release')
      release()
    }
  })
  report('createLock free', free, FREE_OPS)

  const wrapped = await sample(async () => {
    const lock = withLock()
    for (let i = 0; i < WRAP_OPS; i++) {
      const value = await lock(async () => 1)
      if (value !== 1) throw new Error('bad value')
    }
  })
  report('withLock async', wrapped, WRAP_OPS)

  const queued = await sample(async () => {
    const lock = createLock()
    for (let burst = 0; burst < BURSTS; burst++) {
      const held = await lock()
      const pending = new Array(DEPTH)
      for (let i = 0; i < DEPTH; i++) pending[i] = lock()
      held()
      for (let i = 0; i < DEPTH; i++) {
        const release = await pending[i]
        if (typeof release !== 'function') throw new Error('missing release')
        release()
      }
      if (lock.isLocked() || lock.awaiting() !== 0) {
        throw new Error('queue did not drain')
      }
    }
  })
  report('createLock queue', queued, BURSTS * DEPTH)

  if (free.errors || wrapped.errors || queued.errors) process.exitCode = 1
}

main()
