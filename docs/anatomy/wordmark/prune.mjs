const ROOT_CLASSES = ['iso', 'iso-svg']

function blocksOf (css) {
  const blocks = []
  let depth = 0
  let start = 0
  for (let index = 0; index < css.length; index++) {
    if (css[index] === '{') depth++
    if (css[index] === '}' && --depth === 0) {
      blocks.push(css.slice(start, index + 1).trim())
      start = index + 1
    }
  }
  return blocks.filter(Boolean)
}

const classesIn = markup => new Set([...ROOT_CLASSES, ...[...markup.matchAll(/class="([^"]*)"/g)].flatMap(match => match[1].split(/\s+/))])

function usable (selector, classes, markup) {
  if (/\b(html|body)\b/.test(selector)) return false
  const needed = [...selector.matchAll(/\.([\w-]+)/g)].map(match => match[1])
  const attributes = [...selector.matchAll(/\[(data-[\w-]+)/g)].map(match => match[1])
  return needed.every(name => classes.has(name)) && attributes.every(name => markup.includes(name))
}

function pruneBlock (block, classes, markup) {
  const open = block.indexOf('{')
  const head = block.slice(0, open).trim()
  const inner = block.slice(open + 1, -1)
  if (head.startsWith('@keyframes')) return markup.includes(head.slice(10).trim()) ? block : ''
  if (head.startsWith('@media')) {
    const kept = blocksOf(inner).map(child => pruneBlock(child, classes, markup)).join('')
    return kept ? `${head}{${kept}}` : ''
  }
  const selectors = head.split(',').map(entry => entry.trim()).filter(selector => usable(selector, classes, markup))
  return selectors.length ? `${selectors.join(',')}{${inner.trim()}}` : ''
}

export function pruneCss (css, markup) {
  const classes = classesIn(markup)
  return blocksOf(css).map(block => pruneBlock(block, classes, markup)).join('').replace(/\s*\n\s*/g, '').replace(/\s*([{};:,])\s*/g, '$1')
}
