'use strict'

const {
  createFairLock,
  createFairQueue,
  createLock,
  withFairQueue
} = require('superlock')
const test = require('ava')

test('createFairLock is createFairQueue', t => {
  t.is(createFairLock, createFairQueue)
})

test('withFairQueue runs the function and releases', async t => {
  const queue = withFairQueue()
  t.is(await queue(async () => 'ok', 'a'), 'ok')
  t.false(queue.isLocked())
  t.is(queue.awaiting(), 0)
})

test('withFairQueue releases when the function throws', async t => {
  const queue = withFairQueue()
  await t.throwsAsync(
    queue(async () => {
      throw new Error('oh no')
    }, 'a'),
    { message: 'oh no' }
  )
  t.false(queue.isLocked())
})

test('withFairQueue skips the function when the signal aborts', async t => {
  const queue = withFairQueue(1)
  let releaseHeld
  const held = queue(
    () =>
      new Promise(resolve => {
        releaseHeld = resolve
      }),
    'a'
  )

  const controller = new AbortController()
  let ran = false
  const pending = queue(
    () => {
      ran = true
    },
    'b',
    controller.signal
  )

  controller.abort()
  t.is(await pending, undefined)
  t.false(ran)

  releaseHeld()
  await held
  t.false(queue.isLocked())
})

test('rotates the next slot across keys', async t => {
  const lock = createFairQueue(1)
  const releaseA = await lock(undefined, 'a')
  const pending = new Map()
  for (const key of ['a', 'b', 'a', 'b']) {
    const list = pending.get(key) ?? []
    list.push(lock(undefined, key))
    pending.set(key, list)
  }

  t.is(lock.awaiting(), 4)

  const granted = []
  let holder = releaseA
  for (const key of ['b', 'a', 'b', 'a']) {
    holder()
    holder = await pending.get(key).shift()
    granted.push(key)
  }
  holder()

  t.deepEqual(granted, ['b', 'a', 'b', 'a'])
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('a drained key does not skip the keys behind it', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'held')
  const order = []
  const wait = key =>
    lock(undefined, key).then(next => {
      order.push(key)
      return next
    })

  const first = wait('a')
  const middle = wait('b')
  const last = wait('c')
  const again = wait('a')

  release()
  for (const pending of [first, middle, last, again]) (await pending)()

  t.deepEqual(order, ['a', 'b', 'c', 'a'])
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('aborting the rest of a served key continues with the next key', async t => {
  const lock = createFairQueue(1)
  const held = await lock(undefined, 'held')
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })

  const first = track('a')
  const again = track('a')
  const middle = track('b')
  const controller = new AbortController()
  const dropped = lock(controller.signal, 'b')
  const last = track('c')

  held()
  const releaseFirst = await first
  releaseFirst()
  const releaseMiddle = await middle
  controller.abort()
  t.is(await dropped, null)
  releaseMiddle()
  const releaseLast = await last
  releaseLast()
  const releaseAgain = await again
  releaseAgain()

  t.deepEqual(order, ['a', 'b', 'c', 'a'])
})

test('a key can wait again after it left the ring', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'a')
  const controller = new AbortController()
  const aborted = lock(controller.signal, 'b')
  controller.abort()
  t.is(await aborted, null)

  const again = lock(undefined, 'b')
  t.is(lock.awaiting(), 1)
  release()
  const releaseAgain = await again
  t.is(lock.awaiting(), 0)
  releaseAgain()
  t.false(lock.isLocked())
})

test('null is its own key', async t => {
  const lock = createFairQueue(1)
  const held = await lock(undefined, null)
  const order = []
  const track = (key, label) =>
    lock(undefined, key).then(release => {
      order.push(label)
      return release
    })

  const nullWaiter = track(null, 'null')
  const shared = track(undefined, 'shared')

  held()
  const releaseShared = await shared
  releaseShared()
  const releaseNull = await nullWaiter
  releaseNull()

  t.deepEqual(order, ['shared', 'null'])
})

test('two slots can be held while a third waits', async t => {
  const lock = createFairQueue(2)
  const releaseA = await lock(undefined, 'a')
  const releaseB = await lock(undefined, 'b')
  t.true(lock.isLocked())
  t.is(lock.awaiting(), 0)

  let woke = false
  const pending = lock(undefined, 'c').then(release => {
    woke = true
    return release
  })
  t.is(lock.awaiting(), 1)
  t.false(woke)

  releaseA()
  const releaseC = await pending
  t.true(woke)
  t.true(lock.isLocked())
  t.is(lock.awaiting(), 0)

  releaseB()
  releaseC()
  t.false(lock.isLocked())
})

test('defaults to a single slot', async t => {
  const lock = createFairQueue()
  const release = await lock()
  t.true(lock.isLocked())
  const pending = lock()
  t.is(lock.awaiting(), 1)
  release()
  const releaseNext = await pending
  releaseNext()
  t.false(lock.isLocked())
  t.is(lock.awaiting(), 0)
})

test('keeps FIFO order within a key', async t => {
  const lock = createFairQueue(1)
  const releaseA = await lock(undefined, 'a')
  const granted = []
  const first = lock(undefined, 'a').then(release => {
    granted.push('first')
    return release
  })
  const second = lock(undefined, 'a').then(release => {
    granted.push('second')
    return release
  })

  releaseA()
  const releaseFirst = await first
  releaseFirst()
  const releaseSecond = await second
  releaseSecond()

  t.deepEqual(granted, ['first', 'second'])
})

