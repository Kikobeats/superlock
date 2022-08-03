![Last version](https://img.shields.io/github/tag/@Kikobeats/lock.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/@Kikobeats/lock.svg?style=flat-square)](https://coveralls.io/github/@Kikobeats/lock)
[![NPM Status](https://img.shields.io/npm/dm/@Kikobeats/lock.svg?style=flat-square)](https://www.npmjs.org/package/@Kikobeats/lock)

> A mutex/semaphore implementation made easy to use.

## Why

**@kikobeats/lock** aims to be:

- **Simple**: Designed for usage with `async` and `await`
- **Powerful**: Mutex & Semaphore patterns supported
- **Resilient**: Error handling to avoid dead locks
- **Lightweight**: No dependencies, just ~50 LOC

## Install

```bash
$ npm install @kikobeats/lock --save
```

## Usage

### as mutex

The lock is a mutex by default:

```js
const { withLock } = require('@kikobeats/lock')
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
const { withLock } = require('@kikobeats/lock')
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

### withLock([concurrency])

It returns a new lock.

#### concurrency

Type: `number`<br>
Default: `1`

It sets the maximum of concurrency allowed for the lock.

### .isLocked()

Type: `boolean`

It indicates if there is at least one free concurrency slots in the lock.

## License

**@kikobeats/lock** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/lock/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/Kikobeats/lock/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · Twitter [@Kikobeats](https://twitter.com/Kikobeats)
