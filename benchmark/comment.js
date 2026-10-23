'use strict'

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')

const readJson = path => JSON.parse(readFileSync(path, 'utf8'))

const fromHistory = path => {
  const data = readJson(path)
  const suites = (data.entries && data.entries.superlock) || []
  const current = suites[suites.length - 1]
  if (!current) return { current }
  const previous = suites
    .slice()
    .reverse()
    .find(suite => suite.commit.id !== current.commit.id)
  return { current, previous }
}

const fromPair = (headPath, basePath) => ({
  current: {
    commit: { id: process.env.HEAD_SHA || '' },
    benches: readJson(headPath)
  },
  previous: {
    commit: { id: process.env.BASE_SHA || '' },
    benches: readJson(basePath)
  }
})

const loaded = process.argv[3]
  ? fromPair(process.argv[2], process.argv[3])
  : fromHistory(process.argv[2] || 'cache/benchmark-data.json')
const current = loaded.current
const previous = loaded.previous

if (!current) {
  console.error('no benchmark result')
  process.exit(0)
}

const bounds = bench => {
  if (!bench || !bench.range) return null
  const [min, max] = bench.range.split('-').map(Number)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return [min, max]
}

const faster = (now, before) => {
  if (!before || !now) return ''
  const left = bounds(now)
  const right = bounds(before)
  const overlap = left && right && left[1] >= right[0] && right[1] >= left[0]
  if (overlap) return '0%'
  const percent = Math.round((before.value / now.value - 1) * 100)
  return `${percent}%`
}

const repo = process.env.GITHUB_REPOSITORY
const server = process.env.GITHUB_SERVER_URL || 'https://github.com'

const commitLink = commit => {
  if (!commit || !commit.id) return ''
  const short = commit.id.slice(0, 7)
  if (!repo) return short
  return `[${short}](${server}/${repo}/commit/${commit.id})`
}

const cell = bench => {
  if (!bench) return ''
  const range = bench.range ? ` (\`${bench.range}\`)` : ''
  return `\`${bench.value}\` ${bench.unit}${range}`
}

const lines = [
  '<!-- superlock-benchmark -->',
  '# superlock',
  '',
  `| Benchmark | Current: ${commitLink(
    current.commit
  )} | Previous: ${commitLink(previous && previous.commit)} | Faster |`,
  '|-|-|-|-|'
]

for (const bench of current.benches) {
  const prev =
    previous && previous.benches.find(item => item.name === bench.name)
  const shown = faster(bench, prev)
  lines.push(
    `| \`${bench.name}\` | ${cell(bench)} | ${cell(prev)} | ${
      shown ? `\`${shown}\`` : ''
    } |`
  )
}

const body = lines.join('\n') + '\n'
const pr = process.env.PR_NUMBER

if (!pr) {
  process.stdout.write(body)
  process.exit(0)
}

const gh = (args, input) =>
  execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    input
  })

const comments = JSON.parse(
  gh([`repos/${repo}/issues/${pr}/comments?per_page=100`])
)
const marker = '<!-- superlock-benchmark -->'
const existing = comments.filter(comment => {
  const login = comment.user && comment.user.login
  return (
    login === 'github-actions[bot]' &&
    comment.body.includes('superlock') &&
    (comment.body.includes(marker) || comment.body.includes('<details>'))
  )
})
const latest = existing[existing.length - 1]
const payload = JSON.stringify({ body })

if (latest) {
  gh(
    [
      '--method',
      'PATCH',
      `repos/${repo}/issues/comments/${latest.id}`,
      '--input',
      '-'
    ],
    payload
  )
} else {
  gh(
    ['--method', 'POST', `repos/${repo}/issues/${pr}/comments`, '--input', '-'],
    payload
  )
}
