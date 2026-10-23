import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { wordOf, ASCENDER, ROUND, SHACKLE, shackleRing } from './letters.mjs'
import { createPrism } from './prism.mjs'
import * as M from './machine.mjs'
import { createSim } from './sim.mjs'
import { mount, embed } from './live.mjs'
import { recordLoop, stillOf, readmeMotion, liveMotion, FPS } from './readme.mjs'
import { compactSvg } from './compact.mjs'
import { pruneCss } from './prune.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..')
const ROOT = join(HERE, '..', '..', '..')
const require = createRequire(import.meta.url)
const ANATOMY = process.env.ANATOMY_HOME || [join(homedir(), '.claude', 'skills', 'anatomy'), join(homedir(), '.agents', 'skills', 'anatomy')].find(path => existsSync(join(path, 'kit', 'iso-kit.mjs')))
if (!ANATOMY) throw new Error('Anatomy kit not found: set ANATOMY_HOME to the anatomy skill directory')
const k = await import(pathToFileURL(join(ANATOMY, 'kit', 'iso-kit.mjs')).href)

const WIDTH = 640
const AZIMUTH = 65
const PAD_X = 8
const PAD_TOP = 3
const PAD_BOTTOM = 4

const WORD = wordOf('superlock')
const THICK = 6
const FOOT_H = 1.1
const PLATE_H = 3.8
const PLATE_TOP = FOOT_H + PLATE_H
const KEEPER = { w: 7, d: 5.2, h: 4.4 }
const STANDOFF = 7
const BASELINE = PLATE_TOP + STANDOFF
const PIN_R = 1.2
const BOSS_R = 2.1
const MARGIN = 8
const PLATE = { x: -WORD.width / 2 - MARGIN, y: -5.8, w: WORD.width + MARGIN * 2, d: 29.3, r: 5 }
const RAIL = { y: 12, d: 4.6, h: 1.6, end: WORD.width / 2 + 0.5 }
const STOP = { w: 4, d: 7.6, h: 4.6 }
const CARRIAGE = { w: 12, y: 10.4, d: 8.2, h: 3.2 }
const CARRIAGE_Z = PLATE_TOP + RAIL.h
const BOLT = { w: 4.4, h: 1.8, z: CARRIAGE_Z + 0.4, reach: KEEPER.d / 2 - 2.2, stroke: M.BOLT_STROKE }
const FLAG = { x: KEEPER.w / 2 + 0.5, y: 0.6, w: 5, d: 1, h: 3.6 }
const GUIDE = { r: 1, h: 1.8 }
const SHACKLE_Y = 2
const RULER = { y: 19.2, d: 2.6, h: 0.5 }

const stations = WORD.letters.map(letter => letter.x + letter.posts[0])
const PARK = -RAIL.end + 5.6

const LOCK = WORD.letters.find(letter => letter.char === 'o')
const SHACKLE_TOP = BASELINE + SHACKLE.crown + SHACKLE.spread + SHACKLE.stroke / 2 + M.SHACKLE_LIFT

function fit (points) {
  const unit = { origin: [0, 0], scale: 1, azimuth: AZIMUTH, elevation: k.ELEVATION }
  const flat = points.map(point => k.iso(point, unit))
  const left = Math.min(...flat.map(([x]) => x))
  const right = Math.max(...flat.map(([x]) => x))
  const up = Math.min(...flat.map(([, y]) => y))
  const down = Math.max(...flat.map(([, y]) => y))
  const scale = (WIDTH - PAD_X * 2) / (right - left)
  return {
    projection: { origin: [PAD_X - left * scale, PAD_TOP - up * scale], scale, azimuth: AZIMUTH, elevation: k.ELEVATION },
    height: Math.ceil((down - up) * scale + PAD_TOP + PAD_BOTTOM)
  }
}

const { projection: P, height: HEIGHT } = fit([
  ...k.boxCorners(PLATE, 0, PLATE_TOP),
  ...WORD.letters.flatMap(letter => [[letter.x, -THICK / 2, BASELINE + ASCENDER], [letter.x + letter.width, THICK / 2, BASELINE + ASCENDER]]),
  [LOCK.x + ROUND, -SHACKLE_Y, SHACKLE_TOP]
])

