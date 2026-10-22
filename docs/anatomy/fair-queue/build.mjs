import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import * as M from './machine.mjs'
import { mount } from './live.mjs'
import { embed } from '../live.mjs'
import { createSim } from './sim.mjs'
import { createDrawing } from './drawing.mjs'
import { recordLoop, animatedSvg } from './readme.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..')
const require = createRequire(import.meta.url)
const ROOT = join(HERE, '..', '..', '..')
const ANATOMY = process.env.ANATOMY_HOME || [join(homedir(), '.claude', 'skills', 'anatomy'), join(homedir(), '.agents', 'skills', 'anatomy')].find(path => existsSync(join(path, 'kit', 'iso-kit.mjs')))
const k = await import(pathToFileURL(join(ANATOMY, 'kit', 'iso-kit.mjs')).href)

const WIDTH = 640
const PAD = 20

const { r: TR, h: TH } = M.TOKEN
const DECK = M.DECK
const BED_Z = 8
const FOOT_H = 8
const ROD_R = 1.6
const ROD_RING = 16
const ROD_FOOT = DECK + TH + 1.6
const ROD_ANGLES = [20, -20, 160, 200]
const POST_R = 2.2
const POST = { s: -14.8, side: 14.8 }
const YOKE = { half: 19, h: 3 }
const FLAG = { half: 8, thick: 1.6, height: 13, letter: 10 }
const BRIDGE = { from: 81, to: 88, half: 11.5, leg: 2, legTop: DECK + TH + 1.5, top: DECK + TH + 4.5 }
const DRIVE = { half: 7, h: 3.2 }
const PRESS_ARM = { from: -10, to: 7, half: 10, z: 78, h: 12 }
const PILLAR = { from: -7, to: 7, half: 8 }
const PILLAR_BASE = { from: -12, to: 12, half: 13, h: 3 }
const CAN_R = 8
const CAN_TOP = 102
const RAM_R = 3.2
const RAM_LENGTH = 50
const MOTOR = M.along(M.AZIMUTH + 154, 84)
const MOTOR_R = 8
const MOTOR_TOP = DECK + 14
const SPINDLE_R = 7
const STATION = M.padPoint(M.PRESS_ANGLE)
const PILLAR_AT = [STATION[0] - M.VIEW[0] * 79, STATION[1] - M.VIEW[1] * 79]

function screenPoint (across, along) {
  return [M.VIEW[1] * across + M.VIEW[0] * along, -M.VIEW[0] * across + M.VIEW[1] * along]
}

function bedRing (inset, count = 120, from = 0) {
  const { half, back, front } = M.BED
  const right = [M.VIEW[1], -M.VIEW[0]]
  const centre = (front - back) / 2
  const deep = (front + back) / 2
  return Array.from({ length: count }, (_, index) => {
    const angle = from + (index / count) * Math.PI * 2
    const across = (half - inset) * Math.cos(angle)
    const along = centre + (deep - inset) * Math.sin(angle)
    return [right[0] * across + M.VIEW[0] * along, right[1] * across + M.VIEW[1] * along]
  })
}
function flagTop (key) {
  return [...flagCentre(key), M.COLUMN_TOP + YOKE.h + FLAG.height]
}
const fitPoints = () => [
  ...bedRing(0).map(point => [...point, 0]),
  ...bedRing(0).map(point => [...point, DECK]),
  [...STATION, CAN_TOP + 2],
  [PILLAR_AT[0] - M.VIEW[0] * 12, PILLAR_AT[1] - M.VIEW[1] * 12, PRESS_ARM.z + PRESS_ARM.h],
  ...M.KEYS.map(flagTop)
]
const unit = k.fitProjection(fitPoints(), WIDTH, 2000, { pad: PAD, azimuth: M.AZIMUTH })
const screenYs = fitPoints().map(point => k.iso(point, unit)[1])
const HEIGHT = Math.ceil(Math.max(...screenYs) - Math.min(...screenYs) + PAD * 2)
const P = k.fitProjection(fitPoints(), WIDTH, HEIGHT, { pad: PAD, azimuth: M.AZIMUTH })

