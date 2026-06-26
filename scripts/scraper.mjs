import fs from 'fs';
import path from 'path';
import { load } from 'cheerio';

const BASE = 'https://iiadil.framer.website';
const OUT = 'public';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'fr,en;q=0.9',
};

async function fetchPage(pagePath) {
  const url = BASE + pagePath;
  console.log('Fetching:', url);
  const res = await fetch(url, { headers: HEADERS });
  console.log('Status:', res.status, url);
  if (!res.ok) return null;
  return await res.text();
}

function extractFramerRoutes(html) {
  const routes = new Set(['/']);
  // Framer embeds routes as "path":"..." in JS bundles
  const patterns = [
    /"path":"(\/[^"]*?)"/g,
    /"href":"(\/[^"]*?)"/g,
    /href="(\/[^"#?][^"]*?)"/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      const p = m[1];
      if (!p.includes('.') || p.endsWith('/')) routes.add(p.replace(/\/$/, '') || '/');
    }
  }
  return [...routes];
}

fs.mkdirSync(OUT, { recursive: true });

// Step 1: fetch index to discover all routes
const indexHtml = await fetchPage('/');
if (!indexHtml) { console.error('Cannot fetch homepage'); process.exit(1); }

fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);
console.log('Saved: public/index.html');

const routes = extractFramerRoutes(indexHtml);
console.log('Routes found:', routes);

// Step 2: fetch each discovered route
const visited = new Set(['/']);
for (const route of routes) {
  if (visited.has(route)) continue;
  visited.add(route);
  try {
    const html = await fetchPage(route);
    if (!html) continue;
    const outFile = path.join(OUT, route, 'index.html');
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html);
    console.log('Saved:', outFile, html.length, 'bytes');
    // Discover more routes from this page
    const moreRoutes = extractFramerRoutes(html);
    for (const r of moreRoutes) {
      if (!visited.has(r)) routes.push(r);
    }
  } catch(e) { console.error('ERROR:', e.message); }
}

console.log('Done. Total pages scraped:', visited.size);
