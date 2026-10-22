import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as M from './machine.mjs'
import { createRequire } from 'node:module'
import { mount, embed } from './live.mjs'
import { createSim } from './sim.mjs'
import { createDrawing } from './drawing.mjs'
import { recordLoop, animatedSvg } from './readme.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ROOT = join(HERE, '..', '..')
const ANATOMY = process.env.ANATOMY_HOME || join(homedir(), '.claude', 'skills', 'anatomy')
const k = await import(pathToFileURL(join(ANATOMY, 'kit', 'iso-kit.mjs')).href)

const WIDTH = 640
const HEIGHT = 350
const AZIMUTH = 58

const { r: TR, h: TH } = M.TOKEN
const DECK = M.DECK
const BED = { x: -172, y: -48, w: 172 + M.DECK_END, d: 96, r: 8 }
const BED_Z = 8
const FOOT_H = 8
const RAIL_FROM = -104
const RAIL = { from: RAIL_FROM, w: M.DECK_END - RAIL_FROM, d: 8, inner: 12.6 }
const ROD_R = 1.6
const ROD_RING = 15
const RODS = { back: [0, -ROD_RING], front: [0, ROD_RING], hang: [-ROD_RING * Math.SQRT1_2, -ROD_RING * Math.SQRT1_2] }
const YOKE = { x: -18, y: -19, w: 36, d: 38, r: 5 }
const YOKE_H = 3
const HOLE_R = TR + 0.6
const GEARBOX = { x: -126, y: -14, w: 20, d: 28, r: 2 }
const GEARBOX_TOP = 30
const MOTOR = [M.CRANK.cx, -28]
const MOTOR_R = 10
const MOTOR_TOP = 32
const PRESS = { x: M.STATION - 10, w: 20 }
const PRESS_ARM = { x: PRESS.x, y: -44, w: PRESS.w, d: 52, r: 3 }
const PRESS_ARM_Z = 78
const PRESS_ARM_H = 10
const CAN_R = 8
const CAN_TOP = 102
const BIN = { x: M.DECK_END, y: -16, w: 34, d: 32, wall: 2, z: M.BIN_FLOOR - 2, top: 18 }
const RAM_R = 3.2
const RAM_LENGTH = 50

const P = k.fitProjection(
  [
    ...k.boxCorners(BED, 0, DECK),
    ...k.boxCorners({ x: BIN.x, y: BIN.y, w: BIN.w, d: BIN.d }, 0, BIN.top),
    [M.STATION, 0, CAN_TOP + 2],
    [0, 0, M.COLUMN_TOP + YOKE_H],
    [M.CRANK.cx - M.CRANK.r - 6, 0, M.ROD_Z + M.ROD_H]
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZIMUTH }
)

const at = point => k.iso(point, P)
const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)
const depth = ([x, y]) => k.depthOf([x, y, 0], P)
const byDepth = points => [...points].sort((a, b) => depth(a) - depth(b))
const layer = (name, children = '', extra = '') => `<g data-layer="${name}"${extra}>${Array.isArray(children) ? children.join('') : children}</g>`
const screw = ([x, y], z, size = 0.45) => L(k.ring(x, y, 1.6, z, P, 14), { tone: 'lo' }) + D([at([x, y, z])], { size })
const rodOf = ([x, y], z0, z1, r = ROD_R) => S(k.cylinder(x, y, r, z0, z1 - z0, P, 18), { tone: 'mid', crease: 'none' })

