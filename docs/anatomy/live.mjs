export function mount ({ data, kit, machine, sim, drawing }) {
  const { translateAlong, iso } = kit
  const { TOKEN, TIP_HOME, postX, tipX, pinOf } = machine
  const { P } = data

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const RESUME_TOUR_MS = 3600
  const stage = document.querySelector('.ml-stage')
  const svg = stage.querySelector('svg')
  const readout = document.querySelector('[data-readout]')
  const announcer = stage.querySelector('[data-live]')
  const still = window.matchMedia('(prefers-reduced-motion: reduce)')
  const part = name => svg.querySelector(`[data-part="${name}"]`)
  const layerOf = name => svg.querySelector(`[data-layer="${name}"]`)
  const layers = { tokens: layerOf('tokens'), aborting: layerOf('aborting'), bin: layerOf('bin') }
  const parts = { blade: part('blade'), crank: part('crank'), rod: part('rod'), pinCrank: part('pin-crank'), pinPost: part('pin-post'), die: part('die'), counter: part('counter') }
  const elements = new Map()

  let frame = 0
  let last = 0
  let visible = false
  let resumeTimer = 0
  let drawnTheta = null
  let drawnDie = null
  let heard = 0

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
    for (const name of Object.keys(layers)) {
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

  function draw () {
    const theta = sim.theta
    if (theta !== drawnTheta) {
      drawnTheta = theta
      parts.blade.setAttribute('transform', translateAlong(P, [tipX(theta) - TIP_HOME, 0, 0]))
      parts.pinPost.setAttribute('transform', translateAlong(P, [postX(theta), 0, 0]))
      const pin = pinOf(theta)
      parts.pinCrank.setAttribute('transform', translateAlong(P, [pin[0], pin[1], 0]))
      parts.crank.innerHTML = drawing.crankSvg(theta)
      parts.rod.innerHTML = drawing.rodSvg(theta)
    }
    if (sim.dieZ !== drawnDie) {
      drawnDie = sim.dieZ
      parts.die.setAttribute('transform', translateAlong(P, [0, 0, drawnDie]))
    }
    placeTokens()
    const count = String(sim.counter % 1000).padStart(3, '0')
    if (parts.counter.textContent !== count) parts.counter.textContent = count
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
    const half = TOKEN.r * P.scale
    const lid = half * Math.sin((P.elevation * Math.PI) / 180)
    const centre = token => iso([token.x, token.y, token.z + TOKEN.h / 2], P)[1]
    const hits = sim.tokens.filter(token => token.state === 'waiting' || token.state === 'holding' || token.lit).filter(token => {
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

  window.__mutex = {
    lock: sim.lock,
    history: sim.history,
    state: () => ({ phase: sim.phase, theta: sim.theta, waiting: sim.waiting.map(token => token.id), holder: sim.holder && sim.holder.id, stamps: sim.stamps })
  }
  draw()
}

export function embed () {
  if (!new URLSearchParams(window.location.search).has('embed')) return
  document.documentElement.dataset.embed = ''
  const page = document.querySelector('.iso-page')
  const report = () => window.parent.postMessage({ superlockFigureHeight: Math.ceil(page.getBoundingClientRect().height) }, '*')
  new window.ResizeObserver(report).observe(page)
}
