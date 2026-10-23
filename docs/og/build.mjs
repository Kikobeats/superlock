import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const RENDER_BUDGET_MS = 5000
const TOUCH_ICON_SIZE = 180

const SHOTS = [
  { source: join(HERE, 'banner.html'), output: join(ROOT, 'static', 'og.png'), width: 1200, height: 630 },
  { source: join(HERE, 'touch-icon.html'), output: join(ROOT, 'static', 'apple-touch-icon.png'), width: TOUCH_ICON_SIZE, height: TOUCH_ICON_SIZE }
]

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
]

const chrome = CHROME_CANDIDATES.find(path => path && existsSync(path))
if (!chrome) throw new Error('Chrome not found: set CHROME_PATH')

for (const { source, output, width, height } of SHOTS) {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--virtual-time-budget=${RENDER_BUDGET_MS}`,
    `--screenshot=${output}`,
    pathToFileURL(source).href
  ], { stdio: 'ignore' })
  console.log(`wrote ${output}`)
}
