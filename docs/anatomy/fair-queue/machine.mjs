export const AZIMUTH = 58
export const TOKEN = { r: 12, h: 4 }
export const DECK = 20
export const SPAWN = 48
export const COLUMN_TOP = 62

export const KEYS = ['A', 'B', 'C']
export const STATION = { A: AZIMUTH + 112, B: AZIMUTH - 180, C: AZIMUTH - 112 }
export const PRESS_ANGLE = AZIMUTH - 63.5
export const HOME_ANGLE = PRESS_ANGLE

export const R_PAD = 38
export const R_COL = 68
export const R_DIAL = R_PAD + TOKEN.r + 4
export const BED = { half: 118, back: 124, front: 64 }

export const BLADE = { length: 38, width: 18, rest: R_COL + TOKEN.r, out: R_PAD + TOKEN.r }
export const DROP = { floor: DECK - 14, hole: TOKEN.r + 0.8 }
export const KICK = { home: R_PAD - TOKEN.r, length: 34, width: 10 }
export const DIE = { r: 6, h: 3, rest: 44 }
export const GLAND_Z = 72
export const HUB = { r: 10, top: DECK + 13 }
export const GUIDE = { from: 11, to: 23, width: 15, height: TOKEN.h + 3 }

export const TIMING = { indexBase: 0.25, indexPerTurn: 1.1, push: 0.45, bladeBack: 0.4, stamp: 0.6, drop: 0.5, retract: 0.3, abort: 1 }
export const GRAVITY = 520

const RADIANS = Math.PI / 180
export const unitOf = degrees => [Math.cos(degrees * RADIANS), Math.sin(degrees * RADIANS)]
export const along = (degrees, distance) => {
  const [ux, uy] = unitOf(degrees)
  return [ux * distance, uy * distance]
}
export const sideOf = degrees => {
  const [ux, uy] = unitOf(degrees)
  return [-uy, ux]
}

export const VIEW = unitOf(AZIMUTH)
const facingViewer = ([x, y]) => x * VIEW[0] + y * VIEW[1]
export const ABORT_SIDE = Object.fromEntries(KEYS.map(key => {
  const [tx, ty] = sideOf(STATION[key])
  return [key, facingViewer([tx, ty]) >= 0 ? [tx, ty] : [-tx, -ty]]
}))

export const columnPoint = key => along(STATION[key], R_COL)
export const padPoint = theta => along(theta, R_PAD)
export const armFacesViewer = theta => facingViewer(unitOf(theta)) > 0

export const indexSeconds = (from, to) => TIMING.indexBase + (Math.abs(to - from) / 360) * TIMING.indexPerTurn

export const MAX_WAITING = Math.floor((SPAWN - DECK) / TOKEN.h) - 1

export const smoothEase = progress => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, progress)))) / 2
