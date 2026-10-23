const SHADES = 4
const SEAM_AT = 0.42
const TRIM = 0.85
const MITER = 2.2

function insetOf (ring, by) {
  const count = ring.length
  const unit = ([dx, dz]) => {
    const length = Math.hypot(dx, dz) || 1
    return [dx / length, dz / length]
  }
  return ring.map(([x, z], index) => {
    const [px, pz] = ring[(index + count - 1) % count]
    const [nx, nz] = ring[(index + 1) % count]
    const [ax, az] = unit([x - px, z - pz])
    const [bx, bz] = unit([nx - x, nz - z])
    const left = unit([-az - bz, ax + bx])
    const cosine = left[0] * -az + left[1] * ax
    const reach = Math.min(MITER, 1 / Math.max(0.2, cosine)) * by
    return [x + left[0] * reach, z + left[1] * reach]
  })
}
const TOP_FACING = 0.72

const screenArea = points => points.reduce((sum, [ax, ay], index) => {
  const [bx, by] = points[(index + 1) % points.length]
  return sum + ax * by - bx * ay
}, 0) / 2

const facingSign = (points, sign) => (Math.sign(screenArea(points)) === sign ? points : [...points].reverse())

function runsOf (flags) {
  const count = flags.length
  const start = flags.findIndex((flag, index) => flag !== flags[(index + count - 1) % count])
  if (start < 0) return [{ value: flags[0], edges: Array.from({ length: count }, (_, index) => index), closed: true }]
  const runs = []
  let run = null
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count
    if (!run || run.value !== flags[index]) {
      run = { value: flags[index], edges: [] }
      runs.push(run)
    }
    run.edges.push(index)
  }
  return runs
}

export function createPrism (k, P) {
  const { sinA, cosA, sinE, cosE } = k.cameraOf(P)
  const view = [cosA * cosE, sinA * cosE, sinE]
  const light = [-sinA, cosA]
  const toneOf = ([nx, ny, nz]) => {
    if (nz >= TOP_FACING) return 'top'
    const level = (nx * light[0] + ny * light[1] + 1) / 2
    const lifted = nz > 0 ? level + (1 - level) * nz : level * (1 + nz * 0.6)
    return Math.min(SHADES - 1, Math.max(0, Math.floor(lifted * SHADES)))
  }
  const capTone = toneOf([0, 1, 0])

  return function prism (rings, [ox, oz], [y0, y1], { lit = false, tone = 'hi', crease = 'mid', className = '', trim = true } = {}) {
    const front = ring => ring.map(([x, z]) => k.iso([ox + x, y1, oz + z], P))
    const back = ring => ring.map(([x, z]) => k.iso([ox + x, y0, oz + z], P))
    const fills = []
    const strips = []
    const creases = []
    const silhouettes = []
    const cap = []
    const trims = []
    const depthOf = points => points.reduce((sum, [x, z]) => sum + k.depthOf([ox + x, (y0 + y1) / 2, oz + z], P), 0) / points.length

    rings.forEach((ring, ringIndex) => {
      const sign = ringIndex === 0 ? 1 : -1
      const near = front(ring)
      const far = back(ring)
      const middle = ring.map(([x, z]) => k.iso([ox + x, y0 + (y1 - y0) * SEAM_AT, oz + z], P))
      if (trim) trims.push(k.pathOf(insetOf(ring, TRIM).map(([x, z]) => k.iso([ox + x, y1, oz + z], P)), true))
      const count = ring.length
      cap.push(facingSign(near, sign))
      fills.push(facingSign(near, sign), facingSign(far, sign))
      const edges = ring.map(([ax, az], index) => {
        const [bx, bz] = ring[(index + 1) % count]
        const length = Math.hypot(bx - ax, bz - az) || 1
        const normal = [(bz - az) / length, 0, -(bx - ax) / length]
        const facing = normal[0] * view[0] + normal[2] * view[2] > 1e-9
        return { facing, tone: facing ? toneOf(normal) : null }
      })
      const span = run => (run.closed ? [...run.edges, run.edges[0]] : [...run.edges, (run.edges[run.edges.length - 1] + 1) % count])
      for (const run of runsOf(edges.map(edge => edge.facing))) {
        const vertices = span(run)
        if (run.value) {
          creases.push(k.pathOf(vertices.map(index => near[index])))
          fills.push(facingSign([...vertices.map(index => near[index]), ...vertices.map(index => far[index]).reverse()], 1))
        } else {
          silhouettes.push(k.pathOf(vertices.map(index => near[index])))
        }
      }
      for (const run of runsOf(edges.map(edge => edge.tone))) {
        if (run.value === null) continue
        const vertices = span(run)
        const first = vertices[0]
        const last = vertices[vertices.length - 1]
        const lines = [k.pathOf(vertices.map(index => far[index]))]
        if (!edges[(first + count - 1) % count].facing) lines.push(k.pathOf([near[first], far[first]]))
        if (!run.closed && !edges[last].facing) lines.push(k.pathOf([near[last], far[last]]))
        strips.push({
          tone: run.value,
          depth: depthOf(vertices.map(index => ring[index])),
          d: k.pathOf(facingSign([...vertices.map(index => near[index]), ...vertices.map(index => far[index]).reverse()], 1), true),
          lines: lines.join(''),
          seam: k.pathOf(vertices.map(index => middle[index]))
        })
      }
    })

    const classOf = value => (value === 'top' ? 'class="iso-top"' : `class="iso-shade" data-shade="${value}"`)
    const parts = [`<path class="iso-fill" d="${fills.map(points => k.pathOf(points, true)).join('')}"/>`]
    for (const strip of strips.sort((a, b) => a.depth - b.depth)) {
      parts.push(`<path ${classOf(strip.tone)} d="${strip.d}"/>`)
      parts.push(`<path class="iso-line" data-tone="faint" d="${strip.seam}"/>`)
      parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${strip.lines}"/>`)
    }
    parts.push(`<path ${classOf(capTone)} data-cap="" d="${cap.map(points => k.pathOf(points, true)).join('')}"/>`)
    if (trims.length) parts.push(`<path class="iso-line" data-tone="lo" data-trim="" d="${trims.join('')}"/>`)
    parts.push(`<path class="iso-line iso-crease" data-tone="${crease}" d="${creases.join('')}"/>`)
    parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${silhouettes.join('')}"/>`)
    return `<g class="iso-solid${className ? ` ${className}` : ''}"${lit ? ' data-lit=""' : ''}>${parts.join('')}</g>`
  }
}