const at = point => k.iso(point, P)
const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)
const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P)
const byDepth = points => [...points].sort((a, b) => depth(a) - depth(b))
const layer = (name, children = '', extra = '') => `<g data-layer="${name}"${extra}>${Array.isArray(children) ? children.join('') : children}</g>`
const screw = ([x, y], z, size = 0.45) => L(k.ring(x, y, 1.6, z, P, 14), { tone: 'lo' }) + D([at([x, y, z])], { size })
const slab = (ring, z, height, style, bevel = 0.4) => S(k.extrude(ring, z, height, P, { bevel }), style)

function frameAt (degrees, centre = 0, origin = [0, 0]) {
  const u = M.unitOf(degrees)
  const t = M.sideOf(degrees)
  const point = (s, side = 0) => [origin[0] + u[0] * (centre + s) + t[0] * side, origin[1] + u[1] * (centre + s) + t[1] * side]
  const plan = (from, to, left, right, radius = 1, steps = 3) => k.roundedPlan({ x: from, y: left, w: to - from, d: right - left, r: radius }, steps).map(([s, side]) => point(s, side))
  return { u, t, point, plan }
}

function frameOf (key) {
  const frame = frameAt(M.STATION[key])
  const open = M.ABORT_SIDE[key]
  const openSide = Math.sign(open[0] * frame.t[0] + open[1] * frame.t[1])
  return { ...frame, postSide: -openSide }
}

function faceMatrix (origin, along) {
  const [ox, oy] = at(origin)
  const [ax, ay] = at([origin[0] + along[0], origin[1] + along[1], origin[2]])
  const [dx, dy] = at([origin[0], origin[1], origin[2] - 1])
  const fixed = value => Math.round(value * 1000) / 1000
  return `matrix(${[ax - ox, ay - oy, dx - ox, dy - oy, ox, oy].map(fixed).join(' ')})`
}

const PRESS_REACH = Math.hypot(PILLAR_AT[0] - STATION[0], PILLAR_AT[1] - STATION[1])
const pressFrame = frameAt(Math.atan2(PILLAR_AT[1] - STATION[1], PILLAR_AT[0] - STATION[0]) * 180 / Math.PI, 0, STATION)

function dropClip () {
  const [x, y] = STATION
  const rim = k.circleRing(x, y, M.DROP.hole, 48).map(([px, py]) => ({ screen: at([px, py, DECK]), near: depth([px, py]) >= depth([x, y]) }))
  const left = rim.reduce((best, point) => (point.screen[0] < best.screen[0] ? point : best)).screen
  const right = rim.reduce((best, point) => (point.screen[0] > best.screen[0] ? point : best)).screen
  const lower = rim.filter(point => point.near).map(point => point.screen).sort((a, b) => a[0] - b[0])
  const up = 600
  const path = [left, ...lower, right, [right[0], right[1] - up], [left[0], left[1] - up]]
  return `<clipPath id="fq-drop"><path d="${k.pathOf(path, true)}"/></clipPath>`
}

function trap (style = '') {
  const [x, y] = STATION
  return `<path class="ml-void" data-part="trap" opacity="0"${style} d="${k.ring(x, y, M.DROP.hole, DECK, P, 48)}"/>`
}