const at = point => k.iso(point, P)
const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)
const screw = ([x, y], z, size = 0.45) => L(k.ring(x, y, 1.5, z, P, 14), { tone: 'lo' }) + D([at([x, y, z])], { size })
const depth = ([x, y]) => k.depthOf([x, y, 0], P)
const byDepth = points => [...points].sort((a, b) => depth(a) - depth(b))
const prism = createPrism(k, P)

function base () {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, 0, PLATE_TOP, P)}"/>`]
  for (const [x, y] of byDepth(k.corners(PLATE, 7))) {
    out.push(S(k.cylinder(x, y, 5, 0, 0.8, P, 28), { tone: 'lo' }))
    out.push(S(k.cylinder(x, y, 3.8, 0.8, FOOT_H - 0.8, P, 28), { tone: 'mid' }))
  }
  const seam = k.sideSeam(PLATE, FOOT_H + 2.4, P, 8)
  out.push(S(k.slabOf(PLATE, FOOT_H, PLATE_H, P, 8, 1.2), { tone: 'mid', inner: L(seam, { tone: 'faint' }) }))
  out.push(k.corners(PLATE, 4).map(point => screw(point, PLATE_TOP, 0.5)).join(''))

  const ruler = { x: -WORD.width / 2 + 2, y: RULER.y, w: WORD.width - 4, d: RULER.d, r: 0.8 }
  out.push(S(k.slabOf(ruler, PLATE_TOP, RULER.h, P, 3), { tone: 'lo', crease: 'none' }))
  const ticks = k.topTicks(ruler.x + 3, ruler.x + ruler.w - 3, 3, 5, ruler.y + 0.01, PLATE_TOP + RULER.h, [1.2, 2.2], P)
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  out.push(D([at([ruler.x + 1.5, ruler.y + RULER.d / 2, PLATE_TOP + RULER.h]), at([ruler.x + ruler.w - 1.5, ruler.y + RULER.d / 2, PLATE_TOP + RULER.h])], { size: 0.4 }))
  const channel = { x: -WORD.width / 2 - 4, y: -4.4, w: WORD.width + 8, d: 8.8, r: 2.4 }
  const lip = k.planOutline(channel, PLATE_TOP, P, 6)
  out.push(`<path class="wm-void" d="${lip}"/>`, L(lip, { tone: 'lo' }), L(k.planOutline(k.insetPlan(channel, 1.4), PLATE_TOP, P, 6), { tone: 'faint' }))
  out.push(D([channel.x + 2.2, channel.x + channel.w - 2.2].map(x => at([x, 0, PLATE_TOP])), { size: 0.45 }))
  return out.join('')
}

function pin (x, from, to) {
  return S(k.cylinder(x, 0, PIN_R, from, to - from, P, 18), { tone: 'faint', crease: 'none', className: 'wm-pin' })
}

const SLOT = { w: BOLT.w + 1, z: BOLT.z - 0.4, h: BOLT.h + 0.8 }
const LIP = { front: KEEPER.d / 2, d: 0.9 }

const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]

function keeper (x) {
  const plan = { x: x - KEEPER.w / 2, y: -KEEPER.d / 2, w: KEEPER.w, d: KEEPER.d - LIP.d, r: 0.8 }
  const top = PLATE_TOP + KEEPER.h
  const recess = k.pathOf(rect(x - SLOT.w / 2, SLOT.z, x + SLOT.w / 2, SLOT.z + SLOT.h).map(([sx, sz]) => at([sx, LIP.front - LIP.d, sz])), true)
  return [
    S(k.slabOf(plan, PLATE_TOP, KEEPER.h, P, 3, 0.4), { tone: 'mid', inner: L(k.sideSeam(plan, PLATE_TOP + 1, P, 3), { tone: 'faint' }) }),
    `<path class="wm-void" d="${recess}"/>`,
    D([at([x - KEEPER.w / 2 + 1.3, 0, top]), at([x + KEEPER.w / 2 - 1.3, 0, top])], { size: 0.4 }),
    S(k.cylinder(x, 0, BOSS_R, top, 0.8, P, 24), { tone: 'mid' })
  ].join('')
}

