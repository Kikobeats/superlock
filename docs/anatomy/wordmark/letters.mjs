export const STROKE = 4.4
export const X_HEIGHT = 24
export const ASCENDER = 31.5
export const DESCENDER = 5.6
export const ROUND = X_HEIGHT / 2

const DEG = Math.PI / 180
const ARC_STEPS = 48

export const arcPoints = ([cx, cz], radius, from, to, scaleX = 1) => {
  const count = Math.max(2, Math.ceil((Math.abs(to - from) / 360) * ARC_STEPS))
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = (from + ((to - from) * index) / count) * DEG
    return [cx + Math.cos(angle) * radius * scaleX, cz + Math.sin(angle) * radius]
  })
}

const dedupe = points => points.filter((point, index) => {
  const previous = points[(index + points.length - 1) % points.length]
  return Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 1e-6
})

export function strokeOf (centerline, width = STROKE) {
  const line = dedupe(centerline)
  const normals = line.map((point, index) => {
    const previous = line[Math.max(0, index - 1)]
    const next = line[Math.min(line.length - 1, index + 1)]
    const dx = next[0] - previous[0]
    const dz = next[1] - previous[1]
    const length = Math.hypot(dx, dz) || 1
    return [-dz / length, dx / length]
  })
  const half = width / 2
  const left = line.map(([x, z], index) => [x + normals[index][0] * half, z + normals[index][1] * half])
  const right = line.map(([x, z], index) => [x - normals[index][0] * half, z - normals[index][1] * half])
  return [...right, ...left.reverse()]
}

const signedArea = ring => ring.reduce((sum, [ax, az], index) => {
  const [bx, bz] = ring[(index + 1) % ring.length]
  return sum + ax * bz - bx * az
}, 0) / 2

const counterClockwise = ring => (signedArea(ring) < 0 ? [...ring].reverse() : ring)
const clockwise = ring => (signedArea(ring) > 0 ? [...ring].reverse() : ring)

const W = STROKE
const R = ROUND
const INNER = R - W

function letterS () {
  const radius = (X_HEIGHT + W) / 4
  const spine = radius - W / 2
  const stretch = 1.16
  const cx = radius * stretch
  const upper = arcPoints([cx, X_HEIGHT - radius], spine, 28, 270, stretch)
  const lower = arcPoints([cx, radius], spine, 90, -152, stretch)
  return { width: cx * 2, rings: [counterClockwise(strokeOf([...upper, ...lower.slice(1)]))], posts: [cx] }
}

function letterU () {
  const meet = Math.sqrt(R * R - (R - W) ** 2)
  const from = 180
  const to = Math.atan2(R - meet - R, R - W) / DEG + 360
  const outer = [
    [0, X_HEIGHT], [0, R],
    ...arcPoints([R, R], R, from, to).slice(1, -1),
    [2 * R - W, R - meet], [2 * R - W, 0], [2 * R, 0], [2 * R, X_HEIGHT], [2 * R - W, X_HEIGHT], [2 * R - W, R],
    ...arcPoints([R, R], INNER, 360, 180).slice(1, -1),
    [W, R], [W, X_HEIGHT]
  ]
  return { width: 2 * R, rings: [counterClockwise(dedupe(outer))], posts: [R] }
}

function letterP () {
  const meet = Math.sqrt(R * R - (R - W) ** 2)
  const from = Math.atan2(-meet, W - R) / DEG + 360
  const to = Math.atan2(meet, W - R) / DEG + 360
  const outer = [
    [0, -DESCENDER], [W, -DESCENDER], [W, R - meet],
    ...arcPoints([R, R], R, from, to).slice(1, -1),
    [W, R + meet], [W, X_HEIGHT], [0, X_HEIGHT]
  ]
  const hole = arcPoints([R, R], INNER, 0, 360).slice(0, -1)
  return { width: 2 * R, rings: [counterClockwise(outer), clockwise(hole)], posts: [R] }
}

