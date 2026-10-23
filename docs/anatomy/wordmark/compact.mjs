const TOKEN = /([MLZ])|(-?\d*\.?\d+)/g

const tenths = value => Math.round(value * 10)

const number = tenth => {
  const text = (tenth / 10).toString()
  return text.replace(/^(-?)0\./, '$1.')
}

const joined = values => values.reduce((out, text, index) => out + (index && !text.startsWith('-') ? ' ' : '') + text, '')

export function compactPath (d) {
  const tokens = [...d.matchAll(TOKEN)].map(match => match[1] || Number(match[2]))
  let out = ''
  let command = null
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let index = 0
  let previous = ''
  while (index < tokens.length) {
    const token = tokens[index]
    if (token === 'Z') {
      out += 'z'
      x = startX
      y = startY
      previous = 'z'
      index++
      continue
    }
    if (typeof token === 'string') {
      command = token
      index++
      continue
    }
    const nx = tenths(tokens[index])
    const ny = tenths(tokens[index + 1])
    index += 2
    const pair = joined([number(nx - x), number(ny - y)])
    if (command === 'M') {
      out += 'm' + pair
      startX = nx
      startY = ny
      previous = 'm'
      command = 'L'
    } else {
      out += (previous === 'm' || previous === 'l' ? (pair.startsWith('-') ? '' : ' ') : 'l') + pair
      previous = 'l'
    }
    x = nx
    y = ny
  }
  return out
}

export const compactSvg = svg => svg.replace(/ d="([^"]*)"/g, (_, d) => ` d="${/^[MLZ\d.\s-]*$/.test(d) ? compactPath(d) : d}"`)
