![Last version](https://img.shields.io/github/tag/superlock.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/superlock.svg?style=flat-square)](https://coveralls.io/github/superlock)
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
const { withLock } = require('superlock')
const delay = require('delay')

const lock = withLock()

const promiseOne = lock.then(() => {
  console.log('mutual exclusion is guaranteed')
  return delay(50)
})

const promiseTwo = lock.then(() => {
  console.log('do something')
  return delay(100)
})

Promise.all([promiseOne, promiseTwo])
```

### as semaphore

Just pass the desired concurrency as first argument:

```js
const { withLock } = require('superlock')
const delay = require('delay')

const lock = withLock(2)

const executions = []

Promise.all(
  [...Array(100).keys()].map(async index => {
    await delay(Math.random() * 100)
    return index
  })
)

console.log(executions)
```

## API

### withLock([concurrency=1])

It returns a function that can be used to wrap any code you want to execute with concurrency control:

```js
const { withLock } = require('superlock')

const lock = createLock()

lock().then(() => {
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

It indicates if there is at least one free concurrency slots in the lock.

## License

**superlock** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/lock/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/Kikobeats/lock/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · Twitter [@Kikobeats](https://twitter.com/Kikobeats)