function base () {
  const out = [`<path class="iso-halo" d="${k.extrude(bedRing(0), 0, DECK, P).fill}"/>`]
  const feet = bedRing(20, 6, Math.PI / 6)
  for (const [x, y] of byDepth(feet)) {
    out.push(S(k.cylinder(x, y, 7, 0, 1.6, P, 28), { tone: 'lo' }))
    out.push(S(k.cylinder(x, y, 5.4, 1.6, FOOT_H - 1.6, P, 28), { tone: 'mid' }))
  }
  out.push(S(k.extrude(bedRing(0), BED_Z, DECK - BED_Z, P, { bevel: 1.6 }), { tone: 'mid', inner: L(k.ringSeam(bedRing(0), BED_Z + 4, P), { tone: 'faint' }) }))
  out.push(L(k.onTop(bedRing(5), DECK, P, true), { tone: 'lo' }))
  out.push(bedRing(10, 8, Math.PI / 8).map(point => screw(point, DECK, 0.5)).join(''))

  out.push(L(k.ring(0, 0, M.R_DIAL + 1.2, DECK, P, 96), { tone: 'lo' }))
  out.push(L(k.ring(0, 0, M.R_DIAL, DECK, P, 96), { tone: 'lo' }))
  out.push(L(k.ring(0, 0, M.R_DIAL - 3, DECK, P, 96), { tone: 'faint' }))
  const scale = M.R_DIAL + 5.4
  out.push(L(k.ring(0, 0, scale, DECK, P, 120), { tone: 'lo' }))
  const ticks = { minor: [], major: [] }
  for (let degrees = 0; degrees < 360; degrees += 5) {
    const major = degrees % 30 === 0
    const [ux, uy] = M.unitOf(degrees)
    const from = M.R_DIAL + 1.2
    const to = major ? scale : from + 1.6
    ticks[major ? 'major' : 'minor'].push(k.lineOnTop([ux * from, uy * from], [ux * to, uy * to], DECK, P))
  }
  out.push(L(ticks.minor.join(''), { tone: 'lo' }), L(ticks.major.join(''), { tone: 'hi' }))
  const [ax, ay] = M.unitOf(M.PRESS_ANGLE)
  const [bx, by] = M.sideOf(M.PRESS_ANGLE)
  const pointer = [[scale + 0.6, 0], [scale + 6, -3], [scale + 6, 3]].map(([s, side]) => at([ax * s + bx * side, ay * s + by * side, DECK]))
  out.push(`<path class="ml-pointer" d="${k.pathOf(pointer, true)}"/>`)

  const [px, py] = screenPoint(-62, 26)
  const plate = { x: px - 22, y: py - 6, w: 44, d: 12, r: 1.5 }
  out.push(S(k.slabOf(plate, DECK, 0.8, P, 4), { tone: 'mid', crease: 'none' }))
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), DECK + 0.8, P, 4), { tone: 'faint' }))
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 5, plate.y + 6.2], DECK + 0.8, P, 'x'), 'superlock', { size: 3.6, tone: 'mid' }))
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 8.6], [plate.x + 30, plate.y + 8.6], DECK + 0.8, P), { tone: 'lo', free: true }))
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 10.2], [plate.x + 22, plate.y + 10.2], DECK + 0.8, P), { tone: 'lo', free: true }))
  out.push(D([at([plate.x + plate.w - 3.4, plate.y + 3, DECK + 0.8]), at([plate.x + plate.w - 3.4, plate.y + plate.d - 3, DECK + 0.8])], { size: 0.45 }))
  return out.join('')
}

function dialMarks () {
  const out = []
  const [cx, cy] = M.padPoint(0)
  const hubRing = 25
  const rim = M.R_DIAL - 3
  out.push(L(k.ring(0, 0, hubRing, DECK, P, 64), { tone: 'lo' }))
  out.push(L([45, 135, 225, 315].map(degrees => {
    const [ux, uy] = M.unitOf(degrees)
    return k.lineOnTop([ux * hubRing, uy * hubRing], [ux * rim, uy * rim], DECK, P)
  }).join(''), { tone: 'mid' }))
  out.push(L(k.ring(cx, cy, TR + 1.2, DECK, P, 48), { tone: 'mid' }))
  out.push(L(k.ring(cx, cy, TR - 3, DECK, P, 40), { tone: 'faint' }))
  out.push(D([at([cx + TR - 0.6, cy, DECK]), at([cx - TR + 0.6, cy, DECK])], { size: 0.4 }))
  const bolts = []
  for (let degrees = 22.5; degrees < 360; degrees += 45) bolts.push(at([...M.along(degrees, 44), DECK]))
  out.push(D(bolts, { size: 0.5 }))
  return out.join('')
}

function bridgeLegs (key) {
  const { plan, point } = frameOf(key)
  const legs = [[-BRIDGE.half, -BRIDGE.half + BRIDGE.leg], [BRIDGE.half - BRIDGE.leg, BRIDGE.half]]
  const sideDepth = ([left, right]) => depth(point(M.R_COL + (BRIDGE.from + BRIDGE.to) / 2 - M.R_COL, (left + right) / 2))
  const [far, near] = [...legs].sort((a, b) => sideDepth(a) - sideDepth(b))
  const leg = ([left, right]) => slab(plan(BRIDGE.from, BRIDGE.to, left, right, 0.6), DECK, BRIDGE.legTop - DECK, { tone: 'mid' })
  return { far: leg(far), near: leg(near) }
}

