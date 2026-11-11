/* Jangid Cricinfo API bridge with durable local-first match and broadcast syncing. */
(() => {
  const nativeFetch=window.fetch.bind(window),store=window.JangidOfflineStore;
  let resolveBridge,rejectBridge;
  const ready=new Promise((resolve,reject)=>{resolveBridge=resolve;rejectBridge=reject;});
  window.__JC_FIREBASE_BRIDGE_READY__=ready;window.__JC_FIREBASE_BRIDGE_RESOLVE__=resolveBridge;window.__JC_FIREBASE_BRIDGE_REJECT__=rejectBridge;
  window.__JC_FIREBASE_EVENTS__=new Set();window.__JC_LAST_PUBLIC_PAYLOAD__=null;window.__JC_FIREBASE_INIT_ERROR__=null;
  let cachedState=null,activeUid='',syncing=false,channel=null,syncRetryTimer=null,syncFailureCount=0,syncStatusTimer=null;
  const BG_SYNC_TAG='jangid-cricinfo-pending-sync-v1';
  function requestBackgroundSync(){
    if(!('serviceWorker' in navigator))return;
    void navigator.serviceWorker.ready.then(registration=>{
      if(registration.sync?.register)return registration.sync.register(BG_SYNC_TAG);
      return null;
    }).catch(error=>console.debug('Background Sync unavailable; foreground retry remains active.',error));
  }
  navigator.serviceWorker?.addEventListener('message',event=>{
    if(event.data?.type!=='JC_BACKGROUND_SYNC_REQUEST')return;
    const port=event.ports?.[0];
    void syncNow().then(ok=>{try{port?.postMessage({ok:!!ok});}catch{}if(!ok)requestBackgroundSync();}).catch(error=>{try{port?.postMessage({ok:false,error:String(error?.message||error)});}catch{}});
  });

  try{channel=new BroadcastChannel('jangid-cricinfo-local-live-v1');}catch{}
  const clone=x=>store?.clone?store.clone(x):JSON.parse(JSON.stringify(x??null));
  const uidOf=s=>String(s?.user?.id||s?.user?.uid||s?.user?.userId||'');
  const AUTH_SESSION_KEY='jc-auth-session-uid';
  function markVerifiedSession(state){const uid=uidOf(state);if(!uid)return;try{sessionStorage.setItem(AUTH_SESSION_KEY,uid);}catch{}}
  function hasVerifiedSession(state){const uid=uidOf(state);try{return !!uid&&sessionStorage.getItem(AUTH_SESSION_KEY)===uid;}catch{return false;}}
  const key=(uid,type,id)=>'queue:'+uid+':'+type+(id?':'+id:'');
  const isNetworkError=e=>!navigator.onLine||e?.name==='TypeError'||['unavailable','network-request-failed'].includes(e?.code)||/network|offline|failed to fetch|connection|timed out/i.test(String(e?.message||''));
  const localStatus=(state,detail='')=>{const d={state,detail,online:navigator.onLine,pending:0,updatedAt:new Date().toISOString()};window.dispatchEvent(new CustomEvent('jc-offline-status',{detail:d}));try{channel?.postMessage({type:'status',state,detail});}catch{}return d;};
  async function records(prefix){return store?.all?store.all(prefix):[];}
  async function saveState(state){if(!state?.user)return;cachedState=clone(state);activeUid=uidOf(state);if(store){await store.put('state:last',cachedState);if(activeUid)await store.put('state:'+activeUid,cachedState);}}
  async function readState(){if(cachedState)return clone(cachedState);if(!store)return null;const last=await store.get('state:last');if(last?.user){cachedState=last;activeUid=uidOf(last);return clone(last);}return null;}
  async function withPending(state){
    if(!state?.user)return state;
    const uid=uidOf(state),pending=await records('queue:'+uid+':match:');
    for(const entry of pending){const match=entry.value?.match;if(!match?.id)continue;state.matches=Array.isArray(state.matches)?state.matches:[];const ix=state.matches.findIndex(x=>String(x.id)===String(match.id));if(ix>=0)state.matches[ix]=clone(match);else state.matches.push(clone(match));if(match.status==='live')state.activeMatch=clone(match);state.savedLiveMatches=(state.savedLiveMatches||[]).filter(x=>String(x.id)!==String(match.id));if(match.status==='live')state.savedLiveMatches.push(clone(match));}
    if(!state.activeMatch&&state.savedLiveMatches?.length)state.activeMatch=clone(state.savedLiveMatches.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0]);
    const broadcasts=await records('queue:'+uid+':broadcast');if(broadcasts.length)state.broadcast={...(state.broadcast||{}),...(broadcasts[broadcasts.length-1].value?.payload||{})};
    return state;
  }
  function emitPublic(payload){window.__JC_LAST_PUBLIC_PAYLOAD__=payload;const event={data:JSON.stringify(payload)};for(const source of window.__JC_FIREBASE_EVENTS__){try{source.onmessage?.(event);}catch(error){console.error(error);}try{source.dispatchEvent?.(new MessageEvent('message',{data:event.data}));}catch{}}try{channel?.postMessage({publicPayload:payload});}catch{}}
  if(channel)channel.addEventListener('message',event=>{const p=event.data;if(p?.type==='status'){window.dispatchEvent(new CustomEvent('jc-offline-status',{detail:{state:p.state,detail:p.detail,online:navigator.onLine}}));return;}if(p?.publicPayload){window.__JC_LAST_PUBLIC_PAYLOAD__=p.publicPayload;const e={data:JSON.stringify(p.publicPayload)};for(const source of window.__JC_FIREBASE_EVENTS__){try{source.onmessage?.(e);}catch{}try{source.dispatchEvent?.(new MessageEvent('message',{data:e.data}));}catch{}}}});
  window.__JC_EMIT_PUBLIC__=emitPublic;
  function publicPayload(match,broadcast){const state=cachedState||{},matches=[...(state.matches||[])];if(match){const ix=matches.findIndex(x=>String(x.id)===String(match.id));if(ix>=0)matches[ix]=clone(match);else matches.push(clone(match));}const broadcasts={...(state.broadcasts||{})};if(broadcast&&activeUid)broadcasts[activeUid]=clone(broadcast);return {activeMatches:matches.filter(x=>x.status==='live'),matches,tournaments:state.tournaments||[],broadcasts,changedCollection:'local-offline'};}
  async function apiRequest(url,init={}){const bridge=await ready;return bridge.handleApi(url,init);}
  function toResponse(result){return new Response(JSON.stringify(result.body??{}),{status:result.status??200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
  function localFinish(match,body){const finished=clone(match||{}),type=['winner','tie','no-result'].includes(body.resultType)?body.resultType:'winner';if(type==='winner'){if(![String(finished.teamA),String(finished.teamB)].includes(String(body.winnerTeamId)))throw new Error('Winner Team चुनें।');finished.winnerTeamId=String(body.winnerTeamId);finished.resultType='winner';finished.result=(finished.winnerTeamId===String(finished.teamA)?(finished.teamAName||'Team A'):(finished.teamBName||'Team B'))+' won';}else{finished.winnerTeamId=null;finished.resultType=type;finished.result=type==='tie'?'Match tied':'No Result';}finished.status='finished';finished.completedAt=new Date().toISOString();finished.updatedAt=finished.completedAt;return finished;}
  async function cacheMatch(match){if(!match?.id)throw new Error('Match snapshot में ID नहीं है।');const uid=activeUid||uidOf(cachedState);if(!uid)throw new Error('इस डिवाइस पर पिछला Login डेटा नहीं मिला। एक बार internet पर Login करके Match खोलें।');const stamp=new Date().toISOString(),snapshot=clone({...match,updatedAt:match.updatedAt||stamp,offlineUpdatedAt:stamp}),queueKey=key(uid,'match',snapshot.id);await store?.put(queueKey,{match:snapshot,version:snapshot.offlineUpdatedAt});if(cachedState){cachedState.matches||=[];const ix=cachedState.matches.findIndex(x=>String(x.id)===String(snapshot.id));if(ix>=0)cachedState.matches[ix]=clone(snapshot);else cachedState.matches.push(clone(snapshot));cachedState.activeMatch=snapshot.status==='live'?clone(snapshot):null;cachedState.savedLiveMatches=(cachedState.savedLiveMatches||[]).filter(x=>String(x.id)!==String(snapshot.id));if(snapshot.status==='live')cachedState.savedLiveMatches.push(clone(snapshot));await saveState(cachedState);}emitPublic(publicPayload(snapshot,cachedState?.broadcast));return {uid,queueKey,snapshot};}
  async function cacheBroadcast(payload){const uid=activeUid||uidOf(cachedState);if(!uid)throw new Error('पहले online Login करें, फिर offline graphics सेव हो सकेंगी।');const queueKey=key(uid,'broadcast'),version=String(payload.eventId||Date.now());await store?.put(queueKey,{payload:clone(payload),version});if(cachedState){cachedState.broadcast={...(cachedState.broadcast||{}),...clone(payload)};await saveState(cachedState);}emitPublic(publicPayload(cachedState?.activeMatch,cachedState?.broadcast));return {uid,queueKey,version};}
  function scheduleSync(delay=120){if(!navigator.onLine)return;if(syncRetryTimer)clearTimeout(syncRetryTimer);syncRetryTimer=setTimeout(()=>{syncRetryTimer=null;if(syncing){scheduleSync(180);return;}void syncNow();},Math.max(50,Number(delay)||120));}
  async function syncNow(){
    if(syncing||!navigator.onLine)return false;syncing=true;let rerunSync=false;clearTimeout(syncStatusTimer);syncStatusTimer=setTimeout(()=>{if(syncing)localStatus('syncing','स्कोर device पर सुरक्षित है; Firebase में background upload चल रहा है।');},700);
    try{
      const state=await readState(),uid=activeUid||uidOf(state);if(!uid){localStatus('offline','Login करें; saved offline data इस device पर सुरक्षित है।');return false;}
      const matchRows=await records('queue:'+uid+':match:');
      const finishRows=await records('queue:'+uid+':finish:');
      const broadcastRow=await store?.get(key(uid,'broadcast'));
      if(!matchRows.length&&!finishRows.length&&!broadcastRow){localStatus('synced','कोई pending बदलाव नहीं है।');return true;}
      for(const row of matchRows){
        const queued=await store?.get(row.key);
        if(!queued)continue;
        if(queued.version!==row.value?.version){rerunSync=true;continue;}
        const match=queued.value?.match;if(!match?.id)continue;
        const result=await apiRequest(new URL('/api/match/state',location.href),{method:'POST',body:JSON.stringify({match})});
        if((result.status||200)>=400)throw Object.assign(new Error(result.body?.error||'Match sync failed'),{code:result.body?.code});
        const latest=await store?.get(row.key);
        if(latest?.version===queued.version)await store?.remove(row.key);
        else rerunSync=true;
      }
      for(const row of finishRows){
        const result=await apiRequest(new URL('/api/match/finish',location.href),{method:'POST',body:JSON.stringify(row.value.body||{})});
        if((result.status||200)>=400)throw new Error(result.body?.error||'Match finish sync failed');
        await store?.remove(row.key);await store?.remove(key(uid,'match',String(row.key).split(':').pop()));
      }
      if(broadcastRow){const result=await apiRequest(new URL('/api/broadcast',location.href),{method:'POST',body:JSON.stringify(broadcastRow.payload)});if((result.status||200)>=400)throw new Error(result.body?.error||'Broadcast save failed');const latest=await store?.get(key(uid,'broadcast'));if(latest?.version===broadcastRow.version)await store?.remove(key(uid,'broadcast'));}
      const pending=(await records('queue:'+uid+':')).length;rerunSync=pending>0;syncFailureCount=0;localStatus(pending?'syncing':'synced',pending?pending+' बदलाव Sync के लिए queue में हैं।':'सभी बदलाव Firebase से Sync हो गए।');return pending===0;
    }catch(error){syncFailureCount=Math.min(6,syncFailureCount+1);const detail=String(error?.message||'Sync अभी पूरा नहीं हुआ; फिर प्रयास होगा।');localStatus('error',detail);console.error('Jangid Firebase background sync failed:',error);return false;}
    finally{syncing=false;clearTimeout(syncStatusTimer);syncStatusTimer=null;if(rerunSync&&navigator.onLine)scheduleSync(180);}
  }
  window.JangidOfflineSync={syncNow,getStatus:()=>({online:navigator.onLine,userId:activeUid}),getCachedState:readState};
  window.fetch=async(input,init={})=>{
    let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch{return nativeFetch(input,init);}
    if(url.pathname==='/events')return new Response('Jangid local + Firebase realtime channel active.',{status:200,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
    const method=String(init.method||'GET').toUpperCase(),body=(()=>{try{return init.body?JSON.parse(init.body):{};}catch{return {};}})();
    try{
      if(url.pathname==='/api/state'&&method==='GET'){
        try{const result=await apiRequest(url,init);if((result.status||200)<400&&result.body?.user){markVerifiedSession(result.body);await saveState(result.body);const merged=await withPending(clone(result.body));await saveState(merged);const pending=activeUid?(await records('queue:'+activeUid+':')).length:0;localStatus(pending?'pending':'synced',pending?pending+' pending items.':'Firebase connected.');return toResponse({status:200,body:merged});}return toResponse(result);}
        catch(error){if(!isNetworkError(error))throw error;const saved=await readState();if(!saved||!hasVerifiedSession(saved))throw error;const merged=await withPending(saved);localStatus('offline','Offline mode · पिछला Match और Teams डेटा लोड हुआ।');return toResponse({status:200,body:{...merged,firebaseConnection:'offline',offlineMode:true}});}
      }
      const publicMatchPath=url.pathname.match(/^\/api\/public\/match\/([^/]+)$/);
      if(publicMatchPath&&method==='GET'){
        const matchCacheKey='public:match:'+decodeURIComponent(publicMatchPath[1]);
        try{const result=await apiRequest(url,init);if((result.status||200)<400)await store?.put(matchCacheKey,result.body||{});return toResponse(result);}
        catch(error){if(!isNetworkError(error))throw error;const cached=await store?.get(matchCacheKey);if(!cached)throw error;localStatus('offline','इस Scoreboard का पिछला Match snapshot दिखाया जा रहा है।');return toResponse({status:200,body:{...cached,offlineMode:true}});}
      }
      if(url.pathname==='/api/public'&&method==='GET'){
        try{const result=await apiRequest(url,init);if((result.status||200)<400)await store?.put('public:last',result.body||{});return toResponse(result);}
        catch(error){if(!isNetworkError(error))throw error;const cached=await store?.get('public:last');if(!cached)throw error;localStatus('offline','Public page last saved copy दिखा रहा है।');return toResponse({status:200,body:{...cached,offlineMode:true}});}
      }
      if(url.pathname==='/api/match/state'&&method==='POST'){
        const saved=await cacheMatch(body.match);
        localStatus(navigator.onLine?'syncing':'offline',navigator.onLine?'स्कोर device पर सुरक्षित है; Firebase background में upload हो रहा है।':'स्कोर device पर सुरक्षित है; internet आने पर Sync होगा।');
        requestBackgroundSync();
        if(navigator.onLine)scheduleSync(100);
        return toResponse({status:200,body:{ok:true,queued:true,localFirst:true,match:saved.snapshot}});
      }
      if(url.pathname==='/api/match/finish'&&method==='POST'){
        const uid=activeUid||uidOf(cachedState),match=(cachedState?.matches||[]).find(x=>String(x.id)===String(body.matchId))||cachedState?.activeMatch;if(!uid||!match)throw new Error('Offline Finish के लिए Match की saved copy नहीं मिली।');
        const finished=localFinish(match,body);await store?.put(key(uid,'finish',finished.id),{body:clone(body),version:finished.completedAt});
        if(cachedState){cachedState.matches||=[];const ix=cachedState.matches.findIndex(x=>String(x.id)===String(finished.id));if(ix>=0)cachedState.matches[ix]=finished;else cachedState.matches.push(finished);cachedState.activeMatch=null;cachedState.savedLiveMatches=(cachedState.savedLiveMatches||[]).filter(x=>String(x.id)!==String(finished.id));await saveState(cachedState);}
        emitPublic(publicPayload(finished,cachedState?.broadcast));
        try{const result=await apiRequest(url,init);if((result.status||200)>=400)throw Object.assign(new Error(result.body?.error||'Finish failed'),{status:result.status,code:result.body?.code});await store?.remove(key(uid,'finish',finished.id));await store?.remove(key(uid,'match',finished.id));localStatus('synced','Match result Firebase में सेव हुआ।');return toResponse(result);}
        catch(error){if(!isNetworkError(error))throw error;requestBackgroundSync();localStatus('pending','Match result offline सेव है; internet आने पर Sync होगा।');return toResponse({status:200,body:{ok:true,offline:true,queued:true,match:finished}});}
      }
      if(url.pathname==='/api/broadcast'&&method==='POST'){
        await cacheBroadcast(body);
        localStatus(navigator.onLine?'saved':'offline',navigator.onLine?'Broadcast graphics device पर सेव हैं; Firebase background में upload होंगी।':'Broadcast graphics device पर सेव हैं; reconnect पर Sync होंगी।');
        requestBackgroundSync();
        if(navigator.onLine)scheduleSync(100);
        return toResponse({status:200,body:{ok:true,queued:true,localFirst:true}});
      }
      if((url.pathname==='/api/login'||url.pathname==='/api/admin/login')&&method==='POST'){
        try{sessionStorage.removeItem(AUTH_SESSION_KEY);}catch{}
        const result=await apiRequest(url,init);
        if((result.status||200)<400&&result.body?.user)markVerifiedSession(result.body);
        return toResponse(result);
      }
      if(url.pathname==='/api/logout'&&method==='POST'){
        const uid=activeUid||uidOf(cachedState)||( ()=>{try{return sessionStorage.getItem(AUTH_SESSION_KEY)||'';}catch{return '';}} )();
        const result=await apiRequest(url,init);
        if((result.status||200)<400){
          try{sessionStorage.removeItem(AUTH_SESSION_KEY);}catch{}
          cachedState=null;activeUid='';
          await store?.remove('state:last');
          if(uid)await store?.remove('state:'+uid);
        }
        return toResponse(result);
      }
      return toResponse(await apiRequest(url,init));
    }catch(error){
      const message=error?.message||'Firebase connection could not be started.';window.__JC_FIREBASE_INIT_ERROR__=message;
      try{const show=()=>{if(!document.body||document.getElementById('jcFirebaseSetupNotice'))return;const notice=document.createElement('div');notice.id='jcFirebaseSetupNotice';notice.setAttribute('role','alert');notice.style.cssText='position:relative;z-index:99999;margin:10px;padding:12px 15px;border:1px solid #b45309;border-radius:12px;background:#fff7ed;color:#7c2d12;font:600 14px/1.5 system-ui,sans-serif;';notice.textContent='Firebase request failed: '+message;document.body.prepend(notice);};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();}catch{}
      return new Response(JSON.stringify({ok:false,error:message}),{status:error?.status||503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
    }
  };
  async function emitCachedSession(){
    if(!store)return;
    try{
      const saved=await store.get('state:last');if(!saved?.user)return;
      const uid=uidOf(saved);if(!uid)return;
      const matches=[...(saved.matches||[])];
      if(saved.activeMatch){const ix=matches.findIndex(x=>String(x.id)===String(saved.activeMatch.id));if(ix>=0)matches[ix]=clone(saved.activeMatch);else matches.push(clone(saved.activeMatch));}
      const pending=await records('queue:'+uid+':match:');
      for(const row of pending){const match=row.value?.match;if(!match?.id)continue;const ix=matches.findIndex(x=>String(x.id)===String(match.id));if(ix>=0)matches[ix]=clone(match);else matches.push(clone(match));}
      const broadcasts={...(saved.broadcasts||{})};if(saved.broadcast)broadcasts[uid]=clone(saved.broadcast);
      emitPublic({activeMatches:matches.filter(x=>x.status==='live'),matches,tournaments:saved.tournaments||[],broadcasts,changedCollection:'offline-cache'});
    }catch(error){console.warn('Cached match snapshot could not be emitted:',error);}
  }
  class LocalFirebaseEventSource{
    constructor(url){this.url=url;this.onmessage=null;this.onerror=null;this.onopen=null;this.listeners=new Map();this.closed=false;this.readyState=0;window.__JC_FIREBASE_EVENTS__?.add(this);ready.then(async bridge=>{try{bridge?.subscribePublic?.(undefined,error=>{console.error('Firebase live Score Layer subscription failed:',error);localStatus('error','Live Score Layer realtime connection: '+(error?.message||'Firebase subscription failed'));});}catch(error){console.error('Realtime subscriptions could not start:',error);}await emitCachedSession();if(this.closed)return;this.readyState=1;const e=new Event('open');try{this.onopen?.(e);}catch{}for(const fn of this.listeners.get('open')||[])try{fn(e);}catch{}}).catch(error=>{this.readyState=2;const e=new Event('error');e.error=error;try{this.onerror?.(e);}catch{}for(const fn of this.listeners.get('error')||[])try{fn(e);}catch{}});}
    addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
    removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
    dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])try{fn(event);}catch(error){console.error(error);}return true;}
    close(){this.closed=true;this.readyState=2;window.__JC_FIREBASE_EVENTS__?.delete(this);}
  }
  window.EventSource=LocalFirebaseEventSource;
  window.addEventListener('online',()=>{localStatus('saved','Internet वापस आया है; pending changes background में upload हो रहे हैं।');requestBackgroundSync();syncNow();});
  window.addEventListener('offline',()=>localStatus('offline','Offline · scoring device पर सेव होगी।'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)syncNow();});
  setInterval(()=>{if(navigator.onLine)syncNow();},30000);
  window.addEventListener('load',()=>{requestBackgroundSync();scheduleSync(500);},{once:true});
})();