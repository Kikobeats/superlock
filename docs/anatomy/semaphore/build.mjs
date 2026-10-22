import { readFileSync, writeFileSync } from 'node:fs'
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
const ANATOMY = process.env.ANATOMY_HOME || join(homedir(), '.claude', 'skills', 'anatomy')
const k = await import(pathToFileURL(join(ANATOMY, 'kit', 'iso-kit.mjs')).href)

const WIDTH = 640
const HEIGHT = 340
const AZIMUTH = 60

const { r: TR, h: TH } = M.TOKEN
const DECK = M.DECK
const BED = { x: -178, y: -97, w: 178 + M.DECK_END, d: 194, r: 8 }
const BED_Z = 8
const FOOT_H = 8
const RAIL_FROM = -101
const RAIL = { d: 8, inner: 12.6 }
const ROD_R = 1.6
const ROD_RING = 14.4
const RODS = { back: [0, -ROD_RING], right: [ROD_RING, 0], left: [-14, -8] }
const YOKE = { x: -18, y: -17.5, w: 36, d: 35, r: 5 }
const YOKE_H = M.YOKE_H
const HOLE_R = TR + 0.6
const GEARBOX_W = 20
const MOTOR_OFFSET = 28
const MOTOR_R = 10
const PRESS_ARM_Z = 92
const PRESS_ARM_H = 10
const PRESS_BACK = M.LANE_Y + 32
const PRESS_ARM = { x: M.STATION - 10, y: -PRESS_BACK, w: 20, d: PRESS_BACK + M.LANE_Y + 14, r: 3 }
const COUNTER = { w: 16, d: 4, h: 12, gap: 9.5 }
const UPRIGHT = { x: M.STATION - 8, y: -PRESS_BACK, w: 16, d: 10, r: 2 }
const UPRIGHT_BASE = { x: M.STATION - 12, y: -PRESS_BACK - 4, w: 24, d: 14.5, r: 2 }
const LANE_TAG = { x: 40, w: 17, d: 10, z: 0.3, text: 8 }
const CAN_R = 8
const CAN_TOP = 116
const RAM_R = 3.2
const RAM_LENGTH = 66
const GEAR = { x: -M.GATE.half - 6, y: 11, r: 6 }
const GEAR_MOTOR_R = 4.6
const GEAR_MOTOR_TOP = 42
const RACK_STEP = 2
const README_DETAIL = 0.75
const GUIDE = { x: -16.8, w: 2.2, from: M.GATE.middle - 4, to: M.LANE_Y + 26, postR: 1.8 }

const P = k.fitProjection(
  [
    ...k.boxCorners(BED, 0, DECK),
    ...M.LANES.flatMap(lane => k.boxCorners(binPlan(lane), 0, 18)),
    ...M.LANES.map(lane => [M.STATION, lane.y, CAN_TOP + 2]),
    [0, 0, M.COLUMN_TOP + YOKE_H],
    [0, M.LANE_Y + M.GATE.reach, M.GATE_TOP],
    [0, -M.LANE_Y - M.GATE.reach, M.GATE_TOP]
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: AZIMUTH }
)