function bridgeTop (key) {
  const { plan, point } = frameOf(key)
  const out = [slab(plan(BRIDGE.from, BRIDGE.to, -BRIDGE.half, BRIDGE.half, 1), BRIDGE.legTop, BRIDGE.top - BRIDGE.legTop, { tone: 'mid' }, 0.5)]
  out.push(D([[BRIDGE.from + 1.6, -BRIDGE.half + 1.8], [BRIDGE.from + 1.6, BRIDGE.half - 1.8], [BRIDGE.to - 1.6, -BRIDGE.half + 1.8], [BRIDGE.to - 1.6, BRIDGE.half - 1.8]].map(([s, side]) => at([...point(s, side), BRIDGE.top])), { size: 0.42 }))
  const drive = plan(BRIDGE.from + 1, BRIDGE.to - 1, -DRIVE.half, DRIVE.half, 0.8)
  out.push(slab(drive, BRIDGE.top, DRIVE.h, { tone: 'mid', inner: L(k.ringSeam(drive, BRIDGE.top + 1.2, P), { tone: 'faint' }) }, 0.4))
  out.push(D([[(BRIDGE.from + BRIDGE.to) / 2, -DRIVE.half + 1.6], [(BRIDGE.from + BRIDGE.to) / 2, DRIVE.half - 1.6]].map(([s, side]) => at([...point(s, side), BRIDGE.top + DRIVE.h])), { size: 0.4 }))
  return out.join('')
}

function blade (key) {
  const { plan, point } = frameOf(key)
  const { rest, length, width } = M.BLADE
  const top = DECK + TH
  const out = [slab(plan(rest, rest + length, -width / 2, width / 2, 0.8), DECK, TH, { tone: 'mid' })]
  out.push(L(k.lineOnTop(point(rest + 5, -width / 2), point(rest + 5, width / 2), top, P), { tone: 'faint' }))
  out.push(D([14, 24, 34].map(s => at([...point(rest + s, -5), top])), { size: 0.4 }))
  return out.join('')
}

function columnFrame (key) {
  return frameAt(M.STATION[key], M.R_COL)
}

function rods (key) {
  const frame = columnFrame(key)
  const centre = depth(frame.point(0))
  return ROD_ANGLES.map(angle => {
    const [cos, sin] = M.unitOf(angle)
    const spot = frame.point(cos * ROD_RING, sin * ROD_RING)
    return { spot, front: depth(spot) > centre, outer: cos > 0 }
  })
}

function postSpot (key) {
  return columnFrame(key).point(POST.s, frameOf(key).postSide * POST.side)
}

function flagCentre (key) {
  const [cx, cy] = columnFrame(key).point(0)
  const reach = YOKE.half - FLAG.thick
  return [cx - M.VIEW[0] * reach, cy - M.VIEW[1] * reach]
}

function footBar (key) {
  const plan = columnFrame(key).plan(-ROD_RING - 1.6, -ROD_RING + 2.2, -7.6, 7.6, 1, 2)
  return slab(plan, ROD_FOOT, 1.4, { tone: 'mid' }, 0.3)
}

function hangers (key, list) {
  const bar = list.some(rod => !rod.outer) ? footBar(key) : ''
  return bar + [...list].sort((a, b) => depth(a.spot) - depth(b.spot)).map(({ spot: [x, y], outer }) => {
    const foot = outer ? BRIDGE.top : ROD_FOOT
    return S(k.cylinder(x, y, ROD_R + 0.9, foot, 1.4, P, 18), { tone: 'mid' }) +
      S(k.cylinder(x, y, ROD_R, foot + 1.4, M.COLUMN_TOP - foot - 1.4, P, 18), { tone: 'mid', crease: 'none' })
  }).join('')
}

function post (key) {
  const [x, y] = postSpot(key)
  return S(k.cylinder(x, y, POST_R + 1.2, DECK, 1.6, P, 18), { tone: 'lo' }) +
    S(k.cylinder(x, y, POST_R, DECK + 1.6, M.COLUMN_TOP - DECK - 1.6, P, 18), { tone: 'mid', crease: 'none', inner: L(k.sideArc(x, y, POST_R, DECK + 8, P, 12), { tone: 'faint' }) })
}