function base () {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, 0, DECK, P)}"/>`]
  for (const [x, y] of byDepth(k.corners(BED, 22))) {
    out.push(S(k.cylinder(x, y, 7, 0, 1.6, P, 28), { tone: 'lo' }))
    out.push(S(k.cylinder(x, y, 5.4, 1.6, FOOT_H - 1.6, P, 28), { tone: 'mid' }))
  }
  const seam = k.sideSeam(BED, BED_Z + 4, P, 8)
  out.push(S(k.slabOf(BED, BED_Z, DECK - BED_Z, P, 8, 1.6), { tone: 'mid', inner: L(seam, { tone: 'faint' }) }))
  out.push(L(k.planOutline(k.insetPlan(BED, 5), DECK, P), { tone: 'lo' }))
  out.push(k.corners(BED, 10).map(point => screw(point, DECK, 0.5)).join(''))

  const strip = { x: -24, y: 26, w: M.DECK_END - 2 + 24, d: 6, r: 1 }
  out.push(S(k.slabOf(strip, DECK, 0.6, P, 3), { tone: 'lo', crease: 'none' }))
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.01, DECK + 0.6, [2, 3.6], P)
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  out.push(D([at([strip.x + 2, strip.y + 3, DECK + 0.6]), at([strip.x + strip.w - 2, strip.y + 3, DECK + 0.6])], { size: 0.4 }))

  const plate = { x: -78, y: 30, w: 44, d: 12, r: 1.5 }
  out.push(S(k.slabOf(plate, DECK, 0.8, P, 4), { tone: 'mid', crease: 'none' }))
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), DECK + 0.8, P, 4), { tone: 'faint' }))
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 5, plate.y + 6.2], DECK + 0.8, P, 'x'), 'superlock', { size: 3.6, tone: 'mid' }))
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 8.6], [plate.x + 30, plate.y + 8.6], DECK + 0.8, P), { tone: 'lo', free: true }))
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 10.2], [plate.x + 22, plate.y + 10.2], DECK + 0.8, P), { tone: 'lo', free: true }))
  out.push(D([at([plate.x + plate.w - 3.4, plate.y + 3, DECK + 0.8]), at([plate.x + plate.w - 3.4, plate.y + plate.d - 3, DECK + 0.8])], { size: 0.45 }))
  return out.join('')
}

function drive () {
  const out = []
  const [mx, my] = MOTOR
  out.push(S(k.cylinder(mx, my, MOTOR_R + 1.6, DECK, 1.6, P, 40), { tone: 'lo' }))
  out.push(S(k.cylinder(mx, my, MOTOR_R, DECK + 1.6, MOTOR_TOP - DECK - 1.6, P, 48, 0.6), {
    tone: 'mid',
    inner: L(k.knurl(mx, my, MOTOR_R, DECK + 4, MOTOR_TOP - 3, 44, P), { tone: 'lo' })
  }))
  out.push(L(k.sideArc(mx, my, MOTOR_R, DECK + 4, P, 32) + k.sideArc(mx, my, MOTOR_R, MOTOR_TOP - 3, P, 32), { tone: 'faint' }))
  out.push(L(k.ring(mx, my, MOTOR_R - 3, MOTOR_TOP, P, 40), { tone: 'lo' }))
  out.push(D([0, 1, 2, 3].map(index => {
    const angle = Math.PI / 4 + index * Math.PI / 2
    return at([mx + Math.cos(angle) * (MOTOR_R - 1.5), my + Math.sin(angle) * (MOTOR_R - 1.5), MOTOR_TOP])
  }), { size: 0.45 }))
  const box = { x: mx - MOTOR_R - 5, y: my - 4, w: 5.4, d: 8, r: 0.8 }
  out.push(S(k.slabOf(box, DECK + 6, 6, P, 3, 0.4), { tone: 'mid' }))
  out.push(D([at([box.x + 2.7, box.y + 2, DECK + 12]), at([box.x + 2.7, box.y + 6, DECK + 12])], { size: 0.4 }))
  out.push(S(k.slabOf({ x: mx - 6.5, y: my + MOTOR_R - 0.6, w: 13, d: GEARBOX.y - (my + MOTOR_R) + 0.6, r: 0.6 }, DECK + 2, 6, P, 3), { tone: 'mid' }))

  const seam = k.sideSeam(GEARBOX, DECK + 5, P, 4)
  out.push(S(k.slabOf(GEARBOX, DECK, GEARBOX_TOP - DECK, P, 4, 0.6), { tone: 'mid', inner: L(seam, { tone: 'faint' }) }))
  out.push(k.corners(GEARBOX, 3.2).map(point => D([at([point[0], point[1], GEARBOX_TOP])], { size: 0.45 })).join(''))
  out.push(S(k.cylinder(M.CRANK.cx, 0, 9, GEARBOX_TOP, M.ARM_Z - GEARBOX_TOP, P, 40, 0.5), { tone: 'mid' }))
  return out.join('')
}

