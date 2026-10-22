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

test('a partial signal rejects before it is queued', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'a')
  const fake = { addEventListener () {}, aborted: false }
  await t.throwsAsync(lock(fake, 'b'), { instanceOf: TypeError })
  t.is(lock.awaiting(), 0)
  t.true(lock.isLocked())
  release()
  t.false(lock.isLocked())
})

test('aborting the rest of a NaN key continues with the next key', async t => {
  const lock = createFairQueue(1)
  const held = await lock(undefined, 'held')
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(Number.isNaN(key) ? 'nan' : key)
      return release
    })

  const first = track('a')
  const again = track('a')
  const middle = track(NaN)
  const controller = new AbortController()
  const dropped = lock(controller.signal, NaN)
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

  t.deepEqual(order, ['a', 'nan', 'c', 'a'])
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

test('a requeued holder runs after keys queued before the release', async t => {
  const lock = createFairQueue(1)
  const held = await lock(undefined, 'a')
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })

  const first = track('b')
  const again = track('a')
  const last = track('c')

  held()
  for (const pending of [first, last, again]) (await pending)()

  t.deepEqual(order, ['b', 'c', 'a'])
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('keys that arrive later cannot skip a waiter forever', async t => {
  const lock = createFairQueue(1)
  let holder = await lock(undefined, 'a')
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })

  const early = track('b')
  const again = track('a')
  holder()
  holder = await early

  const late = []
  for (let i = 0; i < 20; i++) late.push(track(`u${i}`))
  holder()
  holder = await again
  for (const pending of late) {
    holder()
    holder = await pending
  }
  holder()

  t.deepEqual(order[0], 'b')
  t.deepEqual(order[1], 'a')
  t.deepEqual(
    order.slice(2),
    late.map((_, i) => `u${i}`)
  )
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('a later waiter on a sealed key waits behind a newer key', async t => {
  const lock = createFairQueue(1)
  const held = await lock(undefined, 'hold')
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })

  const early = track('a')
  const second = track('a')
  held()
  const releaseEarly = await early

  const newer = track('c')
  const late = track('a')

  releaseEarly()
  for (const pending of [second, newer, late]) (await pending)()

  t.deepEqual(order, ['a', 'a', 'c', 'a'])
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('a requeued NaN holder runs after keys queued before the release', async t => {
  const lock = createFairQueue(1)
  const held = await lock(undefined, NaN)
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(Number.isNaN(key) ? 'nan' : key)
      return release
    })

  const first = track('b')
  const again = track(NaN)
  const last = track('c')

  held()
  for (const pending of [first, last, again]) (await pending)()

  t.deepEqual(order, ['b', 'c', 'nan'])
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

test('a holder granted from the queue calls again after the keys already waiting', async t => {
  const lock = createFairQueue(1)
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })
  const runThrough = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      release()
    })

  const first = await track('a')
  const a2 = track('a')
  const b1 = track('b')
  const b2 = track('b')
  first()
  const releaseB1 = await b1
  const a3 = runThrough('a')
  releaseB1()
  ;(await a2)()
  const releaseB2 = await b2
  const b3 = runThrough('b')
  releaseB2()
  await Promise.all([a3, b3])

  t.deepEqual(order, ['a', 'b', 'a', 'b', 'a', 'b'])
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('a key still holding a slot waits behind a key holding none', async t => {
  const lock = createFairQueue(2)
  const order = []
  const runThrough = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      release()
    })

  const releaseA = await lock(undefined, 'a')
  const releaseB = await lock(undefined, 'b')
  const a2 = runThrough('a')
  const b2 = runThrough('b')
  releaseA()
  await a2
  releaseB()
  await b2

  t.deepEqual(order, ['a', 'b'])
  t.is(lock.awaiting(), 0)
  t.false(lock.isLocked())
})