function binPlan (lane) {
  return { x: M.DECK_END, y: lane.y - 16, w: 34, d: 32, wall: 2, z: M.BIN_FLOOR - 2, top: 18 }
}

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

  const strip = { x: -24, y: 68, w: M.DECK_END - 2 + 24, d: 6, r: 1 }
  out.push(S(k.slabOf(strip, DECK, 0.6, P, 3), { tone: 'lo', crease: 'none' }))
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.01, DECK + 0.6, [2, 3.6], P)
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  out.push(D([at([strip.x + 2, strip.y + 3, DECK + 0.6]), at([strip.x + strip.w - 2, strip.y + 3, DECK + 0.6])], { size: 0.4 }))

  const plate = { x: -84, y: 66, w: 44, d: 12, r: 1.5 }
  out.push(S(k.slabOf(plate, DECK, 0.8, P, 4), { tone: 'mid', crease: 'none' }))
  out.push(L(k.planOutline(k.insetPlan(plate, 1.4), DECK + 0.8, P, 4), { tone: 'faint' }))
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 5, plate.y + 6.2], DECK + 0.8, P, 'x'), 'superlock', { size: 3.6, tone: 'mid' }))
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 8.6], [plate.x + 30, plate.y + 8.6], DECK + 0.8, P), { tone: 'lo', free: true }))
  out.push(L(k.lineOnTop([plate.x + 5, plate.y + 10.2], [plate.x + 22, plate.y + 10.2], DECK + 0.8, P), { tone: 'lo', free: true }))
  out.push(D([at([plate.x + plate.w - 3.4, plate.y + 3, DECK + 0.8]), at([plate.x + plate.w - 3.4, plate.y + plate.d - 3, DECK + 0.8])], { size: 0.45 }))
  M.LANES.forEach(lane => {
    const plan = { x: LANE_TAG.x, y: lane.y - LANE_TAG.d / 2, w: LANE_TAG.w, d: LANE_TAG.d, r: 1.2 }
    out.push(S(k.slabOf(plan, DECK, LANE_TAG.z, P, 3), { tone: 'mid', crease: 'none' }))
    out.push(k.faceTextSvg(k.topMatrix([plan.x + 3, plan.y + plan.d - 1.6], DECK + LANE_TAG.z, P, 'x'), `L${lane.id}`, { size: LANE_TAG.text, tone: 'mid' }))
  })
  return out.join('')
}

const gearboxOf = lane => ({ x: M.CRANK.cx - GEARBOX_W / 2, y: lane.y - 14, w: GEARBOX_W, d: 28, r: 2 })
const gearboxTop = lane => lane.armZ - 4
const motorOf = lane => [M.CRANK.cx, lane.y + lane.side * MOTOR_OFFSET]
const motorTop = lane => lane.armZ - 2

function motor (lane) {
  const out = []
  const [mx, my] = motorOf(lane)
  const top = motorTop(lane)
  const gearbox = gearboxOf(lane)
  out.push(S(k.cylinder(mx, my, MOTOR_R + 1.6, DECK, 1.6, P, 40), { tone: 'lo' }))
  out.push(S(k.cylinder(mx, my, MOTOR_R, DECK + 1.6, top - DECK - 1.6, P, 48, 0.6), {
    tone: 'mid',
    inner: L(k.knurl(mx, my, MOTOR_R, DECK + 4, top - 3, 44, P), { tone: 'lo' })
  }))
  out.push(L(k.sideArc(mx, my, MOTOR_R, DECK + 4, P, 32) + k.sideArc(mx, my, MOTOR_R, top - 3, P, 32), { tone: 'faint' }))
  out.push(L(k.ring(mx, my, MOTOR_R - 3, top, P, 40), { tone: 'lo' }))
  out.push(D([0, 1, 2, 3].map(index => {
    const angle = Math.PI / 4 + index * Math.PI / 2
    return at([mx + Math.cos(angle) * (MOTOR_R - 1.5), my + Math.sin(angle) * (MOTOR_R - 1.5), top])
  }), { size: 0.45 }))
  const box = { x: mx - MOTOR_R - 5, y: my - 4, w: 5.4, d: 8, r: 0.8 }
  out.push(S(k.slabOf(box, DECK + 6, 6, P, 3, 0.4), { tone: 'mid' }))
  out.push(D([at([box.x + 2.7, box.y + 2, DECK + 12]), at([box.x + 2.7, box.y + 6, DECK + 12])], { size: 0.4 }))
  const near = lane.side < 0 ? my + MOTOR_R - 0.6 : gearbox.y + gearbox.d
  const far = lane.side < 0 ? gearbox.y : my - MOTOR_R + 0.6
  const link = S(k.slabOf({ x: mx - 6.5, y: near, w: 13, d: far - near, r: 0.6 }, DECK + 2, 6, P, 3), { tone: 'mid' })
  return lane.side < 0 ? out.join('') + link : link + out.join('')
}

function gearbox (lane) {
  const plan = gearboxOf(lane)
  const top = gearboxTop(lane)
  const seam = k.sideSeam(plan, DECK + 5, P, 4)
  return [
    S(k.slabOf(plan, DECK, top - DECK, P, 4, 0.6), { tone: 'mid', inner: L(seam, { tone: 'faint' }) }),
    k.corners(plan, 3.2).map(point => D([at([point[0], point[1], top])], { size: 0.45 })).join(''),
    S(k.cylinder(M.CRANK.cx, lane.y, 9, top, lane.armZ - top, P, 40, 0.5), { tone: 'mid' })
  ].join('')
}

