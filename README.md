![Last version](https://img.shields.io/github/tag/Kikobeats/superlock.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/github/Kikobeats/superlock?style=flat-square)](https://coveralls.io/github/Kikobeats/superlock)
[![NPM Status](https://img.shields.io/npm/dm/superlock.svg?style=flat-square)](https://www.npmjs.org/package/superlock)

> A mutex/semaphore implementation made easy to use.

## Why

**superlock** aims to be:

- **Simple**: Designed for usage with `async` and `await`
- **Powerful**: Mutex & Semaphore patterns supported
- **Secure**: Auto lock release toa void dead locks
- **Lightweight**: No dependencies, just ~50 LOC
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

### .isLocked()

Type: `boolean`

It returns `false` if there is at least one free concurrency slots in the lock.

## License

**superlock** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/lock/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/Kikobeats/lock/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · X [@Kikobeats](https://x.com/Kikobeats)
