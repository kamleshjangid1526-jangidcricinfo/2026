let STATE=null, MATCH=null, selectedTeamId=null, matchStep=1, modalCloseHook=null, PUBLIC_LIVE=[], activeCardType=null, draftSaveTimer=null, restoringMatchDraft=false, secondSetupModalOpen=false, secondSetupDismissed=false, secondSetupOpenScheduled=false, nextInningsModalOpen=false, nextInningsPromptDismissed=false, nextInningsPromptScheduled=false, newBatterModalOpen=false, newBatterDismissed=false, newBatterOpenScheduled=false;
let broadcastSequence=Date.now(),eventBroadcastQueue=Promise.resolve(),eventPublishGeneration=0;
const eventSequenceTimers=new Set();
// Auth bootstrap guard: an initial unauthenticated /api/state request must never undo a later successful login.
let authBootSequence=0, loginSubmitting=false;
const DESIGN_DEFAULTS={enabled:false,width:92,scale:100,scoreFont:56,metaFont:11,logoSize:36,opacity:94,radius:15,border:1,shape:'rounded',fontFamily:'system',position:'bottom-center',bg:'#071626',accent:'#58c8ff',text:'#f4f9ff'};
let SCORE_DESIGN={...DESIGN_DEFAULTS}, designSaveTimer=null, designControlsInitialized=false;
const $=id=>document.getElementById(id);
const LAYERS=['01 · Classic TV Blocks','02 · Championship Frame','03 · Angular Stadium','04 · Rounded Arena','05 · Split Edge Broadcast','06 · Hexagon Score Rail','07 · Twin Shield Panels','08 · Slanted Match Bar','09 · Triple Border Display','10 · Pill Side Panels','11 · Score Crown','12 · Corner Cut Classic','13 · Stadium Curve','14 · Digital Night Board','15 · Gold Championship','16 · Diagonal Edge','17 · Minimal TV Rail','18 · Heavy Score Focus','19 · Side Wing Panels','20 · Final Over Spotlight'];
const COLORS=['World Cup Red / Gold','India Blue / Gold','Stadium Green / Lime','Royal Purple / Pink','Desert Orange / Gold','Blue / Silver','Violet / Gold','Teal / Aqua','Graphite / Lime','Crimson / Steel','Ocean Blue / Ice','Emerald / Champagne','Black / Electric Blue','Magenta / Silver','Maroon / Gold','Turquoise / Navy','Sunset Orange / Purple','White / Royal Blue','Forest / Amber','Midnight / Neon'];
const EVENT_THEME_NAMES=["boundary-ripple","orbital-rays","stadium-surge","impact-ribbons","lightning-grid","halo-pulse","starburst-field","radial-bloom","shard-break","spotlight-ring","laser-sweep","velocity-trails","split-impact","pulse-tunnel","chromatic-wave","stadium-flash","ribbon-burst","glass-shatter","orbit-launch","impact-digital"];
const ANIMS=['slideUp','slideDown','slideLeft','slideRight','fade','zoom','pop','bounce','flip','rotate','wipe','flash','glitch','blur','fireworks','spark','slam','shatter','orbit','spotlight','none'];
const CARD_TYPES=[['batter','Individual Batter'],['bowler','Individual Bowler'],['player','Player Spotlight'],['partnership','Partnership'],['teamBatting','Full Team Batting'],['teamBowling','Full Team Bowling'],['nextBatter','Next Batsman'],['newBatter','New Batter'],['newBowler','New Bowler'],['inningsBreak','Innings Break'],['result','Match Result'],['chase','Runs Needed / Balls Remaining']];
let CARD_ANIM_MAP={batter:'spark',bowler:'spotlight',player:'fireworks',partnership:'orbit',teamBatting:'slideUp',teamBowling:'slideDown',nextBatter:'bounce',newBatter:'slideRight',newBowler:'slideLeft',inningsBreak:'shatter',result:'fireworks',chase:'slam'};
let CARD_DURATION_MAP={batter:1800,bowler:1800,player:1900,partnership:1800,teamBatting:2600,teamBowling:2600,nextBatter:1700,newBatter:1800,newBowler:1800,inningsBreak:2600,result:3000,chase:2400};
const EVENT_STYLES={FOUR:'four',SIX:'six',WICKET:'wicket','NO BALL':'noball',WIDE:'wide','LEG BYE':'legbye',BYE:'bye','FREE HIT':'freehit',FIFTY:'fifty',CENTURY:'century','NEW BATSMAN':'newbatsman','NEW BOWLER':'newbowler',RESULT:'result','INNINGS BREAK':'inningsbreak',POWERPLAY:'powerplay',PARTNERSHIP:'partnership','50 PARTNERSHIP':'partnership'};
const EVENTS=['FOUR','SIX','WICKET','FREE HIT','FIFTY','CENTURY','NO BALL','WIDE','LEG BYE','BYE','NEW BATSMAN','NEW BOWLER','RESULT','INNINGS BREAK','POWERPLAY','PARTNERSHIP','50 PARTNERSHIP'];
let EVENT_DURATION_MAP={FOUR:2200,SIX:2600,WICKET:2700,'FREE HIT':1600,FIFTY:2400,CENTURY:3000,'NO BALL':1900,WIDE:1700,'LEG BYE':1700,BYE:1500,'NEW BATSMAN':1800,'NEW BOWLER':1800,RESULT:3000,'INNINGS BREAK':2500,POWERPLAY:2000,PARTNERSHIP:2000,'50 PARTNERSHIP':2300};
const api=(u,o={})=>fetch(u,{credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},...o}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'Request failed');e.code=j.code||'';e.details=j;e.status=r.status;throw e;}return j});
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function activePlan(){if(STATE?.localTestMode)return true;const s=STATE?.user?.subscription;return !!(s&&s.status==='active'&&new Date(s.expiresAt)>new Date())}
function isPro(){return !!STATE?.localTestMode || (activePlan()&&STATE.user.activePlan==='pro')}
function team(id){return (STATE?.teams||[]).find(t=>String(t.id)===String(id))}
function playerName(pid){for(const t of STATE.teams){const p=(t.players||[]).find(x=>String(x.id)===String(pid));if(p)return p.name}return 'Player'}
function playerNameInTeam(teamId,pid){const p=(team(teamId)?.players||[]).find(x=>String(x.id)===String(pid));return p?.name||'Unknown player'}
// A player's eligibility is always intersected with the batting team's own roster. This also repairs old/stale match snapshots that contain foreign player IDs.
function matchXI(teamId, statKey='batStats'){
 const roster=(team(teamId)?.players||[]).map(p=>String(p.id));
 const rawSaved=MATCH?.teamXIs?.[String(teamId)]??MATCH?.teamXIs?.[teamId]??[]; const saved=Array.isArray(rawSaved)?rawSaved.map(String):[];
 const allowed=saved.filter(id=>roster.includes(id));
 if(allowed.length)return [...new Set(allowed)];
 const stats=currentInnings()?.[statKey]||{};
 return roster.filter(id=>Object.prototype.hasOwnProperty.call(stats,id));
}
function currentInnings(){return MATCH?.activeInnings||null}
// Shared eligible-player helpers are used by the Scoring card controls as well as setup UI.
function eligibleBatters(){
 const i=currentInnings();if(!i)return [];
 return matchXI(i.battingId,'batStats').filter(id=>{const p=i.batStats?.[id],mayReturn=p?.howOut==='Retired Hurt'||p?.howOut==='Substituted'||p?.retiredReason==='Substituted';return !!p&&!p.out&&(!p.retired||mayReturn)&&String(id)!==String(i.striker||'')&&String(id)!==String(i.nonStriker||'')});
}
function eligibleBowlers(){
 const i=currentInnings();if(!i)return [];
 const limit=Math.max(1,Number(i.bowlerOverLimit||MATCH?.bowlerOverLimit||1)),previous=String(i.previousBowler||'');
 return matchXI(i.bowlingId,'bowlStats').filter(id=>{const p=i.bowlStats?.[id];if(!p||Number(p.balls||0)/6>=limit)return false;if(i.awaitingBowler&&previous&&String(id)===previous)return false;return true});
}

let scoringPageLocked=false,scoringLockHistoryGuard=false,scoringLockNoticeTimer=null;
function showScoringLockNotice(message='Scoring screen locked है। Unlock करने के बाद ही Back या Logout कर सकते हैं।'){
 let toast=$('scoringLockNotice');
 if(!toast){toast=document.createElement('div');toast.id='scoringLockNotice';toast.className='scoringLockNotice';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.append(toast);}
 toast.textContent=message;toast.classList.add('show');
 clearTimeout(scoringLockNoticeTimer);
 scoringLockNoticeTimer=setTimeout(()=>toast.classList.remove('show'),2400);
}
function syncScoringLockUI(){
 const inScoring=document.body.classList.contains('jc-scoring-view');
 const button=$('scoringLockBtn'),logout=$('logout'),menu=$('menuToggle');
 if(button){
  button.classList.toggle('hidden',!inScoring);
  button.classList.toggle('isLocked',scoringPageLocked);
  button.setAttribute('aria-pressed',String(scoringPageLocked));
  button.textContent=scoringPageLocked?'🔐 Locked':'🔒 Lock';
  button.title=scoringPageLocked?'Unlock scoring controls':'Lock scoring controls';
 }
 if(logout){logout.disabled=scoringPageLocked;logout.setAttribute('aria-disabled',String(scoringPageLocked));}
 if(menu){menu.disabled=scoringPageLocked;menu.setAttribute('aria-disabled',String(scoringPageLocked));}
 document.body.classList.toggle('jc-scoring-locked',scoringPageLocked);
 if(scoringPageLocked)closeSideNav();
}
function toggleScoringLock(){
 if(!document.body.classList.contains('jc-scoring-view'))return;
 if(scoringPageLocked){
  if(!window.confirm('Scoring Lock हटाकर सामान्य navigation और Logout चालू करें?'))return;
  scoringPageLocked=false;
  syncScoringLockUI();
  showScoringLockNotice('Scoring Lock हट गया। अब Back और Logout उपलब्ध हैं।');
  if(scoringLockHistoryGuard){scoringLockHistoryGuard=false;history.back();}
  return;
 }
 scoringPageLocked=true;
 try{history.pushState({jcScoringLock:true},'',location.href);scoringLockHistoryGuard=true;}catch(error){console.warn('Could not add scoring lock history guard:',error);}
 syncScoringLockUI();
 showScoringLockNotice('Scoring LOCKED — Back और Logout बंद हैं।');
}
window.addEventListener('popstate',()=>{
 if(!scoringPageLocked)return;
 try{history.pushState({jcScoringLock:true},'',location.href);scoringLockHistoryGuard=true;}catch(error){console.warn('Could not restore scoring lock history guard:',error);}
 closeSideNav();
 showScoringLockNotice('Scoring LOCKED है। पहले ऊपर Unlock दबाएँ।');
});
window.addEventListener('keydown',event=>{
 if(!scoringPageLocked)return;
 const tag=document.activeElement?.tagName;
 const backShortcut=(event.altKey&&event.key==='ArrowLeft')||event.key==='BrowserBack'||(event.key==='Backspace'&&!['INPUT','TEXTAREA','SELECT'].includes(tag));
 if(backShortcut){event.preventDefault();event.stopPropagation();showScoringLockNotice('Scoring LOCKED है। पहले ऊपर Unlock दबाएँ।');}
},true);
document.addEventListener('click',event=>{
 if(!scoringPageLocked)return;
 if(event.target.closest('#scoringLockBtn'))return;
 const nav=event.target.closest('[data-go]');
 if(nav){event.preventDefault();event.stopImmediatePropagation();showScoringLockNotice('Scoring LOCKED है। पहले ऊपर Unlock दबाएँ।');return;}
 const link=event.target.closest('a[href]');
 if(link){event.preventDefault();event.stopImmediatePropagation();showScoringLockNotice('Scoring LOCKED है। पहले ऊपर Unlock दबाएँ।');}
},true);
$('scoringLockBtn')?.addEventListener('click',toggleScoringLock);

function closeSideNav(){const side=$('sideNav'),backdrop=$('navBackdrop'),toggle=$('menuToggle');side?.classList.remove('open');side?.setAttribute('aria-hidden','true');if(backdrop){backdrop.classList.remove('show');backdrop.hidden=true;}if(toggle){toggle.setAttribute('aria-expanded','false');toggle.classList.remove('isOpen')}}
function openSideNav(){const side=$('sideNav'),backdrop=$('navBackdrop'),toggle=$('menuToggle');if(!side)return;side.classList.add('open');side.setAttribute('aria-hidden','false');if(backdrop){backdrop.hidden=false;requestAnimationFrame(()=>backdrop.classList.add('show'));}if(toggle){toggle.setAttribute('aria-expanded','true');toggle.classList.add('isOpen')}}
$('menuToggle')?.addEventListener('click',()=> $('sideNav')?.classList.contains('open')?closeSideNav():openSideNav());$('closeSideNav')?.addEventListener('click',closeSideNav);$('navBackdrop')?.addEventListener('click',closeSideNav);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSideNav()});
function setAuthView(isAuthenticated){
 const login=$('loginScreen'),app=$('app');
 if(isAuthenticated){login?.classList.add('hidden');app?.classList.remove('hidden');}
 else{app?.classList.add('hidden');login?.classList.remove('hidden');}
}
function showAppRuntimeNotice(message){
 const main=document.querySelector('#app main');if(!main)return;
 let box=$('appRuntimeNotice');if(!box){box=document.createElement('div');box.id='appRuntimeNotice';box.className='notice';box.setAttribute('role','status');main.prepend(box);}
 box.textContent=String(message||'इस सेक्शन को लोड करने में समस्या आई। दूसरे सेक्शन इस्तेमाल कर सकते हैं।');
}
function showPage(id){
 if(scoringPageLocked&&id!=='scoring'){showScoringLockNotice('Scoring LOCKED है। पहले ऊपर Unlock दबाएँ।');return;}
 if(!STATE?.user){setAuthView(false);return;}
 if(!$(id))return;
 document.body.classList.toggle('jc-scoring-view',id==='scoring');
 syncScoringLockUI();
 document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
 $(id).classList.remove('hidden');
 document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.go===id));
 closeSideNav();
 try{
  if(id==='dashboard')renderDashboard();
  if(id==='teams')renderTeams();
  if(id==='tournament')renderTournament();
  if(id==='match')initMatchPage();
  if(id==='scoring')renderScoring();
  if(id==='graphics')renderGraphics();
 }catch(err){console.error(`Could not render ${id} page`,err);showAppRuntimeNotice(`पेज लोड करने में समस्या: ${err.message||err}. बाकी Control Board खुला रहेगा।`);}
 window.scrollTo({top:0,behavior:'smooth'});
}