const railPlan = (lane, outer, from, to) => {
  const outward = outer ? lane.side : -lane.side
  const y = outward < 0 ? lane.y - RAIL.inner - RAIL.d : lane.y + RAIL.inner
  return { x: from, y, w: to - from, d: RAIL.d, r: 1 }
}

function railSlab (plan, xs) {
  const cy = plan.y + plan.d / 2
  return S(k.slabOf(plan, DECK, TH, P, 3, 0.4), { tone: 'mid' }) +
    D(xs.map(x => at([x, cy, DECK + TH])), { size: 0.45 })
}

const outerRail = lane => railSlab(railPlan(lane, true, RAIL_FROM, M.DECK_END), [RAIL_FROM + 6, -60, -30, 0, 30, M.DECK_END - 6])
const innerLeft = lane => railSlab(railPlan(lane, false, RAIL_FROM, M.PAD.x - 1), [RAIL_FROM + 6, -60, M.PAD.x - 7])
const innerRight = lane => railSlab(railPlan(lane, false, M.PAD.x + M.PAD.w + 1, M.DECK_END), [M.PAD.x + M.PAD.w + 7, M.DECK_END - 6])

function blade (lane) {
  const tail = M.TIP_HOME - M.BLADE.length
  const post = M.TIP_HOME - M.BLADE.post
  const plan = { x: tail, y: lane.y - 11.6, w: M.BLADE.length, d: 23.2, r: 0.8 }
  const out = [S(k.slabOf(plan, DECK, TH, P, 3, 0.4), { tone: 'hi', crease: 'lo' })]
  out.push(L(k.lineOnTop([M.TIP_HOME - 5, lane.y - 11.6], [M.TIP_HOME - 5, lane.y + 11.6], M.BLADE_TOP, P), { tone: 'faint' }))
  out.push(D([-60, -40, -20].map(dx => at([M.TIP_HOME + dx, lane.y - lane.side * 7, M.BLADE_TOP])), { size: 0.4 }))
  out.push(S(k.slabOf({ x: post - 4, y: lane.y - 4, w: 8, d: 8, r: 1.2 }, M.BLADE_TOP, 2, P, 3, 0.4), { tone: 'mid' }))
  out.push(S(k.cylinder(post, lane.y, M.BLADE.postR, M.BLADE_TOP + 2, M.rodZ(lane) - M.BLADE_TOP - 2, P, 18), { tone: 'mid', crease: 'none' }))
  return out.join('')
}

function pinHead (lane) {
  const z = M.rodZ(lane) + M.ROD_H
  return S(k.cylinder(0, 0, 2.6, z, 1.4, P, 18), { tone: 'mid' }) + D([at([0, 0, z + 1.4])], { size: 0.4 })
}

function pad () {
  const top = M.GATE_Z
  const out = [S(k.slabOf(M.PAD, DECK, top - DECK, P, 4, 0.5), { tone: 'mid', inner: L(k.sideSeam(M.PAD, DECK + 2, P, 4), { tone: 'faint' }) })]
  out.push(D(k.corners(M.PAD, 3).map(([x, y]) => at([x, y, top])), { size: 0.45 }))
  return out.join('')
}

function gearDrive () {
  const { x, y, r } = GEAR
  const out = []
  out.push(S(k.cylinder(x, y, r, M.GATE_Z, M.GATE_H, P, 40, 0.3), { tone: 'mid', inner: L(k.knurl(x, y, r, M.GATE_Z, M.GATE_TOP, 40, P, 0.3), { tone: 'lo' }) }))
  out.push(S(k.cylinder(x, y, GEAR_MOTOR_R, M.GATE_TOP, GEAR_MOTOR_TOP - M.GATE_TOP, P, 36, 0.4), {
    tone: 'mid',
    inner: L(k.sideArc(x, y, GEAR_MOTOR_R, M.GATE_TOP + 2.5, P, 24) + k.sideArc(x, y, GEAR_MOTOR_R, GEAR_MOTOR_TOP - 2.5, P, 24), { tone: 'faint' })
  }))
  out.push(L(k.ring(x, y, GEAR_MOTOR_R - 1.8, GEAR_MOTOR_TOP, P, 28), { tone: 'lo' }))
  out.push(D([at([x, y, GEAR_MOTOR_TOP])], { size: 0.45 }))
  return out.join('')
}

