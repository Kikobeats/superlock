const TOLERANCE = 0.12

const percent = (index, total) => `${+((index / total) * 100).toFixed(2)}%`

function fits (values, from, to, distance) {
  for (let index = from + 1; index < to; index++) {
    const share = (index - from) / (to - from)
    const error = values[index].reduce((worst, value, axis) => Math.max(worst, Math.abs(value - (values[from][axis] + (values[to][axis] - values[from][axis]) * share))), 0)
    if (error > distance) return false
  }
  return true
}

function simplify (values, distance) {
  const kept = [0]
  let from = 0
  while (from < values.length - 1) {
    let to = from + 1
    while (to + 1 < values.length && fits(values, from, to + 1, distance)) to++
    kept.push(to)
    from = to
  }
  return kept
}

export const translate = ([x, y]) => `transform:translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`
export const opacity = ([value]) => `opacity:${value.toFixed(3)}`

export function createKeyframes (seconds) {
  const rules = []
  const named = new Map()
  let serial = 0
  const ruleFor = body => {
    if (!named.has(body)) {
      const name = `w${(serial++).toString(36)}`
      named.set(body, name)
      rules.push(`@keyframes ${name}{${body}}`)
    }
    return named.get(body)
  }
  const motion = (values, css) => {
    const looped = [...values, values[0]]
    if (looped.every(value => value.every((entry, axis) => entry === looped[0][axis]))) return null
    const kept = simplify(looped, TOLERANCE)
    const name = ruleFor(kept.map(index => `${percent(index, values.length)}{${css(looped[index])}}`).join(''))
    return `${name} ${seconds.toFixed(3)}s linear infinite`
  }
  const steps = (flags, css) => {
    if (flags.every(flag => flag === flags[0])) return { always: flags[0] }
    const marks = [`0%{${css(flags[0])}}`]
    flags.forEach((flag, index) => {
      if (index > 0 && flag !== flags[index - 1]) marks.push(`${percent(index, flags.length)}{${css(flag)}}`)
    })
    marks.push(`100%{${css(flags[0])}}`)
    return { animation: `${ruleFor(marks.join(''))} ${seconds.toFixed(3)}s step-end infinite` }
  }
  return { rules, motion, steps }
}
