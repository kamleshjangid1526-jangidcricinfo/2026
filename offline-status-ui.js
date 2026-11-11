/* Offline/sync status badge and service-worker registration. */
(() => {
  const mount=()=>{
    if(!document.body)return;
    const isObsScoreLayer=document.body.classList.contains('scoreLayerBody');
    const obsStatusSelectors='#jcOfflineStatus,#offlineScoreStatus,.jcOfflineStatus,.offlineScoreStatus,[data-jc-offline-status],[data-offline-status]';
    const clearObsStatus=()=>{
      if(!document.body?.classList.contains('scoreLayerBody'))return;
      document.querySelectorAll(obsStatusSelectors).forEach(node=>node.remove());
    };
    if(isObsScoreLayer){
      clearObsStatus();
      const statusObserver=new MutationObserver(clearObsStatus);
      statusObserver.observe(document.body,{childList:true,subtree:true});
    }
    const scoring=document.getElementById('scoring');
    let bar=isObsScoreLayer?null:(document.getElementById('jcOfflineStatus')||document.getElementById('offlineScoreStatus'));
    if(!isObsScoreLayer&&!bar){bar=document.createElement('div');bar.id='jcOfflineStatus';bar.className='jcOfflineStatus';bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');bar.textContent='Checking connection…';if(scoring)scoring.prepend(bar);else document.body.prepend(bar);}
    const update=event=>{
      if(!bar)return;
      const d=event?.detail||{},online=navigator.onLine;
      const state=d.state||(online?'synced':'offline');
      bar.dataset.state=state;
      const labels={offline:'● OFFLINE · Device में सुरक्षित',pending:'◷ SYNC PENDING · Internet पर Sync होगा',syncing:'↻ SAVED · Firebase में Background Sync',synced:'✓ SYNCED · सभी बदलाव सुरक्षित',error:'⚠ SYNC ERROR · नीचे कारण देखें'};
      const detail=String(d.detail||'').trim();
      bar.textContent=state==='error'&&detail?`⚠ SYNC ERROR · ${detail.slice(0,90)}`:(labels[state]||labels[online?'synced':'offline']);
      bar.title=detail||bar.textContent;
    };
    if(bar){window.addEventListener('jc-offline-status',update);update({detail:{state:navigator.onLine?'synced':'offline'}});}
    if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
      navigator.serviceWorker.register(new URL('./sw.js',location.href),{scope:'./'}).then(registration=>{
        if(registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});
      }).catch(error=>{console.warn('Offline cache could not be registered:',error);});
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();