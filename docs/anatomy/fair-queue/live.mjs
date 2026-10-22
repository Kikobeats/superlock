export function mount ({ data, kit, machine, sim, drawing }) {
  const { translateAlong, iso } = kit
  const { TOKEN, DECK, KEYS, STATION, BLADE, HUB, unitOf, armFacesViewer, columnPoint } = machine
  const { P } = data

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const RESUME_TOUR_MS = 3600
  const COLUMN_MID = DECK + 24
  const stage = document.querySelector('.ml-stage')
  const svg = stage.querySelector('svg')
  const readout = document.querySelector('[data-readout]')
  const announcer = stage.querySelector('[data-live]')
  const still = window.matchMedia('(prefers-reduced-motion: reduce)')
  const part = name => svg.querySelector(`[data-part="${name}"]`)
  const layerOf = name => svg.querySelector(`[data-layer="${name}"]`)
  const layerNames = KEYS.map(key => `col-${key}`).concat(['aborting', 'carry', 'drop'])
  const layers = Object.fromEntries(layerNames.map(name => [name, layerOf(name)]))
  const slots = { under: layerOf('arm-under'), over: layerOf('arm-over') }
  const arm = document.createElementNS(SVG_NS, 'g')
  const bar = document.createElementNS(SVG_NS, 'g')
  const guide = document.createElementNS(SVG_NS, 'g')
  arm.append(bar, guide)
  const parts = { trap: part('trap'), dial: part('dial-marks'), hub: part('hub-marks'), die: part('die'), counter: part('counter') }
  const bladeParts = Object.fromEntries(KEYS.map(key => [key, part(`blade-${key}`)]))
  const elements = new Map()

  let frame = 0
  let last = 0
  let visible = false
  let resumeTimer = 0
  let drawnTheta = null
  let drawnTrap = null
  let drawnDie = null
  const drawnBlades = {}
  let heard = 0

  sim.touring = !still.matches

  function elementOf (token) {
    if (elements.has(token)) return elements.get(token)
    const el = document.createElementNS(SVG_NS, 'g')
    el.setAttribute('data-token', '')
    el.setAttribute('data-id', String(token.id))
    el.setAttribute('data-key', token.key)
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
    for (const name of layerNames) {
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

  function drawArm () {
    const theta = sim.theta
    if (theta !== drawnTheta) {
      drawnTheta = theta
      bar.innerHTML = drawing.barSvg(theta)
      guide.innerHTML = drawing.guideSvg(theta)
      parts.dial.setAttribute('transform', drawing.planeTransform(DECK, theta))
      parts.hub.setAttribute('transform', drawing.planeTransform(HUB.top, theta))
      const slot = armFacesViewer(theta) ? slots.under : slots.over
      if (arm.parentNode !== slot) slot.appendChild(arm)
    }
  }

  function drawBlades () {
    for (const key of KEYS) {
      const tip = sim.bladeTip(key)
      if (drawnBlades[key] === tip) continue
      drawnBlades[key] = tip
      const [ux, uy] = unitOf(STATION[key])
      const shift = tip - BLADE.rest
      bladeParts[key].setAttribute('transform', translateAlong(P, [ux * shift, uy * shift, 0]))
    }
  }

  function draw () {
    drawArm()
    if (sim.trap !== drawnTrap) {
      drawnTrap = sim.trap
      parts.trap.setAttribute('opacity', drawnTrap.toFixed(3))
    }
    drawBlades()
    if (sim.dieZ !== drawnDie) {
      drawnDie = sim.dieZ
      parts.die.setAttribute('transform', translateAlong(P, [0, 0, drawnDie]))
    }
    placeTokens()
    if (parts.counter.textContent !== sim.pressKey) parts.counter.textContent = sim.pressKey
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
    sim.step(dt)
    draw()
    frame = visible && (sim.touring || sim.busy()) ? window.requestAnimationFrame(tick) : 0
  }

  function run () {
    if (!frame && visible) {
      last = 0
      frame = window.requestAnimationFrame(tick)
    }
  }

  function takeOver () {
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
    const half = TOKEN.r * P.scale * Math.sqrt(1.6)
    const lid = half * Math.sin((P.elevation * Math.PI) / 180)
    const centre = token => iso([token.x, token.y, token.z + TOKEN.h / 2], P)[1]
    const hits = sim.tokens.filter(token => token.state === 'waiting' || token.state === 'holding' || token.state === 'carried').filter(token => {
      const [cx, top] = iso([token.x, token.y, token.z + TOKEN.h], P)
      const [, bottom] = iso([token.x, token.y, token.z], P)
      return Math.abs(x - cx) <= half && y >= top - lid && y <= bottom + lid
    })
    return hits.sort((a, b) => Math.abs(centre(a) - y) - Math.abs(centre(b) - y))[0]
  }

  function columnNear ({ x, y }) {
    const distance = key => {
      const [cx, cy] = iso([...columnPoint(key), COLUMN_MID], P)
      return Math.hypot(x - cx, (y - cy) * 0.6)
    }
    return KEYS.reduce((best, key) => (distance(key) < distance(best) ? key : best), KEYS[0])
  }

  stage.addEventListener('pointerdown', () => stage.setAttribute('data-pointer', ''))

  stage.addEventListener('click', event => {
    takeOver()
    const point = viewBoxPoint(event)
    const token = tokenAt(point)
    if (token) sim.abortToken(token)
    else sim.callQueue(columnNear(point))
    run()
  })

  stage.addEventListener('keydown', event => {
    stage.removeAttribute('data-pointer')
    const key = event.key.toUpperCase()
    if (KEYS.includes(key) && !event.metaKey && !event.ctrlKey && !event.altKey) sim.callQueue(key)
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

  window.__fair = {
    queue: sim.queue,
    history: sim.history,
    call: key => sim.callQueue(key),
    state: () => ({
      phase: sim.phase,
      theta: sim.theta,
      holder: sim.holder && { id: sim.holder.id, key: sim.holder.key },
      waiting: Object.fromEntries(KEYS.map(key => [key, sim.waiting[key].map(token => token.id)])),
      awaiting: sim.queue.awaiting(),
      stamps: sim.stamps
    })
  }
  draw()
}
