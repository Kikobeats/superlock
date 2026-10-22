const FPS = 60
const CRANK_FRAMES = 240
const TOLERANCE = 0.15
const BAND = 34
const MAX_SECONDS = 120

const settle = () => new Promise(resolve => setImmediate(resolve))

export async function recordLoop ({ createSim, machine, createLock }) {
  const sim = createSim({ machine, createLock })
  const starts = []
  sim.onTourStart(() => starts.push(sim.clock))
  const frames = []
  while (starts.length < 2) {
    sim.step(1 / FPS)
    await settle()
    if (starts.length === 1) frames.push(snapshot(sim))
    if (sim.clock > MAX_SECONDS) throw new Error('the tour never came back to rest')
  }
  return frames
}

function snapshot (sim) {
  return {
    theta: sim.theta,
    dieZ: sim.dieZ,
    counter: String(sim.stamps % 1000).padStart(3, '0'),
    readout: sim.readout(),
    tokens: sim.tokens.map(({ uid, layer, x, y, z, alpha, lit }) => ({ id: uid, layer, x, y, z, alpha, lit }))
  }
}

const stillFrame = frames => {
  const busiest = frames.findIndex(frame => frame.tokens.some(entry => entry.lit) && frame.readout.includes('in the press') && /· [3-9] awaiting/.test(frame.readout))
  return Math.max(0, busiest)
}

const percent = (index, total) => `${((index / total) * 100).toFixed(3)}%`

function simplify (values, distance) {
  const kept = [0]
  let from = 0
  while (from < values.length - 1) {
    let to = from + 1
    while (to + 1 < values.length && fits(values, from, to + 1, distance)) to++
    kept.push(to)
    from = to
  }
  return kept
}

function fits (values, from, to, distance) {
  for (let index = from + 1; index < to; index++) {
    const share = (index - from) / (to - from)
    const error = values[index].reduce((worst, value, axis) => Math.max(worst, Math.abs(value - (values[from][axis] + (values[to][axis] - values[from][axis]) * share))), 0)
    if (error > distance) return false
  }
  return true
}

function createKeyframes (seconds) {
  const rules = []
  let serial = 0
  const add = (frames, timing) => {
    const name = `a${(serial++).toString(36)}`
    rules.push(`@keyframes ${name}{${frames}}`)
    return `${name} ${seconds}s ${timing} infinite`
  }

  const motion = (values, css) => {
    const looped = [...values, values[0]]
    const kept = simplify(looped, TOLERANCE)
    if (kept.length === 2 && fits(looped, 0, looped.length - 1, 0)) return null
    return add(kept.map(index => `${percent(index, values.length)}{${css(looped[index])}}`).join(''), 'linear')
  }

  const switches = (flags, css) => {
    if (flags.every(flag => flag === flags[0])) return { always: flags[0] }
    const steps = [`0%{${css(flags[0])}}`]
    flags.forEach((flag, index) => {
      if (index > 0 && flag !== flags[index - 1]) steps.push(`${percent(index, flags.length)}{${css(flag)}}`)
    })
    steps.push(`100%{${css(flags[0])}}`)
    return { animation: add(steps.join(''), 'step-end') }
  }

  return { rules, motion, switches }
}

const translate = ([x, y]) => `transform:translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`
const visibility = flag => `visibility:${flag ? 'visible' : 'hidden'}`
const style = animations => {
  const list = animations.filter(Boolean)
  return list.length ? ` style="animation:${list.join(',')}"` : ''
}

function switched (keys, markup, flags) {
  const result = keys.switches(flags, visibility)
  if ('always' in result) return result.always ? markup : ''
  return markup.replace(/^<g/, `<g style="visibility:hidden;animation:${result.animation}"`)
}

function heldWhereAbsent (values, present) {
  const first = present.indexOf(true)
  let last = values[first]
  return values.map((value, index) => {
    if (present[index]) last = value
    return present[index] ? value : last
  })
}