const railPlan = side => ({ x: RAIL.from, y: side < 0 ? -RAIL.inner - RAIL.d : RAIL.inner, w: RAIL.w, d: RAIL.d, r: 1 })
function rail (side) {
  const plan = railPlan(side)
  const out = [S(k.slabOf(plan, DECK, TH, P, 3, 0.4), { tone: 'mid' })]
  const cy = plan.y + plan.d / 2
  const xs = [RAIL.from + 6, -60, -30, 30, M.DECK_END - 6]
  out.push(D(xs.map(x => at([x, cy, DECK + TH])), { size: 0.45 }))
  return out.join('')
}

function columnBack () {
  return [
    S(k.cylinder(RODS.back[0], RODS.back[1], 2.6, M.BLADE_TOP, 2.4, P, 20), { tone: 'mid' }),
    rodOf(RODS.back, M.BLADE_TOP + 2.4, M.COLUMN_TOP),
    rodOf(RODS.hang, 30, M.COLUMN_TOP),
    S(k.cylinder(RODS.hang[0], RODS.hang[1], 2.1, 29, 1.4, P, 18), { tone: 'mid' })
  ].join('')
}

function columnFront () {
  return [
    S(k.cylinder(RODS.front[0], RODS.front[1], 2.6, M.BLADE_TOP, 2.4, P, 20), { tone: 'mid' }),
    rodOf(RODS.front, M.BLADE_TOP + 2.4, M.COLUMN_TOP)
  ].join('')
}

function yoke () {
  const z = M.COLUMN_TOP + YOKE_H
  const out = [S(k.slabOf(YOKE, M.COLUMN_TOP, YOKE_H, P, 6, 0.6), { tone: 'mid' })]
  out.push(`<path class="ml-void" d="${k.ring(0, 0, HOLE_R, z, P, 64)}"/>`)
  out.push(L(k.ring(0, 0, HOLE_R, z, P, 64), { tone: 'lo' }))
  for (const [x, y] of Object.values(RODS)) out.push(S(k.cylinder(x, y, 2.2, z, 1.4, P, 16), { tone: 'mid' }))
  out.push(D([[YOKE.x + 3.4, YOKE.y + YOKE.d - 3.4], [YOKE.x + YOKE.w - 3.4, YOKE.y + 3.4]].map(([x, y]) => at([x, y, z])), { size: 0.45 }))
  return out.join('')
}

function blade () {
  const tail = M.TIP_HOME - M.BLADE.length
  const post = M.TIP_HOME - M.BLADE.post
  const plan = { x: tail, y: -11.6, w: M.BLADE.length, d: 23.2, r: 0.8 }
  const out = [S(k.slabOf(plan, DECK, TH, P, 3, 0.4), { tone: 'hi', crease: 'lo' })]
  out.push(L(k.lineOnTop([M.TIP_HOME - 5, -11.6], [M.TIP_HOME - 5, 11.6], M.BLADE_TOP, P), { tone: 'faint' }))
  out.push(D([-60, -40, -20].map(dx => at([M.TIP_HOME + dx, -7, M.BLADE_TOP])), { size: 0.4 }))
  out.push(S(k.slabOf({ x: post - 4, y: -4, w: 8, d: 8, r: 1.2 }, M.BLADE_TOP, 2, P, 3, 0.4), { tone: 'mid' }))
  out.push(S(k.cylinder(post, 0, M.BLADE.postR, M.BLADE_TOP + 2, M.ROD_Z - M.BLADE_TOP - 2, P, 18), { tone: 'mid', crease: 'none' }))
  return out.join('')
}

function pinHead () {
  return S(k.cylinder(0, 0, 2.6, M.ROD_Z + M.ROD_H, 1.4, P, 18), { tone: 'mid' }) + D([at([0, 0, M.ROD_Z + M.ROD_H + 1.4])], { size: 0.4 })
}

