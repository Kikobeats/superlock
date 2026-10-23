import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const RENDER_BUDGET_MS = 5000
const PAGE_TIMEOUT_MS = 30000
const PROCESS_TIMEOUT_MS = 45000
const TOUCH_ICON_SIZE = 180
const MIN_OG_BYTES = 20000
// Pausing at 0% holds the recorded idle frame. animation:none drops keyframe
// transforms and leaves the carriage and bolt in a pose the sim never draws.
const PAUSE = '*{animation-delay:0s!important;animation-play-state:paused!important}'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
]

const chrome = CHROME_CANDIDATES.find(path => path && existsSync(path))
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH')

const escapeHtml = text => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char])

const prepareBanner = html => {
  const wordmark = readFileSync(join(HERE, '..', 'anatomy', 'wordmark.svg'), 'utf8')
  if (!wordmark.includes('</style>')) throw new Error('wordmark svg has no style')
  const frozen = wordmark.replace('</style>', `${PAUSE}</style>`)
  const subtitle = readFileSync(join(ROOT, 'README.md'), 'utf8').match(/class="subtitle">([^<]+)</)
  if (!subtitle) throw new Error('README is missing the subtitle')
  const inlined = html.replace(/<object\b[\s\S]*?<\/object>/, frozen)
  if (inlined === html) throw new Error('banner is missing the wordmark')
  return inlined
    .replace('id="subtitle"></p>', `id="subtitle">${escapeHtml(subtitle[1])}</p>`)
    .replace(/<script>[\s\S]*<\/script>\s*/, '')
}

const shoot = (url, output, width, height) => {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--timeout=${PAGE_TIMEOUT_MS}`,
    `--virtual-time-budget=${RENDER_BUDGET_MS}`,
    `--screenshot=${output}`,
    url
  ], { stdio: 'ignore', timeout: PROCESS_TIMEOUT_MS })
  console.log(`wrote ${output}`)
}

const dir = mkdtempSync(join(tmpdir(), 'superlock-og-'))
const og = join(ROOT, 'static', 'og.png')
try {
  const file = join(dir, 'banner.html')
  writeFileSync(file, prepareBanner(readFileSync(join(HERE, 'banner.html'), 'utf8')))
  shoot(pathToFileURL(file).href, og, 1200, 630)
  shoot(
    pathToFileURL(join(HERE, 'touch-icon.html')).href,
    join(ROOT, 'static', 'apple-touch-icon.png'),
    TOUCH_ICON_SIZE,
    TOUCH_ICON_SIZE
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}

if (statSync(og).size < MIN_OG_BYTES) {
  throw new Error(`${og} is too small to include the wordmark`)
}