test('a single key is served in arrival order', async t => {
  const fair = createFairQueue(1)
  const fifo = createLock(1)
  const run = async lock => {
    const granted = []
    const release = await lock(undefined, 'only')
    const queued = [1, 2, 3].map(n =>
      lock(undefined, 'only').then(next => {
        granted.push(n)
        return next
      })
    )
    release()
    for (const pending of queued) (await pending)()
    return granted
  }

  t.deepEqual(await run(fair), await run(fifo))
})

test('a key that is not waiting gets the free slot', async t => {
  const lock = createFairQueue(1)
  const releaseA = await lock(undefined, 'a')
  let b = false
  const pending = lock(undefined, 'b').then(release => {
    b = true
    return release
  })
  t.is(lock.awaiting(), 1)
  releaseA()
  const releaseB = await pending
  t.true(b)
  t.is(lock.awaiting(), 0)
  releaseB()
  t.false(lock.isLocked())
})

test('aborting a queued acquire resolves to null', async t => {
  const lock = createFairQueue(1)
  const releaseA = await lock(undefined, 'a')
  const controller = new AbortController()
  const pending = lock(controller.signal, 'b')

  t.true(lock.isLocked())
  t.is(lock.awaiting(), 1)

  controller.abort()
  t.is(await pending, null)
  t.is(lock.awaiting(), 0)

  releaseA()
  t.false(lock.isLocked())
})

test('an already-aborted signal resolves to null without taking a slot', async t => {
  const lock = createFairQueue(1)
  const controller = new AbortController()
  controller.abort()

  t.is(await lock(controller.signal, 'a'), null)
  t.false(lock.isLocked())
  t.is(lock.awaiting(), 0)

  const release = await lock(undefined, 'b')
  t.true(lock.isLocked())
  release()
})

test('a cancelled waiter does not steal the slot from a live one', async t => {
  const lock = createFairQueue(1)
  const releaseA = await lock(undefined, 'a')
  const controller = new AbortController()
  const order = []

  const pendingB = lock(controller.signal, 'b')
  const pendingC = lock(undefined, 'c').then(release => {
    order.push('c')
    return release
  })

  t.is(lock.awaiting(), 2)
  controller.abort()
  t.is(await pendingB, null)

  releaseA()
  const releaseC = await pendingC
  t.deepEqual(order, ['c'])
  t.is(lock.awaiting(), 0)

  releaseC()
  t.false(lock.isLocked())
})

test('aborting after the slot was granted is a no-op', async t => {
  const lock = createFairQueue(1)
  const releaseA = await lock(undefined, 'a')
  const controller = new AbortController()
  const pendingB = lock(controller.signal, 'b')

  releaseA()
  const releaseB = await pendingB
  t.truthy(releaseB)

  controller.abort()
  t.true(lock.isLocked())
  t.is(lock.awaiting(), 0)

  releaseB()
  t.false(lock.isLocked())
})

test('null signal acquires like a missing signal', async t => {
  const lock = createFairQueue(1)
  const release = await lock(null, 'a')
  t.true(lock.isLocked())
  release()
  t.false(lock.isLocked())
})

test('a non-signal rejects', async t => {
  const lock = createFairQueue(1)
  await t.throwsAsync(lock('nope', 'a'), { instanceOf: TypeError })
  t.false(lock.isLocked())
})

test('an empty key leaves the ring', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'held')
  const controllers = []
  const pending = []
  for (let i = 0; i < 10_000; i++) {
    const controller = new AbortController()
    controllers.push(controller)
    pending.push(lock(controller.signal, `k${i}`))
  }
  t.is(lock.awaiting(), 10_000)
  for (const controller of controllers) controller.abort()
  await Promise.all(pending)
  t.is(lock.awaiting(), 0)

  release()
  t.false(lock.isLocked())

  const again = await lock(undefined, 'after')
  t.true(lock.isLocked())
  t.is(lock.awaiting(), 0)
  again()
})

test('awaiting counts every key', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'a')
  const secondA = lock(undefined, 'a')
  const b = lock(undefined, 'b')
  const thirdA = lock(undefined, 'a')
  t.is(lock.awaiting(), 3)

  release()
  const releaseB = await b
  t.is(lock.awaiting(), 2)
  releaseB()

  const releaseSecond = await secondA
  t.is(lock.awaiting(), 1)
  releaseSecond()

  const releaseThird = await thirdA
  t.is(lock.awaiting(), 0)
  releaseThird()
  t.false(lock.isLocked())
})

test('aborting one waiter of a key leaves the rest of that key', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'a')
  const controller = new AbortController()
  const aborted = lock(controller.signal, 'b')
  const live = lock(undefined, 'b')
  controller.abort()
  t.is(await aborted, null)
  t.is(lock.awaiting(), 1)
  release()
  const releaseLive = await live
  t.is(lock.awaiting(), 0)
  releaseLive()
  t.false(lock.isLocked())
})

test('callers without a key share one queue', async t => {
  const lock = createFairQueue(1)
  const release = await lock()
  const first = lock()
  const second = lock()
  t.is(lock.awaiting(), 2)
  release()
  const releaseFirst = await first
  t.is(lock.awaiting(), 1)
  releaseFirst()
  const releaseSecond = await second
  releaseSecond()
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})