function pressBack () {
  const basePlan = { x: PRESS.x - 4, y: -46, w: PRESS.w + 8, d: 18, r: 2 }
  const upright = { x: PRESS.x, y: -44, w: PRESS.w, d: 13, r: 2 }
  return [
    S(k.slabOf(basePlan, DECK, 3, P, 4, 0.5), { tone: 'mid' }),
    k.corners(basePlan, 2.6).map(point => D([at([point[0], point[1], DECK + 3])], { size: 0.45 })).join(''),
    S(k.slabOf(upright, DECK + 3, PRESS_ARM_Z - DECK - 3, P, 4, 0.6), {
      tone: 'mid',
      inner: L(k.sideSeam(upright, DECK + 12, P, 4), { tone: 'faint' })
    })
  ].join('')
}

function pressTop (counter) {
  const [x, y] = [M.STATION, 0]
  const top = PRESS_ARM_Z + PRESS_ARM_H
  const out = []
  out.push(S(k.cylinder(x, y, 6.5, M.GLAND_Z, PRESS_ARM_Z - M.GLAND_Z, P, 32, 0.4), { tone: 'mid' }))
  out.push(L(k.sideArc(x, y, 6.5, M.GLAND_Z + 2.4, P, 24), { tone: 'faint' }))
  out.push(S(k.slabOf(PRESS_ARM, PRESS_ARM_Z, PRESS_ARM_H, P, 4, 0.8), {
    tone: 'mid',
    inner: L(k.sideSeam(PRESS_ARM, PRESS_ARM_Z + 2, P, 4), { tone: 'faint' })
  }))
  out.push(D([[PRESS_ARM.x + 3, PRESS_ARM.y + PRESS_ARM.d - 3], [PRESS_ARM.x + PRESS_ARM.w - 3, PRESS_ARM.y + PRESS_ARM.d - 3], [PRESS_ARM.x + 3, PRESS_ARM.y + 3], [PRESS_ARM.x + PRESS_ARM.w - 3, PRESS_ARM.y + 3]].map(([px, py]) => at([px, py, top])), { size: 0.45 }))

  const face = k.sideMatrix([PRESS_ARM.x, PRESS_ARM.y + PRESS_ARM.d], top, P, 'left')
  out.push(`<g transform="${face}"><rect class="ml-window" x="4" y="2.2" width="12" height="5.6" rx="0.8"/>${counter}</g>`)

  out.push(S(k.cylinder(x, y, CAN_R + 1, top, 1.4, P, 40), { tone: 'mid' }))
  out.push(S(k.cylinder(x, y, CAN_R, top + 1.4, CAN_TOP - top - 1.4, P, 44, 0.5), {
    tone: 'mid',
    inner: L(k.knurl(x, y, CAN_R, top + 4, CAN_TOP - 3, 36, P), { tone: 'lo' })
  }))
  out.push(L(k.sideArc(x, y, CAN_R, top + 4, P, 28) + k.sideArc(x, y, CAN_R, CAN_TOP - 3, P, 28), { tone: 'faint' }))
  out.push(L(k.ring(x, y, CAN_R - 2.4, CAN_TOP, P, 36), { tone: 'lo' }))
  out.push(D([at([x, y, CAN_TOP])], { size: 0.5 }))
  return out.join('')
}

function die () {
  const { r, h } = M.DIE
  return S(k.cylinder(M.STATION, 0, RAM_R, h + 1.6, RAM_LENGTH, P, 20), { tone: 'mid', crease: 'none' }) +
    S(k.cylinder(M.STATION, 0, r, 0, h, P, 40, 0.5), { tone: 'mid', inner: L(k.sideArc(M.STATION, 0, r, 1.2, P, 28), { tone: 'faint' }) }) +
    S(k.cylinder(M.STATION, 0, 4.6, h, 1.6, P, 24), { tone: 'mid' })
}

