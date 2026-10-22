[![Last version](https://img.shields.io/github/v/tag/Kikobeats/superlock?style=flat-square)](https://github.com/Kikobeats/superlock/releases)
[![Coverage Status](https://img.shields.io/coverallsCoverage/github/Kikobeats/superlock?style=flat-square)](https://coveralls.io/github/Kikobeats/superlock)
[![NPM Status](https://img.shields.io/npm/dm/superlock?style=flat-square)](https://www.npmjs.com/package/superlock)

> A mutex/semaphore implementation made easy to use.

## Why

**superlock** aims to be:

- **Simple**: Designed for usage with `async` and `await`
- **Powerful**: Mutex, semaphore, and fair queuing
- **Secure**: Auto lock release to avoid deadlocks
- **Lightweight**: No dependencies
- **Well-tested**: 100% code coverage

## Install

```bash
$ npm install superlock --save
```

## Usage

### as mutex

The lock is a mutex by default: one caller holds it, the rest wait in arrival order.

<a href="https://kikobeats.github.io/superlock/#/?id=as-mutex">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/anatomy/mutex.svg">
    <img alt="A coin-feed escapement: tokens queue in a column, a pusher one token thick carries exactly one at a time to a press, and the next drops in only after release()." src="docs/anatomy/mutex-light.svg">
  </picture>
</a>

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

Call `withLock(n)` with `n` as the maximum concurrency for the lock. Up to `n` callers hold it at once; a freed slot goes to the oldest waiter:

<a href="https://kikobeats.github.io/superlock/#/?id=as-semaphore">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/anatomy/semaphore.svg">
    <img alt="Twin lanes fed by one column: a diverter drops the oldest waiting token into whichever of two lanes is free, and each lane releases on its own." src="docs/anatomy/semaphore-light.svg">
  </picture>
</a>

```js
const { setTimeout } = require('timers/promises')
const { withLock } = require('superlock')

const lock = withLock(2)

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

### as fair queue

`withLock` and `createLock` are one FIFO queue. A caller that enqueues a lot of work keeps taking the next slot.

`withFairQueue` is [fair queuing](https://en.wikipedia.org/wiki/Fair_queuing): one queue per key, and a free slot rotates across those keys. The same key is still served in arrival order. Callers that omit the key share one queue.

<a href="https://kikobeats.github.io/superlock/#/?id=as-fair-queue">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/anatomy/fair-queue.svg">
    <img alt="An indexing table: one column per key around a rotating dial that feeds one press, visiting the keys in turn so a deep column cannot starve the others." src="docs/anatomy/fair-queue-light.svg">
  </picture>
</a>

```js
const { withFairQueue } = require('superlock')

const queue = withFairQueue()

await queue(async () => {
  /* your code execution */
}, userId)
```

A second queued call for the same user waits until each other waiting user has had a turn. Pass an `AbortSignal` as the third argument when the caller can give up. Aborting while the call is queued skips the function.

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

The fair queue behind `withFairQueue`, in the same way `createLock` is behind `withLock`. The promise resolves to a release function you call when the work is done. `createFairLock` is this function.

```js
const { createFairQueue } = require('superlock')

const queue = createFairQueue()
const release = await queue(undefined, key)

release()
```

One key is served in arrival order. Across keys, a free slot goes to the waiting key that has gone longest without a turn; keys that never had one go first, in arrival order. A key that still holds a slot waits behind keys that hold none. Calls that arrive while a round is being served wait until every call that was already waiting has had its turn.

A missing key shares one queue. Any other value, including `null`, is its own queue. `null` and a missing signal do not cancel. A value that is not an `AbortSignal` throws `TypeError`. Aborting after the slot was granted does nothing.

#### slots

Type: `number`<br>
Default: `1`

How many callers can hold the queue at once.

#### signal

Type: `AbortSignal`

Optional first argument. Aborting it while the call is queued resolves `null` and does not take a slot.

#### key

Type: any

Optional second argument. Identifies the queue.

### withFairQueue([slots=1])

It returns a function that runs your code under [fair queuing](https://en.wikipedia.org/wiki/Fair_queuing). The queue is released when the function finishes, including when it throws.

```js
const { withFairQueue } = require('superlock')

const queue = withFairQueue()

await queue(() => {
  /* your code execution */
}, key)
```

An `AbortSignal` is an optional third argument:

```js
await queue(() => {
  /* your code execution */
}, key, signal)
```

If `signal` aborts while the call is still queued, the function is skipped and the call resolves `undefined`.

#### slots

Type: `number`<br>
Default: `1`

How many callers can hold the queue at once.

#### key

Type: any

Optional second argument. Identifies the queue. A missing key shares one queue.

#### signal

Type: `AbortSignal`

Optional third argument. Aborting it while the call is queued skips the function.

### .isLocked()

Type: `boolean`

It returns `false` if there is at least one free concurrency slots in the lock. `createLock`, `createFairQueue`, and `withFairQueue` expose it too.

### .awaiting()

Type: `number`

How many callers are waiting for a slot. On a fair queue that is the total across every key.

## License

**superlock** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/superlock/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/Kikobeats/superlock/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · X [@Kikobeats](https://x.com/Kikobeats)
