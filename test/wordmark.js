'use strict'

const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { createLock } = require('superlock')
const test = require('ava')

const settle = () => new Promise(resolve => setImmediate(resolve))

async function wordmark () {
  const { createSim } = await import('../docs/anatomy/wordmark/sim.mjs')
  const { TIMING, DEMO } = await import('../docs/anatomy/wordmark/machine.mjs')
  const letters = ['s', 'u', 'p', 'e', 'r', 'l', 'o', 'c', 'k']
  return {
    letters,
    create () {
      return createSim({
        machine: {
          stations: letters.map((_, index) => index * 12),
          park: -40,
          letters,
          TIMING,
          DEMO
        },
        createLock
      })
    }
  }
}

async function untilIdle (sim) {
  for (let step = 0; step < 60 * 30; step++) {
    sim.step(1 / 60)
    await settle()
    if (!sim.busy()) return
  }
  throw new Error('wordmark sim did not return to idle')
}

test('a second press on a waiting letter aborts it and leaves the rest queued', async t => {
  const { create, letters } = await wordmark()
  const sim = create()
  const index = char => letters.indexOf(char)

  sim.press(index('s'))
  await settle()
  sim.press(index('u'))
  sim.press(index('p'))
  await settle()

  t.is(sim.letters[index('u')].state, 'waiting')
  sim.press(index('u'))
  await settle()

  t.is(sim.letters[index('u')].state, 'idle')
  t.deepEqual(
    sim.waiting.map(letter => letter.char),
    ['p']
  )
  t.true(sim.history.includes('u aborted'))

  await untilIdle(sim)
  t.false(sim.history.includes('u holds the lock'))
  t.false(sim.history.some(line => line.startsWith('u toggled')))
  t.true(sim.history.includes('p holds the lock'))
})

test('letters are served in arrival order and a second service toggles them off', async t => {
  const { create, letters } = await wordmark()
  const sim = create()
  const index = char => letters.indexOf(char)

  sim.press(index('s'))
  await settle()
  sim.press(index('u'))
  sim.press(index('p'))
  await settle()
  await untilIdle(sim)

  t.deepEqual(
    sim.history.filter(line => line.endsWith('holds the lock')),
    ['s holds the lock', 'u holds the lock', 'p holds the lock']
  )
  t.deepEqual(
    sim.letters.filter(letter => letter.on).map(letter => letter.char),
    ['s', 'u', 'p']
  )

  sim.press(index('s'))
  await settle()
  await untilIdle(sim)
  t.true(sim.history.includes('s toggled off'))
  t.false(sim.letters[index('s')].on)
})

test('pressing the holder is ignored, and the status does not say free while a letter waits', async t => {
  const { create, letters } = await wordmark()
  const sim = create()
  const index = char => letters.indexOf(char)

  sim.press(index('s'))
  await settle()
  sim.press(index('s'))
  t.is(sim.holder.char, 's')
  t.true(sim.history.includes('s is being served · ignored'))

  sim.press(index('u'))
  await settle()
  t.false(sim.status().startsWith('free'))
  t.true(sim.status().includes('u waiting'))
})

function hitsOf (html) {
  const start = html.indexOf('"hits":')
  const open = html.indexOf('[', start)
  let depth = 0
  for (let index = open; index < html.length; index++) {
    if (html[index] === '[') depth++
    else if (html[index] === ']' && --depth === 0) {
      return JSON.parse(html.slice(open, index + 1))
    }
  }
  return null
}

test('wordmark hit slots stay at least 60 viewBox units wide', t => {
  for (const name of ['wordmark.html', 'wordmark-light.html']) {
    const html = readFileSync(join('docs/anatomy', name), 'utf8')
    const hits = hitsOf(html)
    t.truthy(hits, name)
    t.is(hits.length, 9)
    hits.forEach(([left, top, right, bottom], index) => {
      t.true(right - left >= 59.9, `${name} slot ${index} is ${right - left}`)
      t.true(bottom > top)
      if (index > 0) t.is(left, hits[index - 1][2])
    })
  }
})