export function animatedSvg ({ k, M, P, theme, frames, drawing, bodyOf, token, pinHead, blade, die, css, label, width, height }) {
  const seconds = (frames.length / FPS).toFixed(3)
  const still = (stillFrame(frames) / FPS).toFixed(3)
  const keys = createKeyframes(seconds)
  const origin = k.iso([0, 0, 0], P)
  const screen = point => {
    const [x, y] = k.iso(point, P)
    return [x - origin[0], y - origin[1]]
  }

  const moving = (markup, values) => `<g${style([keys.motion(values, translate)])}>${markup}</g>`

  const bladeTrack = frames.map(frame => screen([M.tipX(frame.theta) - M.TIP_HOME, 0, 0]))
  const postTrack = frames.map(frame => screen([M.postX(frame.theta), 0, 0]))
  const pinTrack = frames.map(frame => screen([...M.pinOf(frame.theta), 0]))
  const dieTrack = frames.map(frame => screen([0, 0, frame.dieZ]))

  const binOf = theta => ((Math.round((theta / (Math.PI * 2)) * CRANK_FRAMES) % CRANK_FRAMES) + CRANK_FRAMES) % CRANK_FRAMES
  const bins = frames.map(frame => binOf(frame.theta))
  const crank = [...new Set(bins)].sort((a, b) => a - b).map(bin => {
    const theta = (bin / CRANK_FRAMES) * Math.PI * 2
    return switched(keys, `<g>${drawing.crankSvg(theta)}${drawing.rodSvg(theta)}</g>`, bins.map(value => value === bin))
  }).join('')

  const litToken = token.replace('<g class="iso-solid"', '<g class="iso-solid" data-lit=""')
  const tokenLayer = name => {
    const ids = [...new Set(frames.flatMap(frame => frame.tokens.filter(entry => entry.layer === name).map(entry => entry.id)))].sort((a, b) => a - b)
    return ids.map(id => {
      const entries = frames.map(frame => frame.tokens.find(entry => entry.id === id && entry.layer === name))
      const present = entries.map(Boolean)
      const where = heldWhereAbsent(entries.map(entry => entry && screen([entry.x, entry.y, entry.z])), present)
      const alpha = heldWhereAbsent(entries.map(entry => entry && [entry.alpha]), present)
      const fade = keys.motion(alpha, ([value]) => `opacity:${value.toFixed(3)}`)
      const lit = switched(keys, `<g>${litToken}</g>`, entries.map(entry => Boolean(entry && entry.lit)))
      const inner = `<g${style([keys.motion(where, translate), fade])}>${token}${lit}</g>`
      return switched(keys, `<g>${inner}</g>`, present)
    }).join('')
  }

  const texts = (values, render) => [...new Set(values)].map(value => switched(keys, `<g>${render(value)}</g>`, values.map(entry => entry === value))).join('')
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

  const body = bodyOf({
    blade: moving(blade, bladeTrack),
    tokens: tokenLayer('tokens'),
    crank,
    rod: '',
    pinCrank: moving(pinHead, pinTrack),
    pinPost: moving(pinHead, postTrack),
    aborting: tokenLayer('aborting'),
    die: moving(die, dieTrack),
    bin: tokenLayer('bin'),
    counter: texts(frames.map(frame => frame.counter), value => `<text class="ml-counter" x="10" y="6.6" text-anchor="middle">${value}</text>`)
  }).join('')

  const total = height + BAND * 2
  const corner = (x, y, anchor, text, extra = '') => `<text class="ml-corner"${extra} x="${x}" y="${y}" text-anchor="${anchor}">${escape(text)}</text>`
  const readout = texts(frames.map(frame => frame.readout), value => corner(width - 22, total - 14, 'end', value, ' data-tone="strong"'))
  const extra = `
.ml-card{fill:var(--anatomy-card);stroke:var(--anatomy-faint);stroke-width:1}
.ml-corner{font:500 9.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.9px;text-transform:uppercase}
.ml-corner[data-tone="strong"]{fill:var(--anatomy-strong);text-transform:none;letter-spacing:.2px}
@media (prefers-reduced-motion:reduce){*{animation-delay:-${still}s!important;animation-play-state:paused!important}}
${keys.rules.join('\n')}`

  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso iso-svg" data-theme="${theme}" viewBox="0 0 ${width} ${total}" role="img" aria-label="${escape(label)}"><title>superlock mutex</title><style>${k.ISO_CSS}${css}${extra}</style>` +
    `<rect class="ml-card" x="0.5" y="0.5" width="${width - 1}" height="${total - 1}" rx="10"/>` +
    corner(22, 24, 'start', 'Fig 1') + corner(width - 22, 24, 'end', 'superlock · mutex') +
    corner(22, total - 14, 'start', 'Open the interactive version ↗') + readout +
    `<g transform="translate(0 ${BAND})">${body}</g></svg>`
}
