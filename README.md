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

#### concurrency

Type: `number`<br>
Default: `1`

It sets the maximum of concurrency allowed for the lock.

### .isLocked()

Type: `boolean`

It returns `false` if there is at least one free concurrency slots in the lock.

## License

**superlock** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/lock/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/Kikobeats/lock/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · X [@Kikobeats](https://x.com/Kikobeats)