const ESC_BLOCK = { x: -37, y: -16, w: 24, d: 48, r: 3 }
const ESC_ARM = { x: -13.4, w: 29.4, inner: 12.8, outer: 16 }
const ESC_RIGHT = { x: 12.8, y: -12.8, w: 3.2, d: 18.8, r: 0.8 }
const ESC_POSTS = [[-29, -12], [-29, 12]]
const ESC_ARM_TOP = M.ESC_TOP - 1.5
const PAWL = { xs: [[-8, -4], [4, 8]], inner: M.TOKEN.r - 2.6, depth: 4.2, side: 4 }
const armPlan = side => ({ x: ESC_ARM.x, y: side < 0 ? -ESC_ARM.outer : ESC_ARM.inner, w: ESC_ARM.w, d: ESC_ARM.outer - ESC_ARM.inner, r: 0.8 })

function escapementPosts () {
  return byDepth(ESC_POSTS).map(([x, y]) =>
    S(k.cylinder(x, y, 3.2, M.GATE_Z, 1.4, P, 20), { tone: 'mid' }) +
    S(k.cylinder(x, y, 2.2, M.GATE_Z + 1.4, M.ESC.z - M.GATE_Z - 1.4, P, 20), { tone: 'mid', crease: 'none' })
  ).join('')
}

function escapementArm (side) {
  const plan = armPlan(side)
  return S(k.slabOf(plan, M.ESC.z, ESC_ARM_TOP - M.ESC.z, P, 2, 0.3), { tone: 'mid' }) +
    D([ESC_ARM.x + 2, ESC_ARM.x + ESC_ARM.w - 2].map(x => at([x, plan.y + plan.d / 2, ESC_ARM_TOP])), { size: 0.4 })
}

function escapementRight () {
  return S(k.slabOf(ESC_RIGHT, M.ESC.z, ESC_ARM_TOP - M.ESC.z, P, 2, 0.3), { tone: 'mid' }) +
    D([at([ESC_RIGHT.x + ESC_RIGHT.w / 2, ESC_RIGHT.y + ESC_RIGHT.d - 2, ESC_ARM_TOP])], { size: 0.4 })
}

function sidePawl (side) {
  const x = side < 0 ? -PAWL.inner - PAWL.depth : PAWL.inner
  return S(k.slabOf({ x, y: -PAWL.side / 2, w: PAWL.depth, d: PAWL.side, r: 0.5 }, ESC_ARM_TOP, M.ESC_TOP - ESC_ARM_TOP, P, 2, 0.2), { tone: 'hi', crease: 'lo' })
}

function pawls (side) {
  const y = side < 0 ? -PAWL.inner - PAWL.depth : PAWL.inner
  return PAWL.xs.map(([x0, x1]) => S(k.slabOf({ x: x0, y, w: x1 - x0, d: PAWL.depth, r: 0.5 }, ESC_ARM_TOP, M.ESC_TOP - ESC_ARM_TOP, P, 2, 0.2), { tone: 'hi', crease: 'lo' })).join('')
}

function escapementBack () {
  const top = M.ESC_TOP
  return [
    S(k.slabOf(ESC_BLOCK, M.ESC.z, top - M.ESC.z, P, 4, 0.5), { tone: 'mid', inner: L(k.sideSeam(ESC_BLOCK, M.ESC.z + 1.2, P, 4), { tone: 'faint' }) }),
    D(ESC_POSTS.map(([x, y]) => at([x, y, top])), { size: 0.5 }),
    escapementArm(-1)
  ].join('')
}

const standingRod = at => S(k.cylinder(at[0], at[1], 2.6, ESC_ARM_TOP, 2.4, P, 20), { tone: 'mid' }) + rodOf(at, ESC_ARM_TOP + 2.4, M.COLUMN_TOP)

function columnBack () {
  return standingRod(RODS.back) + standingRod(RODS.left)
}

