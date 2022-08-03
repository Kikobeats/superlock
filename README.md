![Last version](https://img.shields.io/github/tag/Kikobeats/lock.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/Kikobeats/lock.svg?style=flat-square)](https://coveralls.io/github/Kikobeats/lock)
[![NPM Status](https://img.shields.io/npm/dm/lock.svg?style=flat-square)](https://www.npmjs.org/package/lock)

> The simplest mutex/semaphore implementation you will find in JavaScript.

## Why

- Less than 50 lines of code (> 500 bytes)
- Mutex & Semaphore patterns
- Node/Deno/Browser support
- Good performance
- Promise API style
- No dependencies

## Install

```bash
$ npm install @kikobeats/lock --save
```

## Usage

### as mutex

The lock is a mutex by default:

```js
const createLock = require('@kikobeats/lock')
const delay = require('delay')

const lock = createLock()

const promiseOne = lock.then(release => {
  console.log('mutual exclusion is guaranteed')
  return delay(50).then(release)
})

const promiseTwo = lock.then(release => {
  console.log('do something')
  return delay(100).then(release)
})

Promise.all([promiseOne, promiseTwo])
```

### as semaphore

Just pass the concurrency as first argument:

```js
const createLock = require('@kikobeats/lock')
const delay = require('delay')

const lock = createLock(2)

const executions = []

Promise.all(
  [...Array(100).keys()].map(async index => {
    await delay(Math.random() * 100)
    const release = await lock()
    executions.push(index)
    release()
  })
)

console.log(executions)
```

## API

### createLock([concurrency])

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
