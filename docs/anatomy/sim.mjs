export function createSim ({ machine, createLock, calm = () => false, touring = true }) {
  const { TOKEN, DECK, SPAWN, BIN_X, DIE, TIMING, GRAVITY, tipX, THETA_STATION, slotZ, MAX_WAITING, crankEase, BIN_FLOOR } = machine

  const FADE_IN = 0.22
  const ABORT_TRAVEL = 34
  const ABORT_LAYER_X = 14
  const PILE_LIMIT = 3
  const NOTE_SECONDS = 2.2
  const TOUR_REST = 2.5
  const TOUR = [[0.4, 'call'], [1.3, 'call'], [1.7, 'call'], [2.1, 'call'], [2.5, 'call'], [4.8, 'abort', 1]]
  const PILE_JITTER = [[-2.6, 1.8], [2.4, -1.4], [0.6, 2], [-1.8, -2]]
  const PHASE_WORDS = { push: 'carrying', stamp: 'in the press', eject: 'ejecting', retract: 'releasing' }

  const lock = createLock()
  const tokens = []
  const waiting = []
  const pile = []
  const history = []
  const listeners = { tour: [] }
  let holder = null
  let serial = 0
  let uids = 0
  let released = true
  let stamps = 0
  let phase = 'idle'
  let phaseAt = 0
  let clock = 0
  let theta = 0
  let ram = 0
  let note = ''
  let noteUntil = 0
  let tourClock = 0
  let tourIndex = 0
  let quietSince = null

  const clamp01 = value => Math.min(1, Math.max(0, value))
  const smoothstep = (from, to, value) => {
    const t = clamp01((value - from) / (to - from))
    return t * t * (3 - 2 * t)
  }
  const ease = progress => (calm() ? (progress >= 1 ? 1 : 0) : crankEase(progress))
  const atColumn = token => token.state === 'holding' && token.x === 0
  const columnOrder = () => (holder && atColumn(holder) ? [holder] : []).concat(waiting)

  function say (text) {
    note = text
    noteUntil = clock + NOTE_SECONDS
  }

  function callLock () {
    if (waiting.length >= MAX_WAITING) return say(`column full · ${lock.awaiting()} awaiting`)
    const below = columnOrder()
    const top = below.length ? below[below.length - 1].z + TOKEN.h : SPAWN
    const token = { uid: ++uids, id: ++serial, x: 0, y: 0, z: Math.max(SPAWN, top), vz: 0, alpha: calm() ? 1 : 0, state: 'waiting', layer: 'tokens', lit: false, controller: new AbortController() }
    tokens.push(token)
    waiting.push(token)
    lock(token.controller.signal).then(release => (release ? grant(token, release) : leave(token)))
    history.push(`#${token.id} calls lock()`)
    return token
  }

  function grant (token, release) {
    waiting.splice(waiting.indexOf(token), 1)
    token.state = 'holding'
    token.release = release
    token.lit = true
    holder = token
    history.push(`#${token.id} holds the lock`)
  }

  function leave (token) {
    waiting.splice(waiting.indexOf(token), 1)
    token.state = 'aborting'
    token.leftAt = clock
    token.leftX = token.x
    history.push(`#${token.id} aborted`)
    say(`#${token.id} aborted · lock(signal) resolved null`)
  }

  function abortToken (token) {
    token.controller.abort()
    if (token === holder) say(`#${token.id} already holds the lock · abort ignored`)
  }

  function abortNewest () {
    const token = waiting[waiting.length - 1]
    if (token) abortToken(token)
    else say('nobody is waiting')
  }

  function setPhase (name) {
    phase = name
    phaseAt = clock
  }

  function carry () {
    holder.x = Math.max(holder.x, tipX(theta) + TOKEN.r)
  }

  function stepMachine () {
    const elapsed = clock - phaseAt
    if (phase === 'idle') {
      if (holder && atColumn(holder) && holder.z === DECK && holder.vz === 0) setPhase('push')
    } else if (phase === 'push') {
      const progress = elapsed / TIMING.push
      theta = THETA_STATION * ease(progress)
      carry()
      if (progress >= 1) setPhase('stamp')
      released = false
    } else if (phase === 'stamp') {
      const progress = clamp01(elapsed / TIMING.stamp)
      ram = calm() ? (progress < 1 ? 1 : 0) : smoothstep(0, 0.35, progress) * (1 - smoothstep(0.6, 1, progress))
      if (!holder.stamped && ram >= 0.999) {
        holder.stamped = true
        stamps++
      }
      if (progress >= 1) {
        ram = 0
        setPhase('eject')
      }
    } else if (phase === 'eject') {
      const progress = elapsed / TIMING.eject
      theta = THETA_STATION + (Math.PI - THETA_STATION) * ease(progress)
      carry()
      if (progress >= 1) {
        sendToBin(holder)
        setPhase('retract')
      }
    } else if (phase === 'retract') {
      const progress = elapsed / TIMING.retract
      theta = Math.PI + Math.PI * ease(progress)
      if (!released && (tipX(theta) <= 0 || progress >= 1)) releaseHolder()
      if (progress >= 1) {
        theta = 0
        setPhase('idle')
      }
    }
  }

  function releaseHolder () {
    const done = holder
    released = true
    holder = null
    done.lit = false
    done.release()
    history.push(`#${done.id} released`)
  }

  function sendToBin (token) {
    const [dx, dy] = PILE_JITTER[stamps % PILE_JITTER.length]
    Object.assign(token, { state: 'off', offAt: clock, offX: token.x, binX: BIN_X + dx, binY: dy, vz: 0, layer: 'bin' })
    pile.push(token)
    if (pile.length > PILE_LIMIT) remove(pile.shift())
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

  function stepTokens (dt) {
    const leaving = tokens.filter(token => token.state === 'aborting' && token.x - token.leftX < TOKEN.r * 2)
    const column = columnOrder().concat(leaving).sort((a, b) => a.z - b.z)
    column.forEach((token, index) => {
      if (token.state === 'aborting') return
      const own = token === holder ? DECK : slotZ(waiting.indexOf(token))
      const floor = index === 0 ? own : Math.max(own, column[index - 1].z + TOKEN.h)
      fall(token, floor, dt)
    })
    for (const token of [...tokens]) {
      token.alpha = Math.min(1, token.alpha + dt / FADE_IN)
      if (token.state === 'off') stepOff(token, dt)
      if (token.state === 'aborting') stepAborting(token)
    }
  }

  function stepOff (token, dt) {
    const progress = calm() ? 1 : clamp01((clock - token.offAt) / TIMING.slide)
    const glide = 1 - (1 - progress) ** 2
    token.x = token.offX + (token.binX - token.offX) * glide
    token.y = token.binY * glide
    if (progress < 1) return
    fall(token, BIN_FLOOR + TOKEN.h * pile.indexOf(token), dt)
  }

  function stepAborting (token) {
    const progress = calm() ? 1 : clamp01((clock - token.leftAt) / TIMING.abort)
    token.x = token.leftX + ABORT_TRAVEL * progress * progress
    token.alpha = Math.min(token.alpha, 1 - smoothstep(0.25, 1, progress))
    if (token.x > ABORT_LAYER_X) token.layer = 'aborting'
    if (progress >= 1) remove(token)
  }

  function settled (token) {
    if (token.alpha < 1 || token.vz !== 0 || token.state === 'aborting') return false
    if (token.state === 'off') return clock - token.offAt >= TIMING.slide && token.z === BIN_FLOOR + TOKEN.h * pile.indexOf(token)
    return true
  }

  const busy = () => phase !== 'idle' || holder !== null || waiting.length > 0 || !tokens.every(settled) || clock < noteUntil

  function stepTour (dt) {
    if (!sim.touring) return
    tourClock += dt
    while (tourIndex < TOUR.length && tourClock >= TOUR[tourIndex][0]) {
      const [, action, index] = TOUR[tourIndex++]
      if (action === 'call') callLock()
      if (action === 'abort' && waiting[index]) abortToken(waiting[index])
    }
    if (tourIndex < TOUR.length) return
    if (busy()) {
      quietSince = null
      return
    }
    quietSince = quietSince ?? clock
    if (clock - quietSince >= TOUR_REST) restartTour()
  }

  function resumeTour () {
    sim.touring = true
    tourIndex = TOUR.length
    quietSince = null
  }

  function restartTour () {
    if (!holder && waiting.length === 0) serial = 0
    tourClock = 0
    tourIndex = 0
    quietSince = null
    listeners.tour.forEach(listener => listener(clock))
  }

  function step (dt) {
    clock += dt
    stepTour(dt)
    stepMachine()
    stepTokens(dt)
  }

  function readout () {
    if (note && clock < noteUntil) return note
    const awaiting = lock.awaiting()
    if (!lock.isLocked()) return `free · ${awaiting} awaiting`
    if (!holder) return `locked · handing over · ${awaiting} awaiting`
    const carrying = !released || phase === 'idle'
    const doing = carrying && PHASE_WORDS[phase] ? ` (${PHASE_WORDS[phase]})` : ''
    return `locked by #${holder.id}${doing} · ${awaiting} awaiting`
  }

  const sim = {
    lock,
    tokens,
    history,
    touring,
    step,
    busy,
    readout,
    callLock,
    abortToken,
    abortNewest,
    resumeTour,
    onTourStart: listener => listeners.tour.push(listener),
    get theta () { return theta },
    get dieZ () { return DIE.rest - (DIE.rest - DECK - TOKEN.h) * ram },
    get stamps () { return stamps },
    get clock () { return clock },
    get holder () { return holder },
    get waiting () { return waiting },
    get phase () { return phase }
  }
  return sim
}