function lipSvg (x) {
  const outer = rect(-KEEPER.w / 2 + 0.3, 0, KEEPER.w / 2 - 0.3, KEEPER.h - 0.3)
  const hole = rect(-SLOT.w / 2, SLOT.z - PLATE_TOP, SLOT.w / 2, SLOT.z - PLATE_TOP + SLOT.h).reverse()
  const face = LIP.front
  return prism([outer, hole], [x, PLATE_TOP], [face - LIP.d, face], { tone: 'mid', crease: 'faint', trim: false }) +
    D([at([x - KEEPER.w / 2 + 1.2, face, PLATE_TOP + KEEPER.h - 1.1]), at([x + KEEPER.w / 2 - 1.2, face, PLATE_TOP + KEEPER.h - 1.1])], { size: 0.38 })
}

const flagAxis = x => [x + FLAG.x + FLAG.w / 2, FLAG.y + FLAG.d / 2]

function flagSvg (x, index, motion) {
  const plan = { x: x + FLAG.x, y: FLAG.y, w: FLAG.w, d: FLAG.d, r: 0.3 }
  const bottom = PLATE_TOP + GUIDE.h
  const top = bottom + FLAG.h
  const face = k.sideMatrix([plan.x, FLAG.y + FLAG.d], top, P, 'left')
  const counter = text => `<text class="wm-counter" x="${FLAG.w / 2}" y="2.5" text-anchor="middle">${text}</text>`
  return S(k.slabOf(plan, bottom, FLAG.h, P, 2, 0.25), { tone: 'mid' }) +
    `<g transform="${face}"><rect class="wm-window" x="0.6" y="0.55" width="${FLAG.w - 1.2}" height="${FLAG.h - 1.1}" rx="0.35"/>${motion.swap(`rank-${index}`, counter)}</g>`
}

function mastSvg (x, index, motion) {
  const [mx, my] = flagAxis(x)
  const base = PLATE_TOP + GUIDE.h
  const clip = k.cylinder(mx, my, GUIDE.r - 0.05, base, 80, P, 18).fill
  const mast = S(k.cylinder(mx, my, 0.45, base - M.FLAG_LIFT - 1, M.FLAG_LIFT + 2, P, 14), { tone: 'mid', crease: 'none' })
  return `<clipPath id="wm-mast-${index}"><path d="${clip}"/></clipPath><g clip-path="url(#wm-mast-${index})">${motion.move(`mast-${index}`, mast)}</g>`
}

function guideSvg (x) {
  const [mx, my] = flagAxis(x)
  return S(k.cylinder(mx, my, GUIDE.r, PLATE_TOP, GUIDE.h, P, 20, 0.2), { tone: 'mid' }) +
    L(k.ring(mx, my, 0.55, PLATE_TOP + GUIDE.h, P, 14), { tone: 'lo' })
}

const COLLAR_TOP = PLATE_TOP + KEEPER.h + 0.8
const PIN_DEPTH = 3

function mounts (letter, index, motion) {
  const x = letter.x + letter.posts[0]
  return keeper(x) + mastSvg(x, index, motion) + guideSvg(x) + motion.move(`flag-${index}`, flagSvg(x, index, motion))
}

function slidingPin (letter, index, motion) {
  const x = letter.x + letter.posts[0]
  const clip = k.cylinder(x, 0, PIN_R + 0.6, COLLAR_TOP, 80, P, 18).fill
  const travel = M.RISE + M.DIP + 1
  return `<clipPath id="wm-pin-${index}"><path d="${clip}"/></clipPath><g clip-path="url(#wm-pin-${index})">${motion.move(`pin-${index}`, pin(x, COLLAR_TOP - travel, BASELINE + PIN_DEPTH))}</g>`
}

function letterSolid (letter, lit) {
  return prism(letter.rings, [letter.x, BASELINE], [-THICK / 2, THICK / 2], { lit, className: 'wm-letter' })
}

function shackleSvg (motion) {
  const solid = className => prism([shackleRing()], [LOCK.x, BASELINE], [-SHACKLE_Y, SHACKLE_Y], { className, tone: 'mid', crease: 'lo', trim: false })
  return solid('wm-shackle wm-free') + motion.fade('shackle-shut', solid('wm-shackle'))
}

function railSvg () {
  const plan = { x: -RAIL.end, y: RAIL.y, w: RAIL.end * 2, d: RAIL.d, r: 0.8 }
  const out = [S(k.slabOf(plan, PLATE_TOP, RAIL.h, P, 3, 0.3), { tone: 'mid' })]
  out.push(L(k.lineOnTop([-RAIL.end + 0.3, RAIL.y + RAIL.d / 2], [RAIL.end - 0.3, RAIL.y + RAIL.d / 2], PLATE_TOP + RAIL.h, P), { tone: 'faint' }))
  out.push(D(stations.map(x => at([x, RAIL.y + RAIL.d / 2, PLATE_TOP + RAIL.h])), { size: 0.55, tone: 'mid' }))
  return out.join('')
}