function letterE () {
  const bar = W / 2
  const lower = -34
  const start = -Math.asin(bar / R) / DEG
  const innerJoin = 180 + Math.asin(bar / INNER) / DEG
  const outer = [
    ...arcPoints([R, R], R, start, 360 + lower),
    ...arcPoints([R, R], INNER, 360 + lower, innerJoin)
  ]
  const upperJoin = Math.asin(bar / INNER) / DEG
  const hole = arcPoints([R, R], INNER, upperJoin, 180 - upperJoin)
  return { width: 2 * R, rings: [counterClockwise(dedupe(outer)), clockwise(dedupe(hole))], posts: [R] }
}

function letterR () {
  const bend = 6.6
  const center = [W / 2 + bend, X_HEIGHT - W / 2 - bend]
  const line = [[W / 2, 0], [W / 2, center[1]], ...arcPoints(center, bend, 180, 48)]
  const ring = counterClockwise(strokeOf(line))
  const right = Math.max(...ring.map(([x]) => x))
  return { width: right, rings: [ring], posts: [W / 2] }
}

function letterL () {
  return { width: W, rings: [counterClockwise([[0, 0], [W, 0], [W, ASCENDER], [0, ASCENDER]])], posts: [W / 2] }
}

function letterO () {
  return {
    width: 2 * R,
    rings: [counterClockwise(arcPoints([R, R], R, 0, 360).slice(0, -1)), clockwise(arcPoints([R, R], INNER, 0, 360).slice(0, -1))],
    posts: [R]
  }
}

function letterC () {
  const open = 42
  const outer = [...arcPoints([R, R], R, open, 360 - open), ...arcPoints([R, R], INNER, 360 - open, open)]
  const right = Math.max(...outer.map(([x]) => x))
  return { width: right, rings: [counterClockwise(dedupe(outer))], posts: [R] }
}

function letterK () {
  const slope = Math.tan(56 * DEG)
  const along = W / Math.sin(56 * DEG)
  const armRight = 17.4
  const armLeft = armRight - along
  const legRight = armRight + 0.6
  const legLeft = legRight - along
  const armLower = x => X_HEIGHT + slope * (x - armRight)
  const armUpper = x => X_HEIGHT + slope * (x - armLeft)
  const legRightEdge = x => -slope * (x - legRight)
  const meet = (lineA, lineB) => {
    let low = W
    let high = armRight
    for (let step = 0; step < 60; step++) {
      const middle = (low + high) / 2
      if (lineA(middle) - lineB(middle) < 0) low = middle
      else high = middle
    }
    return [(low + high) / 2, lineA((low + high) / 2)]
  }
  const legLeftEdge = x => -slope * (x - legLeft)
  const notch = meet(armLower, legLeftEdge)
  const crotch = meet(armLower, legRightEdge)
  const outer = [
    [0, 0], [W, 0], [W, armLower(W)], notch, [legLeft, 0], [legRight, 0], crotch,
    [armRight, X_HEIGHT], [armLeft, X_HEIGHT], [W, armUpper(W)], [W, ASCENDER], [0, ASCENDER]
  ]
  return { width: legRight, rings: [counterClockwise(outer)], posts: [W / 2] }
}

const BUILDERS = { s: letterS, u: letterU, p: letterP, e: letterE, r: letterR, l: letterL, o: letterO, c: letterC, k: letterK }

const KERN = { su: 5.4, up: 5.2, pe: 5, er: 5, rl: 5.8, lo: 5.4, oc: 4.6, ck: 5.4 }

export function wordOf (text) {
  let cursor = 0
  const letters = []
  ;[...text].forEach((char, index) => {
    const glyph = BUILDERS[char]()
    if (index) cursor += KERN[text[index - 1] + char] ?? 5
    letters.push({ char, x: cursor, ...glyph })
    cursor += glyph.width
  })
  const shift = -cursor / 2
  return { width: cursor, letters: letters.map(letter => ({ ...letter, x: letter.x + shift })) }
}

export const SHACKLE = { stroke: 3.4, spread: 6.4, crown: 27, long: 16.6, short: 19.5 }

export function shackleRing () {
  const { spread, crown, long, short, stroke } = SHACKLE
  const line = [[R - spread, long], ...arcPoints([R, crown], spread, 180, 0), [R + spread, short]]
  return counterClockwise(strokeOf(line, stroke))
}