function yoke (key) {
  const frame = columnFrame(key)
  const [cx, cy] = frame.point(0)
  const z = M.COLUMN_TOP + YOKE.h
  const out = [slab(frame.plan(-YOKE.half, YOKE.half, -YOKE.half, YOKE.half, 5), M.COLUMN_TOP, YOKE.h, { tone: 'mid' }, 0.6)]
  out.push(`<path class="ml-void" d="${k.ring(cx, cy, TR + 0.6, z, P, 64)}"/>`)
  out.push(L(k.ring(cx, cy, TR + 0.6, z, P, 64), { tone: 'lo' }))
  for (const [x, y] of [...rods(key).map(rod => rod.spot), postSpot(key)]) out.push(S(k.cylinder(x, y, 2.1, z, 1.2, P, 16), { tone: 'mid' }))
  const corner = YOKE.half - 3.2
  const side = frameOf(key).postSide
  out.push(D([frame.point(corner, -side * corner), frame.point(-corner, -side * corner)].map(([x, y]) => at([x, y, z])), { size: 0.42 }))
  return out.join('')
}

function flag (key) {
  const [cx, cy] = flagCentre(key)
  const face = frameAt(M.AZIMUTH)
  const bottom = M.COLUMN_TOP + YOKE.h
  const plan = k.roundedPlan({ x: -FLAG.thick / 2, y: -FLAG.half, w: FLAG.thick, d: FLAG.half * 2, r: 0.4 }, 2).map(([s, side]) => [cx + face.u[0] * s + face.t[0] * side, cy + face.u[1] * s + face.t[1] * side])
  const out = [slab(plan, bottom, FLAG.height, { tone: 'mid' }, 0.3)]
  const screen = [-face.t[0], -face.t[1]]
  const front = FLAG.thick / 2
  const origin = [cx + face.u[0] * front - screen[0] * FLAG.half, cy + face.u[1] * front - screen[1] * FLAG.half, bottom + FLAG.height]
  const inset = 1.2
  out.push(`<g transform="${faceMatrix(origin, screen)}"><rect class="ml-tag" x="${inset}" y="${inset}" width="${FLAG.half * 2 - inset * 2}" height="${FLAG.height - inset * 2}" rx="1"/><text class="ml-key" x="${FLAG.half}" y="${FLAG.height / 2 + FLAG.letter * 0.36}" font-size="${FLAG.letter}" text-anchor="middle">${key}</text></g>`)
  return out.join('')
}

function columnUnit (key, moving) {
  const legs = bridgeLegs(key)
  const list = rods(key)
  return [
    legs.far,
    `<g data-part="blade-${key}"${moving.bladeStyle ? moving.bladeStyle(key) : ''}>${blade(key)}</g>`,
    legs.near,
    bridgeTop(key),
    post(key),
    hangers(key, list.filter(rod => !rod.front)),
    layer(`col-${key}`, moving.tokens(`col-${key}`)),
    hangers(key, list.filter(rod => rod.front)),
    yoke(key),
    flag(key)
  ].join('')
}

function pressBack () {
  const out = []
  out.push(`<path class="iso-halo" d="${k.extrude(pressFrame.plan(PRESS_REACH + PILLAR_BASE.from, PRESS_REACH + PILLAR_BASE.to, -PILLAR_BASE.half, PILLAR_BASE.half, 3), DECK, PILLAR_BASE.h, P).fill}"/>`)
  out.push(slab(pressFrame.plan(PRESS_REACH + PILLAR_BASE.from, PRESS_REACH + PILLAR_BASE.to, -PILLAR_BASE.half, PILLAR_BASE.half, 3), DECK, PILLAR_BASE.h, { tone: 'lo' }, 0.6))
  const corner = 3
  out.push([[PILLAR_BASE.from + corner, -PILLAR_BASE.half + corner], [PILLAR_BASE.from + corner, PILLAR_BASE.half - corner], [PILLAR_BASE.to - corner, -PILLAR_BASE.half + corner], [PILLAR_BASE.to - corner, PILLAR_BASE.half - corner]].map(([s, side]) => screw(pressFrame.point(PRESS_REACH + s, side), DECK + PILLAR_BASE.h)).join(''))
  const pillar = pressFrame.plan(PRESS_REACH + PILLAR.from, PRESS_REACH + PILLAR.to, -PILLAR.half, PILLAR.half, 2)
  out.push(S(k.extrude(pillar, DECK + PILLAR_BASE.h, PRESS_ARM.z - DECK - PILLAR_BASE.h, P, { bevel: 0.6 }), {
    tone: 'mid',
    inner: L(k.ringSeam(pillar, DECK + 14, P) + k.ringSeam(pillar, PRESS_ARM.z - 12, P), { tone: 'faint' })
  }))
  return out.join('')
}

