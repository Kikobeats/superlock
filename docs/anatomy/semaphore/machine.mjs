export const SLOTS = 2
export const TOKEN = { r: 12, h: 4 }
export const DECK = 20
export const BLADE_TOP = DECK + TOKEN.h
export const GATE_Z = BLADE_TOP + 1.5
export const GATE_H = TOKEN.h
export const GATE_TOP = GATE_Z + GATE_H
export const ESC = { z: 50, h: 3, pawl: 2.4 }
export const PAWL_PARTS = [['pawls-back', [0, -1]], ['pawl-left', [-1, 0]], ['pawl-right', [1, 0]]]
export const ESC_TOP = ESC.z + ESC.h
export const REJECT = [-17, 17]
export const COLUMN_SLOTS = 11
export const SPAWN = ESC_TOP + TOKEN.h * COLUMN_SLOTS
export const COLUMN_TOP = SPAWN + TOKEN.h
export const YOKE_H = 3
export const ARRIVE_Z = COLUMN_TOP + YOKE_H + 6

export const LANE_Y = 40
export const LANES = [
  { id: 1, y: -LANE_Y, side: -1, armZ: 34 },
  { id: 2, y: LANE_Y, side: 1, armZ: 44 }
]
export const ARM_H = 3
export const ROD_H = 3
export const rodZ = lane => lane.armZ + ARM_H

export const CRANK = { cx: -113, r: 48, rod: 60 }
export const BLADE = { length: 90, post: 88, postR: 2.2 }
export const STATION = 79
export const DECK_END = 91
export const BIN_X = 108

export const DIE = { r: 9, h: 3, rest: 44 }
export const GLAND_Z = 72

export const GATE = { half: 14.2, bar: 1.6, notch: TOKEN.r + 0.6, wall: 3.2, wallH: 6, lip: 1.8, lipH: 2.2 }
GATE.reach = LANE_Y + GATE.notch + GATE.wall
GATE.middle = LANE_Y - GATE.notch
export const PAD = { x: -34, y: -GATE.middle, w: 55, d: GATE.middle * 2, r: 2 }

export const HITS = [1, 4, 4, 1, 2, 4, 3]
export const hitsOf = id => HITS[(id - 1) % HITS.length]

export const TIMING = { push: 0.85, stamp: 0.9, eject: 0.45, retract: 0.85, slide: 0.2, abort: 1, gate: 0.38, drain: 0.5 }
export const GRAVITY = 520

export const postX = theta => CRANK.cx - CRANK.r * Math.cos(theta) + Math.sqrt(CRANK.rod ** 2 - (CRANK.r * Math.sin(theta)) ** 2)

export const tipX = theta => postX(theta) + BLADE.post

export const pinOf = (lane, theta) => [CRANK.cx - CRANK.r * Math.cos(theta), lane.y + lane.side * CRANK.r * Math.sin(theta)]

export const thetaForTip = tip => {
  let low = 0
  let high = Math.PI
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2
    if (tipX(middle) < tip) low = middle
    else high = middle
  }
  return (low + high) / 2
}

export const TIP_HOME = tipX(0)
export const TIP_OUT = tipX(Math.PI)
export const THETA_STATION = thetaForTip(STATION - TOKEN.r)

export const slotZ = index => ESC_TOP + TOKEN.h * index

export const crankEase = progress => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, progress)))) / 2

export const BIN_FLOOR = 6
