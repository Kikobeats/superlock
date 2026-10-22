export const TOKEN = { r: 12, h: 4 }
export const DECK = 20
export const BLADE_TOP = DECK + TOKEN.h
export const SPAWN = 66
export const COLUMN_TOP = 70

export const CRANK = { cx: -114.5, r: 41.5, rod: 55 }
export const BLADE = { length: 90, post: 88, postR: 2.2 }
export const STATION = 52
export const DECK_END = 78
export const BIN_X = 95

export const ARM_Z = 34
export const ARM_H = 3
export const ROD_Z = ARM_Z + ARM_H
export const ROD_H = 3

export const DIE = { r: 9, h: 3, rest: 44 }
export const GLAND_Z = 72

export const TIMING = { push: 0.85, stamp: 0.9, eject: 0.45, retract: 0.85, slide: 0.2, abort: 0.7 }
export const GRAVITY = 520

export const postX = theta => CRANK.cx - CRANK.r * Math.cos(theta) + Math.sqrt(CRANK.rod ** 2 - (CRANK.r * Math.sin(theta)) ** 2)

export const tipX = theta => postX(theta) + BLADE.post

export const pinOf = theta => [CRANK.cx - CRANK.r * Math.cos(theta), -CRANK.r * Math.sin(theta)]

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

export const slotZ = index => BLADE_TOP + TOKEN.h * index

export const MAX_WAITING = Math.floor((SPAWN - BLADE_TOP) / TOKEN.h) - 1

export const crankEase = progress => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, progress)))) / 2

export const BIN_FLOOR = 6