function pressTop (counter) {
  const [x, y] = STATION
  const top = PRESS_ARM.z + PRESS_ARM.h
  const out = []
  out.push(S(k.cylinder(x, y, 6.5, M.GLAND_Z, PRESS_ARM.z - M.GLAND_Z, P, 32, 0.4), { tone: 'mid' }))
  out.push(L(k.sideArc(x, y, 6.5, M.GLAND_Z + 2.4, P, 24), { tone: 'faint' }))
  const arm = pressFrame.plan(PRESS_ARM.from, PRESS_REACH + PRESS_ARM.to, -PRESS_ARM.half, PRESS_ARM.half, 3)
  out.push(S(k.extrude(arm, PRESS_ARM.z, PRESS_ARM.h, P, { bevel: 0.8 }), { tone: 'mid', inner: L(k.ringSeam(arm, PRESS_ARM.z + 2, P), { tone: 'faint' }) }))
  out.push(D([[PRESS_ARM.from + 3, -PRESS_ARM.half + 3], [PRESS_ARM.from + 3, PRESS_ARM.half - 3], [PRESS_REACH + PRESS_ARM.to - 3, -PRESS_ARM.half + 3], [PRESS_REACH + PRESS_ARM.to - 3, PRESS_ARM.half - 3]].map(([s, side]) => at([...pressFrame.point(s, side), top])), { size: 0.45 }))
  const origin = [...pressFrame.point(PRESS_ARM.from, -PRESS_ARM.half), top]
  out.push(`<g transform="${faceMatrix(origin, pressFrame.t)}"><rect class="ml-window" x="2" y="0.8" width="16" height="10.4" rx="1"/>${counter}</g>`)
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
  const [x, y] = STATION
  return S(k.cylinder(x, y, RAM_R, h + 1.6, RAM_LENGTH, P, 20), { tone: 'mid', crease: 'none' }) +
    S(k.cylinder(x, y, r, 0, h, P, 32, 0.4), { tone: 'mid', inner: L(k.sideArc(x, y, r, 1.2, P, 24), { tone: 'faint' }) }) +
    S(k.cylinder(x, y, RAM_R + 0.8, h, 1.6, P, 24), { tone: 'mid' })
}

function spindle () {
  return S(k.cylinder(0, 0, SPINDLE_R + 1.6, DECK, 1.2, P, 32), { tone: 'lo' }) +
    S(k.cylinder(0, 0, SPINDLE_R, DECK + 1.2, M.GUIDE.height - 1.2, P, 32), { tone: 'mid' })
}

function hub () {
  const { r, top } = M.HUB
  const bottom = DECK + M.GUIDE.height
  return S(k.cylinder(0, 0, r, bottom, top - bottom, P, 48, 0.5), {
    tone: 'mid',
    inner: L(k.knurl(0, 0, r, bottom + 2.6, top - 2.6, 44, P), { tone: 'lo' })
  }) +
    L(k.sideArc(0, 0, r, bottom + 2.6, P, 32) + k.sideArc(0, 0, r, top - 2.6, P, 32), { tone: 'faint' }) +
    L(k.ring(0, 0, r - 2.2, top, P, 40), { tone: 'lo' })
}

function hubMarks () {
  const { r, top } = M.HUB
  return L(k.lineOnTop([0, 0], [r - 2.2, 0], top, P), { tone: 'hi' }) +
    D([at([0, 0, top])], { size: 0.5 }) +
    D([at([-4.4, 3.4, top]), at([-4.4, -3.4, top])], { size: 0.42 })
}

