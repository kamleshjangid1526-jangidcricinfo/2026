/* Static asset cache for offline scoring sessions. API writes are handled by firebase-api-loader.js. */
const JC_CACHE='jangid-cricinfo-static-v34';
const JC_ASSETS=[
  './','./index.html','./control.html','./scorelayer.html','./scoreboard.html','./jangid-cricinfo.html',
  './firebase-api-loader.js','./firebase-api-loader.js?v=5.1.3','./control.js?v=5.1.10','./firebase/firebase-api-bridge.mjs?v=5.0.8','./scoring-engine.js?v=4.4.21','./mobile-scoring-v2.css?v=5.0.4','./offline-store.js','./offline-store.js?v=5.0.1','./offline-status-ui.js','./offline-status-ui.js?v=5.1.4','./scorelayer.js?v=8.1.1','./scorelayer-broadcast-v2.css?v=9.0.1','./scorelayer-obs-fixes.css','./scorelayer-obs-fixes.css?v=5.1.3','./mobile-scoring-v2.css?v=5.0.2','./event-animation-themes.js','./mobile-scoring-v2.css','./event-animation-themes.css','./scorelayer-broadcast-v2.css','./broadcast-ui-fixes.css','./broadcast-ui-fixes.css?v=5.0.1',
  './theme.js','./theme.css','./control.js','./scoring-engine.js','./tournament-manager.js',
  './control.css','./control-workflow.css','./tournament-manager.css','./mobile-scoring-v2.css',
  './event-animation-themes.css','./scorelayer.js','./scorelayer.css','./scorelayer-v6.css','./scorelayer-v7.css',
  './scorelayer-designer.css','./scorelayer-compact-pattern.css','./scorelayer-studio.css','./scorelayer-text-only.css','./scorelayer-overlays-v446.css',
  './scorelayer-v4_4_11-fixes.css','./scorelayer-card-layout-v4414.css','./scorelayer-broadcast-v2.css',
  './firebase/firebase-api-bridge.mjs','./firebase/firebase-config.js','./firebase/firebase-init.mjs',
  'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js','https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js','https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js',
  './scoreboard.css','./scoreboard.js','./jangid.css','./jangid.js',
  './assets/demo/india-flag.svg','./assets/demo/pakistan-flag.svg',
  './assets/stickers/bat-ball-sticker.png','./assets/stickers/batter-sticker.png','./assets/stickers/bowler-sticker.png',
  './assets/stickers/celebration-sticker.png','./assets/stickers/umpire-out-sticker.png'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(JC_CACHE);await Promise.all(JC_ASSETS.map(async path=>{try{await cache.add(new Request(new URL(path,self.registration.scope),{cache:'reload'}));}catch{}}));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('jangid-cricinfo-static-')&&k!==JC_CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));

/* Best-effort Background Sync: ask an open authenticated Control Board tab to flush its IndexedDB queue. */
self.addEventListener('sync',event=>{
  if(event.tag!=='jangid-cricinfo-pending-sync-v1')return;
  event.waitUntil((async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(!clients.length)throw new Error('No open scoring client is available; retry when the app is active.');
    const client=clients.find(item=>{try{return new URL(item.url).pathname.endsWith('/control.html');}catch{return false;}});if(!client)throw new Error('Control Board tab is not open; pending scores will sync when it is opened.');
    const synced=await new Promise(resolve=>{
      const channel=new MessageChannel();let settled=false;
      const done=value=>{if(settled)return;settled=true;try{channel.port1.close();}catch{}resolve(!!value);};
      channel.port1.onmessage=message=>done(message.data?.ok===true);
      setTimeout(()=>done(false),20000);
      try{client.postMessage({type:'JC_BACKGROUND_SYNC_REQUEST'},[channel.port2]);}catch{done(false);}
    });
    if(!synced)throw new Error('Background sync did not finish; browser may retry.');
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin===self.location.origin&&(url.pathname.includes('/api/')||url.pathname.endsWith('/events')))return;
  const firebaseCdn=url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/');
  const sameOrigin=url.origin===self.location.origin&&url.pathname.startsWith(new URL(self.registration.scope).pathname);
  if(!firebaseCdn&&!sameOrigin)return;
  event.respondWith((async()=>{const cache=await caches.open(JC_CACHE),cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response&&response.ok&&(response.type==='basic'||response.type==='cors'))await cache.put(request,response.clone());return response;}catch(error){if(cached)return cached;throw error;}})());
});