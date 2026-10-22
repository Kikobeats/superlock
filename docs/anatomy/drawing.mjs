export function createDrawing ({ kit, machine, P }) {
  const { extrude, solidSvg, lineSvg, dotsSvg, onTop, iso } = kit
  const { CRANK, ARM_Z, ARM_H, ROD_Z, ROD_H, postX, pinOf } = machine

  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const halfHull = points => points.reduce((hull, point) => {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop()
    hull.push(point)
    return hull
  }, [])
  const hullOf = points => {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
    return halfHull(sorted).slice(0, -1).concat(halfHull([...sorted].reverse()).slice(0, -1))
  }
  const circlePoints = ([cx, cy], radius, count = 20) => Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]
  })
  const unitBetween = (from, to) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    return [(to[0] - from[0]) / length, (to[1] - from[1]) / length, length]
  }

  function crankSvg (theta) {
    const hub = [CRANK.cx, 0]
    const pin = pinOf(theta)
    const [ux, uy] = unitBetween(hub, pin)
    const weight = [hub[0] - ux * 11, hub[1] - uy * 11]
    const outline = hullOf([...circlePoints(hub, 9, 18), ...circlePoints(pin, 5, 12), ...circlePoints(weight, 8, 16)])
    const top = ARM_Z + ARM_H
    const bolts = [0, 1, 2, 3].map(index => {
      const angle = theta + Math.PI / 4 + (index * Math.PI) / 2
      return iso([hub[0] + Math.cos(angle) * 5.4, hub[1] + Math.sin(angle) * 5.4, top], P)
    })
    return solidSvg(extrude(outline, ARM_Z, ARM_H, P, { bevel: 0.5 }), { tone: 'mid' }) +
      lineSvg(onTop(circlePoints(hub, 3, 14), top, P, true), { tone: 'lo' }) +
      dotsSvg(bolts, { size: 0.45 })
  }

  function rodSvg (theta) {
    const pin = pinOf(theta)
    const post = [postX(theta), 0]
    const [ux, uy, length] = unitBetween(pin, post)
    const along = distance => [pin[0] + ux * distance, pin[1] + uy * distance]
    const outline = hullOf([...circlePoints(pin, 4.4, 14), ...circlePoints(post, 4.4, 14)])
    const slot = hullOf([...circlePoints(along(11), 1.5, 8), ...circlePoints(along(length - 11), 1.5, 8)])
    return solidSvg(extrude(outline, ROD_Z, ROD_H, P, { bevel: 0.4 }), { tone: 'mid' }) +
      lineSvg(onTop(slot, ROD_Z + ROD_H, P, true), { tone: 'lo' })
  }

  return { crankSvg, rodSvg }
}