function motor () {
  const [mx, my] = MOTOR
  const out = []
  const box = { x: mx - 6, y: my + MOTOR_R - 0.4, w: 12, d: 7.4, r: 0.6 }
  out.push(S(k.cylinder(mx, my, MOTOR_R + 1.6, DECK, 1.6, P, 40), { tone: 'lo' }))
  out.push(S(k.cylinder(mx, my, MOTOR_R, DECK + 1.6, MOTOR_TOP - DECK - 1.6, P, 44, 0.6), {
    tone: 'mid',
    inner: L(k.knurl(mx, my, MOTOR_R, DECK + 4, MOTOR_TOP - 3, 40, P), { tone: 'lo' })
  }))
  out.push(L(k.sideArc(mx, my, MOTOR_R, DECK + 4, P, 28) + k.sideArc(mx, my, MOTOR_R, MOTOR_TOP - 3, P, 28), { tone: 'faint' }))
  out.push(L(k.ring(mx, my, MOTOR_R - 2.6, MOTOR_TOP, P, 36), { tone: 'lo' }))
  out.push(D([0, 1, 2, 3].map(index => {
    const angle = Math.PI / 4 + index * Math.PI / 2
    return at([mx + Math.cos(angle) * (MOTOR_R - 1.3), my + Math.sin(angle) * (MOTOR_R - 1.3), MOTOR_TOP])
  }), { size: 0.42 }))
  out.push(S(k.slabOf(box, DECK, 7, P, 3, 0.4), { tone: 'mid', inner: L(k.sideSeam(box, DECK + 2.4, P, 3), { tone: 'faint' }) }))
  out.push(D([at([box.x + 2, box.y + box.d - 2, DECK + 7]), at([box.x + box.w - 2, box.y + box.d - 2, DECK + 7])], { size: 0.4 }))
  return out.join('')
}

function token () {
  const solid = S(k.cylinder(0, 0, TR, 0, TH, P, 48, 0.5), {
    tone: 'hi',
    crease: 'lo',
    inner: L(k.knurl(0, 0, TR, 0.4, TH - 0.4, 64, P, 0.2), { tone: 'lo' })
  })
  return solid + L(k.ring(0, 0, TR - 2.6, TH, P, 48), { tone: 'faint' })
}

const LABEL = 'An indexing table on a round bed. Three token columns, A, B and C, stand around a turning dial; every token is a call to queue(signal, key) with that column\'s key. When the press is free, the dial turns to the column the fair queue just granted, a pusher slides that column\'s bottom token onto the dial, the dial carries it to the press, and a trap under the press drops it through the bed.'
const CAPTION = 'Every token is a call to queue(signal, key) on superlock\'s own createFairQueue(1): one queue per key, one column per queue, and each key is served in arrival order. When the slot frees, the dial turns to the column whose call the queue just granted, never one the figure picks, and a pusher slides that column\'s bottom token onto it. Calls are served in rounds: when a round runs out, every call waiting at that moment forms the next one, and within a round the press never serves the same key twice in a row while another key in the round is still waiting. A call that arrives during a round waits for the next round. release() fires as the trap under the press closes. Abort a waiting token and it leaves its column; aborting the token being served does nothing.'

const columnDepth = key => depth(M.columnPoint(key))

function bodyOf (moving) {
  return [
    `<defs>${dropClip()}</defs>`,
    layer('base', base()),
    layer('dial', moving.dialMarks, ' data-part="dial-marks"'),
    layer('motor', motor()),
    layer('press-back', pressBack()),
    layer('drop', trap(moving.trapStyle) + moving.tokens('drop'), ' clip-path="url(#fq-drop)"'),
    layer('spindle', spindle()),
    layer('arm-under', moving.armUnder),
    layer('carry', moving.tokens('carry')),
    layer('arm-over', moving.armOver),
    layer('hub', hub()),
    layer('hub-top', moving.hubMarks, ' data-part="hub-marks"'),
    ...[...M.KEYS].sort((a, b) => columnDepth(a) - columnDepth(b)).map(key => columnUnit(key, moving)),
    layer('aborting', moving.tokens('aborting')),
    layer('die', moving.die, ' data-part="die"' + (moving.dieStyle || '')),
    layer('press-top', pressTop(moving.counter))
  ]
}

const CSS = `
.ml-stage{position:relative;outline:none;cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.ml-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ml-stage[data-pointer]:focus-visible{outline:none}
.ml-void{fill:var(--anatomy-shade-0);stroke:none}
.ml-pointer{fill:var(--anatomy-hi);stroke:var(--anatomy-hi);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ml-wall{fill:var(--anatomy-shade-1);stroke:none}
.ml-window{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ml-tag{fill:none;stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ml-key{font:700 10px var(--anatomy-mono);fill:var(--anatomy-hi)}
.ml-counter{font:700 7px var(--anatomy-mono);fill:var(--anatomy-hi);letter-spacing:.3px}
[data-layer] g[data-token]{pointer-events:none}
.iso{--ml-hold-top:#5c5c5c;--ml-hold-side:#5c5c5c}
.iso[data-theme="light"]{--ml-hold-top:#2a2a2e;--ml-hold-side:#4a4a4f}
.iso-solid[data-lit]>.iso-top{fill:var(--ml-hold-top)}
.iso-solid[data-lit]>.iso-shade{fill:var(--ml-hold-side)}
.iso-plate-corner[data-corner="hint"]{text-transform:none;letter-spacing:.02em}
.ml-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`

