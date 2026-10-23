export const TIMING = { bolt: 0.2, light: 0.2, hold: 0.35, rise: 0.3, flag: 0.3, shackle: 0.35, travel: 0.27, speed: 250, rest: 0.3, nudge: 0.45 }
export const DEMO = [
  [0.3, 'call', 'k'],
  [0.55, 'call', 's'],
  [0.8, 'call', 'u'],
  [1.05, 'call', 'e'],
  [2.4, 'abort', 'e'],
  [8, 'call', 'u'],
  [8.25, 'call', 'k'],
  [8.5, 'call', 's']
]
export const DIP = 1.4
export const RISE = 4.2
export const FLAG_LIFT = 4.4
export const rankLabel = rank => (rank < 0 ? '' : String(rank + 1).padStart(2, '0'))
export const SHACKLE_LIFT = 5.2
export const BOLT_STROKE = 8

export function poseOf (frame, stations) {
  const carriage = [frame.x - stations[0], 0, 0]
  const moves = {
    carriage,
    'bolt-carriage': carriage,
    bolt: [0, (1 - frame.bolt) * BOLT_STROKE, 0],
    shackle: [0, 0, (1 - frame.shackle) * SHACKLE_LIFT]
  }
  const fades = { 'shackle-shut': frame.shackle }
  const labels = {}
  frame.level.forEach((value, index) => {
    const shake = frame.nudge[index]
    moves[`dip-${index}`] = [Math.sin(shake * Math.PI * 6) * shake * 1.2, 0, frame.rise[index] * RISE - frame.dip[index] * DIP]
    moves[`pin-${index}`] = moves[`dip-${index}`]
    moves[`flag-${index}`] = [0, 0, frame.flag[index] * FLAG_LIFT]
    moves[`mast-${index}`] = moves[`flag-${index}`]
    fades[`lit-${index}`] = value
    labels[`rank-${index}`] = rankLabel(frame.rank[index])
  })
  return { moves, fades, labels }
}