test('holding more slots does not skip a key that has waited longer', async t => {
  const lock = createFairQueue(4)
  const releaseA1 = await lock(undefined, 'a')
  const releaseA2 = await lock(undefined, 'a')
  const releaseB = await lock(undefined, 'b')
  const releaseC = await lock(undefined, 'c')
  const order = []
  const queued = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })

  const thirdA = queued('a')
  const secondB = queued('b')
  releaseC()
  const releaseThirdA = await thirdA
  t.deepEqual(order, ['a'])
  t.is(lock.awaiting(), 1)

  releaseThirdA()
  const releaseSecondB = await secondB
  t.deepEqual(order, ['a', 'b'])

  releaseA1()
  releaseA2()
  releaseB()
  releaseSecondB()
  t.false(lock.isLocked())
  t.is(lock.awaiting(), 0)
})

test('a key that has never had a turn goes before one that already has', async t => {
  const lock = createFairQueue(1)
  const order = []
  const track = key =>
    lock(undefined, key).then(release => {
      order.push(key)
      return release
    })

  const releaseC = await track('c')
  const secondC = track('c')
  const firstB = track('b')
  releaseC()
  const releaseB = await firstB
  const secondB = track('b')
  releaseB()
  const releaseSecondC = await secondC
  const firstA = track('a')
  releaseSecondC()

  const next = await Promise.race([
    firstA.then(release => ({ key: 'a', release })),
    secondB.then(release => ({ key: 'b', release }))
  ])
  t.is(next.key, 'a')
  next.release()
  const releaseSecondB = await secondB
  releaseSecondB()

  t.deepEqual(order, ['c', 'b', 'c', 'a', 'b'])
  t.false(lock.isLocked())
  t.is(lock.awaiting(), 0)
})

test('releasing twice frees one slot', async t => {
  const lock = createFairQueue(1)
  const release = await lock(undefined, 'a')
  const next = lock(undefined, 'b')
  release()
  release()
  const releaseNext = await next
  t.true(lock.isLocked())
  releaseNext()
  t.false(lock.isLocked())
})

test('every waiting key gets a turn before a key calls again', async t => {
  const KEYS = ['a', 'b', 'c', 'd']
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const settle = () => new Promise(resolve => setImmediate(resolve))
  let checks = 0

  for (let trial = 0; trial < 150; trial++) {
    const slots = 1 + (trial % 3)
    const lock = createFairQueue(slots)
    const calls = []
    const pending = new Map()
    const holders = new Map()
    const served = []

    for (let step = 0; step < 30; step++) {
      const roll = random()
      if (roll < 0.55) {
        const key = KEYS[Math.floor(random() * KEYS.length)]
        const controller = new AbortController()
        const call = {
          id: calls.length,
          key,
          controller,
          ahead: [...pending.values()].filter(other => other.key === key),
          heldByKey: [...holders.values()].some(other => other.key === key),
          others: [...pending.values()].filter(
            other =>
              other.key !== key &&
              ![...holders.values()].some(holder => holder.key === other.key)
          )
        }
        calls.push(call)
        pending.set(call.id, call)
        lock(controller.signal, key).then(release => {
          pending.delete(call.id)
          if (release === null) return
          call.release = release
          call.position = served.push(call)
          holders.set(call.id, call)
        })
      } else if (roll < 0.65 && pending.size > 0) {
        const ids = [...pending.keys()]
        const call = pending.get(ids[Math.floor(random() * ids.length)])
        call.aborted = true
        call.controller.abort()
      } else if (holders.size > 0) {
        const ids = [...holders.keys()]
        const call = holders.get(ids[Math.floor(random() * ids.length)])
        holders.delete(call.id)
        call.release()
      }
      await settle()
    }
    while (holders.size > 0) {
      const [call] = holders.values()
      holders.delete(call.id)
      call.release()
      await settle()
    }

    t.is(lock.awaiting(), 0)
    for (const call of calls) {
      if (!call.position) continue
      const repeat = call.heldByKey || call.ahead.some(ahead => ahead.position)
      if (!repeat) continue
      const byKey = new Map()
      for (const other of call.others) {
        if (!other.position) continue
        byKey.set(other.key, [...(byKey.get(other.key) || []), other])
      }
      for (const others of byKey.values()) {
        checks++
        t.true(others.some(other => other.position < call.position))
      }
    }
  }
  t.true(checks > 500)
})