document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g){e.preventDefault();showPage(g.dataset.go)}});
async function refresh(){STATE=await api('/api/state');MATCH=STATE.activeMatch;sanitizeActiveMatchPlayers();renderAll()}
function sanitizeActiveMatchPlayers(){
 if(!MATCH?.activeInnings||!STATE)return;
 const i=MATCH.activeInnings;MATCH.teamXIs ||= {};
 for(const id of [MATCH.teamA,MATCH.teamB]){const t=team(id),roster=new Set((t?.players||[]).map(p=>String(p.id))),saved=(MATCH.teamXIs[String(id)]||MATCH.teamXIs[id]||[]).map(String),clean=saved.filter(pid=>roster.has(pid));MATCH.teamXIs[String(id)]=clean.length?Array.from(new Set(clean)):saved.filter(pid=>roster.has(pid));}
 for(const key of Object.keys(MATCH.teamXIs))if(![String(MATCH.teamA),String(MATCH.teamB)].includes(String(key)))delete MATCH.teamXIs[key];
 if(MATCH.awaitingInningsSetup||MATCH.awaitingNextInnings||MATCH.awaitingMatchFinish||MATCH.status!=='live')return;
 const batXI=new Set(matchXI(i.battingId,'batStats').map(String)),bowlXI=new Set(matchXI(i.bowlingId,'bowlStats').map(String));
 if(i.batStats){for(const id of Object.keys(i.batStats))if(!batXI.has(String(id)))delete i.batStats[id];}
 if(i.bowlStats){for(const id of Object.keys(i.bowlStats))if(!bowlXI.has(String(id)))delete i.bowlStats[id];}
 let badSlot=null;for(const slot of ['striker','nonStriker']){const id=i[slot];if(id&&(!batXI.has(String(id))||!i.batStats?.[id])){i[slot]=null;badSlot ||= slot;}}
 if(i.striker&&i.nonStriker&&String(i.striker)===String(i.nonStriker)){i.nonStriker=null;badSlot='nonStriker';}
 if(badSlot){i._replaceSlot=badSlot;i.awaitingNewBatter=true;newBatterDismissed=false;}
 if(i.currentBowler&&(!bowlXI.has(String(i.currentBowler))||!i.bowlStats?.[i.currentBowler])){i.currentBowler=null;i.awaitingBowler=true;}
}
function renderAll(){
 const jobs=[['Dashboard',renderDashboard],['Teams',renderTeams],['Tournament',renderTournament],['Graphics',renderGraphics],['Top bar',updateTopBar],['Demo controls',updateDemoControls]];
 for(const [name,fn] of jobs){try{fn()}catch(err){console.error(`${name} render failed`,err);showAppRuntimeNotice(`${name} सेक्शन में लोडिंग समस्या है: ${err.message||err}. Login दोबारा करने की जरूरत नहीं है।`);}}
}
function updateTopBar(){const p=$('planPill');if(STATE?.localTestMode){p.className='planPill active';p.textContent='LOCAL TEST MODE';p.title='Local-only testing; Firebase is not connected.'}else if(activePlan()){p.className='planPill active';p.textContent=`${String(STATE?.user?.activePlan||'FREE').toUpperCase()} · ${STATE.user.daysLeft}D`}else{p.className='planPill noPlan';p.textContent='NO PLAN'}$('dashMobile').textContent=STATE.user.mobile}
function updateDemoControls(){
 const demo=STATE?.demoData;
 const btn=$('demoDataBtn'),remove=$('removeDemoDataBtn'),panel=$('demoPanel');
 if(btn){btn.textContent=demo?.hasDemo?'▶ Open Demo Preview':'▶ Demo Preview';btn.title=demo?.hasDemo?'Open the current demo Score Layer':'Create demo tournament, squads and sample live score';}
 if(remove)remove.classList.toggle('hidden',!demo?.hasDemo);
 if(panel){panel.classList.toggle('hidden',!demo?.hasDemo);if(demo?.hasDemo){$('demoTournamentLabel').textContent=demo.tournamentName||'Jangid Demo Cup';const id=demo.matchId;const layer=`scorelayer.html?owner=${encodeURIComponent(STATE.user.id)}&match=${encodeURIComponent(id)}`;const board=`scoreboard.html?owner=${encodeURIComponent(STATE.user.id)}&match=${encodeURIComponent(id)}`;$('demoLayerLink').href=layer;$('demoScoreboardLink').href=board;}}
}
function renderDashboard(){
  $('statTeams').textContent=STATE.teams.length;
  $('statPlayers').textContent=STATE.teams.reduce((n,t)=>n+t.players.length,0);
  $('statLive').textContent=PUBLIC_LIVE.filter(m=>m.status==='live'&&m.userId===STATE.user.id).length;
  $('statPlan').textContent=activePlan()?String(STATE?.user?.activePlan||'FREE').toUpperCase():'FREE';
  $('statExpiry').textContent=activePlan()?`expires ${new Date(STATE.user.subscription.expiresAt).toLocaleDateString()}`:'activate at match start';
  const savedLives=STATE.savedLiveMatches||[];
  if(MATCH&&MATCH.status==='live'){const i=currentInnings()||{};$('activeMatchBox').innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>${esc(team(MATCH.teamA)?.name)} vs ${esc(team(MATCH.teamB)?.name)}</b><br><span class="muted">${esc(MATCH.title)} · ${MATCH.oversLimit} overs</span></div><div style="text-align:right"><b style="font-size:26px">${i.score||0}/${i.wickets||0}</b><br><span class="muted">${Math.floor((i.balls||0)/6)}.${(i.balls||0)%6} ov · CRR ${i.balls?(i.score/(i.balls/6)).toFixed(2):'0.00'}</span></div></div>`}
  else if(savedLives.length){$('activeMatchBox').innerHTML=`<div class="staleLiveNotice"><b>⚠ Saved match still marked LIVE</b><p class="muted smallHelp">The saved data contains ${savedLives.length} LIVE record(s), although no active match is attached to this Control Board. If these matches are not actually running, you can move them to ABANDONED history without deleting their scorecards.</p>${savedLives.map(m=>`<div class="staleLiveRow"><span><b>${esc(m.title||'Local Match')}</b><small>${esc(m.teamAName||'Team A')} vs ${esc(m.teamBName||'Team B')} · ${Number(m.activeInnings?.score)||0}/${Number(m.activeInnings?.wickets)||0}</small></span><button class="miniBtn dangerMini" data-recover-live="${esc(m.id)}">Recover stale match</button></div>`).join('')}</div>`}
  else $('activeMatchBox').innerHTML='<div class="emptyState">No live match right now. Teams are ready when you are.</div>';
  $('dashboardLiveCount').textContent=`${PUBLIC_LIVE.filter(m=>m.status==='live').length} LIVE`;
  renderDashboardLiveCards(PUBLIC_LIVE);
  renderDashboardHistory();
  const base=`${location.origin}`;$('obsLayerLink').href=`scorelayer.html?owner=${STATE.user.id}`;$('obsBoardLink').href=`scoreboard.html?owner=${STATE.user.id}`;
}
function renderDashboardLiveCards(matches){
 const grid=$('dashboardLiveGrid'); if(!grid)return;
 const live=(matches||[]).filter(m=>m&&m.status==='live');
 if(!live.length){grid.innerHTML='<div class="emptyState">No live matches right now. A match card will appear automatically when a match goes live.</div>';return}
 grid.innerHTML=live.map(m=>{const i=m.activeInnings||{},rate=i.balls?(i.score/(i.balls/6)).toFixed(2):'0.00';return `<a class="dashboardLiveCard" href="scoreboard.html?match=${encodeURIComponent(m.id)}"><div class="dashLiveHead"><span class="livePulse">● LIVE</span><span>${esc(m.title||'Local Match')}</span></div><div class="dashLiveTeams"><b>${esc(m.teamAName||'Team A')}</b><span>vs</span><b>${esc(m.teamBName||'Team B')}</b></div><div class="dashLiveScore"><strong>${i.score||0}/${i.wickets||0}</strong><span>${Math.floor((i.balls||0)/6)}.${(i.balls||0)%6} OV · CRR ${rate}</span></div><div class="dashLiveFoot">Open full live score & commentary ↗</div></a>`}).join('');
}
function renderDashboardHistory(){
 const el=$('matchHistoryGrid'); if(!el||!STATE)return;
 const rows=(STATE.matches||[]).slice().sort((a,b)=>new Date(b.startedAt||b.dateTime||b.createdAt||0)-new Date(a.startedAt||a.dateTime||a.createdAt||0));
 if(!rows.length){el.innerHTML='<div class="emptyState">No match history yet. Every scheduled and started match will be saved here automatically.</div>';return}
 el.innerHTML=rows.map(m=>{const i=m.activeInnings||{},live=m.status==='live',upcoming=m.status==='scheduled',abandoned=m.status==='abandoned',stamp=m.startedAt||m.dateTime||m.createdAt||Date.now(),url=new URL(`scoreboard.html?match=${encodeURIComponent(m.id)}`,document.baseURI).href;return `<div class="historyCard"><div class="historyMain"><div class="historyState ${live?'historyLive':upcoming?'historyScheduled':'historyDone'}">${live?'● LIVE':upcoming?'◷ UPCOMING':abandoned?'◌ ABANDONED':'✓ COMPLETED'}</div><b>${esc(m.title||'Local Match')}</b><span>${esc(m.teamAName||team(m.teamA)?.name||'Team A')} vs ${esc(m.teamBName||team(m.teamB)?.name||'Team B')}</span><small>${new Date(stamp).toLocaleString()}${upcoming?' · '+(Number(m.oversLimit)||20)+' overs':` · ${i.score??0}/${i.wickets??0} · ${Math.floor((i.balls||0)/6)}.${(i.balls||0)%6} ov`}${m.result?' · '+esc(m.result):''}</small><input class="shareMatchUrl" readonly value="${esc(url)}" aria-label="Public match share link"></div><div class="historyActions">${upcoming?`<button class="miniBtn" data-start-fixture="${esc(m.id)}">Start this match</button>`:''}<a class="miniBtn" target="_blank" rel="noopener" href="scoreboard.html?match=${encodeURIComponent(m.id)}">Open Public Score</a><button class="miniBtn" data-copymatch="${esc(m.id)}">Copy Link</button><button class="miniBtn dangerMini" data-delmatch="${esc(m.id)}">Delete Match</button></div></div>`}).join('');
}

async function compressedLogo(file){if(!file)return '';return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(new Error('Logo file could not be read'));fr.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Logo image format not supported'));img.onload=()=>{const max=320,s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/webp',.68))};img.src=fr.result};fr.readAsDataURL(file)})}
async function compressedBanner(file){return new Promise((resolve,reject)=>{if(!file)return resolve('');const fr=new FileReader();fr.onerror=()=>reject(new Error('Banner file could not be read'));fr.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Image format not supported'));img.onload=()=>{const w=1280,h=420,c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d'),scale=Math.max(w/img.width,h/img.height),sw=img.width*scale,sh=img.height*scale;ctx.drawImage(img,(w-sw)/2,(h-sh)/2,sw,sh);resolve(c.toDataURL('image/webp',.78))};img.src=fr.result};fr.readAsDataURL(file)})}
function renderTeams(){
 const teams=STATE?.teams||[];const list=$('teamList');if(!list)return;
 $('teamCount').textContent=`${teams.length} TEAMS`;
 list.innerHTML=teams.length?teams.map(t=>`<article class="panel teamCard teamListCard"><div class="teamCardMain" data-open-team="${esc(t.id)}" role="button" tabindex="0"><img class="teamLogo" src="${esc(t.logo||'')}" alt="" onerror="this.style.visibility='hidden'"><div><div class="teamTitle">${esc(t.name||'Unnamed Team')}</div><small class="muted">${(t.players||[]).length} players · Open squad →</small></div></div><div class="rowBtns teamCardActions"><button class="miniBtn" data-editteam="${esc(t.id)}">Edit Team</button><button class="miniBtn dangerMini" data-delteam="${esc(t.id)}">Remove</button></div></article>`).join(''):'<div class="emptyState">No teams yet. Add your first team above.</div>';
 const detail=$('teamDetailView'),overview=$('teamListView'),selected=teams.find(t=>String(t.id)===String(selectedTeamId));
 if(!selected){selectedTeamId=null;detail?.classList.add('hidden');overview?.classList.remove('hidden');return;}
 overview?.classList.add('hidden');detail?.classList.remove('hidden');$('teamDetailName').textContent=selected.name||'Team Players';$('teamDetailMeta').textContent=`${(selected.players||[]).length} players · Team roster`;$('playerTeam').value=selected.id;$('playerCount').textContent=`${(selected.players||[]).length} PLAYERS`;
 $('teamPlayerList').innerHTML=(selected.players||[]).length?selected.players.map(p=>`<div class="teamPlayerRow"><div class="teamPlayerIdentity"><b>${esc(p.name||'Unnamed Player')}</b><span class="tag">${esc(String(p.role||'batsman').toUpperCase())}</span>${p.captain?'<span class="tag captainTag">CAPTAIN</span>':''}${p.viceCaptain?'<span class="tag viceCaptainTag">VICE-CAPTAIN</span>':''}</div><div class="rowBtns"><button class="miniBtn" data-editplayer="${esc(selected.id)}|${esc(p.id)}">Edit</button><button class="miniBtn dangerMini" data-delplayer="${esc(selected.id)}|${esc(p.id)}">Remove</button></div></div>`).join(''):'<div class="emptyState">इस टीम में अभी कोई खिलाड़ी नहीं है। ऊपर Add Player से पहला खिलाड़ी जोड़ें।</div>';
}

function groupNameOptions(count){return Array.from({length:Math.max(2,Math.min(8,Number(count)||2))},(_,i)=>`Group ${String.fromCharCode(65+i)}`)}
function updateTournamentGroupControls(){
 const fmt=$('tournamentFormat')?.value||'league',selected=STATE?.tournaments?.find(t=>t.id===$('tournamentSelect')?.value),createGroups=fmt==='groups-knockout',selectedGroups=selected?.format==='groups-knockout';
 $('groupCountWrap')?.classList.toggle('hidden',!createGroups);$('teamGroupWrap')?.classList.toggle('hidden',!selectedGroups);
 if(selectedGroups){const groups=groupNameOptions(selected.groupCount||2);$('tournamentTeamGroup').innerHTML=groups.map(g=>`<option value="${g}">${g}</option>`).join('');if(selected?.teamGroups?.[$('tournamentTeam')?.value])$('tournamentTeamGroup').value=selected.teamGroups[$('tournamentTeam').value];}
}
function tournamentFormReset(){['tournamentName','tournamentVenue','tournamentState','tournamentDistrict','tournamentTehsil','tournamentPin','tournamentStartDate','tournamentEndDate'].forEach(id=>{if($(id))$(id).value=''});$('tournamentBanner').value='';$('tournamentFormat').value='league';$('tournamentGroupCount').value='4';$('tournamentSelect').value='';$('createTournament').classList.remove('hidden');$('saveTournamentChanges').classList.remove('hidden');updateTournamentGroupControls();}
function loadTournamentToForm(t){if(!t)return; $('tournamentName').value=t.name||'';$('tournamentVenue').value=t.venue||'';$('tournamentState').value=t.state||'';$('tournamentDistrict').value=t.district||'';$('tournamentTehsil').value=t.tehsil||'';$('tournamentPin').value=t.pinCode||'';$('tournamentStartDate').value=t.startDate||'';$('tournamentEndDate').value=t.endDate||'';$('tournamentFormat').value=t.format||'league';$('tournamentGroupCount').value=String(t.groupCount||4);$('tournamentBanner').value='';updateTournamentGroupControls();}
function selectedTournament(){return (STATE?.tournaments||[]).find(t=>t.id===$('tournamentSelect')?.value)||null}
function groupOpt(t){const opts=groupNameOptions(t.groupCount||2);return t.format==='groups-knockout'?opts.map(g=>`<option value="${g}">${g}</option>`).join(''):''}
function renderTournament(){
 const ok=isPro();$('proNotice').innerHTML=ok?'<div class="notice green">Pro active — tournament workflow unlocked. Team/Player creation remains available without an active plan.</div>':'<div class="notice">Tournament creation is a <b>Pro</b> feature. Existing teams and players can still be managed without a plan.</div>';
 $('createTournament').disabled=!ok;$('saveTournamentChanges').disabled=!ok;$('addTournamentTeam').disabled=!ok;$('quickCreateTournamentTeam').disabled=!ok;$('addTournamentPlayer').disabled=!ok;
 const oldT=$('tournamentSelect').value,oldTeam=$('tournamentTeam').value,oldPlayerTeam=$('tournamentPlayerTeam').value;
 $('tournamentSelect').innerHTML='<option value="">Select saved tournament</option>'+(STATE?.tournaments||[]).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(STATE.tournaments.some(t=>t.id===oldT))$('tournamentSelect').value=oldT;
 $('tournamentTeam').innerHTML=(STATE?.teams||[]).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(STATE.teams.some(t=>t.id===oldTeam))$('tournamentTeam').value=oldTeam;
 const active=selectedTournament();const allowedTeams=active?STATE.teams.filter(t=>(active.teamIds||[]).includes(t.id)):[];
 $('tournamentPlayerTeam').innerHTML=allowedTeams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(allowedTeams.some(t=>t.id===oldPlayerTeam))$('tournamentPlayerTeam').value=oldPlayerTeam;
 const tr=STATE.tournaments;
 $('tournamentList').innerHTML=tr.length?tr.map(t=>{
  const members=(t.teamIds||[]).map(id=>team(id)).filter(Boolean);
  const teamCards=members.map(tm=>`<div class="tournamentRosterCard"><div class="tournamentRosterHead">${tm.logo?`<img src="${esc(tm.logo)}" alt="" onerror="this.style.display='none'">`:''}<div><b>${esc(tm.name)}</b><small>${esc(t.teamGroups?.[tm.id]||'League')} · ${(tm.players||[]).length} players</small></div><div class="rowBtns"><button class="miniBtn" data-editteam="${tm.id}">Edit</button><button class="miniBtn dangerMini" data-deltournamentteam="${t.id}|${tm.id}">Remove from tournament</button></div></div><div class="tournamentRosterPlayers">${(tm.players||[]).map(p=>`<span class="tag">${esc(p.name)} · ${esc(p.role)} <button title="Edit player" data-editplayer="${tm.id}|${p.id}">✎</button><button title="Remove player" data-delplayer="${tm.id}|${p.id}">×</button></span>`).join('')||'<small class="muted">No players added yet — use the Add Player form above.</small>'}</div></div>`).join('');
  const groups=t.format==='groups-knockout'?groupNameOptions(t.groupCount).map(g=>`<div class="adminGroupBlock"><div class="adminGroupTitle">${esc(g)}</div><div class="adminGroupTeams">${members.filter(tm=>(t.teamGroups?.[tm.id]||'Group A')===g).map(tm=>`<span class="tag">${esc(tm.name)}</span>`).join('')||'<span class="muted">No teams in this group</span>'}</div></div>`).join(''):'';
  const venue=[t.venue,t.tehsil,t.district,t.state,t.pinCode].filter(Boolean).join(', '),dates=[t.startDate,t.endDate].filter(Boolean).join(' – ');
  const tournamentMatches=(STATE.matches||[]).filter(m=>String(m.tournamentId||'')===String(t.id)).sort((a,b)=>new Date(a.dateTime||a.startedAt||0)-new Date(b.dateTime||b.startedAt||0));
  const teamOptionsA=members.map((tm,i)=>`<option value="${tm.id}" ${i===0?'selected':''}>${esc(tm.name)}</option>`).join('');
  const teamOptionsB=members.map((tm,i)=>`<option value="${tm.id}" ${i===1?'selected':''}>${esc(tm.name)}</option>`).join('');
  const stageOptions=(t.format==='groups-knockout'?['group','quarterfinal','qualifier','eliminator','semifinal','final','other']:t.format==='knockout'?['quarterfinal','semifinal','final','other']:['league','qualifier','eliminator','semifinal','final','other']).map(st=>`<option value="${st}" ${(t.format==='groups-knockout'?st==='group':t.format==='knockout'?st==='quarterfinal':st==='league')?'selected':''}>${stageLabel(st)}</option>`).join('');
  const matchRows=tournamentMatches.length?tournamentMatches.map(m=>{const status=m.status==='live'?'LIVE':m.status==='finished'?'COMPLETED':m.status==='abandoned'?'ABANDONED':'UPCOMING';const date=m.dateTime?new Date(m.dateTime).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'Date to be confirmed';return `<div class="fixtureAdminRow"><div class="fixtureAdminMeta"><span class="fixtureStatus ${m.status==='live'?'live':m.status==='finished'?'done':m.status==='abandoned'?'done':'scheduled'}">${status}</span><small>${esc(date)} · ${esc(stageLabel(m.stage||'league'))}${m.groupName?' · '+esc(m.groupName):''}</small></div><b>${esc(m.teamAName||team(m.teamA)?.name||'Team A')} <span>vs</span> ${esc(m.teamBName||team(m.teamB)?.name||'Team B')}</b><div class="fixtureAdminActions">${m.status==='scheduled'?`<button class="miniBtn" data-start-fixture="${m.id}">Start this match</button>`:m.status==='live'&&STATE.activeMatch?.id===m.id?`<button class="miniBtn" data-resume-fixture="${m.id}">Resume scoring</button>`:`<a class="miniBtn" href="scoreboard.html?match=${encodeURIComponent(m.id)}" target="_blank" rel="noopener">Scorecard</a>`}${m.status!=='live'?`<button class="miniBtn dangerMini" data-delmatch="${m.id}">Remove</button>`:''}</div></div>`}).join(''):'<div class="emptyState compactEmpty">No fixtures yet. Generate a round-robin schedule or add a match manually.</div>';
  const scheduleTools=`<div class="tournamentFixturesPanel"><div class="fixturePanelHead"><div><span class="eyebrow">03 / FIXTURES & SCHEDULE</span><h3>Match Schedule</h3><p class="muted smallHelp">Upcoming fixtures are saved first. Start a scheduled fixture to keep the same public match link when it goes live.</p></div><span class="tag">${tournamentMatches.filter(m=>m.status==='scheduled').length} UPCOMING</span></div><div class="fixtureToolsGrid"><div class="fixtureToolBox"><h4>Auto-generate round-robin fixtures</h4><p class="muted smallHelp">${t.format==='groups-knockout'?'Creates fixtures only between teams in the same group.':'Creates one league fixture per unique team pairing.'}${t.format==='knockout'?' Knockout byes and advancing teams are not guessed; add rounds manually.':''}</p><div class="fixtureFormGrid"><label>First date<input type="date" data-fixture-date="${t.id}" value="${t.startDate||new Date().toISOString().slice(0,10)}"></label><label>Start time<input type="time" data-fixture-time="${t.id}" value="09:00"></label><label>Matches per day<select data-fixture-per-day="${t.id}"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option><option value="6">6</option></select></label><label>Gap between matches<select data-fixture-gap="${t.id}"><option value="3">3 hours</option><option value="4">4 hours</option><option value="6" selected>6 hours</option><option value="8">8 hours</option><option value="10">10 hours</option></select></label><label>Overs per match<select data-fixture-overs="${t.id}"><option>5</option><option>10</option><option selected>20</option><option>30</option><option>50</option></select></label></div><button class="btn primary" data-generate-fixtures="${t.id}" ${!ok||members.length<2||t.format==='knockout'?'disabled':''}>Generate Fixtures</button></div><div class="fixtureToolBox"><h4>Add one scheduled fixture</h4><div class="fixtureFormGrid"><label>Team A<select data-fixture-team-a="${t.id}">${teamOptionsA||'<option value="">Add teams first</option>'}</select></label><label>Team B<select data-fixture-team-b="${t.id}">${teamOptionsB||'<option value="">Add teams first</option>'}</select></label><label>Stage<select data-fixture-stage="${t.id}">${stageOptions}</select></label><label>Date<input type="date" data-manual-fixture-date="${t.id}" value="${t.startDate||new Date().toISOString().slice(0,10)}"></label><label>Time<input type="time" data-manual-fixture-time="${t.id}" value="09:00"></label><label>Venue<input type="text" data-manual-fixture-venue="${t.id}" value="${esc(t.venue||'')}" placeholder="Ground / stadium"></label><label>Overs<select data-manual-fixture-overs="${t.id}"><option>5</option><option>10</option><option selected>20</option><option>30</option><option>50</option></select></label></div><button class="btn ghost" data-add-fixture="${t.id}" ${!ok||members.length<2?'disabled':''}>+ Add Scheduled Match</button></div></div><div class="fixtureAdminList">${matchRows}</div></div>`;
  return `<div class="panel tournamentAdminCard"><div class="tournamentBannerPreview" style="background-image:${t.banner?`url(${t.banner})`:'linear-gradient(115deg,#071a2e,#087f70 55%,#c27a24)'}"><b>${esc(t.name)}</b><span class="adminFormatPill">${t.format==='groups-knockout'?'GROUPS + KNOCKOUT':t.format==='knockout'?'KNOCKOUT':'LEAGUE / POINTS TABLE'}</span><span class="tournamentBannerVenue">${esc(venue||'Venue to be confirmed')} ${dates?' · '+esc(dates):''}</span></div><div class="panelHead tournamentControlHead"><div class="tournamentControlCopy"><span class="eyebrow">TOURNAMENT CONTROL</span><h3>${esc(t.name)}</h3><p class="muted smallHelp">${members.length} teams · ${t.format==='groups-knockout'?`${t.groupCount||2} groups`:t.format==='knockout'?'Knockout rounds':'Automatic points table'}</p><p class="muted smallHelp">${esc(venue||'Venue to be confirmed')}${dates?' · '+esc(dates):''}</p></div><div class="rowBtns tournamentControlActions"><span class="planPill active">${members.length} TEAMS</span><button class="miniBtn" data-edit-tournament="${t.id}">Edit details</button><button class="miniBtn dangerMini" data-deltournament="${t.id}">Remove Tournament</button><button class="btn primary" data-start-tournament="${t.id}">🏏 Start a Match</button></div></div>${groups}<div class="tournamentRosterGrid">${teamCards||'<div class="emptyState">First add a team to this tournament.</div>'}</div>${scheduleTools}<div class="tournamentAdminActions"><span class="muted smallHelp">Groups appear only in Groups + Knockout format. Team removal only detaches it from this tournament.</span><a class="miniBtn" href="jangid-cricinfo.html#tournaments" target="_blank" rel="noopener">Open Public Tournament Centre ↗</a></div></div>`
 }).join(''):'<div class="panel emptyState">No tournament yet. Create your first competition above.</div>';
 updateTournamentGroupControls();refreshMatchGroupOptions();
}
function serviceLimit(key,fallback=20){const raw=STATE?.user?.serviceLimits?.[key];const n=raw===undefined?fallback:Number(raw);return Number.isFinite(n)?Math.max(0,Math.min(20,Math.floor(n))):fallback}
function availableAnimations(kind){const key=kind==='event'?'eventAnimations':'graphicCards',count=serviceLimit(key);const active=ANIMS.filter(a=>a!=='none').slice(0,count);return active.length?active.concat('none'):['none']}
function animationOptions(kind,current){const list=availableAnimations(kind),selected=list.includes(current)?current:list[0];return list.map(a=>`<option value="${a}" ${selected===a?'selected':''}>${a}</option>`).join('')}
const DESIGN_FONT_STACKS={system:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',arial:'Arial, Helvetica, sans-serif',condensed:'"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif',trebuchet:'"Trebuchet MS", sans-serif',georgia:'Georgia, serif',mono:'"Courier New", Consolas, monospace',impact:'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'};
function designInputValue(id,fallback){const el=$(id);return el?el.value:fallback}
function readDesignControls(){
 const n=(id,min,max,fallback)=>{const value=Number(designInputValue(id,fallback));return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback};
 return {enabled:!!$('designEnabled')?.checked,width:n('designWidth',55,100,92),scale:n('designScale',65,125,100),scoreFont:n('designScoreFont',20,88,56),metaFont:n('designMetaFont',7,24,11),logoSize:n('designLogoSize',18,64,36),opacity:n('designOpacity',25,100,94),radius:n('designRadius',0,40,15),border:n('designBorder',0,6,1),shape:designInputValue('designShape','rounded'),fontFamily:designInputValue('designFont','system'),position:designInputValue('designPosition','bottom-center'),bg:designInputValue('designBg','#071626'),accent:designInputValue('designAccent','#58c8ff'),text:designInputValue('designText','#f4f9ff')};
}
function setDesignControls(d={}){
 const x={...DESIGN_DEFAULTS,...d};const map={designEnabled:x.enabled,designWidth:x.width,designScale:x.scale,designScoreFont:x.scoreFont,designMetaFont:x.metaFont,designLogoSize:x.logoSize,designOpacity:x.opacity,designRadius:x.radius,designBorder:x.border,designShape:x.shape,designFont:x.fontFamily,designPosition:x.position,designBg:x.bg,designAccent:x.accent,designText:x.text};
 for(const [id,value] of Object.entries(map)){const el=$(id);if(el){if(el.type==='checkbox')el.checked=!!value;else el.value=String(value)}}
 SCORE_DESIGN=x;updateDesignerPreview();
}
function updateDesignerPreview(){
 const d=readDesignControls();SCORE_DESIGN=d;
 const outputs={designWidthOut:`${d.width}vw`,designScaleOut:`${d.scale}%`,designScoreFontOut:`${d.scoreFont}px`,designMetaFontOut:`${d.metaFont}px`,designLogoSizeOut:`${d.logoSize}px`,designOpacityOut:`${d.opacity}%`,designRadiusOut:`${d.radius}px`,designBorderOut:`${d.border}px`};
 for(const [id,value] of Object.entries(outputs)){const el=$(id);if(el)el.textContent=value}
 const preview=$('designLivePreview');if(preview){preview.className=`designerPreview shape-${d.shape}`;preview.style.setProperty('--dp-accent',d.accent);preview.style.setProperty('--dp-bg',hexToRgbaControl(d.bg,d.opacity/100));preview.style.setProperty('--dp-text',d.text);preview.style.setProperty('--dp-radius',`${d.radius}px`);preview.style.setProperty('--dp-border',`${d.border}px`);preview.style.setProperty('--dp-font',DESIGN_FONT_STACKS[d.fontFamily]||DESIGN_FONT_STACKS.system);preview.style.setProperty('--dp-score',`${d.scoreFont}px`);preview.style.setProperty('--dp-meta',`${d.metaFont}px`);preview.style.setProperty('--dp-logo',`${d.logoSize}px`);preview.style.width=`${d.width}%`;preview.style.maxWidth='960px';preview.style.transform=`scale(${d.scale/100})`;preview.style.transformOrigin='left center';preview.style.opacity=d.enabled?'1':'.9'}
 const hint=$('designApplyHint');if(hint)hint.textContent=d.enabled?'Custom Design Override is ON. Saved design will apply to OBS Score Layer.':'Preview updates instantly. Enable Custom Design Override to apply it to the live OBS layer.';
}
function hexToRgbaControl(hex,alpha=1){const m=/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex||''));if(!m)return `rgba(7,22,38,${alpha})`;return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${Math.max(0,Math.min(1,alpha))})`}
function scheduleDesignSave(){updateDesignerPreview();if(!STATE?.user)return;if(designSaveTimer)clearTimeout(designSaveTimer);designSaveTimer=setTimeout(async()=>{try{await saveBroadcast({event:null})}catch(e){const hint=$('designApplyHint');if(hint)hint.textContent=`Design preview ready, but auto-save failed: ${e.message}`}},350)}
function initDesignControls(){if(designControlsInitialized)return;designControlsInitialized=true;const panel=$('scoreDesignPanel');if(!panel)return;panel.addEventListener('input',e=>{if(e.target.matches('input,select'))scheduleDesignSave()});panel.addEventListener('change',e=>{if(e.target.matches('input,select'))scheduleDesignSave()});$('resetDesignBtn')?.addEventListener('click',()=>{setDesignControls({...DESIGN_DEFAULTS,enabled:true});scheduleDesignSave();});$('previewDesignBtn')?.addEventListener('click',()=>{const p=$('designLivePreview');if(!p)return;p.classList.remove('previewPulse');void p.offsetWidth;p.classList.add('previewPulse');setTimeout(()=>p.classList.remove('previewPulse'),1100)});}
function fillGraphics(){
 const layoutCount=serviceLimit('scoreLayouts');
 $('layerSelect').innerHTML=layoutCount?LAYERS.slice(0,layoutCount).map((x,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}. ${x}</option>`).join(''):'<option value="0">Layouts disabled by Admin</option>';
 $('colorSelect').innerHTML=COLORS.map((x,i)=>`<option value="${i+1}">${i+1}. ${x}</option>`).join('');
 const eventOptions=availableAnimations('event'),cardOptions=availableAnimations('card');
 $('animationSelect').innerHTML=eventOptions.map(x=>`<option value="${x}">${x}</option>`).join('');$('animationSelect').value=eventOptions.includes('zoom')?'zoom':eventOptions[0];
 $('cardAnimationSelect').innerHTML=cardOptions.map(x=>`<option value="${x}">${x}</option>`).join('');$('cardAnimationSelect').value=cardOptions.includes('zoom')?'zoom':cardOptions[0];
 $('eventGallery').innerHTML=EVENTS.filter(e=>!['FOUR','SIX','WICKET','NO BALL','WIDE','LEG BYE'].includes(e)).map(e=>`<div class="eventTile"><b>${e}</b><small>Auto trigger · separate style</small><select data-event-anim="${e}" aria-label="${e} animation">${animationOptions('event',EVENT_ANIM_MAP[e])}</select><label class="eventDurationLabel">Duration (ms)<input data-event-duration="${e}" type="number" min="300" max="10000" step="100" value="${EVENT_DURATION_MAP[e]||2200}"></label></div>`).join('');
 document.querySelectorAll('[data-event-anim]').forEach(x=>x.onchange=async()=>{EVENT_ANIM_MAP[x.dataset.eventAnim]=x.value;if(x.dataset.eventAnim==='FREE HIT')EVENT_ANIM_MAP['NO BALL']=x.value;await saveBroadcast({event:null})});
 document.querySelectorAll('[data-event-duration]').forEach(x=>x.onchange=async()=>{EVENT_DURATION_MAP[x.dataset.eventDuration]=Math.max(300,Math.min(10000,Number(x.value)||2200));x.value=EVENT_DURATION_MAP[x.dataset.eventDuration];await saveBroadcast({event:null})});
 $('cardAnimationGallery').innerHTML=CARD_TYPES.map(([key,label])=>`<div class="cardAnimItem"><label>${label}</label><div class="cardAnimControls"><select data-card-anim="${key}" aria-label="${label} animation">${animationOptions('card',CARD_ANIM_MAP[key]||'zoom')}</select><label class="durationLabel">Duration <input data-card-duration="${key}" type="number" min="300" max="10000" step="100" value="${CARD_DURATION_MAP[key]||1800}"> ms</label></div></div>`).join('');
 document.querySelectorAll('[data-card-anim]').forEach(x=>x.onchange=async()=>{CARD_ANIM_MAP[x.dataset.cardAnim]=x.value;await saveBroadcast({event:null})});
 document.querySelectorAll('[data-card-duration]').forEach(x=>x.onchange=async()=>{CARD_DURATION_MAP[x.dataset.cardDuration]=Math.max(300,Math.min(10000,Number(x.value)||1800));x.value=CARD_DURATION_MAP[x.dataset.cardDuration];await saveBroadcast({event:null})});
 initDesignControls();
 updateLayerPreview();
}
function renderGraphics(){
 const b=STATE?.broadcast||{};
 SCORE_DESIGN={...DESIGN_DEFAULTS,...(b.design||{})};
 if(b.eventAnimations)EVENT_ANIM_MAP={...EVENT_ANIM_MAP,...b.eventAnimations};
 EVENT_ANIM_MAP['NO BALL']=EVENT_ANIM_MAP['FREE HIT']||'spotlight';
 if(b.eventDurations)EVENT_DURATION_MAP={...EVENT_DURATION_MAP,...b.eventDurations};
 if(b.cardAnimations)CARD_ANIM_MAP={...CARD_ANIM_MAP,...b.cardAnimations};
 if(b.cardDurations)CARD_DURATION_MAP={...CARD_DURATION_MAP,...b.cardDurations};
 fillGraphics();
 const allowedLayers=serviceLimit('scoreLayouts');
 $('layerSelect').value=String(allowedLayers?Math.min(allowedLayers,Math.max(1,Number(b.layer)||1)):0);
 $('colorSelect').value=String(Math.min(20,Math.max(1,Number(b.color)||1)));
 const allowedEventAnimations=availableAnimations('event');$('animationSelect').value=allowedEventAnimations.includes(b.animation)?b.animation:(allowedEventAnimations.includes('zoom')?'zoom':allowedEventAnimations[0]);
 if(b.duration)$('animationDuration').value=b.duration;
 const allowedCardAnimations=availableAnimations('card');$('cardAnimationSelect').value=allowedCardAnimations.includes(b.cardAnimation)?b.cardAnimation:(allowedCardAnimations.includes('zoom')?'zoom':allowedCardAnimations[0]);
 if(b.cardDuration)$('cardAnimationDuration').value=b.cardDuration;
 document.querySelectorAll('[data-event-anim]').forEach(x=>{const list=availableAnimations('event'),v=EVENT_ANIM_MAP[x.dataset.eventAnim]||b.animation||'zoom';x.value=list.includes(v)?v:list[0];EVENT_ANIM_MAP[x.dataset.eventAnim]=x.value});
 document.querySelectorAll('[data-event-duration]').forEach(x=>x.value=EVENT_DURATION_MAP[x.dataset.eventDuration]||b.duration||2200);
 document.querySelectorAll('[data-card-anim]').forEach(x=>{const list=availableAnimations('card'),v=CARD_ANIM_MAP[x.dataset.cardAnim]||'zoom';x.value=list.includes(v)?v:list[0];CARD_ANIM_MAP[x.dataset.cardAnim]=x.value});
 document.querySelectorAll('[data-card-duration]').forEach(x=>x.value=CARD_DURATION_MAP[x.dataset.cardDuration]||1800);
 syncCardButtonState(b.card?.type||activeCardType);
 setDesignControls(SCORE_DESIGN);
 updateLayerPreview();
 loadAdminStudioDesigns(b.studioDesign?.activeTemplateId || '');
}

let ADMIN_STUDIO_TEMPLATES=[],ADMIN_CARD_TEMPLATES=[],ADMIN_ANIMATION_TEMPLATES=[];
async function loadAdminStudioDesigns(selectedId=''){
 const select=$('studioDesignSelect');if(!select)return;
 try{
  const response=await api('/api/public/studio-library');const data=response.studioDesign||response;ADMIN_STUDIO_TEMPLATES=Array.isArray(data.templates)?data.templates:[];ADMIN_CARD_TEMPLATES=Array.isArray(data.cardTemplates)?data.cardTemplates:[];ADMIN_ANIMATION_TEMPLATES=Array.isArray(data.animationTemplates)?data.animationTemplates:[];
  const fill=(id,list,label,infoId,statusId,wanted='')=>{const el=$(id);if(!el)return;if(!list.length){el.innerHTML=`<option value="">No published ${label} designs</option>`;if($(infoId))$(infoId).textContent=`Admin → Studio Canvas के ${label} Designer में design बनाकर Publish करें।`;if($(statusId))$(statusId).textContent=`अभी कोई Published ${label} design उपलब्ध नहीं है।`;return;}el.innerHTML=list.map(t=>`<option value="${esc(t.id)}">${esc(t.name||'Untitled Design')}</option>`).join('');if(wanted&&list.some(t=>String(t.id)===String(wanted)))el.value=wanted;};
  fill('studioDesignSelect',ADMIN_STUDIO_TEMPLATES,'Score Layer','studioDesignInfo','studioDesignStatus',selectedId||STATE?.broadcast?.studioDesign?.activeTemplateId||'');
  fill('studioCardDesignSelect',ADMIN_CARD_TEMPLATES,'Card','studioCardDesignInfo','studioCardDesignStatus',STATE?.broadcast?.cardDesign?.template?.id||'');
  fill('studioAnimationDesignSelect',ADMIN_ANIMATION_TEMPLATES,'Animation','studioAnimationDesignInfo','studioAnimationDesignStatus',STATE?.broadcast?.animationDesign?.template?.id||'');
  updateStudioDesignInfo();updateStudioCardDesignInfo();updateStudioAnimationDesignInfo();
  loadSponsorControls();
 }catch(error){select.innerHTML='<option value="">Design library unavailable</option>';$('studioDesignStatus').textContent=`Design list load नहीं हुई: ${error.message}`;}
}
function updateStudioDesignInfo(){const t=ADMIN_STUDIO_TEMPLATES.find(x=>String(x.id)===String($('studioDesignSelect')?.value));const info=$('studioDesignInfo');if(info)info.textContent=t?`${t.name||'Untitled'} · ${(t.elements||[]).length} canvas elements · ${t.backgroundImage?'Custom artwork uploaded':'No uploaded artwork'}`:'Admin Score Layer design चुनें।';}
function updateStudioCardDesignInfo(){const t=ADMIN_CARD_TEMPLATES.find(x=>String(x.id)===String($('studioCardDesignSelect')?.value));const info=$('studioCardDesignInfo');if(info)info.textContent=t?`${t.name||'Untitled'} · ${(t.elements||[]).length} canvas elements · Card Library`:'Admin Card design चुनें।';}
function updateStudioAnimationDesignInfo(){const t=ADMIN_ANIMATION_TEMPLATES.find(x=>String(x.id)===String($('studioAnimationDesignSelect')?.value));const info=$('studioAnimationDesignInfo');if(info)info.textContent=t?`${t.name||'Untitled'} · ${(t.elements||[]).length} canvas elements · Animation Library`:'Admin Animation design चुनें।';}
async function applySelectedStudioDesign(){
 const t=ADMIN_STUDIO_TEMPLATES.find(x=>String(x.id)===String($('studioDesignSelect')?.value));if(!t){$('studioDesignStatus').textContent='पहले Admin द्वारा बनाया गया design चुनें।';return;}
 try{await saveBroadcast({studioDesign:{version:2,enabled:true,activeTemplateId:t.id,previewResolution:'1920x1080',templates:[t]},event:null});$('studioDesignStatus').textContent=`✓ “${t.name||'Design'}” OBS Score Layer पर Apply हो गया।`;}
 catch(error){$('studioDesignStatus').textContent=`Apply नहीं हुआ: ${error.message}`;}
}
async function clearSelectedStudioDesign(){try{await saveBroadcast({studioDesign:{version:2,enabled:false,activeTemplateId:'',previewResolution:'1920x1080',templates:[]},event:null});$('studioDesignStatus').textContent='Standard Score Layer चालू कर दिया गया।';}catch(error){$('studioDesignStatus').textContent=`बदलाव नहीं हुआ: ${error.message}`;}}
async function applySelectedStudioCardDesign(){const t=ADMIN_CARD_TEMPLATES.find(x=>String(x.id)===String($('studioCardDesignSelect')?.value));if(!t){$('studioCardDesignStatus').textContent='पहले Card Designer से Published design चुनें।';return;}try{await saveBroadcast({cardDesign:{version:1,enabled:true,template:t},event:null});$('studioCardDesignStatus').textContent=`✓ “${t.name||'Card'}” अब सभी supported on-screen Cards पर लागू होगा।`;}catch(error){$('studioCardDesignStatus').textContent=`Apply नहीं हुआ: ${error.message}`;}}
async function clearSelectedStudioCardDesign(){try{await saveBroadcast({cardDesign:{version:1,enabled:false,template:null},event:null});$('studioCardDesignStatus').textContent='Standard Player Cards चालू हैं।';}catch(error){$('studioCardDesignStatus').textContent=`बदलाव नहीं हुआ: ${error.message}`;}}
async function applySelectedStudioAnimationDesign(){const t=ADMIN_ANIMATION_TEMPLATES.find(x=>String(x.id)===String($('studioAnimationDesignSelect')?.value));if(!t){$('studioAnimationDesignStatus').textContent='पहले Animation Designer से Published design चुनें।';return;}try{await saveBroadcast({animationDesign:{version:1,enabled:true,template:t},event:null});$('studioAnimationDesignStatus').textContent=`✓ “${t.name||'Animation'}” Event Graphics पर Apply हो गया।`;}catch(error){$('studioAnimationDesignStatus').textContent=`Apply नहीं हुआ: ${error.message}`;}}
async function clearSelectedStudioAnimationDesign(){try{await saveBroadcast({animationDesign:{version:1,enabled:false,template:null},event:null});$('studioAnimationDesignStatus').textContent='Standard Event Animations चालू हैं।';}catch(error){$('studioAnimationDesignStatus').textContent=`बदलाव नहीं हुआ: ${error.message}`;}}
$('studioDesignSelect')?.addEventListener('change',updateStudioDesignInfo);$('studioCardDesignSelect')?.addEventListener('change',updateStudioCardDesignInfo);$('studioAnimationDesignSelect')?.addEventListener('change',updateStudioAnimationDesignInfo);
$('refreshStudioLibrary')?.addEventListener('click',()=>loadAdminStudioDesigns($('studioDesignSelect')?.value||''));
$('applyStudioDesign')?.addEventListener('click',applySelectedStudioDesign);$('clearStudioDesign')?.addEventListener('click',clearSelectedStudioDesign);
$('applyStudioCardDesign')?.addEventListener('click',applySelectedStudioCardDesign);$('clearStudioCardDesign')?.addEventListener('click',clearSelectedStudioCardDesign);
$('applyStudioAnimationDesign')?.addEventListener('click',applySelectedStudioAnimationDesign);$('clearStudioAnimationDesign')?.addEventListener('click',clearSelectedStudioAnimationDesign);


let CONTROL_SPONSORS=[];
async function loadSponsorControls(){
 const select=$('sponsorSelect');if(!select)return;
 try{
  const data=await api('/api/public/sponsor-library');CONTROL_SPONSORS=Array.isArray(data.sponsors)?data.sponsors:[];
  const current=STATE?.broadcast?.sponsorDisplay||{};
  select.innerHTML=CONTROL_SPONSORS.length?CONTROL_SPONSORS.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}${x.published?'':' (Draft)'}</option>`).join(''):'<option value="">No published sponsors — Admin → Sponsor Studio में Publish करें</option>';
  if(current.sponsorId&&CONTROL_SPONSORS.some(x=>String(x.id)===String(current.sponsorId)))select.value=current.sponsorId;
  if($('sponsorAutoEnabled'))$('sponsorAutoEnabled').checked=current.autoEnabled===true;
  if($('sponsorRotateAll'))$('sponsorRotateAll').checked=current.rotate===true;
  if($('sponsorControlInterval'))$('sponsorControlInterval').value=current.intervalOvers||5;
  updateSponsorControlInfo();
 }catch(e){select.innerHTML='<option value="">Sponsor Library unavailable</option>';if($('sponsorControlStatus'))$('sponsorControlStatus').textContent=e.message;}
}
function updateSponsorControlInfo(){
 const s=CONTROL_SPONSORS.find(x=>String(x.id)===String($('sponsorSelect')?.value));const box=$('sponsorControlInfo');if(box)box.textContent=s?`${s.name} · ${s.style||'gold'} · ${s.animation||'reveal'} · Hold ${s.holdMs||5000} ms · Triggers: ${(s.triggers||[]).join(', ')||'Manual only'}`:'पहले Admin Sponsor Studio में Sponsor बनाकर Publish करें।';
}
async function setSponsorBroadcast(mode){
 const select=$('sponsorSelect'),status=$('sponsorControlStatus');
 try{
  if(mode!=='off'&&!select?.value){if(status)status.textContent='पहले एक Published Sponsor चुनें।';return;}
  const previous=STATE?.broadcast?.sponsorDisplay||{};
  const autoEnabled=$('sponsorAutoEnabled')?.checked===true,rotate=$('sponsorRotateAll')?.checked===true,intervalOvers=Math.max(1,Math.min(50,Number($('sponsorControlInterval')?.value)||5));
  const config={enabled:mode!=='off',sponsorId:mode==='off'?'':select.value,autoEnabled,rotate,intervalOvers,manualToken:mode==='show'?String(Date.now()):String(previous.manualToken||''),timeoutToken:mode==='timeout'?String(Date.now()):String(previous.timeoutToken||'')};
  await saveBroadcast({sponsorDisplay:config,event:null});
  if(status)status.textContent=mode==='off'?'Sponsor Graphics OFF कर दिए गए।':mode==='timeout'?'Timeout Sponsor Cue भेज दिया गया।':'Sponsor Broadcast पर भेज दिया गया।';
 }catch(e){if(status)status.textContent=`Sponsor Control Error: ${e.message}`;}
}
$('sponsorSelect')?.addEventListener('change',updateSponsorControlInfo);
$('showSponsorNow')?.addEventListener('click',()=>setSponsorBroadcast('show'));
$('turnSponsorOff')?.addEventListener('click',()=>setSponsorBroadcast('off'));
$('showSponsorTimeout')?.addEventListener('click',()=>setSponsorBroadcast('timeout'));
$('sponsorAutoEnabled')?.addEventListener('change',async()=>{const prev=STATE?.broadcast?.sponsorDisplay||{};if(!prev.sponsorId)return;try{await saveBroadcast({sponsorDisplay:{...prev,enabled:true,autoEnabled:$('sponsorAutoEnabled').checked,intervalOvers:Number($('sponsorControlInterval').value)||5},event:null})}catch(e){$('sponsorControlStatus').textContent=e.message}});
$('sponsorRotateAll')?.addEventListener('change',async()=>{const prev=STATE?.broadcast?.sponsorDisplay||{};if(!prev.sponsorId)return;try{await saveBroadcast({sponsorDisplay:{...prev,enabled:true,rotate:$('sponsorRotateAll').checked},event:null})}catch(e){$('sponsorControlStatus').textContent=e.message}});
$('sponsorControlInterval')?.addEventListener('change',async()=>{const prev=STATE?.broadcast?.sponsorDisplay||{};if(!prev.sponsorId)return;try{await saveBroadcast({sponsorDisplay:{...prev,intervalOvers:Number($('sponsorControlInterval').value)||5},event:null})}catch(e){$('sponsorControlStatus').textContent=e.message}});

