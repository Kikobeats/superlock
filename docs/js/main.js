const FIGURE = {
  light: 'docs/anatomy/mutex-light.html?embed',
  dark: 'docs/anatomy/mutex.html?embed',
  title:
    'superlock mutex: an interactive coin-feed escapement running createLock()'
}

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
const phone = window.matchMedia('(max-width: 768px)')
const HEADING_GAP = { phone: 78, desktop: 24 }
const figureSource = () => (darkScheme.matches ? FIGURE.dark : FIGURE.light)

function mountFigure (section) {
  const picture = section.querySelector('a > picture')
  if (!picture) return
  const frame = document.createElement('iframe')
  frame.className = 'figure'
  frame.title = FIGURE.title
  frame.src = figureSource()
  picture.parentElement.replaceWith(frame)
}

window.addEventListener('message', event => {
  const height = event.data && event.data.superlockFigureHeight
  if (!height) return
  const frame = document.querySelector('iframe.figure')
  if (frame && event.source === frame.contentWindow) { frame.style.height = `${height}px` }
})

darkScheme.addEventListener('change', () => {
  const frame = document.querySelector('iframe.figure')
  if (frame) frame.src = figureSource()
})

window.$docsify = {
  name: 'superlock',
  repo: 'Kikobeats/superlock',
  maxLevel: 3,
  auto2top: true,
  topMargin: phone.matches ? HEADING_GAP.phone : HEADING_GAP.desktop,
  noEmoji: true,
  externalLinkRel: 'noopener noreferrer',
  plugins: [
    function (hook) {
      hook.doneEach(function () {
        mountFigure(document.querySelector('.markdown-section'))
        window.codecopy('pre')
      })
    }
  ]
}
