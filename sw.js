/* Gildem v2.0: offline shell ONLY. Never cache market data. */
const CACHE = 'gildem-shell-v300';
const SHELL = ["/", "/index.html", "/styles.css", "/manifest.webmanifest", "/src/batch-calculator.js", "/src/demand-signals.js", "/src/top-filters.js", "/src/economics.js", "/src/orderbook.js", "/src/plan-advisor.js", "/src/plan-log.js", "/src/branch-reference.js", "/src/branches.js", "/src/main.js", "/src/market-intelligence.js", "/src/market.js", "/src/planner-transfer.js", "/src/planner.js", "/src/engine-v3.js", "/src/optimizer.js", "/src/refining-engine.js", "/src/refining-data.js", "/src/refine-page.js", "/src/market-trends.js", "/src/recipe-extractor.js", "/src/refining.js", "/assets/branding/gildem-crest.webp", "/assets/fonts/rajdhani-latin-600-normal.woff2", "/assets/fonts/rajdhani-latin-700-normal.woff2", "/assets/branding/gildem-sidebar-logo.webp", "/assets/pwa-icon-192.png", "/assets/pwa-icon-512.png", "/assets/scenes/craft-cal.webp", "/assets/scenes/forge.webp", "/assets/scenes/planning.webp", "/assets/scenes/royal-market.webp", "/assets/scenes/top-market.webp", "/assets/tabs/craft-cal.svg", "/assets/tabs/craft-planner.svg", "/assets/tabs/top-market.svg", "/assets/tabs/refine-tab.svg"];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gildem-shell-')&&k!==CACHE).map(k=>caches.delete(k)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch', event => {
 const request = event.request;
 if(request.method !== 'GET') return;
 const url = new URL(request.url);
 // Market API and external game/catalog sources are ALWAYS network-only.
 if(url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/netlify/')) return;
 // Network-first allows GitHub/Netlify updates. Offline fallback covers only HTML shell.
 if(request.mode === 'navigate'){
  event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
  return;
 }
 if(!SHELL.includes(url.pathname)) return;
 event.respondWith(fetch(request).then(response => {
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}
  return response;
 }).catch(() => caches.match(request)));
});
