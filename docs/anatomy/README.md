# Figures

Three interactive figures, one per way to use superlock, plus the wordmark at the top of the README. Each one runs the library's own code: the page inlines it, and the README SVGs are recorded from it in Node, frame by frame.

| Figure | Machine | Runs | Sources | Outputs |
|---|---|---|---|---|
| Fig 1, mutex | A coin-feed escapement: one column, one pusher blade, one press | `src/create.js`, `createLock()` | `docs/anatomy/*.mjs` | `mutex.html`, `mutex-light.html`, `mutex.svg`, `mutex-light.svg` |
| Fig 2, semaphore | The same escapement with two lanes fed by a shuttle under one column | `src/create.js`, `createLock(2)` | `docs/anatomy/semaphore/` | `semaphore*.html`, `semaphore*.svg` |
| Fig 3, fair queue | An indexing table: one column per key around a dial that feeds one press | `src/fair.js`, `createFairQueue()` | `docs/anatomy/fair-queue/` | `fair-queue*.html`, `fair-queue*.svg` |
| Wordmark | The word on a plate: click a letter to queue it, one carriage serves the queue and toggles each letter | `src/create.js`, `createLock()` | `docs/anatomy/wordmark/` | `wordmark*.html`, `wordmark*.svg` |

The `.html` pages are interactive: click to call, click a waiting token to abort its signal. The `.svg` files are the same machines baked into a looping CSS animation for the project README, which cannot run scripts. The `-light` files are the light theme.

Add `?embed` to any page to drop its margins, card and background; it then reports its height to the parent with `postMessage({ superlockFigureHeight })`. The docs site (`index.html` at the repo root) uses this to show each live figure in place of its README image.

The mutex, semaphore, and fair queue are split the same way. The wordmark uses those roles except `drawing.mjs`: `letters.mjs` builds the glyphs and `prism.mjs` extrudes them.

| File | Role |
|---|---|
| `machine.mjs` | Sizes, timings and kinematics |
| `sim.mjs` | The model: tokens, the machine cycle, the idle tour and the real lock |
| `drawing.mjs` | Moving parts redrawn for any pose |
| `live.mjs` | The page: draws the model, handles pointer and keys |
| `readme.mjs` | Records one tour loop and writes it as an animated SVG |
| `build.mjs` | Static geometry, then all four outputs |

Rebuild after changing any of them, or `src/`:

```sh
node docs/anatomy/build.mjs
node docs/anatomy/semaphore/build.mjs
node docs/anatomy/fair-queue/build.mjs
node docs/anatomy/wordmark/build.mjs
```

The wordmark build also writes `static/favicon.svg`: the "s" alone, lit, on a dark tile.

The social card at `static/og.png` is a screenshot of `docs/og/banner.html`, which shows the dark wordmark at rest and the README tagline. `static/apple-touch-icon.png` is a 180px screenshot of the favicon through `docs/og/touch-icon.html`. Rebuild both after the wordmark changes:

```sh
npm run og
```

It renders with headless Chrome; set `CHROME_PATH` if Chrome is not in the default location.

The builds use the anatomy isometric kit from `~/.claude/skills/anatomy`; set `ANATOMY_HOME` to point elsewhere.
