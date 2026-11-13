/* 離線備援：有網路時永遠拿最新的，沒網路時用上次存的。改版時把 v 加一。 */
const C='trip-v33';
const SHELL=['./','index.html','styles.css','app.js','boot.js','sky.js','vendor/suncalc.js','planner.js','manifest.webmanifest','trip.sealed.json','trip.js','fonts/num-500.woff2','fonts/num-600.woff2','icons/icon-192.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{});return res}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
});
