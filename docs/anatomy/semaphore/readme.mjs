const FPS = 60
const CRANK_FRAMES = 44
const TOLERANCE = 0.15
const BAND = 34
const MAX_SECONDS = 120
const TOKEN_LAYERS = ['tokens-1', 'tokens-2', 'notch-1', 'notch-2', 'drop', 'column', 'arrival', 'aborting', 'bin-1', 'bin-2']

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
    lanes: sim.lanes.map(lane => ({ theta: lane.theta, dieZ: sim.dieZ(lane), counter: String(sim.counterOf(lane) % 1000).padStart(3, '0') })),
    gate: sim.gate.s,
    pawl: sim.pawl,
    readout: sim.readout(),
    held: sim.holders().length,
    tokens: sim.tokens.map(({ uid, layer, x, y, z, alpha, lit }) => ({ id: uid, layer, x, y, z, alpha, lit }))
  }
}

const stillFrame = frames => {
  const busiest = frames.findIndex(frame => frame.held === 2 && frame.lanes.every(lane => lane.dieZ < 40) && /· [2-9] awaiting/.test(frame.readout))
  const fallback = frames.findIndex(frame => frame.held === 2 && /· [2-9] awaiting/.test(frame.readout))
  return Math.max(0, busiest >= 0 ? busiest : fallback)
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

const binOf = theta => ((Math.round((theta / (Math.PI * 2)) * CRANK_FRAMES) % CRANK_FRAMES) + CRANK_FRAMES) % CRANK_FRAMES

export function animatedSvg ({ k, M, P, theme, frames, drawing, bodyOf, parts, css, label, width, height }) {
  const seconds = (frames.length / FPS).toFixed(3)
  const still = (stillFrame(frames) / FPS).toFixed(3)
  const keys = createKeyframes(seconds)
  const origin = k.iso([0, 0, 0], P)
  const screen = point => {
    const [x, y] = k.iso(point, P)
    return [x - origin[0], y - origin[1]]
  }

  const moving = (markup, values) => `<g${style([keys.motion(values, translate)])}>${markup}</g>`
  const texts = (values, render) => [...new Set(values)].map(value => switched(keys, `<g>${render(value)}</g>`, values.map(entry => entry === value))).join('')
  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

  const laneParts = M.LANES.map((spec, index) => {
    const lanes = frames.map(frame => frame.lanes[index])
    const bins = lanes.map(lane => binOf(lane.theta))
    const crank = [...new Set(bins)].sort((a, b) => a - b).map(bin => {
      const theta = (bin / CRANK_FRAMES) * Math.PI * 2
      return switched(keys, `<g>${drawing.crankSvg(spec, theta)}${drawing.rodSvg(spec, theta)}</g>`, bins.map(value => value === bin))
    }).join('')
    const id = spec.id
    return {
      [`blade-${id}`]: moving(parts.blade[index], lanes.map(lane => screen([M.tipX(lane.theta) - M.TIP_HOME, 0, 0]))),
      [`crank-${id}`]: crank,
      [`rod-${id}`]: '',
      [`pin-crank-${id}`]: moving(parts.pinHead[index], lanes.map(lane => screen([...M.pinOf(spec, lane.theta), 0]))),
      [`pin-post-${id}`]: moving(parts.pinHead[index], lanes.map(lane => screen([M.postX(lane.theta), spec.y, 0]))),
      [`die-${id}`]: moving(parts.die[index], lanes.map(lane => screen([0, 0, lane.dieZ]))),
      [`counter-${id}`]: texts(lanes.map(lane => lane.counter), value => `<text class="ml-counter" x="20.3" y="9.8" text-anchor="middle">${value}</text>`)
    }
  })

  const gateTrack = frames.map(frame => screen([0, frame.gate, 0]))
  const gate = Object.fromEntries(['gate-back', 'gate-mid', 'gate-front'].map(name => [name, moving(parts.gate[name], gateTrack)]))
  const pawls = Object.fromEntries(M.PAWL_PARTS.map(([name, [dx, dy]]) => [name, moving(parts.pawls[name], frames.map(frame => screen([dx * M.ESC.pawl * frame.pawl, dy * M.ESC.pawl * frame.pawl, 0])))]))

  const defs = `<defs><g id="sl-token">${parts.token}</g><g id="sl-token-lit">${parts.token.replace('<g class="iso-solid"', '<g class="iso-solid" data-lit=""')}</g></defs>`
  const token = '<use href="#sl-token"/>'
  const litToken = '<use href="#sl-token-lit"/>'
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

  const body = bodyOf(Object.assign({}, ...laneParts, gate, pawls, Object.fromEntries(TOKEN_LAYERS.map(name => [name, tokenLayer(name)])))).join('')

  const total = height + BAND * 2
  const corner = (x, y, anchor, text, extra = '') => `<text class="ml-corner"${extra} x="${x}" y="${y}" text-anchor="${anchor}">${escape(text)}</text>`
  const readout = texts(frames.map(frame => frame.readout), value => corner(width - 22, total - 14, 'end', value, ' data-tone="strong"'))
  const extra = `
.ml-card{fill:var(--anatomy-card);stroke:var(--anatomy-faint);stroke-width:1}
.ml-corner{font:500 9.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.9px;text-transform:uppercase}
.ml-corner[data-tone="strong"]{fill:var(--anatomy-strong);text-transform:none;letter-spacing:.2px}
@media (prefers-reduced-motion:reduce){*{animation-delay:-${still}s!important;animation-play-state:paused!important}}
${keys.rules.join('\n')}`

  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso iso-svg" data-theme="${theme}" viewBox="0 0 ${width} ${total}" role="img" aria-label="${escape(label)}"><title>superlock semaphore</title><style>${k.ISO_CSS}${css}${extra}</style>` +
    `<rect class="ml-card" x="0.5" y="0.5" width="${width - 1}" height="${total - 1}" rx="10"/>` +
    corner(22, 24, 'start', 'Fig 2') + corner(width - 22, 24, 'end', 'superlock · semaphore') +
    corner(22, total - 14, 'start', 'Open the interactive version ↗') + readout +
    `${defs}<g transform="translate(0 ${BAND})">${body}</g></svg>`
}
