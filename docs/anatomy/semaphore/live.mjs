export function mount ({ data, kit, machine, sim, drawing }) {
  const { translateAlong, iso } = kit
  const { TOKEN, TIP_HOME, postX, tipX, pinOf } = machine
  const { P } = data

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const RESUME_TOUR_MS = 3600
  const SEED_STEPS = 60 * 30
  const SEED_AWAITING = 2
  const TOKEN_LAYERS = ['tokens-1', 'tokens-2', 'notch-1', 'notch-2', 'drop', 'column', 'arrival', 'aborting', 'bin-1', 'bin-2']
  const CLICKABLE = ['arriving', 'waiting', 'granted', 'gate', 'lane']
  const stage = document.querySelector('.ml-stage')
  const svg = stage.querySelector('svg')
  const readout = document.querySelector('[data-readout]')
  const announcer = stage.querySelector('[data-live]')
  const still = window.matchMedia('(prefers-reduced-motion: reduce)')
  const part = name => svg.querySelector(`[data-part="${name}"]`)
  const layers = Object.fromEntries(TOKEN_LAYERS.map(name => [name, svg.querySelector(`[data-layer="${name}"]`)]))
  const gateParts = ['gate-back', 'gate-mid', 'gate-front'].map(part)
  const pawlParts = machine.PAWL_PARTS.map(([name, direction]) => [part(name), direction])
  const lanes = sim.lanes.map(lane => {
    const id = lane.spec.id
    return {
      lane,
      blade: part(`blade-${id}`),
      crank: part(`crank-${id}`),
      rod: part(`rod-${id}`),
      pinCrank: part(`pin-crank-${id}`),
      pinPost: part(`pin-post-${id}`),
      die: part(`die-${id}`),
      counter: part(`counter-${id}`),
      drawnTheta: null,
      drawnDie: null
    }
  })
  const elements = new Map()

  let frame = 0
  let last = 0
  let visible = false
  let resumeTimer = 0
  let drawnGate = null
  let drawnPawl = null
  let heard = 0
  let frozen = false

  sim.touring = !still.matches

  function elementOf (token) {
    if (elements.has(token)) return elements.get(token)
    const el = document.createElementNS(SVG_NS, 'g')
    el.setAttribute('data-token', '')
    el.setAttribute('data-id', String(token.id))
    el.innerHTML = data.token
    elements.set(token, el)
    return el
  }

  function placeTokens () {
    for (const [token, el] of elements) {
      if (!sim.tokens.includes(token)) {
        el.remove()
        elements.delete(token)
      }
    }
    for (const name of TOKEN_LAYERS) {
      const order = sim.tokens.filter(token => token.layer === name).sort((a, b) => a.id - b.id).map(elementOf)
      const current = [...layers[name].children]
      if (order.length === current.length && order.every((el, index) => current[index] === el)) continue
      const fragment = document.createDocumentFragment()
      order.forEach(el => fragment.appendChild(el))
      layers[name].appendChild(fragment)
    }
    for (const token of sim.tokens) {
      const el = elementOf(token)
      el.setAttribute('transform', translateAlong(P, [token.x, token.y, token.z]))
      el.setAttribute('opacity', token.alpha >= 1 ? '1' : token.alpha.toFixed(3))
      el.firstElementChild.toggleAttribute('data-lit', token.lit)
    }
  }

  function drawLane (view) {
    const { lane } = view
    if (lane.theta !== view.drawnTheta) {
      const theta = lane.theta
      const pin = pinOf(lane.spec, theta)
      view.drawnTheta = theta
      view.blade.setAttribute('transform', translateAlong(P, [tipX(theta) - TIP_HOME, 0, 0]))
      view.pinPost.setAttribute('transform', translateAlong(P, [postX(theta), lane.spec.y, 0]))
      view.pinCrank.setAttribute('transform', translateAlong(P, [pin[0], pin[1], 0]))
      view.crank.innerHTML = drawing.crankSvg(lane.spec, theta)
      view.rod.innerHTML = drawing.rodSvg(lane.spec, theta)
    }
    const dieZ = sim.dieZ(lane)
    if (dieZ !== view.drawnDie) {
      view.drawnDie = dieZ
      view.die.setAttribute('transform', translateAlong(P, [0, 0, dieZ]))
    }
    const count = String(sim.counterOf(lane) % 1000).padStart(3, '0')
    if (view.counter.textContent !== count) view.counter.textContent = count
  }

  function draw () {
    lanes.forEach(drawLane)
    if (sim.gate.s !== drawnGate) {
      drawnGate = sim.gate.s
      const shift = translateAlong(P, [0, drawnGate, 0])
      gateParts.forEach(el => el.setAttribute('transform', shift))
    }
    if (sim.pawl !== drawnPawl) {
      drawnPawl = sim.pawl
      const travel = machine.ESC.pawl * drawnPawl
      pawlParts.forEach(([el, [dx, dy]]) => el.setAttribute('transform', translateAlong(P, [dx * travel, dy * travel, 0])))
    }
    placeTokens()
    const text = sim.readout()
    if (readout.textContent !== text) readout.textContent = text
    if (sim.history.length !== heard) {
      heard = sim.history.length
      announcer.textContent = sim.history[heard - 1]
    }
  }

  function tick (now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60
    last = now
    if (!frozen) sim.step(dt)
    draw()
    frame = visible && !frozen && (sim.touring || sim.busy()) ? window.requestAnimationFrame(tick) : 0
  }

  function run () {
    if (!frame && visible) {
      last = 0
      frame = window.requestAnimationFrame(tick)
    }
  }

  function takeOver () {
    frozen = false
    sim.touring = false
    clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      if (!still.matches) sim.resumeTour()
      run()
    }, RESUME_TOUR_MS)
  }

  function viewBoxPoint (event) {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(svg.getScreenCTM().inverse())
  }

  function tokenAt ({ x, y }) {
    const half = TOKEN.r * P.scale
    const lid = half * Math.sin((P.elevation * Math.PI) / 180)
    const centre = token => iso([token.x, token.y, token.z + TOKEN.h / 2], P)[1]
    const hits = sim.tokens.filter(token => CLICKABLE.includes(token.state) || token.lit).filter(token => {
      const [cx, top] = iso([token.x, token.y, token.z + TOKEN.h], P)
      const [, bottom] = iso([token.x, token.y, token.z], P)
      return Math.abs(x - cx) <= half && y >= top - lid && y <= bottom + lid
    })
    return hits.sort((a, b) => Math.abs(centre(a) - y) - Math.abs(centre(b) - y))[0]
  }

  stage.addEventListener('click', event => {
    takeOver()
    const token = tokenAt(viewBoxPoint(event))
    if (token) sim.abortToken(token)
    else sim.callLock()
    run()
  })

  stage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') sim.callLock()
    else if (event.key === 'Backspace' || event.key === 'Delete') sim.abortNewest()
    else return
    event.preventDefault()
    takeOver()
    run()
  })

  new window.IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting
    if (visible) run()
  }, { rootMargin: '120px 0px' }).observe(stage)

  window.__semaphore = {
    lock: sim.lock,
    history: sim.history,
    state: () => ({
      held: sim.holders().map(token => token.id),
      waiting: sim.waiting.map(token => token.id),
      pending: sim.pending.map(token => token.id),
      gate: { phase: sim.gatePhase, s: sim.gate.s, token: sim.gateToken && sim.gateToken.id },
      lanes: sim.lanes.map(lane => ({ lane: lane.spec.id, token: lane.token && lane.token.id, phase: lane.phase, theta: lane.theta, stamps: lane.stamps })),
      readout: sim.readout()
    })
  }
  async function seedStill () {
    const busyStill = () => sim.lanes.every(lane => lane.token && lane.token.state === 'lane') && sim.lock.awaiting() >= SEED_AWAITING
    sim.touring = true
    for (let step = 0; step < SEED_STEPS && !busyStill(); step++) {
      sim.step(1 / 60)
      await Promise.resolve()
      await Promise.resolve()
    }
    sim.touring = false
    frozen = true
    draw()
  }

  draw()
  if (still.matches) seedStill()
}