const binWall = (x, y, w, d) => S(k.slabOf({ x, y, w, d, r: 0.6 }, BIN.z, BIN.top - BIN.z, P, 2, 0.3), { tone: 'mid' })
function binBack () {
  const out = []
  for (const [x, y] of byDepth([[BIN.x + BIN.w - 6, BIN.y + 6], [BIN.x + BIN.w - 6, BIN.y + BIN.d - 6]])) {
    out.push(S(k.cylinder(x, y, 2.6, 0, BIN.z, P, 18), { tone: 'mid' }))
  }
  out.push(S(k.slabOf({ x: BIN.x, y: BIN.y, w: BIN.w, d: BIN.d, r: 1 }, BIN.z, 2, P, 3), { tone: 'lo' }))
  out.push(binWall(BIN.x, BIN.y, BIN.wall, BIN.d))
  out.push(binWall(BIN.x, BIN.y, BIN.w, BIN.wall))
  return out.join('')
}

function binFront () {
  return [
    binWall(BIN.x, BIN.y + BIN.d - BIN.wall, BIN.w, BIN.wall),
    binWall(BIN.x + BIN.w - BIN.wall, BIN.y, BIN.wall, BIN.d),
    D([at([BIN.x + BIN.w - 1, BIN.y + 6, BIN.top]), at([BIN.x + BIN.w - 1, BIN.y + BIN.d - 6, BIN.top])], { size: 0.4 })
  ].join('')
}

function token () {
  const solid = S(k.cylinder(0, 0, TR, 0, TH, P, 48, 0.5), {
    tone: 'hi',
    crease: 'lo',
    inner: L(k.knurl(0, 0, TR, 0.6, TH - 0.6, 64, P, 0.3), { tone: 'lo' })
  })
  return solid + L(k.ring(0, 0, TR - 2.6, TH, P, 48), { tone: 'faint' })
}

const LABEL = 'A coin-feed escapement on a bed. Tokens, one per call to lock(), stack in a column of three rods: the queue. A crank drives a pusher blade exactly one token thick, so it carries one token at a time to a press and over the end into a bin. While the blade is out, the next token rests on it; when it retracts, the next token drops in.'
const CAPTION = 'Every token is a call to lock(); the figure runs superlock\'s own createLock(). A free lock lets a token drop straight onto the deck. While the blade carries it to the press, the next token rests on the blade. release() fires as the blade pulls back from under the column, and the bottom token drops in: first in, first out. Abort a waiting token\'s signal and it leaves the column; the stack closes up. Aborting the holder does nothing.'

const bodyOf = moving => [
  layer('base', base()),
  layer('drive', drive()),
  layer('press-back', pressBack()),
  layer('rail-back', rail(-1)),
  layer('column-back', columnBack()),
  layer('blade', moving.blade, ' data-part="blade"'),
  layer('tokens', moving.tokens),
  layer('rail-front', rail(1)),
  layer('crank', moving.crank, ' data-part="crank"'),
  layer('rod', moving.rod, ' data-part="rod"'),
  layer('pin-crank', moving.pinCrank, ' data-part="pin-crank"'),
  layer('pin-post', moving.pinPost, ' data-part="pin-post"'),
  layer('column-front', columnFront()),
  layer('aborting', moving.aborting),
  layer('die', moving.die, ' data-part="die"'),
  layer('press-top', pressTop(moving.counter)),
  layer('bin-back', binBack()),
  layer('bin', moving.bin),
  layer('bin-front', binFront()),
  layer('yoke', yoke())
]

const CSS = `
.ml-stage{position:relative;outline:none;cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.ml-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ml-void{fill:var(--anatomy-shade-0);stroke:none}
.ml-window{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ml-counter{font:600 4.4px var(--anatomy-mono);fill:var(--anatomy-hi);letter-spacing:.3px}
[data-layer] g[data-token]{pointer-events:none}
.iso{--ml-hold-top:#5c5c5c;--ml-hold-side:#383838}
.iso[data-theme="light"]{--ml-hold-top:#2a2a2e;--ml-hold-side:#4a4a4f}
.iso-solid[data-lit]>.iso-top{fill:var(--ml-hold-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--ml-hold-side)}
.iso-plate-corner[data-corner="hint"]{text-transform:none;letter-spacing:.02em}
.ml-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`

