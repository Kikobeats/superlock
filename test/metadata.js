'use strict'

const { readFileSync, statSync } = require('node:fs')
const { join } = require('node:path')
const test = require('ava')

const ROOT = join(__dirname, '..')
const read = file => readFileSync(join(ROOT, file), 'utf8')

const { description, homepage } = JSON.parse(read('package.json'))
const html = read('index.html')

const OG_IMAGE_PATH = 'static/og.png'
const OG_IMAGE_URL = new URL(OG_IMAGE_PATH, homepage).href
const OG_IMAGE_SIZE = { width: 1200, height: 630 }
const OG_IMAGE_MAX_BYTES = 300 * 1024

const meta = attribute => {
  const tags = [...html.matchAll(/<meta\s[^>]*>/g)].map(([tag]) => tag)
  const values = tags
    .filter(tag => tag.includes(`"${attribute}"`))
    .map(tag => tag.match(/content="([^"]*)"/)[1])
  if (values.length !== 1) {
    throw new Error(`expected one ${attribute}, found ${values.length}`)
  }
  return values[0]
}

const jsonLd = () =>
  JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]
  )

const pngSize = file => {
  const buffer = readFileSync(join(ROOT, file))
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

test('every description tag matches package.json', t => {
  t.is(meta('description'), description)
  t.is(meta('og:description'), description)
  t.is(meta('twitter:description'), description)
  t.is(jsonLd().description, description)
})

test('canonical and og:url point at the package homepage', t => {
  t.is(html.match(/<link rel="canonical" href="([^"]*)"/)[1], homepage)
  t.is(meta('og:url'), homepage)
  t.is(jsonLd().url, homepage)
})

test('the social image is served from the homepage and matches its declared size', t => {
  t.is(meta('og:image'), OG_IMAGE_URL)
  t.is(meta('twitter:image'), OG_IMAGE_URL)
  t.is(jsonLd().image, OG_IMAGE_URL)
  t.deepEqual(pngSize(OG_IMAGE_PATH), OG_IMAGE_SIZE)
  t.is(Number(meta('og:image:width')), OG_IMAGE_SIZE.width)
  t.is(Number(meta('og:image:height')), OG_IMAGE_SIZE.height)
  t.true(statSync(join(ROOT, OG_IMAGE_PATH)).size < OG_IMAGE_MAX_BYTES)
})

test('no tag points at a host other than the homepage', t => {
  const { host } = new URL(homepage)
  const urls = [...html.matchAll(/content="(https?:\/\/[^"]*)"/g)].map(
    ([, url]) => new URL(url)
  )
  t.true(urls.length > 0)
  for (const url of urls) t.is(url.host, host)
})

test('robots.txt and sitemap.xml point at the homepage', t => {
  t.true(
    read('robots.txt').includes(
      `Sitemap: ${new URL('sitemap.xml', homepage).href}`
    )
  )
  t.true(read('sitemap.xml').includes(`<loc>${homepage}</loc>`))
})

test('the favicon and touch icon are linked and exist', t => {
  const href = rel =>
    html.match(new RegExp(`<link rel="${rel}" href="([^"?]*)`))[1]
  t.is(href('icon'), 'static/favicon.svg')
  t.true(read(href('icon')).startsWith('<svg'))
  t.deepEqual(pngSize(href('apple-touch-icon')), { width: 180, height: 180 })
})

test('the social image alt quotes the README tagline', t => {
  const tagline = read('README.md').match(/class="subtitle">([^<]+)</)[1]
  t.true(meta('og:image:alt').includes(`&quot;${tagline}&quot;`))
  t.true(meta('twitter:image:alt').includes(`&quot;${tagline}&quot;`))
})