function stopSvg (side) {
  const x = side < 0 ? -RAIL.end - STOP.w + 1 : RAIL.end - 1
  const plan = { x, y: RAIL.y + RAIL.d / 2 - STOP.d / 2, w: STOP.w, d: STOP.d, r: 0.8 }
  return S(k.slabOf(plan, PLATE_TOP, STOP.h, P, 3, 0.4), { tone: 'mid' }) +
    D([at([x + STOP.w / 2, plan.y + 1.6, PLATE_TOP + STOP.h]), at([x + STOP.w / 2, plan.y + STOP.d - 1.6, PLATE_TOP + STOP.h])], { size: 0.4 })
}

function boltSvg () {
  const x = stations[0]
  const plan = { x: x - BOLT.w / 2, y: BOLT.reach, w: BOLT.w, d: CARRIAGE.y + 0.1 - BOLT.reach, r: 0.3 }
  return S(k.slabOf(plan, BOLT.z, BOLT.h, P, 2, 0.2), { tone: 'hi', crease: 'mid' }) +
    L(k.lineOnTop([x, BOLT.reach + 0.8], [x, CARRIAGE.y - 0.1], BOLT.z + BOLT.h, P), { tone: 'faint' })
}

function carriageSvg () {
  const x = stations[0]
  const plan = { x: x - CARRIAGE.w / 2 + 1.6, y: CARRIAGE.y, w: CARRIAGE.w, d: CARRIAGE.d, r: 1.2 }
  const top = CARRIAGE_Z + CARRIAGE.h
  const out = [S(k.slabOf(plan, CARRIAGE_Z, CARRIAGE.h, P, 4, 0.5), { tone: 'mid', inner: L(k.sideSeam(plan, CARRIAGE_Z + 1.4, P, 4), { tone: 'faint' }) })]
  out.push(L(k.planOutline(k.insetPlan(plan, 1.3), top, P, 4), { tone: 'faint' }))
  out.push(D([[plan.x + 2.2, plan.y + 2.2], [plan.x + plan.w - 2.2, plan.y + 2.2], [plan.x + 2.2, plan.y + plan.d - 2.2]].map(([cx, cy]) => at([cx, cy, top])), { size: 0.42 }))
  const knob = [x + 2.2, plan.y + plan.d - 3.4]
  out.push(S(k.cylinder(...knob, 3.2, top, 0.8, P, 32), { tone: 'mid' }))
  out.push(S(k.cylinder(...knob, 2.6, top + 0.8, 2.4, P, 36, 0.3), { tone: 'mid', inner: L(k.knurl(...knob, 2.6, top + 0.8, top + 3.2, 28, P), { tone: 'lo' }) }))
  out.push(L(k.ring(...knob, 1.5, top + 3.2, P, 24), { tone: 'lo' }))
  out.push(D([at([...knob, top + 3.2])], { size: 0.45 }))
  return out.join('')
}

function bodyOf (motion) {
  const letters = WORD.letters.map((letter, index) => ({ letter, index })).sort((a, b) => depth([a.letter.x, 0]) - depth([b.letter.x, 0]))
  const word = letters.map(({ letter, index }) => {
    const lock = letter === LOCK ? motion.move('shackle', shackleSvg(motion)) : ''
    const solid = lock + letterSolid(letter, false) + motion.fade(`lit-${index}`, letterSolid(letter, true))
    return `<g data-letter="${index}">${mounts(letter, index, motion)}${slidingPin(letter, index, motion)}${motion.move(`dip-${index}`, solid)}</g>`
  }).join('')
  const bolt = motion.move('bolt-carriage', motion.move('bolt', boltSvg()))
  const lips = WORD.letters.map(letter => lipSvg(letter.x + letter.posts[0])).join('')
  return base() + `<g data-layer="word">${word}</g>` + railSvg() + stopSvg(-1) + stopSvg(1) + `<g data-layer="bolt">${bolt}</g><g data-layer="lips">${lips}</g><g data-layer="carriage">${motion.move('carriage', carriageSvg())}</g>`
}

