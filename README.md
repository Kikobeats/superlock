[![Last version](https://img.shields.io/github/v/tag/Kikobeats/superlock?style=flat-square)](https://github.com/Kikobeats/superlock/releases)
[![Coverage Status](https://img.shields.io/coverallsCoverage/github/Kikobeats/superlock?style=flat-square)](https://coveralls.io/github/Kikobeats/superlock)
[![NPM Status](https://img.shields.io/npm/dm/superlock?style=flat-square)](https://www.npmjs.com/package/superlock)

> A mutex/semaphore implementation made easy to use.

## Why

**superlock** aims to be:

- **Simple**: Designed for usage with `async` and `await`
- **Powerful**: Mutex, semaphore, and fair queuing
- **Secure**: Auto lock release toa void dead locks
- **Lightweight**: No dependencies
- **Well-tested**: 100% code coverage

## Install

```bash
$ npm install superlock --save
```

## Usage

### as mutex

The lock is a mutex by default:

```js
const { setTimeout } = require('timers/promises')
const { withLock } = require('superlock')

const lock = withLock()

const executions = await Promise.all(
  [...Array(10).keys()].map(index =>
    lock(async () => {
      await setTimeout(Math.random() * 100)
      return index
    })
  )
)

console.log(executions)
```

### as semaphore

Just call `withLock(n)` being `n` the maximum of concurrency desired for the lock.

### fair queuing

`withLock` and `createLock` are one FIFO queue. A caller that enqueues a lot of work keeps taking the next slot.

`createFairQueue` is [fair queuing](https://en.wikipedia.org/wiki/Fair_queuing): one queue per key, and a free slot rotates across those keys. The same key is still served in arrival order. Callers that omit the key share one queue. You call the release function yourself:

```js
const { createFairQueue } = require('superlock')

const lock = createFairQueue()

const run = async (userId, fn) => {
  const release = await lock(undefined, userId)
  if (!release) return
  try {
    return await fn()
  } finally {
    release()
  }
}
```

A second queued call for the same user waits until each other waiting user has had a turn. Pass an `AbortSignal` as the first argument when the caller can give up. Aborting while the call is queued resolves `null`.

### with cancellation

Pass an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) to drop an acquisition that is still waiting in the queue — handy for shedding work whose caller already gave up (a timed-out request, a disconnected client):

```js
const { withLock } = require('superlock')

const lock = withLock()
const controller = new AbortController()

const pending = lock(() => doWork(), controller.signal)

// caller no longer needs the result: give the queued slot back
controller.abort()

await pending // resolves `undefined`; `doWork` never runs
```

If the signal aborts **before** the slot is granted, the acquisition is dropped: it never takes a slot and the wrapped function never runs. Aborting **after** the slot is granted is a no-op (the work is already running). Aborting is silent — it resolves instead of throwing — so shedding a lot of queued work never produces rejections to handle.

## API

### withLock([concurrency=1])

It returns a function that can be used to wrap any code you want to execute with concurrency control:

```js
const { withLock } = require('superlock')

const lock = withLock()

await lock(() => {
  /* your code execution */
})
```

The lock will be automatically released after your code execution is done even if an error occurred, avoiding [deadlock](https://en.wikipedia.org/wiki/Deadlock) situations.

It also accepts an optional `AbortSignal` as second argument:

```js
await lock(() => {
  /* your code execution */
}, signal)
```

If `signal` aborts while the call is still queued, the function is skipped and the call resolves `undefined` instead of running. Aborting after the slot is granted has no effect.

#### concurrency

Type: `number`<br>
Default: `1`

It sets the maximum of concurrency allowed for the lock.

#### signal

Type: `AbortSignal`

When provided, aborting it drops the acquisition while it is still waiting in the queue: no slot is taken and the wrapped function never runs.

### createLock([slots=1])

The FIFO semaphore behind `withLock`. The promise resolves to a release function you call when the work is done:

```js
const { createLock } = require('superlock')

const lock = createLock()
const release = await lock()

try {
  /* your code execution */
} finally {
  release()
}
```

An optional `AbortSignal` is the first argument. If it aborts while the call is queued, the promise resolves `null` and no slot is taken.

#### slots

Type: `number`<br>
Default: `1`

How many callers can hold the lock at once.

### createFairQueue([slots=1])

Fair queuing on the same contract as `createLock`, plus a key. A missing key shares one queue. Any other value, including `null`, is its own queue. `createFairLock` is this function.

```js
const { createFairQueue } = require('superlock')

const lock = createFairQueue()
const release = await lock(undefined, key)

release()
```

One key is served in arrival order. Across keys, a free slot goes to the next key that is waiting, then wraps around. A key with nobody left waiting leaves the rotation.

`null` and a missing signal do not cancel. A value that is not an `AbortSignal` throws `TypeError`. Aborting after the slot was granted does nothing.

#### slots

Type: `number`<br>
Default: `1`

How many callers can hold the lock at once.

#### signal

Type: `AbortSignal`

Optional first argument. Aborting it while the call is queued resolves `null` and does not take a slot.

#### key

Type: any

Optional second argument. Identifies the queue.

### .isLocked()

Type: `boolean`

It returns `false` if there is at least one free concurrency slots in the lock. `createLock` and `createFairQueue` expose it too.

### .awaiting()

Type: `number`

How many callers are waiting for a slot. On a fair queue that is the total across every key.

## License

**superlock** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/lock/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/Kikobeats/lock/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · X [@Kikobeats](https://x.com/Kikobeats)
