export function createSim ({ machine, createFairQueue, calm = () => false, touring = true, tourRest = 2.5 }) {
  const { TOKEN, DECK, SPAWN, KEYS, STATION, PRESS_ANGLE, HOME_ANGLE, R_COL, R_PAD, BLADE, DROP, DIE, TIMING, GRAVITY, MAX_WAITING, ABORT_SIDE, along, columnPoint, padPoint, indexSeconds, smoothEase } = machine

  const FADE_IN = 0.22
  const ABORT_TRAVEL = 40
  const ABORT_LAYER_AT = 20
  const ABORT_FALL_AT = TOKEN.r
  const NOTE_SECONDS = 2.2
  const TOUR = [[0.3, 'call', 'A'], [0.55, 'call', 'A'], [0.8, 'call', 'A'], [1.05, 'call', 'A'], [1.5, 'call', 'B'], [1.9, 'call', 'C'], [5, 'call', 'B'], [11, 'abort', 'A']]

  const queue = createFairQueue(1)
  const tokens = []
  const waiting = Object.fromEntries(KEYS.map(key => [key, []]))
  const blades = Object.fromEntries(KEYS.map(key => [key, { tip: BLADE.rest, backAt: null }]))
  const history = []
  const listeners = { tour: [] }
  let holder = null
  let serial = 0
  let uids = 0
  let stamps = 0
  let phase = 'idle'
  let phaseAt = 0
  let clock = 0
  let theta = HOME_ANGLE
  let turnFrom = HOME_ANGLE
  let turnTo = HOME_ANGLE
  let turnSeconds = 0
  let trap = 0
  let ram = 0
  let note = () => ''
  let noteUntil = 0
  let tourClock = 0
  let tourIndex = 0
  let quietSince = null

  const clamp01 = value => Math.min(1, Math.max(0, value))
  const smoothstep = (from, to, value) => {
    const t = clamp01((value - from) / (to - from))
    return t * t * (3 - 2 * t)
  }
  const ease = progress => (calm() ? (progress >= 1 ? 1 : 0) : smoothEase(progress))
  const inColumn = (token, key) => token.key === key && token.state === 'holding'
  const stackOf = key => (holder && inColumn(holder, key) ? [holder] : []).concat(waiting[key])
  const totalWaiting = () => KEYS.reduce((sum, key) => sum + waiting[key].length, 0)
  const placeRadial = token => {
    const [x, y] = along(STATION[token.key], token.radial)
    token.x = x
    token.y = y
  }

  function say (text) {
    note = typeof text === 'function' ? text : () => text
    noteUntil = clock + NOTE_SECONDS
  }

  function callQueue (key) {
    if (waiting[key].length >= MAX_WAITING) return say(`${key} full`)
    const below = stackOf(key)
    const top = below.length ? below[below.length - 1].z + TOKEN.h : SPAWN
    const [x, y] = columnPoint(key)
    const token = { uid: ++uids, id: ++serial, key, x, y, z: Math.max(SPAWN, top), vz: 0, radial: R_COL, alpha: calm() ? 1 : 0, state: 'waiting', layer: `col-${key}`, lit: false, controller: new AbortController() }
    tokens.push(token)
    waiting[key].push(token)
    queue(token.controller.signal, key).then(release => (release ? grant(token, release) : leave(token)))
    history.push(`#${token.id} ${key} calls queue(signal, '${key}')`)
    return token
  }

  function grant (token, release) {
    const line = waiting[token.key]
    line.splice(line.indexOf(token), 1)
    token.state = 'holding'
    token.release = release
    token.lit = true
    holder = token
    history.push(`#${token.id} ${token.key} is served`)
  }

  function leave (token) {
    const line = waiting[token.key]
    line.splice(line.indexOf(token), 1)
    token.state = 'aborting'
    token.leftAt = clock
    token.leftFrom = [token.x, token.y]
    history.push(`#${token.id} ${token.key} aborted`)
    say(`#${token.id} aborted`)
  }

  function abortToken (token) {
    token.controller.abort()
    if (token === holder) say(`#${token.id} abort ignored`)
  }

  function abortNewest (key) {
    const candidates = key ? waiting[key] : KEYS.flatMap(name => waiting[name])
    const token = candidates.reduce((newest, entry) => (!newest || entry.id > newest.id ? entry : newest), null)
    if (token) abortToken(token)
    else say(key ? `none in ${key}` : 'none waiting')
  }

  function setPhase (name) {
    phase = name
    phaseAt = clock
  }

  function startTurn (to, name) {
    turnFrom = theta
    turnTo = to
    turnSeconds = indexSeconds(theta, to)
    setPhase(name)
  }

  function turn (elapsed) {
    const progress = turnSeconds > 0 ? elapsed / turnSeconds : 1
    theta = turnFrom + (turnTo - turnFrom) * ease(progress)
    return progress >= 1
  }

  const settledOnDeck = token => token.z === DECK && token.vz === 0

  function stepMachine () {
    const elapsed = clock - phaseAt
    if (phase === 'idle') {
      if (holder && holder.state === 'holding') startTurn(STATION[holder.key], 'index')
    } else if (phase === 'index') {
      if (turn(elapsed) && settledOnDeck(holder)) setPhase('push')
    } else if (phase === 'push') {
      const progress = elapsed / TIMING.push
      const blade = blades[holder.key]
      blade.tip = BLADE.rest + (BLADE.out - BLADE.rest) * ease(progress)
      holder.radial = Math.min(holder.radial, blade.tip - TOKEN.r)
      placeRadial(holder)
      if (progress >= 1) {
        holder.state = 'carried'
        holder.layer = 'carry'
        blade.backAt = clock
        startTurn(PRESS_ANGLE, 'carry')
      }
    } else if (phase === 'carry') {
      const arrived = turn(elapsed)
      const [x, y] = padPoint(theta)
      holder.x = x
      holder.y = y
      if (arrived) {
        holder.radial = R_PAD
        setPhase('stamp')
      }
    } else if (phase === 'stamp') {
      const progress = clamp01(elapsed / TIMING.stamp)
      ram = calm() ? (progress < 1 ? 1 : 0) : smoothstep(0, 0.35, progress) * (1 - smoothstep(0.6, 1, progress))
      if (!holder.stamped && ram >= 0.999) {
        holder.stamped = true
        stamps++
      }
      if (progress >= 1) {
        ram = 0
        setPhase('drop')
      }
    } else if (phase === 'drop') {
      const progress = elapsed / TIMING.drop
      trap = calm() ? 1 : smoothstep(0, 0.35, progress)
      if (trap > 0.6 && holder.state !== 'off') drop(holder)
      if (progress >= 1) setPhase('retract')
    } else if (phase === 'retract') {
      const progress = elapsed / TIMING.retract
      trap = 1 - ease(progress)
      if (progress >= 1) {
        trap = 0
        releaseHolder()
        setPhase('idle')
      }
    }
  }

  function stepBlades () {
    for (const key of KEYS) {
      const blade = blades[key]
      if (blade.backAt === null) continue
      const progress = (clock - blade.backAt) / TIMING.bladeBack
      blade.tip = BLADE.out + (BLADE.rest - BLADE.out) * ease(progress)
      if (progress >= 1) {
        blade.tip = BLADE.rest
        blade.backAt = null
      }
    }
  }

  function releaseHolder () {
    const done = holder
    holder = null
    done.lit = false
    done.release()
    history.push(`#${done.id} ${done.key} released`)
  }

  function drop (token) {
    Object.assign(token, { state: 'off', vz: 0, layer: 'drop' })
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

  const bladeCovers = key => blades[key].tip < R_COL

  function stepColumn (key, dt) {
    const leaving = tokens.filter(token => token.key === key && token.state === 'aborting' && Math.hypot(token.x - token.leftFrom[0], token.y - token.leftFrom[1]) < TOKEN.r * 2)
    const column = stackOf(key).concat(leaving).sort((a, b) => a.z - b.z)
    column.forEach((token, index) => {
      if (token.state === 'aborting') return
      const own = token === holder ? DECK : (bladeCovers(key) ? DECK + TOKEN.h : DECK)
      const floor = index === 0 ? own : Math.max(own, column[index - 1].z + TOKEN.h)
      fall(token, floor, dt)
    })
  }

  function stepTokens (dt) {
    KEYS.forEach(key => stepColumn(key, dt))
    for (const token of [...tokens]) {
      token.alpha = Math.min(1, token.alpha + dt / FADE_IN)
      if (token.state === 'off') stepDrop(token, dt)
      if (token.state === 'aborting') stepAborting(token, dt)
    }
  }

  function stepDrop (token, dt) {
    fall(token, DROP.floor, dt)
    token.alpha = Math.min(token.alpha, clamp01((token.z - DROP.floor) / (DECK - DROP.floor)))
    if (token.z <= DROP.floor) remove(token)
  }

  function stepAborting (token, dt) {
    const progress = calm() ? 1 : clamp01((clock - token.leftAt) / TIMING.abort)
    const travel = ABORT_TRAVEL * smoothstep(0, 0.7, progress)
    const [sx, sy] = ABORT_SIDE[token.key]
    token.x = token.leftFrom[0] + sx * travel
    token.y = token.leftFrom[1] + sy * travel
    if (travel > ABORT_FALL_AT) fall(token, DECK, dt)
    token.alpha = Math.min(token.alpha, 1 - smoothstep(0.7, 1, progress))
    if (travel > ABORT_LAYER_AT) token.layer = 'aborting'
    if (progress >= 1) remove(token)
  }

  function settled (token) {
    if (token.alpha < 1 || token.vz !== 0 || token.state === 'aborting') return false
    if (token.state === 'off') return false
    return true
  }

  const bladesMoving = () => KEYS.some(key => blades[key].backAt !== null)
  const busy = () => phase !== 'idle' || holder !== null || totalWaiting() > 0 || bladesMoving() || !tokens.every(settled) || clock < noteUntil

  function stepTour (dt) {
    if (!sim.touring) return
    tourClock += dt
    while (tourIndex < TOUR.length && tourClock >= TOUR[tourIndex][0]) {
      const [, action, key] = TOUR[tourIndex++]
      if (action === 'call') callQueue(key)
      if (action === 'abort') abortNewest(key)
    }
    if (tourIndex < TOUR.length) return
    if (busy()) {
      quietSince = null
      return
    }
    quietSince = quietSince ?? clock
    if (clock - quietSince >= tourRest / 2 && !holder && totalWaiting() === 0) stamps = 0
    if (clock - quietSince >= tourRest) restartTour()
  }

  function resumeTour () {
    sim.touring = true
    tourIndex = TOUR.length
    quietSince = null
  }

  function restartTour () {
    if (!holder && totalWaiting() === 0) serial = 0
    tourClock = 0
    tourIndex = 0
    quietSince = null
    listeners.tour.forEach(listener => listener(clock))
  }

  function step (dt) {
    clock += dt
    stepTour(dt)
    stepMachine()
    stepBlades()
    stepTokens(dt)
  }

  function counts () {
    return KEYS.map(key => `${key} ${waiting[key].length}`).join(' · ')
  }

  function state () {
    if (!queue.isLocked()) return 'free'
    if (!holder) return 'handing over'
    if (phase === 'drop' || phase === 'retract') return `releasing ${holder.key}`
    return `serving ${holder.key}`
  }

  function readout () {
    const tail = clock < noteUntil ? ` · ${note()}` : ''
    return `${state()} · ${counts()} awaiting${tail}`
  }

  const sim = {
    queue,
    tokens,
    history,
    touring,
    step,
    busy,
    readout,
    callQueue,
    abortToken,
    abortNewest,
    resumeTour,
    onTourStart: listener => listeners.tour.push(listener),
    bladeTip: key => blades[key].tip,
    get theta () { return theta },
    get trap () { return trap },
    get dieZ () { return DIE.rest - (DIE.rest - DECK - TOKEN.h) * ram },
    get stamps () { return stamps },
    get counter () { return String(stamps % 1000).padStart(3, '0') },
    get clock () { return clock },
    get holder () { return holder },
    get waiting () { return waiting },
    get phase () { return phase }
  }
  return sim
}