const MIN_HIT = 60

function slotsOf (letters) {
  const centers = letters.map(letter => at([letter.x + letter.width / 2, 0, BASELINE])[0])
  const last = letters[letters.length - 1]
  const edges = [at([letters[0].x, 0, BASELINE])[0] - 6, ...centers.slice(1).map((center, index) => (center + centers[index]) / 2), at([last.x + last.width, 0, BASELINE])[0] + 6]
  const count = edges.length - 1
  const slack = edges[count] - edges[0] - MIN_HIT * count
  if (slack < 0) throw new Error(`wordmark letters span ${edges[count] - edges[0]}, under ${MIN_HIT} each`)
  const extra = edges.slice(0, -1).map((left, index) => Math.max(0, edges[index + 1] - left - MIN_HIT))
  const extraSum = extra.reduce((sum, value) => sum + value, 0)
  const weight = extraSum > 0 ? extra : Array.from({ length: count }, () => 1)
  const weightSum = weight.reduce((sum, value) => sum + value, 0)
  let cursor = edges[0]
  const next = [cursor]
  for (let index = 0; index < count; index++) {
    cursor += MIN_HIT + slack * weight[index] / weightSum
    next.push(cursor)
  }
  next[count] = edges[count]
  return next.slice(0, -1).map((left, index) => [left, next[index + 1]])
}

const slots = slotsOf(WORD.letters)
for (const [left, right] of slots) {
  if (!(right > left) || right - left < MIN_HIT - 1e-6) throw new Error(`wordmark hit slot ${left}..${right} is under ${MIN_HIT}`)
}
const hits = WORD.letters.map((letter, index) => {
  const points = letter.rings[0].flatMap(([x, z]) => [at([letter.x + x, THICK / 2, BASELINE + z]), at([letter.x + x, -THICK / 2, BASELINE + z + M.RISE])])
  if (letter === LOCK) points.push(at([letter.x + ROUND, 0, SHACKLE_TOP]))
  points.push(at([letter.x + letter.posts[0], KEEPER.d / 2, PLATE_TOP]))
  const ys = points.map(([, y]) => y)
  return [slots[index][0], Math.min(...ys) - 2, slots[index][1], Math.max(...ys) + 2].map(value => Math.round(value * 10) / 10)
})

const CSS = `
.wm-void{fill:var(--anatomy-shade-0);stroke:none}
.wm-window{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.wm-counter{font:600 2.2px var(--anatomy-mono);fill:var(--anatomy-hi);letter-spacing:.12px}
.iso-halo{filter:blur(3px);transform:translateY(1.5px)}
.iso{--wm-hold-top:#ffffff;--wm-hold-cap:#e6e6e6;--wm-hold-side:#d4d4d4}
.iso[data-theme="light"]{--wm-hold-top:#2a2a2e;--wm-hold-cap:#2a2a2e;--wm-hold-side:#4a4a4f}
.iso-solid[data-lit]>.iso-top{fill:var(--wm-hold-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--wm-hold-side)}
.iso-solid[data-lit]>.iso-crease{stroke:var(--anatomy-lit)}
.iso-solid[data-lit]>[data-cap]{fill:var(--wm-hold-cap)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>[data-cap]{fill:var(--anatomy-lit-shade)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>.iso-top{fill:var(--anatomy-lit-top)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>.iso-shade[data-shade="0"]{fill:var(--anatomy-shade-1)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>.iso-shade[data-shade="1"]{fill:var(--anatomy-shade-2)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>.iso-shade[data-shade="2"]{fill:var(--anatomy-shade-3)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>.iso-shade[data-shade="3"]{fill:var(--anatomy-lit-shade)}
.iso:not([data-theme="light"]) .wm-letter:not([data-lit])>.iso-crease{stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight) * 1.5)}
.iso:not([data-theme="light"]) .wm-letter>.iso-edge{stroke:var(--anatomy-hi);stroke-width:calc(var(--anatomy-weight) * 2)}
.iso:not([data-theme="light"]) .wm-letter[data-lit]>.iso-edge{stroke:var(--anatomy-lit)}
.iso[data-theme="light"] .wm-letter:not([data-lit])>.iso-edge{stroke:var(--anatomy-text);stroke-width:calc(var(--anatomy-weight) * 2.5)}
.iso[data-theme="light"] .wm-letter:not([data-lit])>.iso-crease{stroke:var(--anatomy-text);stroke-width:calc(var(--anatomy-weight) * 2)}
.iso[data-theme="light"] .wm-letter:not([data-lit])>[data-trim]{stroke:var(--anatomy-mid)}
.iso[data-theme="light"] .wm-letter[data-lit]>.iso-edge{stroke-width:calc(var(--anatomy-weight) * 1.5)}
.wm-shackle>.iso-edge{stroke:var(--anatomy-mid)}
.wm-shackle>.iso-crease{stroke:var(--anatomy-lo)}
.wm-free>.iso-edge{stroke:var(--anatomy-lo)}
.wm-free>.iso-crease,.wm-free>.iso-line{stroke:var(--anatomy-faint)}
.iso:not([data-theme="light"]) .wm-shackle>.iso-edge{stroke:var(--anatomy-hi)}
.iso:not([data-theme="light"]) .wm-shackle>.iso-crease{stroke:var(--anatomy-mid)}
.iso:not([data-theme="light"]) .wm-free>.iso-edge{stroke:var(--anatomy-mid)}
.iso:not([data-theme="light"]) .wm-free>.iso-crease,.iso:not([data-theme="light"]) .wm-free>.iso-line{stroke:var(--anatomy-lo)}
.wm-letter[data-lit]>[data-trim]{stroke:var(--wm-hold-side)}
.wm-letter[data-lit]>.iso-line[data-tone="faint"]{stroke:var(--wm-hold-side)}
`

