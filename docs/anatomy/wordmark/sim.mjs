export function createSim ({ machine, createLock, calm = () => false, demo = false }) {
  const { stations, park, letters: chars, TIMING, DEMO } = machine

  const lock = createLock()
  const listeners = { demo: [] }
  const history = []
  const waiting = []
  const letters = chars.map((char, index) => ({ index, char, state: 'idle', on: false, served: false, controller: null, release: null }))
  const byChar = new Map(letters.map(letter => [letter.char, letter]))
  let holder = null
  let clock = 0
  let phase = 'idle'
  let phaseAt = 0
  let demoClock = 0
  let demoIndex = 0
  let demoStarted = false
  let quietSince = null

  const clamp01 = value => Math.min(1, Math.max(0, value))
  const ease = progress => (1 - Math.cos(Math.PI * clamp01(progress))) / 2
  const tween = value => ({ from: value, to: value, start: 0, duration: 0, value })
  const carriage = tween(park)
  const bolt = tween(0)
  const shackle = tween(0)
  const level = letters.map(() => tween(0))
  const dip = letters.map(() => tween(0))
  const rise = letters.map(() => tween(0))
  const flag = letters.map(() => tween(0))
  const nudge = letters.map(() => tween(0))
  const tweens = [carriage, bolt, shackle, ...level, ...dip, ...rise, ...flag, ...nudge]
  let ranks = letters.map(() => -1)

  function aim (target, to, duration) {
    if (target.to === to) return
    target.from = target.value
    target.to = to
    target.start = clock
    target.duration = calm() ? 0 : duration
  }

  function advance (target) {
    const progress = target.duration ? (clock - target.start) / target.duration : 1
    target.value = progress >= 1 ? target.to : target.from + (target.to - target.from) * ease(progress)
  }

  const settled = target => target.value === target.to
  const spent = name => clock - phaseAt >= (calm() && name !== 'hold' ? 0 : TIMING[name])

  function callLock (letter) {
    if (letter.state !== 'idle') return letter
    letter.state = 'waiting'
    letter.controller = new AbortController()
    waiting.push(letter)
    history.push(`${letter.char} calls lock()`)
    lock(letter.controller.signal).then(release => (release ? grant(letter, release) : leave(letter)))
    return letter
  }

  function grant (letter, release) {
    waiting.splice(waiting.indexOf(letter), 1)
    letter.state = 'holding'
    letter.release = release
    holder = letter
    history.push(`${letter.char} holds the lock`)
  }

  function leave (letter) {
    waiting.splice(waiting.indexOf(letter), 1)
    letter.state = 'idle'
    letter.controller = null
    history.push(`${letter.char} aborted`)
    shake(letter)
  }

  function shake (letter) {
    const target = nudge[letter.index]
    Object.assign(target, { value: 1, from: 1, to: 1 })
    aim(target, 0, TIMING.nudge)
  }

  function press (index) {
    const letter = letters[index]
    if (letter.state === 'idle') return callLock(letter)
    if (letter.state === 'waiting') return letter.controller.abort()
    history.push(`${letter.char} is being served · ignored`)
    shake(letter)
    return 'ignored'
  }

  function setPhase (name) {
    phase = name
    phaseAt = clock
  }

  function travelTime (from, to) {
    return Math.abs(to - from) < 1e-9 ? 0 : TIMING.travel + Math.abs(to - from) / TIMING.speed
  }

  function releaseHolder () {
    const done = holder
    holder = null
    done.state = 'idle'
    done.served = false
    done.controller = null
    history.push(`${done.char} released`)
    done.release()
  }

  function stepMachine () {
    if (phase === 'idle') {
      if (!holder) return
      aim(carriage, stations[holder.index], travelTime(carriage.value, stations[holder.index]))
      setPhase('travel')
    } else if (phase === 'travel') {
      if (!settled(carriage)) return
      setPhase('boltIn')
      aim(bolt, 1, TIMING.bolt)
      aim(dip[holder.index], 1, TIMING.bolt)
      holder.served = true
    } else if (phase === 'boltIn') {
      if (!spent('bolt')) return
      holder.on = !holder.on
      history.push(`${holder.char} toggled ${holder.on ? 'on' : 'off'}`)
      aim(level[holder.index], holder.on ? 1 : 0, TIMING.light)
      setPhase('hold')
    } else if (phase === 'hold') {
      if (!spent('hold')) return
      setPhase('boltOut')
      aim(bolt, 0, TIMING.bolt)
      aim(dip[holder.index], 0, TIMING.bolt)
    } else if (phase === 'boltOut') {
      if (!spent('bolt')) return
      releaseHolder()
      setPhase('idle')
    } else if (phase === 'park') {
      if (settled(carriage)) setPhase('idle')
    }
  }

  const STEPS = [1, 0.72, 0.48, 0.3]

  function stepLetters () {
    const line = (holder && !holder.served ? [holder] : []).concat(waiting)
    ranks = letters.map(letter => line.indexOf(letter))
    letters.forEach((letter, index) => {
      const rank = ranks[index]
      const height = rank < 0 ? 0 : STEPS[Math.min(rank, STEPS.length - 1)]
      aim(rise[index], height, TIMING.rise)
      aim(flag[index], height, TIMING.flag)
    })
    aim(shackle, lock.isLocked() ? 1 : 0, TIMING.shackle)
  }

  const quiet = () => !holder && waiting.length === 0 && phase === 'idle'
  const still = () => quiet() && tweens.every(settled)

  function startDemo () {
    demoStarted = true
    demoClock = 0
    demoIndex = 0
    quietSince = null
    listeners.demo.forEach(listener => listener(clock))
  }

  function stepDemo (dt) {
    if (!demo) return
    if (!demoStarted) return startDemo()
    demoClock += dt
    while (demoIndex < DEMO.length && demoClock >= DEMO[demoIndex][0]) {
      const [, action, char] = DEMO[demoIndex++]
      const letter = byChar.get(char)
      if (action === 'call') callLock(letter)
      if (action === 'abort' && letter.state === 'waiting') letter.controller.abort()
    }
    if (demoIndex < DEMO.length || !quiet()) {
      quietSince = null
      return
    }
    if (carriage.to !== park) {
      aim(carriage, park, travelTime(carriage.value, park))
      setPhase('park')
      return
    }
    if (!still()) return
    quietSince = quietSince ?? clock
    if (clock - quietSince >= TIMING.rest) startDemo()
  }

  function step (dt) {
    clock += dt
    stepDemo(dt)
    stepMachine()
    stepLetters()
    tweens.forEach(advance)
  }

  const frame = () => ({
    x: carriage.value,
    bolt: bolt.value,
    shackle: shackle.value,
    level: level.map(entry => entry.value),
    dip: dip.map(entry => entry.value),
    rise: rise.map(entry => entry.value),
    flag: flag.map(entry => entry.value),
    nudge: nudge.map(entry => entry.value),
    rank: [...ranks]
  })

  return {
    lock,
    letters,
    history,
    step,
    frame,
    press,
    busy: () => !still(),
    onDemoStart: listener => listeners.demo.push(listener),
    get clock () { return clock },
    get phase () { return phase },
    get holder () { return holder },
    get waiting () { return waiting },
    status () {
      const on = letters.filter(letter => letter.on).map(letter => letter.char)
      const owner = holder || (lock.isLocked() ? waiting[0] : null)
      const rest = waiting.filter(letter => letter !== owner)
      return [
        owner && `${owner.char} holds the lock`,
        rest.length && `${rest.map(letter => letter.char).join(', ')} waiting`,
        on.length && `on: ${on.join(' ')}`
      ].filter(Boolean).join(' · ')
    }
  }
}