function updateLayerPreview(){
 const p=$('layerPreview');if(!p)return;
 const layout=Math.max(1,Math.min(20,+$('layerSelect').value||1));
 const color=Math.max(1,Math.min(20,+$('colorSelect').value||1));
 p.className=`layerPreview jlInternationalPreview layout${layout} color${color}`;p.dataset.layout=String(layout);
 $('colorSelect').disabled=false;
 $('colorSelect').title='Colour changes independently from the selected shape layout.';
 const hint=$('colorStyleHint');
 if(hint)hint.textContent='20 international layouts with different shapes · 20 independent colour combinations · full batting, score, target, partnership, bowler and over details.';
 p.innerHTML=`<div class="jcPvPanel jcPvBatting"><small>INDIA · AT THE CREASE</small><span class="jcPvPlayer"><b>ROHIT</b><b>58 (31)</b></span><span class="jcPvPlayer"><b>VIRAT</b><b>42 (28)</b></span></div><div class="jcPvPanel jcPvScore"><small>LIVE · INNINGS 2</small><strong>189/2</strong><div class="jcPvStats"><b>17.3 OV</b><b>CRR 10.80</b></div><small>EXTRAS 8 · P2</small></div><div class="jcPvPanel jcPvTarget"><div class="jcPvTargetMain"><small>TARGET FOR AUSTRALIA</small><strong>206</strong><small>NEED 17 · 39 BALLS · RRR 2.62</small></div><div class="jcPvPartnership"><small>PARTNERSHIP</small><b>101 (62)</b></div></div><div class="jcPvPanel jcPvBowling"><small>BOWLER · ELLIS</small><b>2.3 O · 0 M · 24 R · 1 W</b><small>THIS OVER</small><span class="jcPvBalls"><i>1</i><i class="four">4</i><i>0</i><i class="six">6</i><i class="wicket">W</i><i>1</i></span></div>`;
}
let EVENT_ANIM_MAP={FOUR:'boundary-ripple',SIX:'stadium-surge',WICKET:'shard-break','FREE HIT':'spotlight',FIFTY:'orbit',CENTURY:'fireworks','NO BALL':'spotlight',WIDE:'fade','LEG BYE':'fade',BYE:'fade','NEW BATSMAN':'bounce','NEW BOWLER':'flip',RESULT:'fireworks','INNINGS BREAK':'shatter',POWERPLAY:'glitch',PARTNERSHIP:'rotate','50 PARTNERSHIP':'spark'};
async function saveBroadcast(extra={}){
  const hasEventUpdate=Object.prototype.hasOwnProperty.call(extra,'event');
  const hasEventIdOverride=Object.prototype.hasOwnProperty.call(extra,'eventId');
  const payload={layer:+$('layerSelect').value,color:+$('colorSelect').value,design:readDesignControls(),animation:$('animationSelect').value,duration:Math.max(300,Math.min(10000,+$('animationDuration').value||2200)),cardAnimation:$('cardAnimationSelect')?.value||'zoom',cardDuration:Math.max(300,Math.min(10000,+$('cardAnimationDuration')?.value||1800)),eventAnimations:EVENT_ANIM_MAP,eventDurations:EVENT_DURATION_MAP,cardAnimations:CARD_ANIM_MAP,cardDurations:CARD_DURATION_MAP,...extra};
  // Only a real event change (or explicit eventId) advances the animation token.
  // Palette, layout and other settings must never replay the previous event.
  if(hasEventIdOverride)payload.eventId=extra.eventId;
  else if(hasEventUpdate){
    payload.eventId=++broadcastSequence;
    payload.eventAt=extra.event?Number(extra.eventAt||Date.now()):null;
    payload.matchId=extra.event?String(extra.matchId||MATCH?.id||''):null;
  }
  else if(STATE?.broadcast?.eventId!==undefined)payload.eventId=STATE.broadcast.eventId;
  await api('/api/broadcast',{method:'POST',body:JSON.stringify(payload)});
  if(STATE)STATE.broadcast={...(STATE.broadcast||{}),...payload};
}
// The no-code visual editor persists its template library beside the existing broadcast settings.
window.persistScoreboardStudio = async (studioDesign) => saveBroadcast({studioDesign, event:null});
function eventStyle(event){return EVENT_STYLES[event]||'generic'}
async function publishEventNow(event,meta={}){
 // Broadcast graphics are best-effort: a graphics/API failure must never roll back a saved ball or lock scoring.
 if(!activePlan())return {ok:false,skipped:true};
 const duration=EVENT_DURATION_MAP[event]||Math.max(300,Math.min(10000,+$('animationDuration').value||2200));
 try{
  await saveBroadcast({event,eventStyle:eventStyle(event),animation:EVENT_ANIM_MAP[event]||$('animationSelect').value,duration,...meta,matchId:MATCH?.id||meta.matchId||null,eventAt:Date.now()});
  return {ok:true};
 }catch(error){
  console.warn(`Broadcast effect ${event} could not be shown; scoring remains saved.`,error);
  const status=$('eventBroadcastStatus');
  if(status)status.textContent='स्कोर सुरक्षित है; Broadcast Graphic अभी उपलब्ध नहीं है।';
  return {ok:false,error:error?.message||'Broadcast unavailable'};
 }
}
function cancelEventSequenceTimers(){
 for(const timer of eventSequenceTimers)clearTimeout(timer);
 eventSequenceTimers.clear();
}
function enqueueCurrentEvent(event,meta,generation){
 const task=eventBroadcastQueue.catch(()=>({ok:false})).then(()=>{
  // A newer ball/event arrived while this save was waiting; discard the stale one.
  if(generation!==eventPublishGeneration)return {ok:false,skipped:true};
  return publishEventNow(event,meta);
 });
 eventBroadcastQueue=task.catch(error=>{console.warn('Broadcast event save failed:',error);return {ok:false,error:error?.message||'Broadcast unavailable'};});
 return task;
}
function fireEvent(event,meta={}){
 cancelEventSequenceTimers();
 const generation=++eventPublishGeneration;
 // Do not wait for the previous animation's display duration. The newest event wins.
 return enqueueCurrentEvent(event,meta,generation);
}
function fireEventSequence(events){
 cancelEventSequenceTimers();
 const generation=++eventPublishGeneration;
 const sequence=events.filter(Boolean);
 let index=0;
 const showNext=async()=>{
  if(generation!==eventPublishGeneration||index>=sequence.length)return;
  const event=sequence[index++];
  const result=await enqueueCurrentEvent(event,{},generation);
  if(!result?.ok||generation!==eventPublishGeneration||index>=sequence.length)return;
  const duration=Math.max(900,Number(EVENT_DURATION_MAP[event]||$('animationDuration')?.value||2200));
  const timer=setTimeout(()=>{eventSequenceTimers.delete(timer);void showNext();},duration+100);
  eventSequenceTimers.add(timer);
 };
 return showNext();
}
function cardDataFor(type){
 const i=currentInnings();if(!i)return null;
 const bat=team(i.battingId),bowl=team(i.bowlingId);
 const battingIds=matchXI(i.battingId,'batStats'),bowlingIds=matchXI(i.bowlingId,'bowlStats');
 const bats=battingIds.map(id=>i.batStats?.[id]).filter(Boolean),bowls=bowlingIds.map(id=>i.bowlStats?.[id]).filter(Boolean);
 const striker=i.batStats?.[i.striker]||{},nonStriker=i.batStats?.[i.nonStriker]||{},currentBowler=i.bowlStats?.[i.currentBowler]||{};
 const score=Number(i.score||0),wickets=Number(i.wickets||0),balls=Number(i.balls||0);
 const crr=balls?(score/(balls/6)).toFixed(2):'0.00';
 if(type==='batter'||type==='player')return {name:striker.name||'Batter',player:striker,teamName:bat?.name||'',role:type==='batter'?'BATTER':'PLAYER SPOTLIGHT',score,wickets,overs:`${Math.floor(balls/6)}.${balls%6}`,runRate:crr};
 if(type==='bowler')return {name:currentBowler.name||'Bowler',player:currentBowler,teamName:bowl?.name||'',role:'BOWLER',overs:`${Math.floor(Number(currentBowler.balls||0)/6)}.${Number(currentBowler.balls||0)%6}`,economy:currentBowler.balls?(Number(currentBowler.runs||0)/(Number(currentBowler.balls)/6)).toFixed(2):'0.00'};
 if(type==='newBatter'||type==='nextBatter'){const nx=eligibleBatters()[0],p=nx?i.batStats[nx]:null;return {name:p?.name||'No batter available',player:p||{},teamName:bat?.name||'',role:'NEXT BATTER'};}
 if(type==='newBowler'){const nx=eligibleBowlers()[0],p=nx?i.bowlStats[nx]:null;return {name:p?.name||'No bowler available',player:p||{},teamName:bowl?.name||'',role:'NEXT BOWLER'};}
 if(type==='inningsBreak'){const prev=MATCH?.inningsHistory?.[MATCH.inningsHistory.length-1]||i;return {name:'INNINGS BREAK',teamName:team(prev.battingId)?.name||'Batting Team',score:prev.score,wickets:prev.wickets,balls:prev.balls,target:prev.target};}
 if(type==='partnership')return {name:'CURRENT PARTNERSHIP',teamName:bat?.name||'',runs:i.partnership?.runs||0,balls:i.partnership?.balls||0,striker,nonStriker};
 if(type==='teamBatting')return {name:bat?.name||'Batting Team',teamName:bat?.name||'',score,wickets,balls,oversLimit:MATCH?.oversLimit,runRate:crr,extras:i.extras||{},partnership:i.partnership||{runs:0,balls:0},fallOfWickets:i.fallOfWickets||[],players:bats.map(p=>({...p,isStriker:String(p.id)===String(i.striker),isNonStriker:String(p.id)===String(i.nonStriker),notBatted:!p.out&&!p.retired&&!p.balls&&!p.runs&&String(p.id)!==String(i.striker)&&String(p.id)!==String(i.nonStriker)})),strikerId:i.striker,nonStrikerId:i.nonStriker,battingId:i.battingId};
 if(type==='teamBowling')return {name:bowl?.name||'Bowling Team',teamName:bowl?.name||'',score,wickets,balls,players:bowls,bowlingId:i.bowlingId};
 if(type==='result')return {name:MATCH?.result||'MATCH RESULT',teamName:bat?.name||'',score,wickets,balls};
 if(type==='chase'){const ballsLeft=Math.max(0,(MATCH?.oversLimit||0)*6-balls),need=Math.max(0,(Number(i.target)||0)-score);return {name:'RUNS NEEDED',teamName:bat?.name||'',score,wickets,balls,target:i.target||0,runsNeeded:need,ballsRemaining:ballsLeft,rrr:ballsLeft?(need/(ballsLeft/6)).toFixed(2):'0.00',runRate:crr};}
 return null;
}
function syncCardButtonState(type=STATE?.broadcast?.card?.type||activeCardType){
 const selected=type||null;
 document.querySelectorAll('[data-card-button]').forEach(button=>{
  const active=!!selected&&button.dataset.cardButton===selected;
  button.classList.toggle('cardOn',active);
  button.setAttribute('aria-pressed',String(active));
 });
}
async function toggleCard(type){
 if(!activePlan())return planModal('Activate a plan to use broadcast graphics');
 const current=STATE?.broadcast?.card?.type||activeCardType;
 if(current===type){
  activeCardType=null;syncCardButtonState(null);
  try{await saveBroadcast({card:null,cardId:Date.now(),event:null});}
  catch(error){activeCardType=STATE?.broadcast?.card?.type||null;syncCardButtonState();throw error;}
  return;
 }
 const data=cardDataFor(type);if(!data)return alert('Start a match before showing a card.');
 activeCardType=type;syncCardButtonState(type);
 try{await saveBroadcast({card:{type,data},cardId:Date.now(),cardAnimation:CARD_ANIM_MAP[type]||$('cardAnimationSelect').value,cardDurations:CARD_DURATION_MAP,event:null});}
 catch(error){activeCardType=STATE?.broadcast?.card?.type||null;syncCardButtonState();throw error;}
}
async function refreshActiveCard(){const type=STATE?.broadcast?.card?.type||activeCardType;if(!type)return;const data=cardDataFor(type);if(data)await saveBroadcast({card:{type,data},cardId:STATE?.broadcast?.cardId||0,event:null,cardAnimation:CARD_ANIM_MAP[type]||'zoom',cardDurations:CARD_DURATION_MAP})}
function planModal(heading='Match access is required'){
 openModal(`<div class="modalHead"><div><div class="eyebrow">SUBSCRIPTION</div><h3>${heading}</h3></div><button class="closeBtn" id="planCloseX" type="button">×</button></div><p class="muted">Team और Player data पहले से सुरक्षित रहेगा। Match start के समय ही plan activate करना जरूरी है.</p><div class="planChoices"><div class="planCard"><h4>Basic</h4><div class="price">₹100/day</div><p>1–5 days · Single Match · Broadcast Graphics</p></div><div class="planCard"><h4>Pro</h4><div class="price">₹200/day</div><p>3–15 days · Tournament + All Features</p></div></div><div class="modalNotice">Activation ID WhatsApp से मिलता है. Auto-generated Activation ID 6 characters का होगा. Manual ID अधिकतम 18 characters तक हो सकती है. Contact: <b>9928262424</b></div><div class="field" style="margin-top:12px"><label>Activation ID</label><input id="modalActivation" maxlength="18" autocomplete="off" placeholder="A7K2P9"></div><div class="rowBtns"><button class="btn primary" id="activateFromModal" type="button">Activate Plan</button><a class="btn ghost" href="https://wa.me/919928262424" target="_blank">WhatsApp Seller</a><button class="btn ghost" id="planCancel" type="button">Cancel</button></div>`,box=>{
   box.querySelector('#planCloseX').onclick=e=>{e.preventDefault();e.stopPropagation();closeModal()};
   box.querySelector('#planCancel').onclick=e=>{e.preventDefault();e.stopPropagation();closeModal()};
   box.querySelector('#modalActivation').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,18));
   box.querySelector('#activateFromModal').onclick=async()=>{try{await api('/api/activate',{method:'POST',body:JSON.stringify({code:box.querySelector('#modalActivation').value})});closeModal();await refresh();goToMatchSetup();}catch(e){alert(e.message)}};
 })
}
function openModal(html,setup){
  $('modalRoot').innerHTML=`<div class="modalBack" role="dialog" aria-modal="true"><div class="modalBox">${html}</div></div>`;
  const backdrop=$('modalRoot').querySelector('.modalBack');
  const box=backdrop.querySelector('.modalBox');
  backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal()});
  box.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeModal()}));
  setup&&setup(box);
  setTimeout(()=>box.querySelector('input,select,button')?.focus(),0);
}
function closeModal(){const hook=modalCloseHook;modalCloseHook=null;$('modalRoot').innerHTML='';if(typeof hook==='function'){try{hook()}catch(e){console.error(e)}}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});document.addEventListener('click',e=>{if(e.target.closest('[data-close]')||e.target.id==='modalRoot')closeModal()})
function goToMatchSetup(){showPage('match');}
$('startFromDash').onclick=()=>activePlan()?goToMatchSetup():planModal();
$('activateDash').onclick=()=>planModal('Activate your plan');
$('addTeam').onclick=async()=>{try{let logo='';if($('teamLogo').files[0])logo=await compressedLogo($('teamLogo').files[0]);await api('/api/team',{method:'POST',body:JSON.stringify({name:$('teamName').value.trim(),logo})});$('teamName').value='';$('teamLogo').value='';await refresh()}catch(e){alert(e.message)}};
$('addPlayer').onclick=async()=>{try{const selectedTeam=$('playerTeam').value;if(!selectedTeam)return alert('पहले team बनाएं.');const name=$('playerName').value.trim();if(!name)return alert('Player name भरें.');await api(`/api/team/${selectedTeam}/player`,{method:'POST',body:JSON.stringify({name,role:$('playerRole').value,captain:$('playerCaptain').value==='1',viceCaptain:$('playerVC').value==='1'})});$('playerName').value='';await refresh();$('playerTeam').value=selectedTeam}catch(e){alert(e.message)}};
$('tournamentFormat').onchange=updateTournamentGroupControls;$('tournamentGroupCount').onchange=updateTournamentGroupControls;$('tournamentSelect').onchange=()=>{updateTournamentGroupControls();const t=selectedTournament();if(t)loadTournamentToForm(t);refreshMatchGroupOptions();const members=t?STATE.teams.filter(x=>(t.teamIds||[]).includes(x.id)):[];$('tournamentPlayerTeam').innerHTML=members.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');};$('tournamentTeam').onchange=updateTournamentGroupControls;
async function tournamentFormPayload(){const name=$('tournamentName').value.trim();if(!name)throw new Error('Tournament name लिखें.');const startDate=$('tournamentStartDate').value,endDate=$('tournamentEndDate').value;if(startDate&&endDate&&endDate<startDate)throw new Error('Tournament end date, start date से पहले नहीं हो सकती.');const pin=$('tournamentPin').value.trim();if(pin&&!/^\d{6}$/.test(pin))throw new Error('PIN Code 6 digits का होना चाहिए.');let banner=await compressedBanner($('tournamentBanner').files[0]);if(!banner)banner=await generateTournamentBanner(name);return {name,banner,venue:$('tournamentVenue').value,state:$('tournamentState').value,district:$('tournamentDistrict').value,tehsil:$('tournamentTehsil').value,pinCode:pin,startDate,endDate,format:$('tournamentFormat').value,groupCount:Number($('tournamentGroupCount').value)||4};}
function generateTournamentBanner(name){return new Promise(resolve=>{const c=document.createElement('canvas');c.width=1280;c.height=420;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,1280,420);g.addColorStop(0,'#07172d');g.addColorStop(.48,'#075d55');g.addColorStop(1,'#ad691e');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);x.globalAlpha=.22;for(let k=-420;k<1500;k+=120){x.fillStyle=k%2?'#ffffff':'#39e0c2';x.beginPath();x.moveTo(k,0);x.lineTo(k+75,0);x.lineTo(k-135,420);x.lineTo(k-210,420);x.closePath();x.fill()}x.globalAlpha=1;x.fillStyle='#8de7c8';x.font='900 28px Arial';x.fillText('JANGID CRICINFO · TOURNAMENT',66,83);x.fillStyle='#ffffff';let txt=name.length>42?name.slice(0,39)+'…':name;let size=txt.length>26?48:txt.length>18?64:82;x.font=`900 ${size}px Arial`;x.fillText(txt,66,198);x.fillStyle='#c9fff0';x.font='700 24px Arial';x.fillText('LIVE MATCHES  ·  POINTS TABLE  ·  TOURNAMENT HISTORY',69,257);x.strokeStyle='#ffffff75';x.lineWidth=3;x.strokeRect(42,38,1196,344);resolve(c.toDataURL('image/webp',.8))})}
$('createTournament').onclick=async()=>{try{const payload=await tournamentFormPayload();const created=await api('/api/tournament',{method:'POST',body:JSON.stringify(payload)});$('tournamentName').value='';$('tournamentBanner').value='';await refresh();$('tournamentSelect').value=created.tournament.id;loadTournamentToForm(created.tournament);await refresh();alert('Tournament save हो गया और उसका banner तैयार है. अब नीचे से teams जोड़ें.')}catch(e){alert(e.message)}};
$('saveTournamentChanges').onclick=async()=>{try{const t=selectedTournament();if(!t)throw new Error('पहले Tournament to Manage में कोई tournament चुनें.');const payload=await tournamentFormPayload();delete payload.banner;if($('tournamentBanner').files[0])payload.banner=await compressedBanner($('tournamentBanner').files[0]);await api(`/api/tournament/${encodeURIComponent(t.id)}`,{method:'PUT',body:JSON.stringify(payload)});await refresh();alert('Tournament details update हो गईं.')}catch(e){alert(e.message)}};
$('resetTournamentForm').onclick=tournamentFormReset;
$('addTournamentTeam').onclick=async()=>{try{const tr=selectedTournament();if(!tr)return alert('पहले Tournament to Manage चुनें.');const teamId=$('tournamentTeam').value;if(!teamId)return alert('पहले existing team बनाएँ या create करें.');const groupName=tr.format==='groups-knockout'?$('tournamentTeamGroup').value:'League';await api(`/api/tournament/${tr.id}/team`,{method:'POST',body:JSON.stringify({teamId,groupName})});await refresh();alert('Team tournament में जोड़ दी गई.')}catch(e){alert(e.message)}};
$('quickCreateTournamentTeam').onclick=async()=>{try{const tr=selectedTournament();if(!tr)return alert('पहले Tournament to Manage चुनें.');const name=$('quickTournamentTeamName').value.trim();if(!name)return alert('Team name लिखें.');const logo=await compressedLogo($('quickTournamentTeamLogo').files[0]);const created=await api('/api/team',{method:'POST',body:JSON.stringify({name,logo})});const groupName=tr.format==='groups-knockout'?$('tournamentTeamGroup').value:'League';await api(`/api/tournament/${tr.id}/team`,{method:'POST',body:JSON.stringify({teamId:created.team.id,groupName})});$('quickTournamentTeamName').value='';$('quickTournamentTeamLogo').value='';await refresh();$('tournamentPlayerTeam').value=created.team.id;alert('नई team बनकर selected tournament में जुड़ गई. अब उसके players जोड़ें.')}catch(e){alert(e.message)}};
$('addTournamentPlayer').onclick=async()=>{try{const t=selectedTournament(),teamId=$('tournamentPlayerTeam').value,name=$('tournamentPlayerName').value.trim();if(!t)return alert('पहले tournament चुनें.');if(!teamId||!(t.teamIds||[]).includes(teamId))return alert('Tournament की team चुनें.');if(!name)return alert('Player name लिखें.');await api(`/api/team/${encodeURIComponent(teamId)}/player`,{method:'POST',body:JSON.stringify({name,role:$('tournamentPlayerRole').value})});$('tournamentPlayerName').value='';await refresh();$('tournamentPlayerTeam').value=teamId;}catch(e){alert(e.message)}};

