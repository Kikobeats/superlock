import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BANNER = pathToFileURL(join(HERE, 'banner.html')).href
const OUTPUT = join(HERE, '..', '..', 'static', 'og.png')

const WIDTH = 1200
const HEIGHT = 630
const RENDER_BUDGET_MS = 10000
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
]

const chrome = CHROME_CANDIDATES.find(path => path && existsSync(path))
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH')

execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1',
  `--window-size=${WIDTH},${HEIGHT}`,
  `--virtual-time-budget=${RENDER_BUDGET_MS}`,
  `--screenshot=${OUTPUT}`,
  BANNER
], { stdio: 'ignore' })

console.log(`wrote ${OUTPUT}`)
