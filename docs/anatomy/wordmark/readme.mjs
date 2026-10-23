import { createKeyframes, translate, opacity } from './keyframes.mjs'

export const FPS = 60
const MAX_SECONDS = 240

const settle = () => new Promise(resolve => setImmediate(resolve))

export async function recordLoop ({ createSim, machine, createLock }) {
  const sim = createSim({ machine, createLock, demo: true })
  const starts = []
  sim.onDemoStart(() => starts.push(sim.clock))
  const frames = []
  while (starts.length < 2) {
    sim.step(1 / FPS)
    await settle()
    if (starts.length === 1) frames.push(sim.frame())
    if (sim.clock > MAX_SECONDS) throw new Error('the demo never came back to its start')
  }
  return frames
}

export function stillOf (frames) {
  const wanted = (frame, index) => Math.max(...frame.level) >= 0.999 && Math.max(...frame.rise) >= 0.999 && Math.max(...frame.dip) <= 0.001 && index > 0 && frames[index - 1].x === frame.x && frames[index - 1].bolt === frame.bolt
  const first = frames.findIndex(wanted)
  let last = first
  while (last + 1 < frames.length && wanted(frames[last + 1], last + 1)) last++
  return Math.round((first + last) / 2) / FPS
}

export function readmeMotion ({ frames, poseOf, screen }) {
  const keys = createKeyframes(frames.length / FPS)
  const poses = frames.map(poseOf)
  return {
    rules: keys.rules,
    seconds: frames.length / FPS,
    move (name, markup) {
      const animation = keys.motion(poses.map(pose => screen(pose.moves[name])), translate)
      return `<g${animation ? ` style="animation:${animation}"` : ''}>${markup}</g>`
    },
    swap (name, render) {
      const labels = poses.map(pose => pose.labels[name])
      return [...new Set(labels)].filter(Boolean).map(label => {
        const result = keys.steps(labels.map(value => value === label), flag => `visibility:${flag ? 'visible' : 'hidden'}`)
        if ('always' in result) return result.always ? render(label) : ''
        return `<g style="visibility:hidden;animation:${result.animation}">${render(label)}</g>`
      }).join('')
    },
    fade (name, markup) {
      const values = poses.map(pose => [pose.fades[name]])
      if (values.every(([value]) => value === 0)) return ''
      const animation = keys.motion(values, opacity)
      return `<g style="opacity:0${animation ? `;animation:${animation}` : ''}">${markup}</g>`
    }
  }
}

export const liveMotion = {
  swap: (name, render) => `<g data-label="${name}">${render('')}</g>`,
  move: (name, markup) => `<g data-part="${name}">${markup}</g>`,
  fade: (name, markup) => `<g data-part="${name}" style="opacity:0">${markup}</g>`
}
