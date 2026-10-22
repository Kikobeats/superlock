# Mutex figure

`mutex.html` is the interactive figure: click to call `lock()`, click a waiting token to abort its signal. `mutex.svg` and `mutex-light.svg` are the same machine baked into a looping CSS animation for the project README, which cannot run scripts.

Both run superlock's own `src/create.js`. The page inlines it; the SVGs are recorded from it in Node, frame by frame.

| File | Role |
|---|---|
| `machine.mjs` | Sizes, timings and crank kinematics |
| `sim.mjs` | The model: tokens, the crank cycle, the idle tour and a real `createLock()` |
| `drawing.mjs` | The crank arm and connecting rod, redrawn for any crank angle |
| `live.mjs` | The page: draws the model, handles pointer and keys |
| `readme.mjs` | Records one tour loop and writes it as an animated SVG |
| `build.mjs` | Static geometry, then all four outputs |

Rebuild after changing any of them, or `src/`:

```sh
node docs/anatomy/build.mjs
```

The build uses the anatomy isometric kit from `~/.claude/skills/anatomy`; set `ANATOMY_HOME` to point elsewhere.