const LIVE_CSS = `
.wm-letter{transition:transform .18s cubic-bezier(.32,.72,0,1)}
[data-letter][data-hover] .wm-letter{transform:translateY(-5px)}
[data-letter][data-hover] .wm-letter:not([data-lit])>.iso-edge{stroke:var(--anatomy-strong)}
[data-letter][data-hover] .wm-letter:not([data-lit])>.iso-top{fill:var(--wm-hover-top)}
[data-letter][data-hover] .wm-letter:not([data-lit])>[data-cap]{fill:var(--wm-hover-cap)}
.iso{--wm-hover-top:var(--anatomy-lo);--wm-hover-cap:var(--anatomy-faint)}
.iso[data-theme="light"]{--wm-hover-top:var(--anatomy-shade-0);--wm-hover-cap:var(--anatomy-shade-2)}
@media (prefers-reduced-motion:reduce){.wm-letter,.wm-hint{transition:none}}
`

const PAGE_CSS = `
html:has(body[data-theme="light"]){color-scheme:light}
.iso-page{margin-top:48px;margin-bottom:48px}
.wm-stage{position:relative;outline:none;touch-action:pan-y;-webkit-tap-highlight-color:transparent;user-select:none}
.wm-focus{display:none;fill:none;stroke:var(--anatomy-text);stroke-width:1.5px;stroke-dasharray:4 3;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.wm-stage:focus-visible .wm-focus{display:inline}
.wm-status{margin:10px 0 0;min-height:1.4em;text-align:center;color:var(--anatomy-text);font:10.5px/1.4 var(--anatomy-mono);letter-spacing:.04em;font-variant-numeric:tabular-nums}
.wm-hint{margin:4px 0 0;text-align:center;color:var(--anatomy-muted);font:10px/1.4 var(--anatomy-mono);letter-spacing:.02em;opacity:.8;white-space:nowrap}
.wm-hint [data-touch]{display:none}
@media (pointer:coarse){.wm-hint [data-touch]{display:inline}.wm-hint [data-mouse]{display:none}}
@media (max-width:420px){.wm-hint{font-size:9px;letter-spacing:0}.wm-status{font-size:10px}}
@media (hover:hover){.wm-hint{opacity:0;transition:opacity .2s var(--anatomy-ease)}body:hover .wm-hint,body:has(.wm-stage:focus-visible) .wm-hint{opacity:.8}}
.wm-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
html[data-embed] body{background:transparent}
html[data-embed] .iso-page{width:100%;margin:0;display:flow-root}
`

const HINT = 'Click letters to queue them · click a waiting one to abort'

const LABEL = 'superlock: nine solid letters stand on posts along a machined plate, and the o carries a padlock shackle. Letters join a queue by calling lock(); one carriage on a rail serves them in order, seats its bolt in each letter, toggles it on or off and releases the lock. The shackle stays shut while anyone holds the lock.'

