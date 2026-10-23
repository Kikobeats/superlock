import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUTPUT = process.env.OG_OUTPUT || join(ROOT, 'static', 'og.png')
const WORDMARK = join(ROOT, 'docs', 'anatomy', 'wordmark-light.svg')
const { description, homepage } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const WIDTH = 1200
const HEIGHT = 630
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
]

const chrome = CHROME_CANDIDATES.find(path => path && existsSync(path))
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH')

const frozenWordmark = readFileSync(WORDMARK, 'utf8').replace(
  '</style>',
  '*{animation:none!important}</style>'
)

const tagline = description.replace(/\.$/, '')
const domain = new URL(homepage).host

const card = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;600&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    background: #f2f2ef;
    color: #18181a;
    font-family: 'IBM Plex Sans', sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 28px;
    padding-bottom: 16px;
    box-sizing: border-box;
  }
  .wordmark svg { width: 820px; height: auto; display: block; }
  .tagline { font-size: 34px; line-height: 1.3; text-align: center; max-width: 960px; text-wrap: balance; color: #3a3a3d; letter-spacing: -0.01em; }
  .footer { display: flex; gap: 28px; align-items: center; font-family: 'IBM Plex Mono', monospace; font-size: 24px; color: #6e6e72; }
  .install { background: #fbfbfa; border: 1px solid #d6d6d2; border-radius: 10px; padding: 10px 18px; color: #18181a; }
</style></head>
<body>
  <div class="wordmark">${frozenWordmark}</div>
  <div class="tagline">${tagline}</div>
  <div class="footer"><span class="install">npm install superlock</span><span>${domain}</span></div>
</body></html>`

const workdir = mkdtempSync(join(tmpdir(), 'superlock-og-'))
const page = join(workdir, 'card.html')
writeFileSync(page, card)

try {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${WIDTH},${HEIGHT}`,
    '--virtual-time-budget=5000',
    `--screenshot=${OUTPUT}`,
    `file://${page}`
  ], { stdio: 'ignore' })
} finally {
  rmSync(workdir, { recursive: true, force: true })
}

console.log(`wrote ${OUTPUT}`)
