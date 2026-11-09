const CACHE_NAME='jangid-cricinfo-shell-v2';
const SHELL=[
 './','./index.html','./control.html','./control.css','./theme.css','./control-workflow.css','./tournament-manager.css',
 './scorelayer.html','./scorelayer.css','./scorelayer-v6.css','./scorelayer-v7.css','./scorelayer-compact-pattern.css',
 './scorelayer-studio.css','./scorelayer-overlays-v446.css','./scorelayer-v4_4_11-fixes.css','./scorelayer-card-layout-v4414.css',
 './scorelayer.js','./control.js','./scoring-engine.js','./tournament-manager.js','./theme.js',
 './firebase-api-loader.js','./firebase-ready.js','./offline-store.js','./mobile-scoring-v2.css','./scorelayer-new-events.css',
 './firebase/firebase-api-bridge.mjs'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await Promise.all(SHELL.map(async path=>{try{await cache.add(path)}catch(_){}}));await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim()})());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.includes('/api/')||url.pathname.endsWith('/events'))return;
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE_NAME);
   if(request.mode==='navigate'){
     try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}
     catch(_){return (await cache.match(request))||(await cache.match('./control.html'))||(await cache.match('./'))||Response.error();}
   }
   const cached=await cache.match(request);
   if(cached)return cached;
   try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}
   catch(_){return Response.error();}
 })());
});
