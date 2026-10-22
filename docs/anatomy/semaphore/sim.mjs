export function createSim ({ machine, createLock, calm = () => false, touring = true }) {
  const { SLOTS, TOKEN, DECK, BLADE_TOP, ARRIVE_Z, COLUMN_TOP, BIN_X, DIE, TIMING, GRAVITY, LANES, GATE_Z, ESC, ESC_TOP, REJECT_X, tipX, THETA_STATION, slotZ, COLUMN_SLOTS, crankEase, BIN_FLOOR, hitsOf } = machine

  const ABORT_SLIDE = 0.55
  const ABORT_LAYER_X = 6
  const ABORT_FADE_FROM = 0.7
  const PAWL_TAU = 0.05
  const PHASE_WORDS = { idle: 'ready', push: 'push', stamp: 'press', eject: 'eject', retract: 'ready' }
  const PILE_LIMIT = 2
  const ENTER_COLUMN_Z = COLUMN_TOP - TOKEN.h
  const NOTE_SECONDS = 1.6
  const TOUR_REST = 0.5
  const TOUR = [[0.25, 'call'], [1.2, 'call'], [1.6, 'call'], [2, 'call'], [2.4, 'call'], [2.8, 'call'], [3, 'abort', 1], [6.5, 'call']]
  const PILE_JITTER = [[-2.6, 1.8], [2.4, -1.4], [0.6, 2], [-1.8, -2]]

  const lock = createLock(SLOTS)
  const tokens = []
  const waiting = []
  const pending = []
  const history = []
  const listeners = { tour: [] }
  const lanes = LANES.map(spec => ({ spec, token: null, phase: 'idle', phaseAt: 0, theta: 0, ram: 0, stamps: 0, hit: 0, released: true, pile: [] }))
  const gate = { s: 0, from: 0, to: 0, phase: 'idle', phaseAt: 0, duration: 0, loading: null, carried: null }
  let serial = 0
  let uids = 0
  let clock = 0
  let note = ''
  let noteUntil = 0
  let noteToken = null
  let tourClock = 0
  let tourIndex = 0
  let quietSince = null
  let pawl = 0

  const clamp01 = value => Math.min(1, Math.max(0, value))
  const smoothstep = (from, to, value) => {
    const t = clamp01((value - from) / (to - from))
    return t * t * (3 - 2 * t)
  }
  const ease = progress => (calm() ? (progress >= 1 ? 1 : 0) : crankEase(progress))
  const loading = () => (gate.phase === 'load' ? [gate.loading] : [])
  const columnOrder = () => loading().concat(pending, waiting)
  const holders = () => tokens.filter(token => token.release && !token.released)
  const resting = (token, floor) => token.z === floor && token.vz === 0

  function say (text, about = null) {
    note = text
    noteToken = about
    noteUntil = clock + NOTE_SECONDS
  }

  function callLock () {
    if (columnOrder().length >= COLUMN_SLOTS) return say('column full')
    const below = columnOrder()
    const top = below.length ? below[below.length - 1].z + TOKEN.h : ARRIVE_Z
    const token = { uid: ++uids, id: ++serial, x: 0, y: 0, z: Math.max(ARRIVE_Z, top), vz: 0, alpha: 1, state: 'waiting', layer: 'arrival', lit: false, lane: null, controller: new AbortController() }
    tokens.push(token)
    waiting.push(token)
    arrive(token)
    return token
  }

  function arrive (token) {
    token.state = 'waiting'
    history.push(`#${token.id} calls lock()`)
    lock(token.controller.signal).then(release => (release ? grant(token, release) : leave(token)))
  }

  function grant (token, release) {
    const lane = lanes.find(candidate => candidate.token === null)
    waiting.splice(waiting.indexOf(token), 1)
    pending.push(token)
    lane.token = token
    Object.assign(token, { state: 'granted', release, released: false, lit: true, lane, hits: hitsOf(token.id) })
    history.push(`#${token.id} holds a slot · lane ${lane.spec.id}`)
  }

  function leave (token) {
    waiting.splice(waiting.indexOf(token), 1)
    token.state = 'aborting'
    token.leftAt = clock
    token.leftX = token.x
    history.push(`#${token.id} aborted`)
    say(`#${token.id} aborted`)
  }

  function abortToken (token) {
    token.controller.abort()
    if (token.release && !token.released) say(`#${token.id} abort ignored`, token)
  }

  function abortNewest () {
    const token = waiting[waiting.length - 1]
    if (token) abortToken(token)
    else say('nobody waiting')
  }

  function setPhase (target, name) {
    target.phase = name
    target.phaseAt = clock
  }

  const fetchS = lane => -lane.spec.y
  const delivered = (token, s) => s * token.lane.spec.y >= 0

  function moveGate (to) {
    Object.assign(gate, { phase: 'move', from: gate.s, to, phaseAt: clock, duration: TIMING.gate * Math.abs(to - gate.s) / LANES[1].y })
  }

  function startLoad (token) {
    pending.shift()
    Object.assign(token, { state: 'gate', layer: 'drop' })
    Object.assign(gate, { phase: 'load', loading: token })
  }

  function deliver (token) {
    gate.carried = null
    Object.assign(token, { y: token.lane.spec.y, state: 'lane', layer: `tokens-${token.lane.spec.id}`, vz: 0 })
  }

  function workLeft (lane) {
    const token = lane.token
    if (!token || token.state !== 'lane') return Infinity
    const elapsed = clock - lane.phaseAt
    const strokes = token.hits * TIMING.stamp
    const after = { idle: TIMING.push + strokes, push: TIMING.push - elapsed + strokes, stamp: strokes - elapsed, eject: 0, retract: 0 }
    return after[lane.phase] + (lane.phase === 'retract' ? 0 : TIMING.eject) + TIMING.retract
  }

  function planGate () {
    const next = pending[0]
    if (next && columnOrder()[0] === next) {
      if (gate.s !== fetchS(next.lane)) return moveGate(fetchS(next.lane))
      if (next.z === slotZ(0) && next.vz === 0) startLoad(next)
      return
    }
    if (gate.carried) return moveGate(0)
    if (waiting.length === 0) return
    const soonest = lanes.reduce((best, lane) => (workLeft(lane) < workLeft(best) ? lane : best))
    if (workLeft(soonest) < Infinity && gate.s !== fetchS(soonest)) moveGate(fetchS(soonest))
  }

  function stepGate () {
    if (gate.phase === 'move') {
      const progress = gate.duration ? (clock - gate.phaseAt) / gate.duration : 1
      gate.s = progress >= 1 ? gate.to : gate.from + (gate.to - gate.from) * ease(progress)
      if (gate.carried) {
        gate.carried.y = gate.s + gate.carried.lane.spec.y
        if (delivered(gate.carried, gate.s)) deliver(gate.carried)
      }
      if (progress < 1) return
      gate.phase = 'idle'
    }
    if (gate.phase === 'load') {
      if (!resting(gate.loading, GATE_Z)) return
      gate.carried = gate.loading
      gate.carried.layer = `notch-${gate.carried.lane.spec.id}`
      gate.loading = null
      gate.phase = 'idle'
    }
    if (gate.phase === 'idle') planGate()
  }

  function carry (lane) {
    lane.token.x = Math.max(lane.token.x, tipX(lane.theta) + TOKEN.r)
  }

  function stepLane (lane) {
    const elapsed = clock - lane.phaseAt
    const token = lane.token
    if (lane.phase === 'idle') {
      if (token && token.state === 'lane' && resting(token, DECK)) {
        lane.hit = 0
        lane.released = false
        setPhase(lane, 'push')
      }
    } else if (lane.phase === 'push') {
      const progress = elapsed / TIMING.push
      lane.theta = THETA_STATION * ease(progress)
      carry(lane)
      if (progress >= 1) setPhase(lane, 'stamp')
    } else if (lane.phase === 'stamp') {
      const strokes = elapsed / TIMING.stamp
      const hit = Math.min(Math.floor(strokes), token.hits - 1)
      const progress = clamp01(strokes - hit)
      lane.ram = calm() ? (progress < 1 ? 1 : 0) : smoothstep(0, 0.35, progress) * (1 - smoothstep(0.6, 1, progress))
      if (lane.hit === hit && lane.ram >= 0.999) {
        lane.hit = hit + 1
        lane.stamps++
      }
      if (strokes >= token.hits) {
        lane.ram = 0
        setPhase(lane, 'eject')
      }
    } else if (lane.phase === 'eject') {
      const progress = elapsed / TIMING.eject
      lane.theta = THETA_STATION + (Math.PI - THETA_STATION) * ease(progress)
      carry(lane)
      if (progress >= 1) {
        sendToBin(lane, token)
        releaseLane(lane)
        setPhase(lane, 'retract')
      }
    } else if (lane.phase === 'retract') {
      const progress = elapsed / TIMING.retract
      lane.theta = Math.PI + Math.PI * ease(progress)
      if (progress >= 1) {
        lane.theta = 0
        setPhase(lane, 'idle')
      }
    }
  }

  const entryFloor = token => (token.x === 0 && tipX(token.lane.theta) > -TOKEN.r ? BLADE_TOP : DECK)

  function releaseLane (lane) {
    const done = lane.token
    lane.released = true
    lane.token = null
    done.lit = false
    done.released = true
    done.release()
    history.push(`#${done.id} released · lane ${lane.spec.id}`)
  }

  function sendToBin (lane, token) {
    const [dx, dy] = PILE_JITTER[lane.stamps % PILE_JITTER.length]
    Object.assign(token, { state: 'off', offAt: clock, offX: token.x, binX: BIN_X + dx, binY: lane.spec.y + dy, vz: 0, layer: `bin-${lane.spec.id}` })
    lane.pile.push(token)
    if (lane.pile.length > PILE_LIMIT) remove(lane.pile.shift())
  }

  function remove (token) {
    tokens.splice(tokens.indexOf(token), 1)
  }

  function fall (token, floor, dt) {
    if (calm() || token.z < floor) {
      token.z = floor
      token.vz = 0
      return
    }
    if (token.z === floor) return
    token.vz -= GRAVITY * dt
    token.z += token.vz * dt
    if (token.z <= floor) {
      token.z = floor
      token.vz = 0
    }
  }

  function stepColumn (dt) {
    const leaving = tokens.filter(token => token.state === 'aborting' && token.leftX - token.x < TOKEN.r * 2)
    const order = columnOrder()
    const stack = order.concat(leaving).sort((a, b) => a.z - b.z)
    const ownFloor = token => (token === gate.loading ? GATE_Z : slotZ(order.indexOf(token) - loading().length))
    stack.forEach((token, index) => {
      if (token.state === 'aborting') return
      const own = ownFloor(token)
      const floor = index === 0 ? own : Math.max(own, stack[index - 1].z + TOKEN.h)
      fall(token, floor, dt)
    })
  }

  function stepTokens (dt) {
    stepColumn(dt)
    for (const token of [...tokens]) {
      if (token.state === 'draining') {
        stepDraining(token)
        continue
      }
      if (token.layer === 'arrival' && token.z < ENTER_COLUMN_Z) token.layer = 'column'
      if (token.state === 'lane') fall(token, entryFloor(token), dt)
      if (token.state === 'off') stepOff(token, dt)
      if (token.state === 'aborting') stepAborting(token, dt)
    }
  }

  function stepOff (token, dt) {
    const progress = calm() ? 1 : clamp01((clock - token.offAt) / TIMING.slide)
    const glide = 1 - (1 - progress) ** 2
    const lane = token.lane
    token.x = token.offX + (token.binX - token.offX) * glide
    token.y = lane.spec.y + (token.binY - lane.spec.y) * glide
    if (progress < 1) return
    fall(token, BIN_FLOOR + TOKEN.h * lane.pile.indexOf(token), dt)
  }

  function stepDraining (token) {
    const progress = calm() ? 1 : clamp01((clock - token.drainAt) / TIMING.drain)
    token.alpha = 1 - smoothstep(0, 1, progress)
    if (progress >= 1) remove(token)
  }

  function drainLane (lane) {
    lane.pile.forEach(token => Object.assign(token, { state: 'draining', drainAt: clock }))
    lane.pile.length = 0
    lane.rewind = { from: lane.stamps, at: clock }
    lane.stamps = 0
  }

  const laneDone = lane => !lane.token && lane.phase === 'idle' && lane.pile.every(settled) && (lane.pile.length > 0 || lane.stamps > 0)

  const rewindProgress = lane => (calm() ? 1 : clamp01((clock - lane.rewind.at) / TIMING.drain))

  function stepRewind (lane) {
    if (lane.rewind && rewindProgress(lane) >= 1) lane.rewind = null
  }

  function counterOf (lane) {
    if (!lane.rewind) return lane.stamps
    return Math.round(lane.rewind.from * (1 - smoothstep(0, 1, rewindProgress(lane))))
  }

  function stepAborting (token, dt) {
    const progress = calm() ? 1 : clamp01((clock - token.leftAt) / TIMING.abort)
    const slide = clamp01(progress / ABORT_SLIDE)
    token.x = token.leftX + (REJECT_X - token.leftX) * (1 - (1 - slide) ** 2)
    if (slide >= 1) fall(token, ESC_TOP, dt)
    token.alpha = Math.min(token.alpha, 1 - smoothstep(ABORT_FADE_FROM, 1, progress))
    if (token.x < -ABORT_LAYER_X) token.layer = 'aborting'
    if (progress >= 1) remove(token)
  }

  function settled (token) {
    if (token.state === 'draining') return true
    if (token.alpha < 1 || token.vz !== 0 || token.state === 'aborting') return false
    if (token.state === 'off') return clock - token.offAt >= TIMING.slide && token.z === BIN_FLOOR + TOKEN.h * token.lane.pile.indexOf(token)
    return true
  }

  const busy = () => gate.phase !== 'idle' || gate.carried !== null || lanes.some(lane => lane.phase !== 'idle' || lane.token) || pending.length > 0 || waiting.length > 0 || !tokens.every(settled) || clock < noteUntil

  function stepTour (dt) {
    if (!sim.touring) return
    tourClock += dt
    while (tourIndex < TOUR.length && tourClock >= TOUR[tourIndex][0]) {
      const [, action, index] = TOUR[tourIndex++]
      if (action === 'call') callLock()
      if (action === 'abort' && waiting[index]) abortToken(waiting[index])
    }
    if (tourIndex < TOUR.length) return
    if (waiting.length === 0 && pending.length === 0) lanes.filter(laneDone).forEach(drainLane)
    if (busy()) {
      quietSince = null
      return
    }
    quietSince = quietSince ?? clock
    if (clock - quietSince >= TOUR_REST && !tokens.some(token => token.state === 'draining') && lanes.every(lane => !lane.rewind)) restartTour()
  }

  function resumeTour () {
    sim.touring = true
    tourIndex = TOUR.length
    quietSince = null
  }

  function restartTour () {
    if (holders().length === 0 && waiting.length === 0) serial = 0
    tourClock = 0
    tourIndex = 0
    quietSince = null
    listeners.tour.forEach(listener => listener(clock))
  }

  function stepPawl (dt) {
    const dropping = gate.phase === 'load' && gate.loading.z > ESC.z - TOKEN.h
    const target = dropping ? 1 : 0
    pawl = calm() ? target : pawl + (target - pawl) * (1 - Math.exp(-dt / PAWL_TAU))
    if (Math.abs(pawl - target) < 1e-3) pawl = target
  }

  function step (dt) {
    clock += dt
    stepTour(dt)
    stepGate()
    lanes.forEach(stepLane)
    stepTokens(dt)
    stepPawl(dt)
    lanes.forEach(stepRewind)
  }

  function doing (token) {
    const lane = token.lane
    if (token.state === 'granted' || token.state === 'gate') return `#${token.id} → L${lane.spec.id}`
    return `#${token.id} L${lane.spec.id} ${PHASE_WORDS[lane.phase]}`
  }

  function readout () {
    const held = holders().sort((a, b) => a.id - b.id)
    const noting = note && clock < noteUntil
    const items = held.map(token => (noting && token === noteToken ? note : doing(token)))
    if (noting && !held.includes(noteToken)) items.push(note)
    const free = SLOTS - held.length
    return items.concat(free ? [`${free} free`] : [], [`${lock.awaiting()} awaiting`]).join(' · ')
  }

  const dieZ = lane => DIE.rest - (DIE.rest - DECK - TOKEN.h) * lane.ram

  const sim = {
    lock,
    tokens,
    history,
    lanes,
    touring,
    step,
    busy,
    readout,
    callLock,
    abortToken,
    abortNewest,
    resumeTour,
    dieZ,
    counterOf,
    onTourStart: listener => listeners.tour.push(listener),
    holders,
    get gate () { return gate },
    get gatePhase () { return gate.phase === 'move' ? (gate.carried ? 'carry' : 'fetch') : gate.phase },
    get gateToken () { return gate.loading || gate.carried || (gate.phase === 'move' ? pending[0] : null) },
    get pawl () { return pawl },
    get clock () { return clock },
    get waiting () { return waiting },
    get pending () { return pending }
  }
  return sim
}
