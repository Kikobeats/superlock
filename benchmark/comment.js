'use strict'

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')

const dataPath = process.argv[2] || 'cache/benchmark-data.json'
const data = JSON.parse(readFileSync(dataPath, 'utf8'))
const suites = (data.entries && data.entries.superlock) || []
const current = suites[suites.length - 1]

if (!current) {
  console.error('no benchmark result')
  process.exit(0)
}

const previous = suites
  .slice()
  .reverse()
  .find(suite => suite.commit.id !== current.commit.id)

const speed = (now, before) => {
  if (!before || !now) return ''
  return (before / now).toFixed(2)
}

const repo = process.env.GITHUB_REPOSITORY
const server = process.env.GITHUB_SERVER_URL || 'https://github.com'

const commitLink = commit => {
  if (!commit) return ''
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
  'Speed is the previous time divided by this time. `1.00` is the same speed. `1.20` is 20% faster.',
  '',
  `| Benchmark | Current: ${commitLink(
    current.commit
  )} | Previous: ${commitLink(previous && previous.commit)} | Speed |`,
  '|-|-|-|-|'
]

for (const bench of current.benches) {
  const prev =
    previous && previous.benches.find(item => item.name === bench.name)
  const shown = speed(bench.value, prev && prev.value)
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