function columnFront () {
  return standingRod(RODS.right)
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

const { half, bar, reach, middle } = M.GATE
const TINE_X = -half + bar
const TINE_W = half - M.GATE.lip - TINE_X
const tine = (y0, y1) => ({ x: TINE_X, y: y0, w: TINE_W, d: y1 - y0, r: 0.8 })
const WALL_TOP = M.GATE_Z + M.GATE.wallH
const gateSlab = (plan, height = M.GATE.wallH) => S(k.slabOf(plan, M.GATE_Z, height, P, 3, 0.4), { tone: 'mid', className: 'ml-shuttle' })

function gateBack () {
  const outerY = M.LANE_Y + M.GATE.notch
  const barPlan = { x: -half, y: -reach, w: bar, d: reach * 2, r: 0.6 }
  const rackTop = WALL_TOP + 1
  const rack = []
  for (let y = barPlan.y + 2; y <= barPlan.y + barPlan.d - 2; y += RACK_STEP) rack.push(k.lineOnTop([-half, y], [-half + bar, y], rackTop, P))
  return S(k.slabOf(barPlan, M.GATE_Z, M.GATE.wallH + 1, P, 2, 0.2), { tone: 'mid', className: 'ml-shuttle' }) +
    L(rack.join(''), { tone: 'faint' }) +
    gateSlab(tine(-reach, -outerY))
}

function gateMid () {
  const inner = middle - M.GATE.wall
  const front = gateSlab(tine(-middle, -inner), M.GATE_H) + D([at([TINE_X + 2.4, -(middle + inner) / 2, M.GATE_TOP])], { size: 0.4 })
  const back = gateSlab(tine(inner, middle)) + D([at([TINE_X + 2.4, (middle + inner) / 2, WALL_TOP])], { size: 0.4 })
  return front + back
}

function gateFront () {
  const lip = { x: half - M.GATE.lip, y: -reach, w: M.GATE.lip, d: reach * 2, r: 0.6 }
  return gateSlab(tine(M.LANE_Y + M.GATE.notch, reach), M.GATE_H) +
    S(k.slabOf(lip, M.GATE_Z, M.GATE.lipH, P, 2, 0.2), { tone: 'mid', className: 'ml-shuttle' })
}

function guide (lane) {
  const near = lane.side * GUIDE.from
  const far = lane.side * GUIDE.to
  const plan = { x: GUIDE.x, y: Math.min(near, far), w: GUIDE.w, d: GUIDE.to - GUIDE.from, r: 0.6 }
  const top = M.GATE_TOP + 1
  const postY = far - lane.side * 3
  const cx = GUIDE.x + GUIDE.w / 2
  const stop = { x: GUIDE.x - 0.6, y: far - (lane.side > 0 ? 4 : 0), w: GUIDE.w + 1.2, d: 4, r: 0.6 }
  return [
    S(k.cylinder(cx, postY, GUIDE.postR + 1, DECK, 1.2, P, 18), { tone: 'lo' }),
    S(k.cylinder(cx, postY, GUIDE.postR, DECK + 1.2, M.GATE_Z - DECK - 1.2, P, 18), { tone: 'mid', crease: 'none' }),
    S(k.slabOf(plan, M.GATE_Z, top - M.GATE_Z, P, 2, 0.3), { tone: 'mid' }),
    D([GUIDE.from + 4, (GUIDE.from + GUIDE.to) / 2].map(y => at([cx, lane.side * y, top])), { size: 0.4 }),
    S(k.slabOf(stop, top, 2, P, 2, 0.3), { tone: 'mid' })
  ].join('')
}

function upright () {
  return [
    S(k.slabOf(UPRIGHT_BASE, DECK, 3, P, 4, 0.5), { tone: 'mid' }),
    k.corners(UPRIGHT_BASE, 2.6).map(point => D([at([point[0], point[1], DECK + 3])], { size: 0.45 })).join(''),
    S(k.slabOf(UPRIGHT, DECK + 3, PRESS_ARM_Z - DECK - 3, P, 4, 0.6), {
      tone: 'mid',
      inner: L(k.sideSeam(UPRIGHT, DECK + 12, P, 4), { tone: 'faint' })
    })
  ].join('')
}

function can (lane) {
  const [x, y] = [M.STATION, lane.y]
  const top = PRESS_ARM_Z + PRESS_ARM_H
  return [
    S(k.cylinder(x, y, CAN_R + 1, top, 1.4, P, 40), { tone: 'mid' }),
    S(k.cylinder(x, y, CAN_R, top + 1.4, CAN_TOP - top - 1.4, P, 44, 0.5), {
      tone: 'mid',
      inner: L(k.knurl(x, y, CAN_R, top + 4, CAN_TOP - 3, 36, P), { tone: 'lo' })
    }),
    L(k.sideArc(x, y, CAN_R, top + 4, P, 28) + k.sideArc(x, y, CAN_R, CAN_TOP - 3, P, 28), { tone: 'faint' }),
    L(k.ring(x, y, CAN_R - 2.4, CAN_TOP, P, 36), { tone: 'lo' }),
    D([at([x, y, CAN_TOP])], { size: 0.5 })
  ].join('')
}

function counterBlock (lane, counter) {
  const plan = { x: M.STATION - 3, y: lane.y + COUNTER.gap, w: COUNTER.w, d: COUNTER.d, r: 1 }
  const z = PRESS_ARM_Z + PRESS_ARM_H
  const face = k.sideMatrix([plan.x, plan.y + plan.d], z + COUNTER.h, P, 'left')
  return S(k.slabOf(plan, z, COUNTER.h, P, 3, 0.4), { tone: 'mid' }) +
    `<g transform="${face}"><rect class="ml-window" x="1.4" y="1.4" width="13.2" height="9.2" rx="1"/>${counter}</g>`
}

function pressTop (counters) {
  const top = PRESS_ARM_Z + PRESS_ARM_H
  const out = []
  out.push(S(k.slabOf(PRESS_ARM, PRESS_ARM_Z, PRESS_ARM_H, P, 4, 0.8), {
    tone: 'mid',
    inner: L(k.sideSeam(PRESS_ARM, PRESS_ARM_Z + 2, P, 4), { tone: 'faint' })
  }))
  const rim = 3
  const left = PRESS_ARM.x + rim
  const right = PRESS_ARM.x + PRESS_ARM.w - rim
  out.push(D([[left, PRESS_ARM.y + rim], [right, PRESS_ARM.y + rim], [left, 0], [right, 0], [left, PRESS_ARM.y + PRESS_ARM.d - rim], [right, PRESS_ARM.y + PRESS_ARM.d - rim]].map(([px, py]) => at([px, py, top])), { size: 0.45 }))
  M.LANES.forEach(lane => out.push(can(lane), counterBlock(lane, counters[lane.id - 1])))
  return out.join('')
}

function die (lane) {
  const { r, h } = M.DIE
  const [x, y] = [M.STATION, lane.y]
  return S(k.cylinder(x, y, RAM_R, h + 1.6, RAM_LENGTH, P, 20), { tone: 'mid', crease: 'none' }) +
    S(k.cylinder(x, y, r, 0, h, P, 40, 0.5), { tone: 'mid', inner: L(k.sideArc(x, y, r, 1.2, P, 28), { tone: 'faint' }) }) +
    S(k.cylinder(x, y, 4.6, h, 1.6, P, 24), { tone: 'mid' })
}

const binWall = (bin, x, y, w, d) => S(k.slabOf({ x, y, w, d, r: 0.6 }, bin.z, bin.top - bin.z, P, 2, 0.3), { tone: 'mid' })
function binBack (lane) {
  const bin = binPlan(lane)
  const out = []
  for (const [x, y] of byDepth([[bin.x + bin.w - 6, bin.y + 6], [bin.x + bin.w - 6, bin.y + bin.d - 6]])) {
    out.push(S(k.cylinder(x, y, 2.6, 0, bin.z, P, 18), { tone: 'mid' }))
  }
  out.push(S(k.slabOf({ x: bin.x, y: bin.y, w: bin.w, d: bin.d, r: 1 }, bin.z, 2, P, 3), { tone: 'lo' }))
  out.push(binWall(bin, bin.x, bin.y, bin.wall, bin.d))
  out.push(binWall(bin, bin.x, bin.y, bin.w, bin.wall))
  return out.join('')
}

function binFront (lane) {
  const bin = binPlan(lane)
  return [
    binWall(bin, bin.x, bin.y + bin.d - bin.wall, bin.w, bin.wall),
    binWall(bin, bin.x + bin.w - bin.wall, bin.y, bin.wall, bin.d),
    D([at([bin.x + bin.w - 1, bin.y + 6, bin.top]), at([bin.x + bin.w - 1, bin.y + bin.d - 6, bin.top])], { size: 0.4 })
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

const [BACK, FRONT] = M.LANES
const LABEL = 'A twin-lane coin feed on a bed. Tokens, one per call to lock(), stack in one column on pawls: the single queue. When a token is granted the pawls open and it drops into a sliding shuttle below, which carries it sideways to whichever of two lanes is free. Each lane has its own crank-driven pusher blade and its own press, so the two holders work and release independently.'
const CAPTION = 'Every token is a call to lock(); the figure runs superlock\'s own createLock(2), so at most two tokens are lit. A new token drops in at the top and calls lock() at once; if a slot is free it lights straight away. A lit token leaves the column bottom first: the pawls open, it drops into the shuttle, and the shuttle carries it to whichever lane is free, not to a lane of its own. Each token needs one to four press strokes, so the lanes finish at different times. release() fires at the end of the eject, as the blade throws the finished token off the deck, and the oldest waiting token is granted next: first in, first out. Abort a waiting token\'s signal and it slides out of the column; the stack closes up. Aborting a holder does nothing.'

const movingLayer = (moving, name) => layer(name, moving[name], ` data-part="${name}"`)
const laneDrive = (moving, id) => ['crank', 'rod', 'pin-crank', 'pin-post'].map(name => movingLayer(moving, `${name}-${id}`))

const bodyOf = moving => [
  layer('base', base()),
  layer('motor-1', motor(BACK)),
  layer('gearbox-1', gearbox(BACK)),
  layer('upright', upright()),
  layer('rail-1-out', outerRail(BACK)),
  movingLayer(moving, 'blade-1'),
  layer('bin-1-back', binBack(BACK)),
  layer('tokens-1', moving['tokens-1']),
  layer('rails-in-left', innerLeft(BACK) + innerLeft(FRONT)),
  layer('guide-1', guide(BACK)),
  ...laneDrive(moving, 1),
  movingLayer(moving, 'die-1'),
  layer('bin-1', moving['bin-1']),
  layer('bin-1-front', binFront(BACK)),
  layer('pad', pad()),
  layer('esc-posts', escapementPosts()),
  layer('gear', gearDrive()),
  layer('rails-in-right', innerRight(BACK) + innerRight(FRONT)),
  layer('gearbox-2', gearbox(FRONT)),
  movingLayer(moving, 'blade-2'),
  layer('bin-2-back', binBack(FRONT)),
  layer('tokens-2', moving['tokens-2']),
  layer('rail-2-out', outerRail(FRONT)),
  layer('guide-2', guide(FRONT)),
  layer('motor-2', motor(FRONT)),
  ...laneDrive(moving, 2),
  movingLayer(moving, 'gate-back'),
  layer('notch-1', moving['notch-1']),
  movingLayer(moving, 'gate-mid'),
  layer('notch-2', moving['notch-2']),
  movingLayer(moving, 'gate-front'),
  layer('esc-back', escapementBack()),
  movingLayer(moving, 'pawls-back'),
  movingLayer(moving, 'pawl-left'),
  layer('column-back', columnBack()),
  layer('drop', moving.drop),
  layer('esc-front', escapementRight()),
  movingLayer(moving, 'pawl-right'),
  layer('column', moving.column),
  layer('column-front', columnFront()),
  layer('aborting', moving.aborting),
  layer('yoke', yoke()),
  layer('arrival', moving.arrival),
  movingLayer(moving, 'die-2'),
  layer('press-top', pressTop([moving['counter-1'], moving['counter-2']])),
  layer('bin-2', moving['bin-2']),
  layer('bin-2-front', binFront(FRONT))
]

const CSS = `
.ml-stage{position:relative;outline:none;cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.ml-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ml-void{fill:var(--anatomy-shade-0);stroke:none}
.ml-window{fill:var(--anatomy-shade-0);stroke:var(--anatomy-lo);stroke-width:var(--anatomy-weight);vector-effect:non-scaling-stroke}
.ml-counter{font:600 7.4px var(--anatomy-mono);fill:var(--anatomy-hi);letter-spacing:.3px}
.iso{--ml-shuttle:#9a9a9a}
.iso[data-theme="light"]{--ml-shuttle:#3c3c40}
.ml-shuttle>.iso-edge{stroke:var(--ml-shuttle)}
.ml-lane{font:700 8px var(--anatomy-mono);fill:var(--anatomy-mid);letter-spacing:.2px}
[data-layer] g[data-token]{pointer-events:none}
.iso{--ml-hold-top:#8c8c8c;--ml-hold-side:#6a6a6a}
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
.iso-plate-corner[data-corner="readout"]{font-size:9.6px}
@media (max-width:560px){.iso-plate-corner[data-corner="hint"]{right:0;white-space:normal;line-height:1.5;text-wrap:balance}}
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
  `mount({ data: ${JSON.stringify(DATA)}, kit, machine, sim: createSim({ machine, createLock, calm: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches }), drawing: createDrawing({ kit, machine, P: ${JSON.stringify(P)} }) })`
].join('\n')

const counterText = id => `<text class="ml-counter" data-part="counter-${id}" x="8" y="8.8" text-anchor="middle">000</text>`
const staticParts = Object.assign({
  'gate-back': gateBack(),
  'gate-mid': gateMid(),
  'gate-front': gateFront(),
  'pawls-back': pawls(-1),
  'pawl-left': sidePawl(-1),
  'pawl-right': sidePawl(1),
  'counter-1': counterText(1),
  'counter-2': counterText(2)
}, ...M.LANES.map(lane => ({
  [`blade-${lane.id}`]: blade(lane),
  [`crank-${lane.id}`]: '',
  [`rod-${lane.id}`]: '',
  [`pin-crank-${lane.id}`]: pinHead(lane),
  [`pin-post-${lane.id}`]: pinHead(lane),
  [`die-${lane.id}`]: die(lane)
})))

const svg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: bodyOf(staticParts).join('') })

const plate = k.plateHtml({
  fig: 'Fig 2',
  title: 'superlock · semaphore',
  hint: 'Click to call lock() · click a waiting token to abort',
  readout: '2 free · 0 awaiting',
  keys: [
    { mark: 'lit', label: 'Lit: holding a slot from the moment lock() resolves, never more than two' },
    { mark: 'raised', label: 'Unlit in the column: callers still waiting, in arrival order, lock.awaiting()' }
  ],
  caption: CAPTION,
  body: `<div class="ml-stage" tabindex="0" role="group" aria-roledescription="interactive figure" aria-label="Semaphore with two slots as a twin-lane coin feed. Enter or Space calls lock(). Backspace aborts the newest waiting token.">${svg}<div class="ml-live" aria-live="polite" data-live></div></div>`
})

const write = (name, text) => {
  writeFileSync(join(OUT, name), text)
  console.log('wrote', name, `${(text.length / 1024).toFixed(0)} KB`)
}

const frames = await recordLoop({ createSim, machine: M, createLock: require(join(ROOT, 'src', 'create.js')) })
const drawing = createDrawing({ kit: k, machine: M, P, detail: README_DETAIL })
const parts = {
  token: token(),
  gate: { 'gate-back': gateBack(), 'gate-mid': gateMid(), 'gate-front': gateFront() },
  pawls: { 'pawls-back': pawls(-1), 'pawl-left': sidePawl(-1), 'pawl-right': sidePawl(1) },
  blade: M.LANES.map(blade),
  pinHead: M.LANES.map(pinHead),
  die: M.LANES.map(die)
}
for (const theme of ['dark', 'light']) {
  const suffix = theme === 'light' ? '-light' : ''
  write(`semaphore${suffix}.html`, k.pageHtml({ title: 'superlock semaphore', theme, body: plate, script, width: 720 }).replace('</style>', `${CSS}${PAGE_CSS}</style>`))
  write(`semaphore${suffix}.svg`, animatedSvg({ k, M, P, theme, frames, drawing, bodyOf, parts, css: CSS, label: LABEL, width: WIDTH, height: HEIGHT }))
}
