export function mount ({ data, kit, machine, sim }) {
  const { translateAlong } = kit
  const { P, stations, hits, outlines } = data

  const stage = document.querySelector('.wm-stage')
  const svg = stage.querySelector('svg')
  const announcer = stage.querySelector('[data-live]')
  const status = document.querySelector('[data-status]')
  const parts = new Map([...svg.querySelectorAll('[data-part]')].map(element => [element.dataset.part, element]))
  const labelled = new Map([...svg.querySelectorAll('[data-label]')].map(element => [element.dataset.label, element.querySelector('text')]))
  const groups = sim.letters.map(letter => svg.querySelector(`[data-letter="${letter.index}"]`))
  const keys = new Map(sim.letters.map(letter => [letter.char, letter.index]))
  const drawn = new Map()

  let frame = 0
  let last = 0
  let visible = false
  let hovered = -1
  let heard = 0

  function draw () {
    const { moves, fades, labels } = machine.poseOf(sim.frame(), stations)
    for (const [name, offset] of Object.entries(moves)) {
      const value = translateAlong(P, offset)
      if (drawn.get(name) === value) continue
      drawn.set(name, value)
      parts.get(name).setAttribute('transform', value)
    }
    for (const [name, text] of Object.entries(labels)) {
      if (drawn.get(name) === text) continue
      drawn.set(name, text)
      labelled.get(name).textContent = text
    }
    for (const [name, amount] of Object.entries(fades)) {
      const value = amount.toFixed(3)
      if (drawn.get(name) === value) continue
      drawn.set(name, value)
      parts.get(name).style.opacity = value
    }
    sim.letters.forEach(letter => groups[letter.index].setAttribute('data-state', letter.state))
    const line = sim.status()
    if (status.textContent !== line) status.textContent = line
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
    frame = visible && sim.busy() ? window.requestAnimationFrame(tick) : 0
  }

  function run () {
    if (!frame && visible) {
      last = 0
      frame = window.requestAnimationFrame(tick)
    }
  }

  function viewBoxPoint (event) {
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    return point.matrixTransform(svg.getScreenCTM().inverse())
  }

  const faces = groups.map(group => group.querySelector('.wm-letter > .iso-fill'))
  const surfaces = groups.map(group => [...group.querySelectorAll('.wm-letter:not([data-lit]) > path')])
  const edges = groups.map(group => [...group.querySelectorAll('.wm-letter:not([data-lit]) > .iso-edge, .wm-letter:not([data-lit]) > .iso-crease')])
  const frames = groups.map(group => group.querySelector('.wm-letter').parentNode)
  const topFirst = faces.map((face, index) => ({ face, index })).sort((a, b) => (a.face.compareDocumentPosition(b.face) & window.Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1))
  const resolved = { x: NaN, y: NaN, index: -1 }
  const OUTLINE_REACH = 3

  function localPoint (index, clientX, clientY) {
    const local = new window.DOMPoint(clientX, clientY).matrixTransform(frames[index].getScreenCTM().inverse())
    const point = svg.createSVGPoint()
    point.x = local.x
    point.y = local.y
    return point
  }

  function paintedAt (clientX, clientY) {
    for (const { index } of topFirst) {
      const point = localPoint(index, clientX, clientY)
      if (surfaces[index].some(surface => surface.isPointInFill(point)) || edges[index].some(edge => edge.isPointInStroke(point)) || outlineDistance(index, point) <= strokeReach()) return index
    }
    return -1
  }

  function outlineDistance (index, point) {
    let best = Infinity
    for (const ring of outlines[index]) {
      for (let at = 1; at < ring.length; at++) {
        const [ax, ay] = ring[at - 1]
        const [bx, by] = ring[at]
        const dx = bx - ax
        const dy = by - ay
        const share = Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / (dx * dx + dy * dy || 1)))
        best = Math.min(best, Math.hypot(point.x - ax - dx * share, point.y - ay - dy * share))
      }
    }
    return best
  }

  function strokeReach () {
    const width = parseFloat(window.getComputedStyle(edges[0][0]).strokeWidth) || 1
    return (width / 2 + 0.5) * 640 / svg.getBoundingClientRect().width
  }

  function nearestAt (clientX, clientY) {
    const { x, y } = viewBoxPoint({ clientX, clientY })
    const ranked = hits
      .map(([left, top, right, bottom], index) => ({ index, inside: x >= left && x <= right && y >= top && y <= bottom, distance: outlineDistance(index, localPoint(index, clientX, clientY)) }))
      .sort((a, b) => a.distance - b.distance)
    if (ranked[0].distance <= OUTLINE_REACH) return ranked[0].index
    const padded = ranked.find(entry => entry.inside)
    return padded ? padded.index : -1
  }

  function letterAt ({ clientX, clientY }) {
    if (clientX === resolved.x && clientY === resolved.y && sim.busy() === false) return resolved.index
    const painted = paintedAt(clientX, clientY)
    const index = painted >= 0 ? painted : nearestAt(clientX, clientY)
    Object.assign(resolved, { x: clientX, y: clientY, index })
    return index
  }

  function hover (index) {
    if (index === hovered) return
    if (hovered >= 0) groups[hovered].removeAttribute('data-hover')
    hovered = index
    if (index >= 0) groups[index].setAttribute('data-hover', '')
    stage.style.cursor = index >= 0 ? 'pointer' : 'default'
  }

  function press (index) {
    sim.press(index)
    draw()
    run()
  }

  stage.addEventListener('pointermove', event => hover(letterAt(event)))
  stage.addEventListener('pointerleave', () => hover(-1))

  stage.addEventListener('click', event => {
    const index = letterAt(event)
    if (index >= 0) press(index)
  })

  stage.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const index = keys.get(event.key.toLowerCase())
    if (index === undefined) return
    event.preventDefault()
    if (!event.repeat) press(index)
  })

  new window.IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting
    if (visible) run()
  }, { rootMargin: '120px 0px' }).observe(stage)

  window.__wordmark = {
    pick: (clientX, clientY) => letterAt({ clientX, clientY }),
    lock: sim.lock,
    history: sim.history,
    state: () => ({
      phase: sim.phase,
      holder: sim.holder && sim.holder.char,
      waiting: sim.waiting.map(letter => letter.char),
      served: sim.history.filter(entry => entry.endsWith('holds the lock')).map(entry => entry[0]),
      lit: sim.letters.filter(letter => letter.on).map(letter => letter.char),
      awaiting: sim.lock.awaiting(),
      locked: sim.lock.isLocked()
    })
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
