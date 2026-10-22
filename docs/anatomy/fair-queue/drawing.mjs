export function createDrawing ({ kit, machine, P }) {
  const { extrude, roundedPlan, solidSvg, lineSvg, dotsSvg, onTop, iso, cameraOf } = kit
  const { TOKEN, DECK, KICK, GUIDE, unitOf } = machine

  const fixed = value => Math.round(value * 10000) / 10000

  const turnPoint = (theta, [x, y]) => {
    const [cos, sin] = unitOf(theta)
    return [x * cos - y * sin, x * sin + y * cos]
  }

  const radialPlan = (theta, from, to, width, radius, steps = 2) => roundedPlan({ x: from, y: -width / 2, w: to - from, d: width, r: radius }, steps).map(point => turnPoint(theta, point))

  function barSvg (theta) {
    const plan = radialPlan(theta, KICK.home - KICK.length, KICK.home, KICK.width, 0.6, 1)
    const top = DECK + TOKEN.h
    const slot = radialPlan(theta, KICK.home - KICK.length + 5, KICK.home - 5, 2.4, 1.2)
    return solidSvg(extrude(plan, DECK, TOKEN.h, P, { bevel: 0.4 }), { tone: 'mid' }) +
      lineSvg(onTop(slot, top, P, true), { tone: 'lo' })
  }

  function guideSvg (theta) {
    const plan = radialPlan(theta, GUIDE.from, GUIDE.to, GUIDE.width, 1.6, 2)
    const top = DECK + GUIDE.height
    const screws = [[GUIDE.from + 3, -GUIDE.width / 2 + 2.6], [GUIDE.from + 3, GUIDE.width / 2 - 2.6], [GUIDE.to - 3, -GUIDE.width / 2 + 2.6], [GUIDE.to - 3, GUIDE.width / 2 - 2.6]]
    return solidSvg(extrude(plan, DECK, GUIDE.height, P, { bevel: 0.5 }), { tone: 'mid' }) +
      dotsSvg(screws.map(point => iso([...turnPoint(theta, point), top], P)), { size: 0.45 })
  }

  function planeParts (z, theta) {
    const { sinA, cosA, sinE, k } = cameraOf(P)
    const [ox, oy] = iso([0, 0, z], P)
    const a = k * sinA
    const b = k * cosA * sinE
    const c = -k * cosA
    const d = k * sinA * sinE
    const det = a * d - b * c
    const ia = d / det
    const ib = -b / det
    const ic = -c / det
    const id = a / det
    const ie = -(ia * ox + ic * oy)
    const iff = -(ib * ox + id * oy)
    const forward = [a, b, c, d, ox, oy].map(fixed).join(' ')
    const back = [ia, ib, ic, id, ie, iff].map(fixed).join(' ')
    return { forward: `matrix(${forward})`, back: `matrix(${back})`, turn: `rotate(${fixed(theta)})` }
  }

  function planeTransform (z, theta) {
    const { forward, turn, back } = planeParts(z, theta)
    return `${forward} ${turn} ${back}`
  }

  return { barSvg, guideSvg, planeParts, planeTransform }
}