const origin = at([0, 0, 0])
const screen = point => {
  const [x, y] = at(point)
  return [x - origin[0], y - origin[1]]
}

const svgTag = (theme, style, body) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso iso-svg" data-theme="${theme}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${LABEL}"><title>superlock</title><style>${style}</style>${body}</svg>`

function readmeSvg (theme, frames, still) {
  const motion = readmeMotion({ frames, poseOf: frame => M.poseOf(frame, stations), screen })
  const body = bodyOf(motion)
  const reduced = `@media (prefers-reduced-motion:reduce){*{animation-delay:-${still.toFixed(3)}s!important;animation-play-state:paused!important}}`
  return svgTag(theme, pruneCss(`${k.ISO_CSS}${CSS}${motion.rules.join('')}${reduced}`, `data-theme ${body}`), body)
}

const source = file => readFileSync(file, 'utf8')
const commonjs = (name, code) => `const ${name} = (() => { const module = { exports: {} }; ${code}\nreturn module.exports })()`
const exportedNames = text => [...text.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map(match => match[1])
const namespace = (name, file) => {
  const text = source(file)
  return `const ${name} = (() => {\n${text.replace(/^export /gm, '')}\nreturn { ${exportedNames(text).join(', ')} }\n})()`
}

const MACHINE = { stations, park: PARK, letters: WORD.letters.map(letter => letter.char), TIMING: M.TIMING, DEMO: M.DEMO }
const tenth = ([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
const outlines = WORD.letters.map(letter => letter.rings.flatMap(ring => [THICK / 2, -THICK / 2].map(y => [...ring, ring[0]].map(([x, z]) => tenth(at([letter.x + x, y, BASELINE + z]))))))
const DATA = { P, stations, hits, outlines }

const script = [
  namespace('kit', join(ANATOMY, 'kit', 'iso-kit.mjs')),
  namespace('machine', join(HERE, 'machine.mjs')),
  commonjs('LinkedList', source(join(ROOT, 'src', 'linked-list.js'))),
  'const require = () => LinkedList',
  commonjs('createLock', source(join(ROOT, 'src', 'create.js'))),
  `const createSim = ${createSim.toString()}`,
  `const mount = ${mount.toString()}`,
  `const embed = ${embed.toString()}`,
  'embed()',
  'const still = window.matchMedia(\'(prefers-reduced-motion: reduce)\')',
  `mount({ data: ${JSON.stringify(DATA)}, kit, machine, sim: createSim({ machine: ${JSON.stringify(MACHINE)}, createLock, calm: () => still.matches }) })`
].join('\n')

function livePage (theme) {
  const ring = `<path class="wm-focus" d="${k.haloOf(k.insetPlan(PLATE, -2.4), 0, PLATE_TOP, P)}"/>`
  const svg = compactSvg(svgTag(theme, `${CSS}${LIVE_CSS}`, ring + bodyOf(liveMotion)))
  const body = `<div class="wm-stage" tabindex="0" role="group" aria-roledescription="interactive figure" aria-label="superlock wordmark. Click a letter, or type it, to queue it: it calls lock(), and the carriage toggles it on or off when its turn comes. Click or type a waiting letter again to abort its signal.">${svg}<div class="wm-live" aria-live="polite" data-live></div></div><p class="wm-status" data-status></p><p class="wm-hint"><span data-mouse>${HINT}</span><span data-touch>${HINT.replace(/click/gi, word => (word[0] === 'C' ? 'Tap' : 'tap'))}</span></p>`
  return k.pageHtml({ title: 'superlock', theme, body, script, width: 640 }).replace('</style>', `${PAGE_CSS}</style>`)
}

const write = (name, text) => {
  writeFileSync(join(OUT, name), text)
  console.log('wrote', name, `${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`)
}

const FAVICON_MARGIN = 0.2
const FAVICON_CORNER = 0.2

function faviconSvg () {
  const letter = WORD.letters[0]
  const points = letter.rings.flat().flatMap(([x, z]) => [-THICK / 2, THICK / 2].map(y => at([letter.x + x, y, BASELINE + z])))
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / (1 - FAVICON_MARGIN * 2)
  const [left, top, size] = [(Math.min(...xs) + Math.max(...xs) - side) / 2, (Math.min(...ys) + Math.max(...ys) - side) / 2, side].map(value => Math.round(value * 100) / 100)
  const tile = `<rect x="${left}" y="${top}" width="${size}" height="${size}" rx="${(size * FAVICON_CORNER).toFixed(2)}" fill="var(--anatomy-page)"/>`
  const body = tile + letterSolid(letter, false)
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso iso-svg" data-theme="dark" viewBox="${left} ${top} ${size} ${size}"><title>superlock</title><style>${pruneCss(`${k.ISO_CSS}${CSS}`, `data-theme ${body}`)}</style>${body}</svg>`
}

const LETTERS_PAD = 2
const FRONT = { origin: [0, 0], scale: P.scale, azimuth: 90, elevation: 0 }

function lettersSvg (theme) {
  const front = createPrism(k, FRONT)
  const project = point => k.iso(point, FRONT)
  const shackleAt = [LOCK.x, BASELINE + M.SHACKLE_LIFT]
  const shackle = front([shackleRing()], shackleAt, [-SHACKLE_Y, SHACKLE_Y], { className: 'wm-shackle wm-free', tone: 'mid', crease: 'lo', trim: false })
  const body = WORD.letters.map(letter => (letter === LOCK ? shackle : '') + front(letter.rings, [letter.x, BASELINE], [-THICK / 2, THICK / 2], { className: 'wm-letter' })).join('')
  const extent = (rings, [x, z], y) => rings.flat().flatMap(([dx, dz]) => [-y, y].map(side => project([x + dx, side, z + dz])))
  const points = [...WORD.letters.flatMap(letter => extent(letter.rings, [letter.x, BASELINE], THICK / 2)), ...extent([shackleRing()], shackleAt, SHACKLE_Y)]
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const [left, top] = [Math.min(...xs) - LETTERS_PAD, Math.min(...ys) - LETTERS_PAD].map(value => Math.round(value * 100) / 100)
  const [width, height] = [Math.max(...xs) + LETTERS_PAD - left, Math.max(...ys) + LETTERS_PAD - top].map(value => Math.round(value * 100) / 100)
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso iso-svg" data-theme="${theme}" viewBox="${left} ${top} ${width} ${height}" role="img" aria-label="superlock"><title>superlock</title><style>${pruneCss(`${k.ISO_CSS}${CSS}`, `data-theme ${body}`)}</style>${body}</svg>`
}

const frames = await recordLoop({ createSim, machine: MACHINE, createLock: require(join(ROOT, 'src', 'create.js')) })
const STILL = stillOf(frames)
const seconds = frames.length / FPS

writeFileSync(join(ROOT, 'static', 'favicon.svg'), compactSvg(faviconSvg()))
console.log('wrote static/favicon.svg')
for (const theme of ['dark', 'light']) {
  const name = `logo${theme === 'light' ? '-light' : ''}.svg`
  writeFileSync(join(ROOT, 'static', name), compactSvg(lettersSvg(theme)))
  console.log(`wrote static/${name}`)
}

for (const theme of ['dark', 'light']) {
  const suffix = theme === 'light' ? '-light' : ''
  write(`wordmark${suffix}.svg`, compactSvg(readmeSvg(theme, frames, STILL)))
  write(`wordmark${suffix}.html`, livePage(theme))
}
const span = vector => Math.hypot(...k.axisVector(P, vector))
const litShare = frames.filter(frame => Math.max(...frame.level) >= 0.5).length / frames.length
const wordLeft = at([WORD.letters[0].x, THICK / 2, BASELINE])[0]
const wordRight = at([WORD.letters[WORD.letters.length - 1].x + WORD.letters[WORD.letters.length - 1].width, -THICK / 2, BASELINE + 24])[0]
console.log(`loop ${seconds.toFixed(3)} s · still at ${STILL.toFixed(3)} s · viewBox ${WIDTH}x${HEIGHT} · aspect ${(WIDTH / HEIGHT).toFixed(2)} · word ${(((wordRight - wordLeft) / WIDTH) * 100).toFixed(1)}% of width`)
console.log(`lit ${(litShare * 100).toFixed(1)}% of loop · bolt travel ${span([0, M.BOLT_STROKE, 0]).toFixed(1)} px · flag ${span([0, 0, M.FLAG_LIFT]).toFixed(1)} px · shackle ${span([0, 0, M.SHACKLE_LIFT]).toFixed(1)} px`)
