import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://iiadil.framer.website'
const OUT_DIR  = 'public'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

function save(route, html) {
  const dir = route === '/' ? OUT_DIR : join(OUT_DIR, ...route.replace(/^\//, '').split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), html, 'utf8')
  console.log('saved ' + route)
}

function extractRoutes(bundleJs) {
  const routes = new Set(['/'])
  for (const m of bundleJs.matchAll(/"path"\s*:\s*"(\/[^"]+?)"/g)) {
    const p = m[1]
    if (p.startsWith('/:') || p.includes('*') || p === '/__framer__') continue
    routes.add(p)
  }
  return [...routes]
}

function extractBundleUrls(indexHtml) {
  const urls = []
  for (const m of indexHtml.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/g)) {
    let src = m[1]
    if (!src.startsWith('http')) src = src.startsWith('//') ? 'https:' + src : BASE_URL + src
    urls.push(src)
  }
  return urls
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  console.log('Fetching index.html...')
  const indexHtml = await fetchText(BASE_URL + '/')
  save('/', indexHtml)

  const bundleUrls = extractBundleUrls(indexHtml)
  console.log('Found ' + bundleUrls.length + ' JS bundles. Scanning for routes...')

  let routes = ['/']
  for (const url of bundleUrls) {
    try {
      const js = await fetchText(url)
      const found = extractRoutes(js)
      if (found.length > 1) {
        routes = found
        console.log('Routes: ' + found.join(', '))
        break
      }
    } catch (e) {
      console.warn('Skip bundle: ' + e.message)
    }
  }

  for (const route of routes) {
    if (route === '/') continue
    try {
      const html = await fetchText(BASE_URL + route)
      save(route, html)
    } catch (e) {
      console.warn('Skip ' + route + ': ' + e.message)
    }
  }
  console.log('Done - ' + routes.length + ' pages.')
}

main().catch(e => { console.error(e); process.exit(1) })