const PAGE_CSS = `
html:has(body[data-theme="light"]){color-scheme:light}
html[data-embed] body{background:transparent}
html[data-embed] .iso-page{width:100%;margin:0;padding:1px;display:flow-root}
html[data-embed] .iso-figure{margin:0}
@media (max-width:560px){.iso-plate-corner[data-corner="hint"]{right:0;white-space:normal;line-height:1.5}}
`

const source = file => readFileSync(file, 'utf8')
const commonjs = (name, code) => `const ${name} = (() => { const module = { exports: {} }; ${code}\nreturn module.exports })()`
const superlockScript = [
  commonjs('LinkedList', source(join(ROOT, 'src', 'linked-list.js'))),
  'const require = () => LinkedList',
  commonjs('createLock', source(join(ROOT, 'src', 'create.js')))
].join('\n')
const exportedNames = text => [...text.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map(match => match[1])
const namespace = (name, file) => {
  const text = source(file)
  return `const ${name} = (() => {\n${text.replace(/^export /gm, '')}\nreturn { ${exportedNames(text).join(', ')} }\n})()`
}

const DATA = { P, token: token() }
const script = [
  namespace('kit', join(ANATOMY, 'kit', 'iso-kit.mjs')),
  namespace('machine', join(HERE, 'machine.mjs')),
  superlockScript,
  `const createSim = ${createSim.toString()}`,
  `const createDrawing = ${createDrawing.toString()}`,
  `const mount = ${mount.toString()}`,
  `const embed = ${embed.toString()}`,
  'embed()',
  `mount({ data: ${JSON.stringify(DATA)}, kit, machine, sim: createSim({ machine, createLock }), drawing: createDrawing({ kit, machine, P: ${JSON.stringify(P)} }) })`
].join('\n')

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: bodyOf({
    blade: blade(),
    tokens: '',
    crank: '',
    rod: '',
    pinCrank: pinHead(),
    pinPost: pinHead(),
    aborting: '',
    die: die(),
    bin: '',
    counter: '<text class="ml-counter" data-part="counter" x="10" y="6.6" text-anchor="middle">000</text>'
  })
})

const plate = k.plateHtml({
  fig: 'Fig 1',
  title: 'superlock · mutex',
  hint: 'Click to call lock() · click a waiting token to abort',
  readout: 'free · 0 awaiting',
  keys: [
    { mark: 'lit', label: 'The token holding the lock: the blade is one token thick, so only one fits' },
    { mark: 'raised', label: 'Tokens in the column: callers waiting in arrival order, lock.awaiting()' }
  ],
  caption: CAPTION,
  body: `<div class="ml-stage" tabindex="0" role="group" aria-roledescription="interactive figure" aria-label="Mutex as a coin-feed escapement. Enter or Space calls lock(). Backspace aborts the newest waiting token.">${svg}<div class="ml-live" aria-live="polite" data-live></div></div>`
})

const write = (name, text) => {
  writeFileSync(join(HERE, name), text)
  console.log('wrote', name, `${(text.length / 1024).toFixed(0)} KB`)
}

const frames = await recordLoop({ createSim, machine: M, createLock: require(join(ROOT, 'src', 'create.js')) })
const drawing = createDrawing({ kit: k, machine: M, P })
for (const theme of ['dark', 'light']) {
  const suffix = theme === 'light' ? '-light' : ''
  write(`mutex${suffix}.html`, k.pageHtml({ title: 'superlock mutex', theme, body: plate, script, width: 720 }).replace('</style>', `${CSS}${PAGE_CSS}</style>`))
  write(`mutex${suffix}.svg`, animatedSvg({ k, M, P, theme, frames, drawing, bodyOf, token: token(), pinHead: pinHead(), blade: blade(), die: die(), css: CSS, label: LABEL, width: WIDTH, height: HEIGHT }))
}
