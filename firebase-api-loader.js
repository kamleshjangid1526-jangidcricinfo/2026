/* Jangid Cricinfo API bridge with durable local-first match and broadcast syncing. */
(() => {
  const nativeFetch=window.fetch.bind(window),store=window.JangidOfflineStore;
  let resolveBridge,rejectBridge;
  const ready=new Promise((resolve,reject)=>{resolveBridge=resolve;rejectBridge=reject;});
  window.__JC_FIREBASE_BRIDGE_READY__=ready;window.__JC_FIREBASE_BRIDGE_RESOLVE__=resolveBridge;window.__JC_FIREBASE_BRIDGE_REJECT__=rejectBridge;
  window.__JC_FIREBASE_EVENTS__=new Set();window.__JC_LAST_PUBLIC_PAYLOAD__=null;window.__JC_FIREBASE_INIT_ERROR__=null;
  let cachedState=null,activeUid='',verifiedUid='',syncing=false,syncRequested=false,cacheWriteSequence=0,channel=null,syncRetryTimer=null,syncFailureCount=0,syncStatusTimer=null;
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
  function publicPayload(match,broadcast,broadcastEvent){const state=cachedState||{},matches=[...(state.matches||[])];if(match){const ix=matches.findIndex(x=>String(x.id)===String(match.id));if(ix>=0)matches[ix]=clone(match);else matches.push(clone(match));}const broadcasts={...(state.broadcasts||{})};if(broadcast&&activeUid)broadcasts[activeUid]=clone(broadcast);const broadcastCards={...(state.broadcastCards||{})};if(broadcast&&activeUid)broadcastCards[activeUid]={uid:activeUid,ownerUid:activeUid,card:broadcast.card??null,cardId:broadcast.cardId??null,cardAnimation:broadcast.cardAnimation||null,cardAnimations:broadcast.cardAnimations||{},cardDurations:broadcast.cardDurations||{}};const broadcastEvents={...(state.broadcastEvents||{})};if(broadcastEvent&&activeUid)broadcastEvents[activeUid]=clone(broadcastEvent);return {activeMatches:matches.filter(x=>x.status==='live'),matches,tournaments:state.tournaments||[],broadcasts,broadcastCards,broadcastEvents,changedCollection:'local-offline'};}
  async function apiRequest(url,init={}){const bridge=await ready;return bridge.handleApi(url,init);}
  function toResponse(result){return new Response(JSON.stringify(result.body??{}),{status:result.status??200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
  function localFinish(match,body){const finished=clone(match||{}),type=['winner','tie','no-result'].includes(body.resultType)?body.resultType:'winner';if(type==='winner'){if(![String(finished.teamA),String(finished.teamB)].includes(String(body.winnerTeamId)))throw new Error('Winner Team चुनें।');finished.winnerTeamId=String(body.winnerTeamId);finished.resultType='winner';finished.result=String(body.resultText||'').trim().slice(0,140)||(finished.winnerTeamId===String(finished.teamA)?(finished.teamAName||'Team A'):(finished.teamBName||'Team B'))+' won';}else{finished.winnerTeamId=null;finished.resultType=type;finished.result=type==='tie'?'Match tied':'No Result';}finished.status='finished';finished.completedAt=new Date().toISOString();finished.updatedAt=finished.completedAt;return finished;}
  async function cacheMatch(match){
    if(!match?.id)throw new Error('Match snapshot में ID नहीं है।');
    const uid=activeUid||uidOf(cachedState);
    if(!uid)throw new Error('इस डिवाइस पर पिछला Login डेटा नहीं मिला। एक बार internet पर Login करके Match खोलें।');
    const stamp=new Date().toISOString(),version=stamp+':'+(++cacheWriteSequence);
    const snapshot=clone({...match,updatedAt:match.updatedAt||stamp,offlineUpdatedAt:stamp});
    const queueKey=key(uid,'match',snapshot.id);
    // The match queue is the durable local source; avoid rewriting the full profile after every ball.
    const durable=await store?.put(queueKey,{match:snapshot,version});
    if(durable!==true) throw new Error('इस डिवाइस की IndexedDB storage उपलब्ध नहीं है। Browser storage permission और खाली जगह जाँचें; Firebase Sync queue सुरक्षित नहीं बन पाई।');
    if(cachedState){
      cachedState.matches||=[];
      const ix=cachedState.matches.findIndex(x=>String(x.id)===String(snapshot.id));
      if(ix>=0)cachedState.matches[ix]=clone(snapshot);else cachedState.matches.push(clone(snapshot));
      cachedState.activeMatch=snapshot.status==='live'?clone(snapshot):null;
      cachedState.savedLiveMatches=(cachedState.savedLiveMatches||[]).filter(x=>String(x.id)!==String(snapshot.id));
      if(snapshot.status==='live')cachedState.savedLiveMatches.push(clone(snapshot));
    }
    emitPublic(publicPayload(snapshot,cachedState?.broadcast));
    return {uid,queueKey,snapshot};
  }
  async function cacheBroadcast(payload){
    const uid=activeUid||uidOf(cachedState);
    if(!uid)throw new Error('पहले online Login करें, फिर offline graphics सेव हो सकेंगी।');
    const queueKey=key(uid,'broadcast');
    // eventId intentionally stays unchanged when only a layout, palette or card setting changes.
    // Give every queue write a new revision so an older upload cannot delete a newer setting.
    const version=String(Date.now())+':'+String(++cacheWriteSequence);
    const durable=await store?.put(queueKey,{payload:clone(payload),version});
    if(durable!==true)throw new Error('इस डिवाइस की IndexedDB storage उपलब्ध नहीं है। Browser storage permission और खाली जगह जाँचें।');
    // Keep a compact last-known broadcast snapshot after the upload queue is cleared.
    // This restores the selected graphics on a later offline Score Layer refresh.
    const localSnapshotSaved=await store?.put('broadcast:last:'+uid,clone(payload));
    if(localSnapshotSaved!==true)throw new Error('Broadcast queue सुरक्षित है, लेकिन आखिरी Graphics की offline copy सेव नहीं हो पाई।');
    // Do not rewrite both full cached profile records on each graphic update.
    if(cachedState)cachedState.broadcast={...(cachedState.broadcast||{}),...clone(payload)};
    emitPublic(publicPayload(cachedState?.activeMatch,cachedState?.broadcast));
    return {uid,queueKey,version};
  }
  async function cacheBroadcastEvent(payload){
    const uid=activeUid||uidOf(cachedState);
    if(!uid)throw new Error('पहले online Login करें, फिर Broadcast Event सेव हो सकेगा।');
    const eventId=String(payload?.eventId||'').trim();
    if(!eventId||!payload?.event||!payload?.matchId)throw new Error('Broadcast Event अधूरा है; event ID, event और match ID जरूरी हैं।');
    const eventPayload={...clone(payload),uid,ownerUid:uid,createdAt:new Date().toISOString()};
    const queueKey=key(uid,'broadcast-event',eventId);
    const version=String(Date.now())+':'+String(++cacheWriteSequence);
    const durable=await store?.put(queueKey,{payload:eventPayload,version});
    if(durable!==true)throw new Error('इस डिवाइस की IndexedDB storage उपलब्ध नहीं है। Broadcast Event queue सुरक्षित नहीं बन पाई।');
    const lastSaved=await store?.put('broadcast-event:last:'+uid,eventPayload);
    if(lastSaved!==true)throw new Error('Broadcast Event सेव हुआ, लेकिन local recovery copy नहीं बन पाई।');
    if(cachedState){cachedState.broadcastEvents||={};cachedState.broadcastEvents[uid]=clone(eventPayload);}
    emitPublic(publicPayload(cachedState?.activeMatch,cachedState?.broadcast,eventPayload));
    return {uid,queueKey,version};
  }
  function scheduleSync(delay=220){
    if(!navigator.onLine)return;
    if(syncing){syncRequested=true;return;}
    if(syncRetryTimer)clearTimeout(syncRetryTimer);
    syncRetryTimer=setTimeout(()=>{
      syncRetryTimer=null;
      if(syncing){syncRequested=true;return;}
      void syncNow();
    },Math.max(50,Number(delay)||220));
  }
  async function syncNow(){
    if(syncing||!navigator.onLine){if(syncing)syncRequested=true;return false;}
    syncing=true;syncRequested=false;let rerunSync=false;const rowErrors=[];
    clearTimeout(syncStatusTimer);
    syncStatusTimer=setTimeout(()=>{if(syncing)localStatus('syncing','स्कोर और Broadcast graphics Firebase में अलग-अलग Sync हो रहे हैं।');},700);
    const publicMatchIsFinal=async(matchId)=>{
      if(!matchId)return false;
      try{
        const response=await apiRequest(new URL('/api/public/match/'+encodeURIComponent(matchId),location.href));
        const remote=response.body?.match;
        return !!remote&&['finished','abandoned'].includes(String(remote.status||''));
      }catch{return false;}
    };
    const noteRowError=(kind,row,error)=>{
      const message=String(error?.message||'Sync failed');
      rowErrors.push(kind+': '+message);
      console.warn('Jangid '+kind+' queue item remains pending:',row?.key||'',error);
    };
    try{
      const state=await readState(),uid=activeUid||uidOf(state);
      if(!uid){localStatus('offline','Login करें; saved offline data इस device पर सुरक्षित है।');return false;}
      // A cached profile alone is not proof that Firebase Auth has restored the current session.
      if(verifiedUid!==uid){
        const queued=(await records('queue:'+uid+':')).length;
        if(queued)localStatus('pending','Login सत्यापित होने के बाद pending बदलाव Firebase से Sync होंगे।');
        return false;
      }
      const matchRows=await records('queue:'+uid+':match:');
      const finishRows=await records('queue:'+uid+':finish:');
      const eventRows=await records('queue:'+uid+':broadcast-event:');
      const broadcastRow=await store?.get(key(uid,'broadcast'));
      if(!matchRows.length&&!finishRows.length&&!eventRows.length&&!broadcastRow){
        localStatus('synced','कोई pending बदलाव नहीं है।');return true;
      }

      // Match sync failures are recorded per item; cards/events still get their own upload attempt.
      for(const row of matchRows){
        try{
          const queued=await store?.get(row.key);
          if(!queued)continue;
          if(queued.version!==row.value?.version){rerunSync=true;continue;}
          const match=queued?.match;
          if(!match?.id)throw new Error('Offline queue में Match snapshot की ID नहीं मिली।');
          const result=await apiRequest(new URL('/api/match/state',location.href),{method:'POST',body:JSON.stringify({match})});
          if((result.status||200)>=400){
            if(['finished','abandoned'].includes(String(match.status||''))&&await publicMatchIsFinal(match.id)){
              const latest=await store?.get(row.key);
              if(latest?.version===queued.version)await store?.remove(row.key);
              else rerunSync=true;
              continue;
            }
            throw Object.assign(new Error(result.body?.error||'Match sync failed'),{code:result.body?.code,status:result.status});
          }
          const latest=await store?.get(row.key);
          if(latest?.version===queued.version)await store?.remove(row.key);else rerunSync=true;
        }catch(error){noteRowError('Match sync',row,error);}
      }

      // A stale/duplicate Finish request is safely cleared only when Firebase already
      // confirms this match is finished or abandoned. Otherwise keep the score data.
      for(const row of finishRows){
        try{
          const matchId=String(row.value?.body?.matchId||String(row.key||'').split(':').pop());
          const result=await apiRequest(new URL('/api/match/finish',location.href),{method:'POST',body:JSON.stringify(row.value.body||{})});
          if((result.status||200)>=400){
            if([404,409].includes(Number(result.status))&&await publicMatchIsFinal(matchId)){
              await store?.remove(row.key);
              await store?.remove(key(uid,'match',matchId));
              continue;
            }
            throw new Error(result.body?.error||'Match finish sync failed');
          }
          await store?.remove(row.key);await store?.remove(key(uid,'match',matchId));
        }catch(error){noteRowError('Finish sync',row,error);}
      }

      // Event queue is independent from score snapshots and card settings.
      for(const row of eventRows){
        try{
          const queued=await store?.get(row.key);
          if(!queued)continue;
          if(queued.version!==row.value?.version){rerunSync=true;continue;}
          const result=await apiRequest(new URL('/api/broadcast/event',location.href),{method:'POST',body:JSON.stringify(queued.payload||{})});
          if((result.status||200)>=400)throw new Error(result.body?.error||'Broadcast Event sync failed');
          const latest=await store?.get(row.key);
          if(latest?.version===queued.version)await store?.remove(row.key);else rerunSync=true;
        }catch(error){noteRowError('Broadcast Event sync',row,error);}
      }

      // Crucially, a failing old Match/Finish queue row no longer blocks this upload.
      if(broadcastRow){
        try{
          const result=await apiRequest(new URL('/api/broadcast',location.href),{method:'POST',body:JSON.stringify(broadcastRow.payload)});
          if((result.status||200)>=400)throw new Error(result.body?.error||'Broadcast save failed');
          const latest=await store?.get(key(uid,'broadcast'));
          if(latest?.version===broadcastRow.version)await store?.remove(key(uid,'broadcast'));else rerunSync=true;
        }catch(error){noteRowError('Broadcast Cards/Graphics sync',broadcastRow,error);}
      }

      const pending=(await records('queue:'+uid+':')).length;
      if(rowErrors.length){
        syncFailureCount=Math.min(6,syncFailureCount+1);
        const detail=rowErrors[0]+(pending?' · '+pending+' बदलाव सुरक्षित queue में हैं।':'');
        window.__JC_LAST_SYNC_ERROR__=detail;
        localStatus('error',detail);
        return false;
      }
      syncFailureCount=0;
      rerunSync=rerunSync||pending>0;
      localStatus(pending?'syncing':'synced',pending?pending+' बदलाव Sync के लिए queue में हैं।':'स्कोर, Cards और Broadcast graphics Firebase से Sync हो गए।');
      return pending===0;
    }catch(error){
      syncFailureCount=Math.min(6,syncFailureCount+1);
      const detail=String(error?.message||'Sync अभी पूरा नहीं हुआ; फिर प्रयास होगा।');
      window.__JC_LAST_SYNC_ERROR__=detail;localStatus('error',detail);
      console.error('Jangid Firebase background sync failed:',error);return false;
    }finally{
      syncing=false;clearTimeout(syncStatusTimer);syncStatusTimer=null;
      if((rerunSync||syncRequested)&&navigator.onLine){syncRequested=false;scheduleSync(160);}
      else if(syncFailureCount>0&&navigator.onLine){
        const retryDelay=Math.min(30000,1000*Math.pow(2,Math.min(5,syncFailureCount-1)));
        scheduleSync(retryDelay);
      }
    }
  }
  window.JangidOfflineSync={syncNow,getStatus:()=>({online:navigator.onLine,userId:activeUid}),getCachedState:readState};
  window.fetch=async(input,init={})=>{
    let url;try{url=new URL(typeof input==='string'?input:input.url,location.href);}catch{return nativeFetch(input,init);}
    if(url.pathname==='/events')return new Response('Jangid local + Firebase realtime channel active.',{status:200,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    if(!url.pathname.startsWith('/api/'))return nativeFetch(input,init);
    const method=String(init.method||'GET').toUpperCase(),body=(()=>{try{return init.body?JSON.parse(init.body):{};}catch{return {};}})();
    try{
      if(url.pathname==='/api/state'&&method==='GET'){
        try{const result=await apiRequest(url,init);if((result.status||200)<400&&result.body?.user){verifiedUid=uidOf(result.body);markVerifiedSession(result.body);await saveState(result.body);const merged=await withPending(clone(result.body));await saveState(merged);const pending=activeUid?(await records('queue:'+activeUid+':')).length:0;localStatus(pending?'pending':'synced',pending?pending+' pending items.':'Firebase connected.');if(pending)scheduleSync(350);return toResponse({status:200,body:merged});}return toResponse(result);}
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
        localStatus(navigator.onLine?'saved':'offline',navigator.onLine?'स्कोर device पर सुरक्षित है; Firebase में background upload queue हो गई है।':'स्कोर device पर सुरक्षित है; internet आने पर Sync होगा।');
        if(navigator.onLine)scheduleSync(220);else requestBackgroundSync();
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
      if(url.pathname==='/api/broadcast/event'&&method==='POST'){
        await cacheBroadcastEvent(body);
        localStatus(navigator.onLine?'saved':'offline',navigator.onLine?'Broadcast Event अलग queue में सुरक्षित है; Firebase realtime पर upload होगा।':'Broadcast Event device पर सुरक्षित है; internet आने पर Firebase sync होगा।');
        if(navigator.onLine)scheduleSync(120);else requestBackgroundSync();
        return toResponse({status:200,body:{ok:true,queued:true,localFirst:true,eventId:body.eventId}});
      }
      if(url.pathname==='/api/broadcast'&&method==='POST'){
        await cacheBroadcast(body);
        localStatus(navigator.onLine?'saved':'offline',navigator.onLine?'Broadcast graphics device पर सेव हैं; Firebase background में upload होंगी।':'Broadcast graphics device पर सेव हैं; reconnect पर Sync होंगी।');
        if(navigator.onLine)scheduleSync(220);else requestBackgroundSync();
        return toResponse({status:200,body:{ok:true,queued:true,localFirst:true}});
      }
      if((url.pathname==='/api/login'||url.pathname==='/api/admin/login')&&method==='POST'){
        verifiedUid='';try{sessionStorage.removeItem(AUTH_SESSION_KEY);}catch{}
        const result=await apiRequest(url,init);
        if((result.status||200)<400&&result.body?.user)markVerifiedSession(result.body);
        return toResponse(result);
      }
      if(url.pathname==='/api/logout'&&method==='POST'){
        const uid=activeUid||uidOf(cachedState)||( ()=>{try{return sessionStorage.getItem(AUTH_SESSION_KEY)||'';}catch{return '';}} )();
        const result=await apiRequest(url,init);
        if((result.status||200)<400){
          try{sessionStorage.removeItem(AUTH_SESSION_KEY);}catch{}
          cachedState=null;activeUid='';verifiedUid='';
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
      const broadcastCards={...(saved.broadcastCards||{})};
      if(saved.broadcast)broadcastCards[uid]={uid,ownerUid:uid,card:saved.broadcast.card??null,cardId:saved.broadcast.cardId??null,cardAnimation:saved.broadcast.cardAnimation||null,cardAnimations:saved.broadcast.cardAnimations||{},cardDurations:saved.broadcast.cardDurations||{}};
      const broadcastEvents={...(saved.broadcastEvents||{})};
      const savedEvent=await store.get('broadcast-event:last:'+uid);
      if(savedEvent)broadcastEvents[uid]=clone(savedEvent);
      const pendingEvents=await records('queue:'+uid+':broadcast-event:');
      if(pendingEvents.length){const latestEvent=pendingEvents.map(row=>row.value?.payload).filter(Boolean).sort((a,b)=>(Date.parse(b.createdAt||'')||0)-(Date.parse(a.createdAt||'')||0))[0];if(latestEvent)broadcastEvents[uid]=clone(latestEvent);}
      // Restore the latest local graphics snapshot even when its Firebase queue was already cleared.
      const savedBroadcast=await store.get('broadcast:last:'+uid);
      if(savedBroadcast)broadcasts[uid]={...(broadcasts[uid]||{}),...clone(savedBroadcast)};
      // A still-pending upload is newer than the last-known local snapshot.
      const pendingBroadcast=await store.get(key(uid,'broadcast'));
      if(pendingBroadcast?.payload)broadcasts[uid]={...(broadcasts[uid]||{}),...clone(pendingBroadcast.payload)};
      emitPublic({activeMatches:matches.filter(x=>x.status==='live'),matches,tournaments:saved.tournaments||[],broadcasts,broadcastCards,broadcastEvents,changedCollection:'offline-cache'});
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
  // Authenticated /api/state now starts any pending queue upload; do not race it on page load.
  window.addEventListener('load',()=>{requestBackgroundSync();},{once:true});
})();