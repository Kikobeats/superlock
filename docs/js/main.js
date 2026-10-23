const FIGURE_IMAGE = /docs\/anatomy\/([\w-]+?)-light\.svg$/

const darkScheme = window.matchMedia('(prefers-color-scheme: dark)')
const phone = window.matchMedia('(max-width: 768px)')
const HEADING_GAP = { phone: 78, desktop: 24 }

const figureSource = name =>
  `docs/anatomy/${name}${darkScheme.matches ? '' : '-light'}.html?embed`

const figureFrames = () => [...document.querySelectorAll('iframe.figure')]

function mountFigures (section) {
  for (const picture of section.querySelectorAll('a > picture')) {
    const image = picture.querySelector('img')
    const match = image && image.getAttribute('src').match(FIGURE_IMAGE)
    if (!match) continue
    const frame = document.createElement('iframe')
    frame.className = 'figure'
    frame.dataset.figure = match[1]
    frame.title = image.alt
    frame.src = figureSource(match[1])
    picture.parentElement.replaceWith(frame)
  }
}

window.addEventListener('message', event => {
  const height = event.data && event.data.superlockFigureHeight
  if (!height) return
  const frame = figureFrames().find(
    frame => frame.contentWindow === event.source
  )
  if (frame) frame.style.height = `${height}px`
})

darkScheme.addEventListener('change', () => {
  for (const frame of figureFrames()) {
    frame.src = figureSource(frame.dataset.figure)
  }
})

window.$docsify = {
  name: '<picture><source media="(prefers-color-scheme: dark)" srcset="static/logo.svg"><img alt="superlock" src="static/logo-light.svg"></picture>',
  repo: 'Kikobeats/superlock',
  maxLevel: 3,
  auto2top: true,
  topMargin: phone.matches ? HEADING_GAP.phone : HEADING_GAP.desktop,
  noEmoji: true,
  externalLinkRel: 'noopener noreferrer',
  plugins: [
    function (hook) {
      hook.doneEach(function () {
        mountFigures(document.querySelector('.markdown-section'))
        window.codecopy('pre')
      })
    }
  ]
}