const PAGE_CSS = `
html:has(body[data-theme="light"]){color-scheme:light}
html[data-embed] body{background:transparent}
html[data-embed] .iso-page{width:100%;margin:0;display:flow-root}
html[data-embed] .iso-figure{margin:0}
html[data-embed] .iso-plate{background:transparent;box-shadow:none;padding-left:0;padding-right:0;--anatomy-paper:var(--anatomy-page)}
html[data-embed] .iso-plate-corners{left:0;right:0}
@media (max-width:560px){.iso-plate-corner[data-corner="hint"]{right:0;white-space:normal;line-height:1.5}}
`

const source = file => readFileSync(file, 'utf8')
const commonjs = (name, code) => `const ${name} = (() => { const module = { exports: {} }; ${code}\nreturn module.exports })()`
const superlockScript = [
  commonjs('LinkedList', source(join(ROOT, 'src', 'linked-list.js'))),
  'const require = () => LinkedList',
  commonjs('createFairQueue', source(join(ROOT, 'src', 'fair.js')))
].join('\n')
const exportedNames = text => [...text.matchAll(/^export (?:const|function|let) ([A-Za-z_$][\w$]*)/gm)].map(match => match[1])
const namespace = (name, file) => {
  const text = source(file)
  return `const ${name} = (() => {\n${text.replace(/^export /gm, '')}\nreturn { ${exportedNames(text).join(', ')} }\n})()`
}

const COUNTER = '<text class="ml-counter" data-part="counter" x="10" y="9" text-anchor="middle">000</text>'
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
  `mount({ data: ${JSON.stringify(DATA)}, kit, machine, sim: createSim({ machine, createFairQueue, calm: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches }), drawing: createDrawing({ kit, machine, P: ${JSON.stringify(P)} }) })`
].join('\n')

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label: LABEL,
  body: bodyOf({
    dialMarks: dialMarks(),
    hubMarks: hubMarks(),
    tokens: () => '',
    armUnder: '',
    armOver: '',
    die: die(),
    counter: COUNTER
  })
})

const plate = k.plateHtml({
  fig: 'Fig 3',
  title: 'superlock · fair queue',
  hint: 'Click a column to queue · click a token to abort',
  readout: 'free · A 0 · B 0 · C 0 awaiting',
  keys: [
    { mark: 'lit', label: 'The token being served: one press, one slot' },
    { mark: 'raised', label: 'Tokens in a column: one key\'s callers, waiting in arrival order' }
  ],
  caption: CAPTION,
  body: `<div class="ml-stage" tabindex="0" role="group" aria-roledescription="interactive figure" aria-label="Fair queue as an indexing table with three columns. A, B or C calls queue() for that key. Backspace aborts the newest waiting token.">${svg}<div class="ml-live" aria-live="polite" data-live></div></div>`
})

const write = (name, text) => {
  writeFileSync(join(OUT, name), text)
  console.log('wrote', name, `${(text.length / 1024).toFixed(0)} KB`)
}

console.log('card', WIDTH, 'x', HEIGHT, 'scale', P.scale.toFixed(3))
const drawing = createDrawing({ kit: k, machine: M, P })
const frames = await recordLoop({ createSim, machine: M, createFairQueue: require(join(ROOT, 'src', 'fair.js')) })
for (const theme of ['dark', 'light']) {
  const suffix = theme === 'light' ? '-light' : ''
  write(`fair-queue${suffix}.html`, k.pageHtml({ title: 'superlock fair queue', theme, body: plate, script, width: 720 }).replace('</style>', `${CSS}${PAGE_CSS}</style>`))
  write(`fair-queue${suffix}.svg`, animatedSvg({ k, M, P, theme, frames, drawing, bodyOf, token: token(), dialMarks: dialMarks(), hubMarks: hubMarks(), die: die(), css: CSS, label: LABEL, width: WIDTH, height: HEIGHT }))
}