document.addEventListener('keydown',e=>{const card=e.target.closest('[data-open-team]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectedTeamId=card.dataset.openTeam;renderTeams();}});
document.addEventListener('click',async e=>{const openTeam=e.target.closest('[data-open-team]');if(openTeam){selectedTeamId=openTeam.dataset.openTeam;renderTeams();return;}if(e.target.closest('#backToTeamList')){selectedTeamId=null;renderTeams();return;}const dp=e.target.closest('[data-delplayer]');const ep=e.target.closest('[data-editplayer]');const et=e.target.closest('[data-editteam]');const editTr=e.target.closest('[data-edit-tournament]');const startTr=e.target.closest('[data-start-tournament]');const dt=e.target.closest('[data-delteam]');const dtt=e.target.closest('[data-deltournamentteam]');const dtr=e.target.closest('[data-deltournament]');const dm=e.target.closest('[data-delmatch]');const cm=e.target.closest('[data-copymatch]');try{if(startTr){e.preventDefault();const tid=startTr.dataset.startTournament;if(STATE?.matchDraft&&STATE.matchDraft.tournamentId!==tid){if(!confirm('Aapke paas ek doosra saved match setup hai. Isse replace karke selected tournament ka setup kholen?'))return;await api('/api/match/draft',{method:'DELETE'});STATE.matchDraft=null;}const existingSame=STATE?.matchDraft?.tournamentId===tid;showPage('match');$('matchTournament').value=tid;refreshMatchTeamOptions();const tr=STATE.tournaments.find(x=>x.id===tid);if(tr&&!existingSame){$('matchLocation').value=tr.venue||'';$('matchState').value=tr.state||'';$('matchDistrict').value=tr.district||'';$('matchTehsil').value=tr.tehsil||'';$('matchPin').value=tr.pinCode||'';}if(!existingSame){matchStep=1;renderMatchStep();scheduleMatchDraftSave(true);}return;}if(editTr){e.preventDefault();$('tournamentSelect').value=editTr.dataset.editTournament;loadTournamentToForm(selectedTournament());window.scrollTo({top:0,behavior:'smooth'});return;}if(et){e.preventDefault();const id=et.dataset.editteam,t=team(id);if(!t)return;const name=prompt('Edit team name:',t.name);if(name===null)return;if(!name.trim())return alert('Team name खाली नहीं हो सकता.');await api(`/api/team/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({name:name.trim()})});await refresh();return;}if(ep){e.preventDefault();const [tid,pid]=ep.dataset.editplayer.split('|'),t=team(tid),p=t?.players.find(x=>x.id===pid);if(!p)return;const name=prompt('Edit player name:',p.name);if(name===null)return;if(!name.trim())return alert('Player name खाली नहीं हो सकता.');const role=prompt('Role: batsman, bowler, allrounder या wicketkeeper',p.role||'batsman');if(role===null)return;await api(`/api/team/${encodeURIComponent(tid)}/player/${encodeURIComponent(pid)}`,{method:'PUT',body:JSON.stringify({name:name.trim(),role:role.toLowerCase()})});await refresh();return;}if(cm){e.preventDefault();const m=(STATE?.matches||[]).find(x=>x.id===cm.dataset.copymatch);if(!m)return;const url=new URL(`scoreboard.html?match=${encodeURIComponent(m.id)}`,document.baseURI).href;try{await navigator.clipboard.writeText(url);cm.textContent='Copied!';setTimeout(()=>cm.textContent='Copy Link',1200)}catch{prompt('Copy public match link:',url)}return}if(dm){e.preventDefault();if(!confirm('इस match को history और public link से permanently हटाएँ? Teams, players और दूसरे matches नहीं हटेंगे.'))return;await api(`/api/match/${encodeURIComponent(dm.dataset.delmatch)}`,{method:'DELETE'});if(MATCH?.id===dm.dataset.delmatch)MATCH=null;await refresh();return}if(dp){e.preventDefault();e.stopPropagation();const[t,p]=dp.dataset.delplayer.split('|');if(!t||!p)return alert('Player reference invalid.');if(!confirm('इस खिलाड़ी को हटाएँ? Team नहीं हटेगी.'))return;await api(`/api/team/${encodeURIComponent(t)}/player/${encodeURIComponent(p)}`,{method:'DELETE'});await refresh();return}if(dt){e.preventDefault();e.stopPropagation();if(!confirm('पूरी team और उसके players हटाएँ?'))return;await api(`/api/team/${encodeURIComponent(dt.dataset.delteam)}`,{method:'DELETE'});await refresh();return}if(dtt){e.preventDefault();e.stopPropagation();const[tid,teamId]=dtt.dataset.deltournamentteam.split('|');if(!confirm('क्या इस team को केवल इसी tournament से हटाना है? Team का मूल record नहीं हटेगा.'))return;await api(`/api/tournament/${encodeURIComponent(tid)}/team/${encodeURIComponent(teamId)}`,{method:'DELETE'});await refresh();return}if(dtr){e.preventDefault();e.stopPropagation();if(!confirm('यह tournament और इसकी team-list हटाएँ? मूल teams और players सुरक्षित रहेंगे.'))return;await api(`/api/tournament/${encodeURIComponent(dtr.dataset.deltournament)}`,{method:'DELETE'});await refresh()}}catch(err){alert(`Remove failed: ${err.message}`)}});

function localDateTimeValue(date=new Date()){const pad=n=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`}
function initMatchPage(){
 fillMatchSelects();
 if(STATE?.matchDraft){restoreMatchDraft(STATE.matchDraft);return;}
 window._fixtureIdPending=window._fixtureIdPending||'';
 if(!$('matchDate').value)$('matchDate').value=localDateTimeValue();window._autoTossWinner=null;$('tossMode').value='manual';renderTossMode();matchStep=1;renderMatchStep();
}
function collectMatchDraft(){
 return {fixtureId:window._fixtureIdPending||'',title:$('matchTitle').value,overs:$('matchOvers').value,tournamentId:$('matchTournament').value,teamA:$('matchTeamA').value,teamB:$('matchTeamB').value,stage:$('matchStage').value,groupName:$('matchGroup').value,venue:$('matchLocation').value,state:$('matchState').value,district:$('matchDistrict').value,tehsil:$('matchTehsil').value,pinCode:$('matchPin').value,dateTime:$('matchDate').value,ballType:$('ballType').value,umpireOne:$('umpireOne').value,umpireTwo:$('umpireTwo').value,scorerName:$('scorerName').value,tossMode:$('tossMode').value,tossWinner:$('tossWinner').value,tossDecision:$('tossDecision').value,autoTossDecision:$('autoTossDecision').value,autoTossWinner:window._autoTossWinner||'',xiA:[...document.querySelectorAll('[data-xia]:checked')].map(x=>x.dataset.xia),xiB:[...document.querySelectorAll('[data-xib]:checked')].map(x=>x.dataset.xib),striker:$('openStriker').value,nonStriker:$('openNon').value,currentBowler:$('openBowler').value,bowlerOverLimit:$('defaultBowlerOvers').value,step:matchStep};
}
function scheduleMatchDraftSave(force=false){
 if(restoringMatchDraft||!STATE?.user)return;
 if(draftSaveTimer)clearTimeout(draftSaveTimer);
 const doSave=async()=>{try{const r=await api('/api/match/draft',{method:'POST',body:JSON.stringify({draft:collectMatchDraft()})});STATE.matchDraft=r.draft;$('matchDraftStatus').textContent='✓ Setup automatically saved';$('matchDraftStatus').classList.add('saved');}catch(e){$('matchDraftStatus').textContent=e.message==='ACTIVE_PLAN_REQUIRED'?'Setup will save after plan activation':'Draft not saved yet';$('matchDraftStatus').classList.remove('saved');}};
 if(force)doSave();else draftSaveTimer=setTimeout(doSave,400);
}
function restoreMatchDraft(d){
 if(!d)return;restoringMatchDraft=true;try{
  const put=(id,value)=>{const el=$(id);if(!el||value==null)return;el.value=String(value)};
  window._fixtureIdPending=d.fixtureId||'';put('matchTitle',d.title||'Local Cricket Match');put('matchOvers',d.overs||10);put('matchTournament',d.tournamentId||'');refreshMatchTeamOptions();
  if([...$('matchTeamA').options].some(o=>o.value===String(d.teamA||'')))put('matchTeamA',d.teamA);if([...$('matchTeamB').options].some(o=>o.value===String(d.teamB||''))&&String(d.teamB)!==String(d.teamA))put('matchTeamB',d.teamB);
  syncTossTeamOptions();put('matchStage',d.stage||'league');refreshMatchGroupOptions();if([...$('matchGroup').options].some(o=>o.value===String(d.groupName||'')))put('matchGroup',d.groupName);
  put('matchLocation',d.venue||'');put('matchState',d.state||'');put('matchDistrict',d.district||'');put('matchTehsil',d.tehsil||'');put('matchPin',d.pinCode||'');put('matchDate',d.dateTime||localDateTimeValue());put('ballType',d.ballType||'leather');put('umpireOne',d.umpireOne||'');put('umpireTwo',d.umpireTwo||'');put('scorerName',d.scorerName||'');put('defaultBowlerOvers',d.bowlerOverLimit||2);
  put('tossMode',d.tossMode||'manual');put('tossDecision',d.tossDecision||'bat');put('autoTossDecision',d.autoTossDecision||'bat');window._autoTossWinner=null;renderTossMode();syncTossTeamOptions();if([...$('tossWinner').options].some(o=>o.value===String(d.tossWinner||'')))put('tossWinner',d.tossWinner);
  window._renderedXIATeam=null;window._renderedXIBTeam=null;renderXI();const xa=new Set((d.xiA||[]).map(String)),xb=new Set((d.xiB||[]).map(String));if(Array.isArray(d.xiA))document.querySelectorAll('[data-xia]').forEach(x=>x.checked=xa.has(x.dataset.xia));if(Array.isArray(d.xiB))document.querySelectorAll('[data-xib]').forEach(x=>x.checked=xb.has(x.dataset.xib));
  renderOpening();if([...$('openStriker').options].some(o=>o.value===String(d.striker||'')))put('openStriker',d.striker);renderOpening();if([...$('openNon').options].some(o=>o.value===String(d.nonStriker||'')))put('openNon',d.nonStriker);if([...$('openBowler').options].some(o=>o.value===String(d.currentBowler||'')))put('openBowler',d.currentBowler);
  if(d.tossMode==='auto'&&d.autoTossWinner&&d.autoTossWinner===d.tossWinner&&[...$('tossWinner').options].some(o=>o.value===d.autoTossWinner))tossWinnerSet(d.autoTossWinner,true);
  matchStep=Math.max(1,Math.min(5,Number(d.step)||1));renderMatchStep();$('matchDraftStatus').textContent='↻ Restored saved match setup';$('matchDraftStatus').classList.add('saved');
 }finally{restoringMatchDraft=false;}
}
async function clearMatchDraft(){if(!confirm('Saved match setup हटाएँ? इससे कोई tournament, team या live match delete नहीं होगा.'))return;try{if(draftSaveTimer)clearTimeout(draftSaveTimer);await api('/api/match/draft',{method:'DELETE'});STATE.matchDraft=null;window._fixtureIdPending='';restoringMatchDraft=true;fillMatchSelects();['matchTitle','matchLocation','matchState','matchDistrict','matchTehsil','matchPin','umpireOne','umpireTwo','scorerName'].forEach(id=>$(id).value='');$('matchTitle').value='Local Cricket Match';$('matchOvers').value='10';$('matchTournament').value='';refreshMatchTeamOptions();$('matchStage').value='league';refreshMatchGroupOptions();$('matchDate').value=localDateTimeValue();$('ballType').value='leather';$('defaultBowlerOvers').value='2';$('tossMode').value='manual';window._autoTossWinner=null;renderTossMode();syncTossTeamOptions();window._renderedXIATeam=null;window._renderedXIBTeam=null;renderXI();renderOpening();matchStep=1;renderMatchStep();$('matchDraftStatus').textContent='No saved draft';$('matchDraftStatus').classList.remove('saved');}catch(e){alert(e.message)}finally{restoringMatchDraft=false;}}

function stageLabel(stage){return ({league:'League / Points Table',group:'Group Match',quarterfinal:'Quarter Final',qualifier:'Qualifier',eliminator:'Eliminator',semifinal:'Semi Final',final:'Final',super8:'Super 8',other:'Other'})[stage]||'League / Points Table'}
function refreshMatchGroupOptions(){const select=$('matchGroup');if(!select)return;const tournament=(STATE?.tournaments||[]).find(t=>t.id===$('matchTournament')?.value),stage=$('matchStage')?.value||'league',wrap=$('matchGroupWrap');const needed=!!tournament&&tournament.format==='groups-knockout'&&['league','group'].includes(stage);wrap?.classList.toggle('hidden',!needed);let groups=tournament?.format==='groups-knockout'?groupNameOptions(tournament.groupCount||2):[];const old=select.value;select.innerHTML='<option value="">Auto by teams</option>'+groups.map(g=>`<option value="${g}">${g}</option>`).join('');if(groups.includes(old))select.value=old;const a=tournament?.teamGroups?.[$('matchTeamA')?.value],b=tournament?.teamGroups?.[$('matchTeamB')?.value];if(a&&a===b){if(groups.includes(a))select.value=a;}if(tournament?.format==='groups-knockout'&&['league','group'].includes(stage)&&stage==='league')$('matchStage').value='group';}
function fillMatchSelects(){const ts=STATE.tournaments||[];const old=$('matchTournament').value;$('matchTournament').innerHTML='<option value="">No tournament / standalone match</option>'+ts.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');if(ts.some(t=>t.id===old))$('matchTournament').value=old;refreshMatchTeamOptions();refreshMatchGroupOptions();syncTossTeamOptions();}
function refreshMatchTeamOptions(){const tid=$('matchTournament')?.value||'',tournament=(STATE?.tournaments||[]).find(t=>t.id===tid),teams=tournament?STATE.teams.filter(t=>(tournament.teamIds||[]).includes(t.id)):STATE.teams,oldA=$('matchTeamA').value,oldB=$('matchTeamB').value,options=teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');$('matchTeamA').innerHTML=options;$('matchTeamB').innerHTML=options;if(teams.some(t=>t.id===oldA))$('matchTeamA').value=oldA;if(teams.some(t=>t.id===oldB))$('matchTeamB').value=oldB;if($('matchTeamA').value===$('matchTeamB').value&&teams[1])$('matchTeamB').value=teams[1].id;syncTossTeamOptions();refreshMatchGroupOptions();}
function syncTossTeamOptions(){const values=[$('matchTeamA')?.value,$('matchTeamB')?.value].filter(Boolean),old=$('tossWinner')?.value;$('tossWinner').innerHTML=values.map(id=>{const t=team(id);return t?`<option value="${t.id}">${esc(t.name)}</option>`:''}).join('');if(values.includes(old))$('tossWinner').value=old;if($('tossMode')?.value==='auto'&&!window._autoTossWinner){$('tossCoinStatus').textContent='Coin ready — tap to toss';$('tossCoinResult').textContent='A random team will win the toss.';}}
function renderMatchStep(){for(let i=1;i<=5;i++)$(`matchStep${i}`).classList.toggle('hidden',i!==matchStep);document.querySelectorAll('.stepDot').forEach((x,i)=>x.classList.toggle('active',i<matchStep));$('prevStep').style.visibility=matchStep===1?'hidden':'visible';$('nextStep').style.display=matchStep<5?'block':'none';if(matchStep===2)renderTossMode();if(matchStep===3)renderXI();if(matchStep===4)renderOpening();if(matchStep===5)prepareReady();}
function renderXI(){
 const A=team($('matchTeamA').value),B=team($('matchTeamB').value);
 const oldA=new Map([...document.querySelectorAll('[data-xia]')].map(x=>[x.dataset.xia,x.checked])),oldB=new Map([...document.querySelectorAll('[data-xib]')].map(x=>[x.dataset.xib,x.checked]));
 const sameA=!!A&&window._renderedXIATeam===A.id,sameB=!!B&&window._renderedXIBTeam===B.id;
 $('xiTitleA').textContent=A?.name||'Team A';$('xiTitleB').textContent=B?.name||'Team B';
 $('xiA').innerHTML=(A?.players||[]).map(p=>{const checked=sameA&&oldA.has(p.id)?oldA.get(p.id):true;return `<label class="xiItem"><input type="checkbox" data-xia="${p.id}" ${checked?'checked':''}><span>${esc(p.name)} <small class="muted">${p.role}${p.captain?' · C':''}${p.viceCaptain?' · VC':''}</small></span></label>`}).join('');
 $('xiB').innerHTML=(B?.players||[]).map(p=>{const checked=sameB&&oldB.has(p.id)?oldB.get(p.id):true;return `<label class="xiItem"><input type="checkbox" data-xib="${p.id}" ${checked?'checked':''}><span>${esc(p.name)} <small class="muted">${p.role}${p.captain?' · C':''}${p.viceCaptain?' · VC':''}</small></span></label>`}).join('');
 window._renderedXIATeam=A?.id||'';window._renderedXIBTeam=B?.id||'';
}
function renderTossMode(){const auto=$('tossMode').value==='auto';$('manualTossFields').classList.toggle('hidden',auto);$('autoTossPanel').classList.toggle('hidden',!auto);if(auto&&!window._autoTossWinner){$('tossCoinStatus').textContent='Coin ready — tap to toss';$('tossCoinResult').textContent='A random team will win the toss.';$('tossCoinFace').textContent='JC';$('flipTossCoin').disabled=false;$('flipTossCoin').classList.remove('isFlipping');}}
function renderOpening(){
 const A=team($('matchTeamA').value),B=team($('matchTeamB').value),tw=$('tossWinner').value,decision=$('tossMode').value==='auto'?$('autoTossDecision').value:$('tossDecision').value,bat=decision==='field'?(tw===A?.id?B:A):(tw===A?.id?A:B),bowl=bat?.id===A?.id?B:A;
 const checkedA=new Set([...document.querySelectorAll('[data-xia]:checked')].map(x=>x.dataset.xia)),checkedB=new Set([...document.querySelectorAll('[data-xib]:checked')].map(x=>x.dataset.xib));
 const ids=(bat?.players||[]).filter(p=>(bat?.id===A?.id?checkedA:checkedB).has(p.id));
 const oldS=$('openStriker').value,oldN=$('openNon').value;$('openStriker').innerHTML=ids.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');if(oldS&&ids.some(p=>p.id===oldS))$('openStriker').value=oldS;
 $('openNon').innerHTML=ids.filter(p=>p.id!==$('openStriker').value).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');if(oldN&&[...$('openNon').options].some(o=>o.value===oldN))$('openNon').value=oldN;else if($('openNon').options.length)$('openNon').selectedIndex=0;
 const bowlIds=(bowl?.players||[]).filter(p=>(bowl?.id===A?.id?checkedA:checkedB).has(p.id));const oldBowler=$('openBowler').value;$('openBowler').innerHTML=bowlIds.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');if(bowlIds.some(p=>p.id===oldBowler))$('openBowler').value=oldBowler;
 $('bowlerAllocations').innerHTML=`<div class="notice">${esc(bat?.name||'Batting team')} batting first · ${esc(bowl?.name||'Bowling team')} bowling first. One common over limit applies to all eligible bowlers.</div>`;
}
function prepareReady(){const t=(STATE?.tournaments||[]).find(x=>x.id===$('matchTournament').value);const A=team($('matchTeamA').value),B=team($('matchTeamB').value);const tw=team($('tossWinner').value);const decision=$('tossMode').value==='auto'?$('autoTossDecision').value:$('tossDecision').value;$('matchStep5').querySelector('p').textContent=`${t?.name?`Tournament: ${t.name} · `:''}${A?.name||'Team A'} vs ${B?.name||'Team B'} · ${$('matchOvers').value} overs · ${$('ballType').value==='tennis'?'Tennis ball':'Leather ball'} · Toss: ${tw?.name||'—'} chooses ${decision==='field'?'field first':'bat first'}.`}
function tossWinnerSet(id,auto=false){window._autoTossWinner=auto?id:null;$('tossWinner').value=id;if(auto){const t=team(id);$('tossCoinStatus').textContent=`Toss won by ${t?.name||'selected team'}`;$('tossCoinResult').textContent='Now choose whether the toss winner bats or fields first.';$('tossCoinFace').textContent=t?String(t.name).slice(0,3).toUpperCase():'WIN';$('flipTossCoin').disabled=true;$('flipTossCoin').classList.remove('isFlipping');}scheduleMatchDraftSave(true)}
async function startMatch(){
 try{
  if(!activePlan())return planModal();
  const selectedTournament=(STATE.tournaments||[]).find(t=>t.id===$('matchTournament').value),A=team($('matchTeamA').value),B=team($('matchTeamB').value);
  if(!A||!B||A.id===B.id)return alert('Team A और Team B अलग-अलग चुनें');
  if(selectedTournament&&(!(selectedTournament.teamIds||[]).includes(A.id)||!(selectedTournament.teamIds||[]).includes(B.id)))return alert('दोनों teams पहले selected tournament में जोड़ें.');
  if(selectedTournament?.format==='groups-knockout'&&['league','group'].includes($('matchStage').value)){const ga=selectedTournament.teamGroups?.[A.id]||'Group A',gb=selectedTournament.teamGroups?.[B.id]||'Group A';if(ga!==gb)return alert('Group-stage match के लिए दोनों teams एक ही group से चुनें.');if($('matchGroup').value&&$('matchGroup').value!==ga)return alert(`इन teams को ${ga} में रखा गया है. सही group चुनें.`)}
  const commonOvers=Math.max(1,Math.floor(+$('defaultBowlerOvers').value||1)),xiA=[...document.querySelectorAll('[data-xia]:checked')].map(x=>x.dataset.xia),xiB=[...document.querySelectorAll('[data-xib]:checked')].map(x=>x.dataset.xib);
  const pickedDecision=$('tossMode').value==='auto'?$('autoTossDecision').value:$('tossDecision').value;const batFirst=pickedDecision==='field'?($('tossWinner').value===A.id?B:A):team($('tossWinner').value);const batRoster=batFirst?.id===A.id?xiA:xiB,bowlRoster=batFirst?.id===A.id?xiB:xiA;
  if(xiA.length<2||xiB.length<2)return alert('हर team की Playing XI में कम से कम 2 players चुनें');
  if(!$('openStriker').value||!$('openNon').value||$('openStriker').value===$('openNon').value)return alert('Striker और Non-Striker अलग-अलग खिलाड़ी होने चाहिए');
  if(!batRoster.includes($('openStriker').value)||!batRoster.includes($('openNon').value)||!bowlRoster.includes($('openBowler').value))return alert('Opening players अपने-अपने Playing XI से चुनें.');
  const tossDecision=$('tossMode').value==='auto'?$('autoTossDecision').value:$('tossDecision').value;
  const r=await api('/api/match/start',{method:'POST',body:JSON.stringify({fixtureId:window._fixtureIdPending||'',title:$('matchTitle').value,overs:+$('matchOvers').value,tournamentId:$('matchTournament').value||'',teamA:A.id,teamB:B.id,tossWinner:$('tossWinner').value,tossDecision,tossMode:$('tossMode').value,location:$('matchLocation').value,venue:$('matchLocation').value,state:$('matchState').value,district:$('matchDistrict').value,tehsil:$('matchTehsil').value,pinCode:$('matchPin').value,ballType:$('ballType').value,umpireOne:$('umpireOne').value,umpireTwo:$('umpireTwo').value,scorerName:$('scorerName').value,dateTime:$('matchDate').value?new Date($('matchDate').value).toISOString():new Date().toISOString(),stage:$('matchStage').value,groupName:$('matchGroup').value,xiA,xiB,bowlerOverLimit:commonOvers,striker:$('openStriker').value,nonStriker:$('openNon').value,currentBowler:$('openBowler').value})});MATCH=r.match;window._fixtureIdPending='';await refresh();showPage('scoring');
 }catch(e){
  if(e.message==='ACTIVE_PLAN_REQUIRED')return planModal();
  if(e.code==='ACTIVE_MATCH_EXISTS'&&Array.isArray(e.details?.matches)&&e.details.matches.length){
   const old=e.details.matches;
   const summary=old.map((m,idx)=>{const inn=m.activeInnings||{};return `${idx+1}. ${m.title||'Local Match'} — ${m.teamAName||'Team A'} vs ${m.teamBName||'Team B'} · ${Number(inn.score)||0}/${Number(inn.wickets)||0} · ${Math.floor((Number(inn.balls)||0)/6)}.${(Number(inn.balls)||0)%6} overs`}).join('\n');
   const ok=confirm(`डेटा में ये ${old.length} मैच अभी LIVE के रूप में सेव हैं:\n\n${summary}\n\nक्या ये मैच वास्तव में नहीं चल रहे हैं?\n\nOK करने पर इन्हें DELETE नहीं किया जाएगा। इनके पूरे स्कोरकार्ड सुरक्षित रहेंगे और Match History में ABANDONED के रूप में चले जाएँगे। इसके बाद नया मैच शुरू होगा।\n\nCancel करने पर कोई डेटा नहीं बदलेगा।`);
   if(!ok)return;
   try{for(const m of old)await api('/api/match/recover-stale',{method:'POST',body:JSON.stringify({matchId:m.id})});await refresh();return startMatch();}
   catch(recoveryError){alert(`पुराने मैच की recovery पूरी नहीं हुई: ${recoveryError.message}`);return;}
  }
  alert(e.message);
 }
}

$('matchTournament').onchange=()=>{refreshMatchTeamOptions();refreshMatchGroupOptions();window._autoTossWinner=null;renderTossMode();const t=(STATE?.tournaments||[]).find(x=>x.id===$('matchTournament').value);if(t){$('matchLocation').value=t.venue||'';$('matchState').value=t.state||'';$('matchDistrict').value=t.district||'';$('matchTehsil').value=t.tehsil||'';$('matchPin').value=t.pinCode||'';if(t.startDate)$('matchDate').value=`${t.startDate}T18:00`; }if(matchStep===3)renderXI();if(matchStep===4)renderOpening();};$('matchStage').onchange=refreshMatchGroupOptions;$('matchGroup').onchange=()=>{};$('matchTeamA').onchange=()=>{syncTossTeamOptions();refreshMatchGroupOptions();if(matchStep===2)renderTossMode();if(matchStep===3)renderXI();if(matchStep===4)renderOpening()};$('matchTeamB').onchange=()=>{syncTossTeamOptions();refreshMatchGroupOptions();if(matchStep===2)renderTossMode();if(matchStep===3)renderXI();if(matchStep===4)renderOpening()};$('tossMode').onchange=()=>{window._autoTossWinner=null;renderTossMode();};$('openStriker').onchange=()=>{renderOpening()};$('tossWinner').onchange=()=>{if(matchStep===4)renderOpening()};$('tossDecision').onchange=()=>{if(matchStep===4)renderOpening()};$('autoTossDecision').onchange=()=>{if(matchStep===4)renderOpening()};$('defaultBowlerOvers').onchange=renderOpening;
$('flipTossCoin').onclick=()=>{const ids=[$('matchTeamA').value,$('matchTeamB').value].filter(Boolean);if(ids.length!==2||ids[0]===ids[1])return alert('पहले दो अलग teams चुनें.');const btn=$('flipTossCoin');btn.disabled=true;btn.classList.add('isFlipping');$('tossCoinStatus').textContent='Coin is flipping…';$('tossCoinResult').textContent='';const winner=ids[Math.floor(Math.random()*2)];setTimeout(()=>{tossWinnerSet(winner,true);},1100)};
$('clearMatchDraft')?.addEventListener('click',clearMatchDraft);
['input','change'].forEach(eventName=>$('match').addEventListener(eventName,e=>{if(e.target.matches('input,select,textarea'))scheduleMatchDraftSave();}));

$('startLive').onclick=startMatch;
$('activeMatchBox')?.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-recover-live]');if(!btn)return;
 const id=btn.dataset.recoverLive,match=(STATE?.savedLiveMatches||[]).find(m=>m.id===id);if(!match)return;
 const ok=confirm(`क्या यह मैच वास्तव में नहीं चल रहा है?\n\n${match.title||'Local Match'} · ${match.teamAName||'Team A'} vs ${match.teamBName||'Team B'}\n\nOK करने पर मैच DELETE नहीं होगा। स्कोरकार्ड सुरक्षित रहेगा और History में ABANDONED दिखाई देगा।`);if(!ok)return;
 try{await api('/api/match/recover-stale',{method:'POST',body:JSON.stringify({matchId:id})});await refresh();}catch(err){alert(err.message)}
});
$('nextStep').onclick=()=>{
 if(matchStep===1){if(!$('matchTeamA').value||!$('matchTeamB').value||$('matchTeamA').value===$('matchTeamB').value)return alert('Team A और Team B अलग-अलग चुनें');const tr=selectedTournament(),a=team($('matchTeamA').value),b=team($('matchTeamB').value);if(tr&&(!(tr.teamIds||[]).includes(a.id)||!(tr.teamIds||[]).includes(b.id)))return alert('Tournament के अंदर पहले दोनों teams जोड़ें.');if(tr?.format==='groups-knockout'&&['league','group'].includes($('matchStage').value)){if((tr.teamGroups?.[a.id]||'Group A')!==(tr.teamGroups?.[b.id]||'Group A'))return alert('Group stage के दोनों teams एक ही group से होने चाहिए.');}if(tr?.startDate&&$('matchDate').value&&$('matchDate').value.slice(0,10)<tr.startDate)return alert('Match date, tournament start date से पहले है.');if(tr?.endDate&&$('matchDate').value&&$('matchDate').value.slice(0,10)>tr.endDate)return alert('Match date, tournament end date के बाद है.');}
 if(matchStep===2){const ids=[$('matchTeamA').value,$('matchTeamB').value];if(!ids[0]||!ids[1])return alert('पहले दो teams चुनें.');if($('tossMode').value==='auto'&&!window._autoTossWinner)return alert('Auto toss के लिए सिक्के को touch करें.');if(!ids.includes($('tossWinner').value))return alert('Toss winner चुनें.');}
 if(matchStep===3){const xa=document.querySelectorAll('[data-xia]:checked').length,xb=document.querySelectorAll('[data-xib]:checked').length;if(xa<2||xb<2)return alert('हर team की Playing XI में कम से कम 2 players चुनें');}
 if(matchStep===4){if(!$('openStriker').value||!$('openNon').value||$('openStriker').value===$('openNon').value)return alert('Striker और Non-Striker अलग-अलग खिलाड़ी होने चाहिए');if(!$('openBowler').value)return alert('Opening Bowler चुनें');}
 if(matchStep<5){matchStep++;renderMatchStep();scheduleMatchDraftSave(true)}
};$('prevStep').onclick=()=>{if(matchStep>1){matchStep--;renderMatchStep();scheduleMatchDraftSave(true)}};$('backMatch').onclick=()=>{matchStep=4;renderMatchStep();scheduleMatchDraftSave(true)};

$('finishMatch').onclick=()=>{if(!MATCH)return;if(!confirm('WARNING: Match finalise hone ke baad scoring band ho jayegi. Pehle confirm karein; agle step par Winner, Tie ya No Result select hoga. Kya aage badhein?'))return;const teamA=team(MATCH.teamA),teamB=team(MATCH.teamB);openModal(`<div class="modalHead"><div><div class="eyebrow">FINAL MATCH RESULT</div><h3>Choose Official Result</h3></div><button class="closeBtn" data-close>×</button></div><p class="muted">Result public scoreboard aur tournament standings mein save hoga. Winner chunein, ya Tie / No Result.</p><div class="resultChoices"><button class="resultChoice" data-finish-type="winner" data-winner="${esc(MATCH.teamA)}"><span>🏆 WINNER</span><b>${esc(teamA?.name||MATCH.teamAName||'Team A')}</b></button><button class="resultChoice" data-finish-type="winner" data-winner="${esc(MATCH.teamB)}"><span>🏆 WINNER</span><b>${esc(teamB?.name||MATCH.teamBName||'Team B')}</b></button><button class="resultChoice" data-finish-type="tie"><span>＝ RESULT</span><b>Tie Match</b></button><button class="resultChoice" data-finish-type="no-result"><span>◌ RESULT</span><b>No Result</b></button></div><div class="rowBtns"><button class="btn dark" data-close>Cancel · Keep Match Open</button></div>`,box=>{box.querySelectorAll('[data-close]').forEach(x=>x.onclick=()=>closeModal());box.querySelectorAll('[data-finish-type]').forEach(btn=>btn.onclick=async()=>{const type=btn.dataset.finishType,winner=btn.dataset.winner||'';if(type==='winner'&&!winner)return alert('Winner team select karein.');if(!confirm('Selected result finalise karein?'))return;closeModal();await finalizeMatch(type,winner)})})};
/* Layout and colour are independent controls: changing a layout must never overwrite the user's selected palette. */
$('layerSelect').addEventListener('change',async()=>{updateLayerPreview();if(activePlan())await saveBroadcast({event:null})});
$('colorSelect').addEventListener('change',async()=>{updateLayerPreview();if(activePlan())await saveBroadcast({event:null})});
$('animationSelect').addEventListener('change',async()=>{EVENTS.filter(e=>!['FOUR','SIX','WICKET','NO BALL','WIDE','LEG BYE'].includes(e)).forEach(e=>EVENT_ANIM_MAP[e]=$('animationSelect').value);EVENT_ANIM_MAP['NO BALL']=EVENT_ANIM_MAP['FREE HIT']||'spotlight';document.querySelectorAll('[data-event-anim]').forEach(x=>x.value=EVENT_ANIM_MAP[x.dataset.eventAnim]);if(activePlan())await saveBroadcast({event:null})});
['FOUR','SIX','WICKET'].forEach((event,index)=>{const id=['eventThemeFour','eventThemeSix','eventThemeWicket'][index],control=$(id);if(!control)return;control.innerHTML=EVENT_THEME_NAMES.map(name=>`<option value="${name}">${name.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>`).join('');control.value=EVENT_ANIM_MAP[event];control.addEventListener('change',async()=>{EVENT_ANIM_MAP[event]=control.value;if(activePlan())await saveBroadcast({event:null});});});
$('animationDuration').addEventListener('change',async()=>{const d=Math.max(300,Math.min(10000,+$('animationDuration').value||2200));$('animationDuration').value=d;EVENTS.forEach(e=>EVENT_DURATION_MAP[e]=d);document.querySelectorAll('[data-event-duration]').forEach(x=>x.value=d);if(activePlan())await saveBroadcast({event:null})});
$('cardAnimationSelect').addEventListener('change',async()=>{CARD_TYPES.forEach(([key])=>CARD_ANIM_MAP[key]=$('cardAnimationSelect').value);document.querySelectorAll('[data-card-anim]').forEach(x=>x.value=CARD_ANIM_MAP[x.dataset.cardAnim]);if(activePlan())await saveBroadcast({event:null})});
$('cardAnimationDuration').addEventListener('change',async()=>{const d=Math.max(300,Math.min(10000,+$('cardAnimationDuration').value||1800));$('cardAnimationDuration').value=d;CARD_TYPES.forEach(([key])=>CARD_DURATION_MAP[key]=d);document.querySelectorAll('[data-card-duration]').forEach(x=>x.value=d);if(activePlan())await saveBroadcast({event:null})});
$('batterCard').onclick=()=>toggleCard('batter');$('bowlerCard').onclick=()=>toggleCard('bowler');$('playerCard').onclick=()=>toggleCard('player');$('partnershipCard').onclick=()=>toggleCard('partnership');$('teamBattingCard').onclick=()=>toggleCard('teamBatting');$('teamBowlingCard').onclick=()=>toggleCard('teamBowling');$('nextBatterCard').onclick=()=>toggleCard('nextBatter');$('newBatterCard').onclick=()=>toggleCard('newBatter');$('newBowlerCard').onclick=()=>toggleCard('newBowler');$('inningsBreakCard').onclick=()=>toggleCard('inningsBreak');$('resultCard').onclick=()=>toggleCard('result');$('clearCard').onclick=async()=>{activeCardType=null;syncCardButtonState(null);try{await saveBroadcast({card:null,cardId:Date.now(),event:null});}catch(error){activeCardType=STATE?.broadcast?.card?.type||null;syncCardButtonState();alert(`Card बंद नहीं हो सका: ${error.message}`)}};
$('resumeSetup').onclick=()=>window.resumeScoringSetup?.();
document.querySelectorAll('[data-powerplay]').forEach(btn=>btn.onclick=async()=>{
 const i=currentInnings();if(!i||MATCH.status!=='live'||MATCH.awaitingNextInnings||MATCH.awaitingInningsSetup||i.awaitingBowler)return;
 const previous=i.powerplay||'',next=btn.dataset.powerplay||'';i.powerplay=next;renderScoring();
 try{await saveMatch(false);if(next)void fireEvent('POWERPLAY');}
 catch(error){i.powerplay=previous;renderScoring();alert(`Power Play सेव नहीं हुआ: ${error.message}`);}
});
$('manualStrikeChange').onclick=async()=>{const i=currentInnings();if(!i||MATCH?.status!=='live')return alert('कोई LIVE match नहीं है।');if(!i.striker||!i.nonStriker||String(i.striker)===String(i.nonStriker))return alert('दो अलग-अलग बल्लेबाज चुनें।');const oldStriker=i.striker,oldNon=i.nonStriker;i.striker=oldNon;i.nonStriker=oldStriker;try{await saveMatch(true)}catch(err){i.striker=oldStriker;i.nonStriker=oldNon;renderScoring();alert(`Strike change सेव नहीं हुआ: ${err.message}`)}};
// Change Batter is handled by the scoring engine's delegated click handler.
$('chaseCard').onclick=()=>toggleCard('chase');
$('demoDataBtn').onclick=()=>{ location.href='demo.html'; };
$('removeDemoDataBtn').onclick=async()=>{if(!confirm('Remove only the generated Demo tournament, its demo teams/players and demo match? Your real teams, players, matches and subscription will stay safe.'))return;try{await api('/api/demo',{method:'DELETE'});await refresh();alert('Demo data removed. Your real data was not changed.')}catch(e){alert(`Remove Demo failed: ${e.message}`)}};
$('logout').onclick=async()=>{if(scoringPageLocked){showScoringLockNotice();return;}await api('/api/logout',{method:'POST'});location.reload()};$('openProfile').onclick=()=>{const s=STATE.user.subscription;openModal(`<div class="modalHead"><div><div class="eyebrow">ACCOUNT</div><h3>${esc(STATE.user.mobile)}</h3></div><button class="closeBtn" data-close>×</button></div><p>Plan: <b>${esc(STATE.user.activePlan||'No active plan')}</b></p>${s?`<p class="muted">Activated ${new Date(s.activatedAt).toLocaleString()}<br>Expires ${new Date(s.expiresAt).toLocaleString()}</p>`:''}<div class="rowBtns"><button class="btn primary" id="profileActivate">Activate Plan</button><a class="btn ghost" href="jangid-cricinfo.html" target="_blank">Open Jangid Cricinfo</a></div>`,box=>box.querySelector('#profileActivate').onclick=()=>{closeModal();planModal('Activate your plan')})};
async function submitLogin(){
 if(loginSubmitting)return;
 loginSubmitting=true;const button=$('loginBtn');if(button){button.disabled=true;button.textContent='Logging in…';}
 $('loginMsg').textContent='';
 try{
  await api('/api/login',{method:'POST',body:JSON.stringify({email:$('loginEmail').value.trim(),password:$('loginPassword').value})});
  const ready=await boot({afterLogin:true});
  if(!ready)throw new Error('Login जाँच पूरी नहीं हुई। कृपया उसी URL पर पेज Refresh करके फिर कोशिश करें।');
  $('loginPassword').value='';
 }catch(e){setAuthView(false);$('loginMsg').textContent=e.message||'Login नहीं हो पाया।';}
 finally{loginSubmitting=false;if(button){button.disabled=false;button.textContent='Login';}}
}
$('loginBtn').onclick=submitLogin;
$('loginPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitLogin();}});
$('loginEmail')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('loginPassword')?.focus();}});
$('registerBtn').onclick=()=>location.href='register.html';
$('forgotPasswordBtn')?.addEventListener('click',async()=>{const email=prompt('अपना registered Email address लिखें:');if(!email)return;try{const r=await api('/api/password/reset',{method:'POST',body:JSON.stringify({email})});alert(r.message||'Password reset link भेज दिया गया है।')}catch(e){alert(e.message)}});
async function boot(options={}){
 const sequence=++authBootSequence;
 let nextState,nextPublic;
 try{
  // Complete authentication/data requests before switching the visible screen.
  nextState=await api('/api/state');
  nextPublic=(await api('/api/public')).matches||[];
 }catch(e){
  // Ignore late responses from an older page-load check after the user has logged in.
  if(sequence!==authBootSequence)return false;
  if(e.status===401){STATE=null;MATCH=null;setAuthView(false);}
  else if(!STATE?.user){setAuthView(false);if(options.afterLogin)$('loginMsg').textContent=`डेटा लोड नहीं हुआ: ${e.message}`;}
  else{setAuthView(true);showAppRuntimeNotice(`सर्वर से डेटा रीफ़्रेश नहीं हो पाया: ${e.message}. आपका Login चालू है; Refresh बाद में करें।`);}
  return false;
 }
 if(sequence!==authBootSequence)return false;
 STATE=nextState;MATCH=STATE.activeMatch;PUBLIC_LIVE=nextPublic;
 activeCardType=STATE.broadcast?.card?.type||null;
 if(STATE.broadcast?.cardAnimations)CARD_ANIM_MAP={...CARD_ANIM_MAP,...STATE.broadcast.cardAnimations};
 if(STATE.broadcast?.eventAnimations)EVENT_ANIM_MAP={...EVENT_ANIM_MAP,...STATE.broadcast.eventAnimations};
 [['FOUR','eventThemeFour'],['SIX','eventThemeSix'],['WICKET','eventThemeWicket']].forEach(([event,id])=>{const control=$(id);if(control)control.value=EVENT_ANIM_MAP[event]||control.value;});
 // Switch the two root views together so Login and Dashboard can never appear one below the other.
 setAuthView(true);
 renderAll();
 showPage('dashboard');
 return true;
}
const es=new EventSource('/events');es.onmessage=e=>{try{
 const p=JSON.parse(e.data);PUBLIC_LIVE=p.activeMatches||[];
 const ownBroadcast=STATE?.user?.id?p.broadcasts?.[STATE.user.id]:null;
 if(ownBroadcast){STATE.broadcast={...(STATE.broadcast||{}),...ownBroadcast};activeCardType=ownBroadcast.card?.type||null;syncCardButtonState(activeCardType);}
 const incomingMine=PUBLIC_LIVE.find(m=>m.userId===STATE?.user?.id&&m.status==='live');
 if(STATE?.user?.id){
  if(incomingMine){
   const localMatch=MATCH?.id===incomingMine.id&&MATCH.status==='live'?MATCH:(STATE.activeMatch?.id===incomingMine.id&&STATE.activeMatch.status==='live'?STATE.activeMatch:null);
   const stamp=value=>({local:Date.parse(value?.offlineUpdatedAt||'')||0,updated:Date.parse(value?.updatedAt||'')||0});
   const localStamp=stamp(localMatch),incomingStamp=stamp(incomingMine);
   const keepLocal=localMatch&&(localStamp.local>incomingStamp.local||(localStamp.local===incomingStamp.local&&localStamp.updated>incomingStamp.updated));
   const mine=keepLocal?localMatch:incomingMine;
   MATCH=mine;STATE.activeMatch=mine;STATE.matches||=[];
   const matchIndex=STATE.matches.findIndex(m=>String(m.id)===String(mine.id));
   if(matchIndex>=0)STATE.matches[matchIndex]=mine;else STATE.matches.push(mine);
   const liveIndex=PUBLIC_LIVE.findIndex(m=>String(m.id)===String(mine.id));
   if(liveIndex>=0)PUBLIC_LIVE[liveIndex]=mine;
  }else if(!MATCH||MATCH.status!=='live'){MATCH=STATE.activeMatch||null;}
  renderDashboard();if(!$('scoring').classList.contains('hidden'))renderScoring();
 }
 }catch(error){console.warn('Live scoring update ignored:',error);}};
setInterval(()=>{if(STATE)$('clock').textContent=new Date().toLocaleString()},1000);
fillGraphics();boot();


// Tournament fixture workflow: generate, add and launch saved fixtures without losing their public match ID.
function getFixtureInput(card, selector){return card?.querySelector(selector)?.value||''}
function fixtureDateTime(dateValue,timeValue){if(!dateValue)throw new Error('Match date चुनें.');const time=timeValue||'09:00';const d=new Date(`${dateValue}T${time}:00`);if(!Number.isFinite(d.getTime()))throw new Error('सही मैच तारीख और समय चुनें.');return d.toISOString()}
document.addEventListener('click',async e=>{
 const generate=e.target.closest('[data-generate-fixtures]');
 const add=e.target.closest('[data-add-fixture]');
 const start=e.target.closest('[data-start-fixture]');
 const resume=e.target.closest('[data-resume-fixture]');
 try{
  if(generate){
   e.preventDefault();const id=generate.dataset.generateFixtures,card=generate.closest('.tournamentAdminCard')||generate.closest('.tournamentCard')||generate.parentElement?.parentElement?.parentElement;
   const date=getFixtureInput(card,`[data-fixture-date="${CSS.escape(id)}"]`),time=getFixtureInput(card,`[data-fixture-time="${CSS.escape(id)}"]`);
   const firstDateTime=fixtureDateTime(date,time);
   generate.disabled=true;generate.textContent='Generating…';
   try{const t=(STATE.tournaments||[]).find(x=>x.id===id);const result=await api(`/api/tournament/${encodeURIComponent(id)}/fixtures/generate`,{method:'POST',body:JSON.stringify({firstDate:date,firstDateTime,matchesPerDay:Number(getFixtureInput(card,`[data-fixture-per-day="${CSS.escape(id)}"]`))||2,gapHours:Number(getFixtureInput(card,`[data-fixture-gap="${CSS.escape(id)}"]`))||6,overs:Number(getFixtureInput(card,`[data-fixture-overs="${CSS.escape(id)}"]`))||20,venue:t?.venue||''})});await refresh();alert(result.message||`Fixtures created: ${result.created||0}`)}finally{if(generate.isConnected){generate.disabled=false;generate.textContent='Generate Fixtures'}}return;
  }
  if(add){
   e.preventDefault();const id=add.dataset.addFixture,card=add.closest('.tournamentAdminCard')||add.closest('.tournamentCard')||add.parentElement?.parentElement?.parentElement;
   const teamA=getFixtureInput(card,`[data-fixture-team-a="${CSS.escape(id)}"]`),teamB=getFixtureInput(card,`[data-fixture-team-b="${CSS.escape(id)}"]`);if(!teamA||!teamB)throw new Error('दो अलग-अलग टीम चुनें.');
   const dateTime=fixtureDateTime(getFixtureInput(card,`[data-manual-fixture-date="${CSS.escape(id)}"]`),getFixtureInput(card,`[data-manual-fixture-time="${CSS.escape(id)}"]`));
   const stage=getFixtureInput(card,`[data-fixture-stage="${CSS.escape(id)}"]`)||'league',venue=getFixtureInput(card,`[data-manual-fixture-venue="${CSS.escape(id)}"]`),overs=Number(getFixtureInput(card,`[data-manual-fixture-overs="${CSS.escape(id)}"]`))||20;
   add.disabled=true;try{await api(`/api/tournament/${encodeURIComponent(id)}/fixtures`,{method:'POST',body:JSON.stringify({teamA,teamB,dateTime,scheduledDate:getFixtureInput(card,`[data-manual-fixture-date=\"${CSS.escape(id)}\"]`),stage,venue,overs})});await refresh();alert('Scheduled match सेव हो गया. अब इस टूर्नामेंट के सार्वजनिक पेज और मैच सूची में दिखेगा.')}finally{if(add.isConnected)add.disabled=false}return;
  }
  if(start){
   e.preventDefault();const id=start.dataset.startFixture;const fixture=(STATE.matches||[]).find(m=>m.id===id&&m.status==='scheduled');if(!fixture)throw new Error('यह fixture नहीं मिला या पहले ही शुरू हो चुका है.');
   if(STATE?.matchDraft&&STATE.matchDraft.fixtureId!==id){if(!confirm('दूसरा match setup सेव है. इसे इस scheduled fixture से बदलना है?'))return;await api('/api/match/draft',{method:'DELETE'});STATE.matchDraft=null;}
   window._fixtureIdPending=id;showPage('match');
   const put=(field,value)=>{const el=$(field);if(el&&value!=null)el.value=String(value)};
   put('matchTournament',fixture.tournamentId||'');refreshMatchTeamOptions();put('matchTeamA',fixture.teamA);put('matchTeamB',fixture.teamB);syncTossTeamOptions();
   put('matchTitle',fixture.title||`${fixture.teamAName||'Team A'} vs ${fixture.teamBName||'Team B'}`);put('matchOvers',fixture.oversLimit||20);put('matchStage',fixture.stage||'league');refreshMatchGroupOptions();put('matchGroup',fixture.groupName||'');put('matchLocation',fixture.venue||fixture.location||'');put('matchState',fixture.state||'');put('matchDistrict',fixture.district||'');put('matchTehsil',fixture.tehsil||'');put('matchPin',fixture.pinCode||'');put('matchDate',fixture.dateTime?localDateTimeValue(new Date(fixture.dateTime)):localDateTimeValue());put('defaultBowlerOvers',fixture.bowlerOverLimit||Math.max(1,Math.ceil((fixture.oversLimit||20)/5)));
   window._autoTossWinner=null;put('tossMode','manual');renderTossMode();syncTossTeamOptions();window._renderedXIATeam=null;window._renderedXIBTeam=null;renderXI();renderOpening();matchStep=1;renderMatchStep();scheduleMatchDraftSave(true);return;
  }
  if(resume){e.preventDefault();const id=resume.dataset.resumeFixture;if(MATCH?.id!==id){const m=(STATE.matches||[]).find(x=>x.id===id);if(!m)return alert('Active match snapshot नहीं मिला. Page refresh करके दोबारा कोशिश करें.');}showPage('scoring');return;}
 }catch(err){alert(err.message||'Fixture request failed.')} 
});
