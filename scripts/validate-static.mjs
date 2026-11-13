import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const skip = new Set(['.git', 'node_modules', '.next', 'dist', 'build']);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) await walk(path.join(dir, entry.name));
      continue;
    }
    if (entry.isFile()) files.push(path.join(dir, entry.name));
  }
}

function balancedCss(source, file) {
  let depth = 0, quote = '', comment = false, escaped = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch.charCodeAt(0) === 92) { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth < 0) throw new Error(file + ': unexpected closing brace');
    }
  }
  if (comment || quote || depth !== 0) throw new Error(file + ': unclosed CSS comment/string/block (depth ' + depth + ')');
}

await walk(root);
const sourceFiles = files.filter(file => ['.js', '.mjs', '.cjs'].some(ext => file.toLowerCase().endsWith(ext)));
const cssFiles = files.filter(file => file.toLowerCase().endsWith('.css'));
const failures = [];

for (const file of sourceFiles) {
  const content = await readFile(file, 'utf8');
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: content, encoding: 'utf8'
  });
  if (result.status !== 0) failures.push('JavaScript syntax: ' + path.relative(root, file) + '\n' + (result.stderr || result.stdout));
}
for (const file of cssFiles) {
  try { balancedCss(await readFile(file, 'utf8'), path.relative(root, file)); }
  catch (error) { failures.push(error.message); }
}

const read = async name => readFile(path.join(root, name), 'utf8');
const [control, engine, bridge, tournament, scoreLayer, scoreLayerCss, workflowCss, html, offlineStore, offlineLoader, serviceWorker, mobileCss, eventCss, offlineUi, freshScoreCss, mobileTapCss, readabilityCss, scoreLayerHtml, obsConsistentCss, studioEditor, scoreLayerStudioCss, adminHtml, studioEditorCss] = await Promise.all([
  read('control.js'), read('scoring-engine.js'), read('firebase/firebase-api-bridge.mjs'),
  read('tournament-manager.js'), read('scorelayer.js'), read('scorelayer.css'),
  read('control-workflow.css'), read('control.html'), read('offline-store.js'),
  read('firebase-api-loader.js'), read('sw.js'), read('mobile-scoring-v2.css'),
  read('event-animation-themes.css'), read('offline-status-ui.js'), read('scorelayer-broadcast-v2.css'),
  read('mobile-scoring-tap-targets.css'), read('scorelayer-readability.css'), read('scorelayer.html'), read('scorelayer-obs-consistent.css'),
  read('scoreboard-studio.js'), read('scorelayer-studio.css'), read('admin.html'), read('scoreboard-studio.css')
]);

const layoutStart = control.indexOf('const LAYERS=[');
const layoutEnd = control.indexOf('];', layoutStart);
const layerCount = layoutStart >= 0 && layoutEnd > layoutStart
  ? [...control.slice(layoutStart, layoutEnd).matchAll(/'[^']+'/g)].length : 0;
const animStart = control.indexOf('const ANIMS=[');
const animEnd = control.indexOf('];', animStart);
const animationNames = animStart >= 0 && animEnd > animStart
  ? [...control.slice(animStart, animEnd).matchAll(/'([^']+)'/g)].map(match => match[1]).filter(name => name !== 'none') : [];
const eventThemeStart = control.indexOf('const EVENT_THEME_NAMES=[');
const eventThemeEnd = control.indexOf('];', eventThemeStart);
const eventThemeNames = eventThemeStart >= 0 && eventThemeEnd > eventThemeStart
  ? [...control.slice(eventThemeStart, eventThemeEnd).matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
const cardMotionStart = control.indexOf('const CARD_MOTION_NAMES=[');
const cardMotionEnd = control.indexOf('];', cardMotionStart);
const cardMotionNames = cardMotionStart >= 0 && cardMotionEnd > cardMotionStart
  ? [...control.slice(cardMotionStart, cardMotionEnd).matchAll(/'([^']+)'/g)].map(match => match[1]) : [];
// Sync regression: cached queue uploads only after authenticated /api/state verification.
const checks = [
  ['25 International Score Layer shape layouts are available', layerCount === 25],
  ['All 25 Score Layer layouts have dedicated live and preview shape treatments', Array.from({length:25},(_,i)=>freshScoreCss.includes('.jlInternationalScorebar.layer'+(i+1)+' .jcIntlPanel')).every(Boolean) && Array.from({length:25},(_,i)=>freshScoreCss.includes('.jlInternationalPreview.layout'+(i+1))).every(Boolean)],
  ['25 independent colour palettes are available', [...control.slice(control.indexOf('const COLORS=['),control.indexOf('];',control.indexOf('const COLORS=['))).matchAll(/'[^']+'/g)].length===25 && Array.from({length:25},(_,i)=>freshScoreCss.includes('.jlInternationalScorebar.color'+(i+1))).every(Boolean) && Array.from({length:25},(_,i)=>freshScoreCss.includes('.jlInternationalPreview.color'+(i+1))).every(Boolean)],
  ['Ten transparent event animations and ten smooth card motions are defined', eventThemeNames.length===10 && eventThemeNames.every(name=>eventCss.includes('data-anim="'+name+'"')) && cardMotionNames.length===10 && cardMotionNames.every(name=>eventCss.includes('data-anim="'+name+'"')) && eventCss.includes('background:transparent!important') && eventCss.includes('border:0!important')],
  ['Five groups contain five layouts each and colour is independently selectable', control.includes('const SCORE_LAYER_GROUPS=[') && (control.match(/start:\s*\d+/g)||[]).length===5 && control.includes('function setLayerOptions(groupId,selectedLayout)') && control.includes("$('colorSelect').onchange=async()=>") && control.includes('groupSelect.onchange=async()=>')],
  ['Single-screen scoring layout prevents vertical page scrolling', workflowCss.includes('overflow:hidden;overscroll-behavior:none')],
  ['Scoring engine exposes save and finish handlers', engine.includes('window.saveMatch=saveMatch') && engine.includes('window.finalizeMatch=finalizeMatch')],
  ['Undo history no longer duplicates full commentary arrays in every snapshot', engine.includes('function compactUndoEntry') && engine.includes('delete previous.events') && engine.includes('compactMatchUndoHistory(MATCH)')],
  ['Undo restores the event and fall-of-wicket history from compact lengths', engine.includes('function restoreUndoEntry') && engine.includes('restoreUndoEntry(snapshot,i)') && engine.includes('_undoFallOfWicketsLength')],
  ['Firebase stores private and public snapshots together in one atomic batch', bridge.includes('const privateData=cleanData(enriched)') && bridge.includes('const publicData=cleanData(publicMatchSnapshot(enriched))') && bridge.includes("batch.set(ownerDoc(uid,'matches',m.id),privateData)") && bridge.includes("batch.set(publicDoc('publicMatches',m.id),publicData)") && bridge.includes('await batch.commit()')],
  ['Public match snapshots exclude private Undo history', bridge.includes('function publicMatchSnapshot(match)') && bridge.includes('delete copy.undoStack') && bridge.includes('snapshot.inningsHistory=snapshot.inningsHistory.map(stripUndo)')],
  ['Live score uploads do not rewrite the active pointer on every ball', !bridge.includes("if(m.status==='live') await setDoc(ownerDoc(uid,'meta','active')") && bridge.includes('active pointer transactionally')],
  ['Live team-pair validation is cached after the first match save', bridge.includes('const validatedMatchTeams=new Map()') && bridge.includes('validatedMatchTeams.get(validationKey)') && bridge.includes('validatedMatchTeams.set(validationKey,teamPair)')],
  ['Complete match snapshots skip repeated team and tournament metadata reads', bridge.includes('const needA=!match.teamAName') && bridge.includes('const needB=!match.teamBName') && bridge.includes('const needTournament=!!match.tournamentId&&!match.tournamentName')],
  ['Local match saving avoids rewriting the full cached profile after every ball', offlineLoader.includes('await store?.put(queueKey,{match:snapshot,version})') && !offlineLoader.includes('await saveState(cachedState);}emitPublic(publicPayload(snapshot')],
  ['IndexedDB queue scans use primary-key ranges instead of loading every stored record', offlineStore.includes('IDBKeyRange.bound') && offlineStore.includes('objectStore.getAll(range)')],
  ['Broadcast queue revisions are unique even when event IDs are unchanged', offlineLoader.includes("const version=String(Date.now())+':'+String(++cacheWriteSequence);")],
  ['Background Sync waits for an authenticated state response before uploading cached rows', offlineLoader.includes("verifiedUid!==uid") && offlineLoader.includes("verifiedUid=uidOf(result.body)") && offlineLoader.includes("if(pending)scheduleSync(350)") && !offlineLoader.includes("scheduleSync(500)")],
  ['Broadcast saves are queued and retained per Match without rewriting the cached account profile', offlineLoader.includes("const queueKey=key(uid,'broadcast',scopeId)") && offlineLoader.includes('cachedState.broadcasts[matchId]=clone(snapshot)') && offlineLoader.includes("store?.put('broadcast:last:'+uid+':'+scopeId,snapshot)") && !offlineLoader.includes('await saveState(cachedState);}emitPublic(publicPayload(cachedState?.activeMatch,cachedState?.broadcast))')],
  ['Pending match-scoped graphics are replayed after app refresh', offlineLoader.includes("records('queue:'+uid+':broadcast:')") && offlineLoader.includes('queuedBroadcasts.find(x=>String(x.matchId||\'\')===currentId)') && offlineLoader.includes('state.broadcasts[mid]=clone(payload)')],
  ['Latest match-specific broadcast graphics remain available offline after queue upload', offlineLoader.includes("store?.put('broadcast:last:'+uid+':'+scopeId,snapshot)") && offlineLoader.includes("const localSnapshotSaved=await store?.put('broadcast:last:'+uid+':'+scopeId,snapshot)")],
  ['Online sync is lightly debounced and coalesced during an active upload', offlineLoader.includes('function scheduleSync(delay=220)') && offlineLoader.includes('syncRequested=true') && offlineLoader.includes('(rerunSync||syncRequested)')],
  ['Existing-live-match details reach Control Board recovery flow', bridge.includes('Array.isArray(error.matches)') && control.includes('e.details?.matches')],
  ['Tournament scheduling stays in dedicated Schedule Match view', tournament.includes('data-tm-tab="schedule"') && tournament.includes('function renderSchedule(t)')],
  ['Matches tab only renders live matches', tournament.includes("const live=list.filter(m=>m.status==='live')")],
  ['International Score Layer keeps both batter lines, score, target team and bowler separate', scoreLayer.includes('jcIntlBattingPanel') && scoreLayer.includes('jcIntlScorePanel') && scoreLayer.includes('jcIntlTargetPanel') && scoreLayer.includes('jcIntlBowlingPanel') && scoreLayer.includes('targetTeam.name')],
  ['Batting team name replaces the generic batting label', scoreLayer.includes('jcIntlTeamName') && scoreLayer.includes('esc(batting.name') && !scoreLayer.includes('<strong>BATTERS</strong>')],
  ['Partnership is separated into the lower half of the target panel', scoreLayer.includes('jcIntlTargetPartnership') && scoreLayer.includes('jcIntlTargetMain') && !scoreLayer.includes('class="jcIntlPartnership"')],
  ['Live batting panel shows only batter name and runs/balls', (()=>{const a=scoreLayer.indexOf(' const batterLine='),b=scoreLayer.indexOf(' layer.innerHTML=',a);const live=a>=0&&b>a?scoreLayer.slice(a,b):'';return live.includes('jcIntlBatScore')&&!/fours|sixes|strikeRate|jcIntlBoundaryStat|jcIntlStrikeRate/.test(live)&&scoreLayer.includes('<span>R (B)</span>')&&!scoreLayer.includes('<span>4s</span>')&&!scoreLayer.includes('<span>6s</span>')&&!scoreLayer.includes('<span>SR</span>');})()],
  ['Live bowling panel shows O-M-R-W and this-over balls without economy', (()=>{const a=scoreLayer.indexOf('jcIntlBowlingPanel'),b=scoreLayer.indexOf('</section>`;',a);const panel=a>=0&&b>a?scoreLayer.slice(a,b):'';return panel.includes('bowlerMaidens')&&panel.includes('jcIntlBowlerStats')&&panel.includes('jcIntlBallRail')&&panel.includes('jcIntlThisOver')&&!panel.includes('economy')&&!panel.includes('ECON');})()],
  ['Partnership, extras and powerplay or free-hit state are visible', scoreLayer.includes('partnershipRuns') && scoreLayer.includes('extrasTotal') && scoreLayer.includes('i.freeHit') && scoreLayer.includes('activePowerplay')],
  ['Control Board loads scoring engine and Firebase bridge', html.includes('scoring-engine.js') && html.includes('firebase/firebase-api-bridge.mjs')],
  ['Offline storage is loaded before API bridge', html.indexOf('offline-store.js') >= 0 && html.indexOf('offline-store.js') < html.indexOf('firebase-api-loader.js')],
  ['Offline match writes are durably queued before Firebase save', offlineLoader.includes('await cacheMatch(body.match)') && offlineLoader.includes("store?.put(queueKey,{match:snapshot")],
  ['Offline queue reads the saved match snapshot and uploads it to Firebase', offlineLoader.includes('const match=queued?.match') && !offlineLoader.includes('queued.value?.match') && offlineLoader.includes("JSON.stringify({match})")],
  ['Offline queue syncs automatically when connection returns', offlineLoader.includes("addEventListener('online'") && offlineLoader.includes('syncNow();') && offlineLoader.includes('setInterval(()=>{if(navigator.onLine)syncNow();},30000)')],
  ['Public match pages can show a cached match snapshot offline', offlineLoader.includes("const matchCacheKey='public:match:'") && offlineLoader.includes("await store?.put(matchCacheKey,result.body||{})") && offlineLoader.includes('इस Scoreboard का पिछला Match snapshot')],
  ['Static assets use a scoped service worker cache', serviceWorker.includes("addEventListener('fetch'") && serviceWorker.includes('skipWaiting') && offlineUi.includes("navigator.serviceWorker.register")],
  ['Mobile scoring layout is loaded and selected only on scoring page', html.includes('mobile-scoring-v2.css') && control.includes("body.classList.toggle('jc-scoring-view',id==='scoring')") && mobileCss.includes('overflow:hidden;overscroll-behavior:none')],
  ['International lower-third height is modestly reduced and typography remains responsive', freshScoreCss.includes('height:clamp(90px,6.5vw,116px)') && obsConsistentCss.includes('height:10.7cqh') && obsConsistentCss.includes('font-size:clamp(.72cqi') && freshScoreCss.includes('container-type:inline-size') && freshScoreCss.includes('cqi')],
  ['International Control Board preview contains full player and bowler details', control.includes('ROHIT') && control.includes('58 (31)') && control.includes('THIS OVER') && freshScoreCss.includes('.jlInternationalPreview')],
  ['Independent FOUR, SIX and WICKET motion themes are connected', control.includes('eventThemeFour') && control.includes('eventThemeSix') && control.includes('eventThemeWicket') && eventCss.includes('jcRipple') && eventCss.includes('jcSurge') && eventCss.includes('jcShards')],
  ['FOUR/SIX event overlays have transparent interiors and no borders', freshScoreCss.includes('.eventLayer[data-event-type="four"] .eventInner') && freshScoreCss.includes('.eventLayer[data-event-type="six"] .eventInner') && freshScoreCss.includes('background:transparent!important') && freshScoreCss.includes('border:0!important') && freshScoreCss.includes('content:none!important')],
  ['Firebase authentication persists across refreshes with browser-local persistence', bridge.includes('browserLocalPersistence') && bridge.includes('setPersistence(auth, browserLocalPersistence)') && !bridge.includes('browserSessionPersistence')],
  ['Firebase waits for restored local auth state before resolving the signed-in user', bridge.includes("if (typeof auth.authStateReady === 'function') await auth.authStateReady();") && bridge.includes('await authPersistenceReady;')],
  ['Mobile scoring buttons have larger tap targets and the CARDS opener stays visible', mobileTapCss.includes('min-height:38px!important') && mobileTapCss.includes('flex:0 0 36px!important') && mobileTapCss.includes('visibility:visible!important') && html.includes('mobile-scoring-tap-targets.css?v=1.0.0')],
  ['Score Layer details use the freed space for larger fonts without changing total height', readabilityCss.includes('.jcIntlBatterName') && readabilityCss.includes('.jcIntlBowlerName') && readabilityCss.includes('repeat(4,minmax(0,1fr))') && !/(?:^|[;{])\s*(?:min-|max-)?height\s*:/.test(readabilityCss) && scoreLayerHtml.includes('scorelayer-readability.css?v=1.1.1')],
  ['Service worker precaches the final 4.7.0 match-specific graphics release', serviceWorker.includes('firebase/firebase-api-bridge.mjs?v=5.1.5') && serviceWorker.includes('firebase-api-loader.js?v=5.1.8') && serviceWorker.includes('mobile-scoring-tap-targets.css?v=1.0.0') && serviceWorker.includes('scorelayer-readability.css?v=1.1.1') && serviceWorker.includes('scorelayer.js?v=8.1.10') && serviceWorker.includes('control.js?v=5.1.16') && serviceWorker.includes('scoring-engine.js?v=4.4.24') && serviceWorker.includes('scorelayer-broadcast-v2.css?v=9.0.4') && serviceWorker.includes('scorelayer-obs-consistent.css?v=1.0.2') && serviceWorker.includes('event-animation-themes.css?v=5.0.4') && serviceWorker.includes('jangid-cricinfo-static-v47')],
  ['Broadcast cards include an explicit close action', scoreLayer.includes('broadcastCardClose') && scoreLayer.includes("setAttribute('aria-label','Close card')")],
  ['Broadcast card is restored after its overlapping event animation finishes', scoreLayer.includes('el._hide=setTimeout(()=>clearEventVisual(el,cardEl,true)')],
  ['Every match receives its own OBS Score Layer URL and the scoring picker exposes both actions', control.includes('function scoreLayerUrlFor(match)') && control.includes("url.searchParams.set('match',String(match.id))") && control.includes('function renderLiveMatchPicker()') && control.includes('data-open-scoring-match') && control.includes('data-copy-scorelayer')],
  ['Private and public broadcast documents, offline queues and events are keyed by Match ID', bridge.includes("const storageId=safeMatch?'match_'+safeMatch:'current'") && bridge.includes("const scopeId=safeMatch?uid+'_match_'+safeMatch:uid") && bridge.includes("uid+'_match_'+safeMatch") && bridge.includes('broadcastsByMatch') && bridge.includes('broadcastEventsByMatch') && offlineLoader.includes("key(uid,'broadcast',scopeId)") && offlineLoader.includes('for(const row of broadcastRows)') && bridge.includes("safeMatchId+'_'+safeEventId")],
  ['Match-scoped Score Layer URLs cannot inherit another Match; legacy user-wide graphics are allowed only for an unambiguous single-live-match link', scoreLayer.includes('const allowLegacy=!requested') && scoreLayer.includes('ownerLiveMatches.length===1') && scoreLayer.includes('d.broadcastsByMatch?.[matchKey]') && bridge.includes('if (!snap.exists()) return {};') && !bridge.includes('if(!snap.exists()&&safeMatch)snap=await getDoc(publicDoc(\'publicBroadcasts\',uid))')],
  ['Completed matches stay on Scoring and keep Cards available while run-entry controls stop', engine.includes("showPage('scoring')") && engine.includes('await window.loadBroadcastForControlMatch?.(finished.id)') && engine.includes('b.disabled=false') && engine.includes("m.status==='live'")],
  ['Tournament Teams render compact cards and open a separate editable roster', tournament.includes('function renderTeamRoster(t,tm)') && tournament.includes('data-tm-team-open') && tournament.includes('data-tm-roster-edit') && tournament.includes('data-tm-roster-delete') && tournament.includes('data-tm-roster-rename') && (()=>{const a=tournament.indexOf('function renderTeams(t){'),b=tournament.indexOf('function renderGroups(t){',a),view=a>=0&&b>a?tournament.slice(a,b):'';return view.includes('tm-team-grid-compact')&&view.includes('data-tm-team-open')&&!view.includes('players.map');})()],
  ['Batting and bowling cards include only players who have batted or bowled, or are currently active', control.includes('filter(p=>Number(p.balls||0)>0||Number(p.runs||0)>0') && control.includes('String(p.id)===String(i.currentBowler)') && control.includes('||!!p.out||!!p.retired')],
  ['Old left/right and slide animation choices are removed from the Graphics screen', !html.includes('animationSelect') && !html.includes('animationDuration') && !html.includes('cardAnimationSelect') && !html.includes('slideLeft') && !html.includes('slideUp') && html.includes('eventThemeFreeHit') && html.includes('cardMotionSelect')],
  ['Finish sync clears orphaned Finish commands without deleting score snapshots', offlineLoader.includes('const publicMatchLookup=async(matchId)=>') && offlineLoader.includes('Cleared an orphaned Finish command; score snapshots were preserved:') && offlineLoader.includes('Restored the owner Match snapshot and cleared an obsolete Finish command without ending the live Match:')],
  ['Card state has stable summary and match-specific projection fallbacks', bridge.includes('broadcastCardsByMatch = {}') && bridge.includes("kind==='broadcast-card-state'") && bridge.includes('broadcastCardsByMatch[uid+\':\'+String(card.matchId)]') && bridge.includes('broadcastCardsByMatch[matchKey]')],
  ['Match, Finish, Event and Card sync queues are isolated so one stale Match cannot block Broadcast uploads', offlineLoader.includes('for(const row of matchRows){') && offlineLoader.includes('for(const row of finishRows){') && offlineLoader.includes('for(const row of eventRows){') && offlineLoader.includes('Broadcast Cards/Graphics sync') && offlineLoader.includes('rowErrors.length')],
  ['A stale Finish request restores an owned live public Match without ending it or deleting score queue data', offlineLoader.includes('const publicMatchSnapshot=async(matchId)=>') && offlineLoader.includes('const ownedRemote=!!remote&&(String(remote.ownerUid||\'\')===uid||String(remote.userId||\'\')===uid)') && offlineLoader.includes("new URL('/api/match/state',location.href)") && offlineLoader.includes('Restored the owner Match snapshot and cleared an obsolete Finish command without ending the live Match:')],
  ['Cards controls are expanded on mobile by default and remain manually selectable', html.includes('id="scoringCardControls" open') && html.includes('data-card-button="batter"') && html.includes('data-card-button="bowler"')],

  ['Mobile scoring gives every broadcast event an independent durable offline queue', offlineLoader.includes('async function cacheBroadcastEvent') && offlineLoader.includes("key(uid,'broadcast-event',eventId)") && offlineLoader.includes("queue:'+uid+':broadcast-event:") && offlineLoader.includes("new URL('/api/broadcast/event',location.href)")],
  ['Firebase publishes immutable event snapshots beside the public design library', bridge.includes("if(path==='/api/broadcast/event'&&method==='POST')") && bridge.includes("kind:'broadcast-event'") && bridge.includes("uid+'_broadcast_event_'+safeMatchId+'_'+safeEventId") && bridge.includes("where('kind','in',['broadcast-event','broadcast-card-state'])")],
  ['Current card state is mirrored independently for reliable cross-device display', bridge.includes("kind:'broadcast-card-state'") && bridge.includes("scopeId+'_broadcast_card_state'") && bridge.includes('broadcastCardsByMatch[matchKey]') && scoreLayer.includes('d.broadcastCardsByMatch?.[matchKey]')],
  ['Score Layer chooses only the selected Match broadcast, card and event state', scoreLayer.includes('d.broadcastsByMatch?.[matchKey]') && scoreLayer.includes('d.broadcastCardsByMatch?.[matchKey]') && scoreLayer.includes('d.broadcastEventsByMatch?.[matchKey]') && scoreLayer.includes('const matchKey=String(m.userId)+\':\'+String(m.id)')],
  ['Control Board writes a durable event record after the local broadcast snapshot', control.includes("api('/api/broadcast/event'") && control.includes('publishedEventId')],

  ['Each new event clears the old event animation state before replay', scoreLayer.includes('function resetEventAnimation(el)') && scoreLayer.includes('void el.offsetWidth;') && scoreLayer.includes('resetEventAnimation(el);clearTimeout(el._hide)') && scoreLayer.includes("el.removeAttribute('data-event-type')")],
  ['Cards run one selected entrance animation without inner Studio or overlay animation', readabilityCss.includes('A broadcast Card has one entrance animation') && readabilityCss.includes('#cardLayer.cardLayer::before') && readabilityCss.includes('#cardLayer.cardLayer .broadcastCardStage *::before')],
  ['Event animations never wait out a display-duration queue', control.includes('eventPublishGeneration') && control.includes('enqueueCurrentEvent') && !control.includes('await new Promise(resolve=>setTimeout(resolve,duration+100))')],
  ['A newer event cancels delayed event-sequence timers', control.includes('cancelEventSequenceTimers') && control.includes('eventSequenceTimers.clear()') && control.includes('generation!==eventPublishGeneration')],
  ['Non-event graphics saves preserve the event ID', control.includes('hasEventUpdate=Object.prototype.hasOwnProperty.call(extra,\'event\')') && control.includes('else if(hasEventUpdate){') && control.includes('payload.eventId=++broadcastSequence;') && control.includes('else if(STATE?.broadcast?.eventId!==undefined)payload.eventId=STATE.broadcast.eventId;') && !control.includes('...extra,eventId:++broadcastSequence')],
  ['Score Layer stores event IDs and timestamps and ignores delayed duplicate snapshots', scoreLayer.includes('jc:last-event:') && scoreLayer.includes('localStorage.setItem(lastEventStorageKey,lastEventId)') && scoreLayer.includes("lastEventStorageKey+':at'") && !scoreLayer.includes('eventAt<=lastEventAt') && scoreLayer.includes('incomingId===String(lastEventId??\'\')') && scoreLayer.includes('unique event ID')],
  ['Scoring recovers a temporarily missing active match from the saved live-state cache', engine.includes('function recoverLiveMatch()') && engine.includes('STATE?.savedLiveMatches') && engine.includes('recoverLiveMatch();')],
  ['Team and batter 50/100 run milestones trigger automatic graphics', engine.includes("previousTeamScore<100") && engine.includes("previousTeamScore<50") && engine.includes("previousBatterRuns<100") && engine.includes("previousBatterRuns<50") && engine.includes("event:'TEAM 50'") && engine.includes("event:'TEAM 100'") && engine.includes("event:'FIFTY'") && engine.includes("event:'CENTURY'")],
  ['Completed second innings automatically calculates winner, margin or tie', engine.includes('function completedMatchOutcome') && engine.includes('async function finishCompletedMatchAutomatically') && engine.includes('awaitingMatchFinish') && engine.includes('won by ${wicketsLeft}') && engine.includes('won by ${runs}') && engine.includes("resultType:'tie'")],
  ['Wicket animations finish before next innings or automatic result', engine.includes('const wicketPlayback=fireEventSequence') && engine.includes('wicketPlayback.then(()=>{if(MATCH?.awaitingNextInnings)startSecondInnings()})') && engine.includes('wicketPlayback.then(()=>finishCompletedMatchAutomatically())')],
  ['Mid-match manual Finish Match retains Winner, Tie and No Result choices', control.includes('data-finish-type="winner"') && control.includes('data-finish-type="tie"') && control.includes('data-finish-type="no-result"') && control.includes('finalizeMatch(type,winner)')],
  ['Event sequences preserve metadata and wait for the final animation', control.includes('eventSequenceResolve') && control.includes('item.meta') && control.includes('done(true)') && control.includes('duration+100')],
  ['Firebase Sync retries failed uploads with capped exponential backoff', offlineLoader.includes('syncFailureCount>0&&navigator.onLine') && offlineLoader.includes('Math.min(30000,1000*Math.pow(2')],
  ['Public Broadcast includes event animation maps, duration and event timestamp', bridge.includes('eventAnimations: broadcast.eventAnimations') && bridge.includes('eventDurations: broadcast.eventDurations') && bridge.includes('eventAt: broadcast.eventAt')],
  ['Public realtime broadcast retains team milestones and final result details', bridge.includes('teamMilestone: broadcast.event') && bridge.includes('resultDetails: broadcast.event') && bridge.includes("broadcast.event==='RESULT'")],
  ['Finished match remains selectable by ID for OBS result animation', scoreLayer.includes('...(d.matches||[])') && scoreLayer.includes("['live','finished'].includes(x.status)") && scoreLayer.includes("d.broadcasts?.[x.userId]?.event==='RESULT'")],
  ['Automatic result margin is retained by online and offline Finish endpoints', bridge.includes('cleanText(body.resultText,140)') && offlineLoader.includes("String(body.resultText||'').trim().slice(0,140)")],
  ['Broadcast events are scoped to the active match and stamped at publish time', control.includes('payload.eventAt=extra.event?Number(extra.eventAt||Date.now()):null') && control.includes('matchId:MATCH?.id||meta.matchId||null,eventAt:Date.now()')],
  ['Score Layer plays the first new event after opening while suppressing older snapshots', !scoreLayer.includes('scoreLayerLoadedAt') && !scoreLayer.includes('eventAt<scoreLayerLoadedAt') && scoreLayer.includes('b.matchId&&String(b.matchId)!==String(matchId)')],
  ['FOUR, SIX and WICKET themes are not disabled by reduced-motion media rules', !eventCss.includes('@media(prefers-reduced-motion:reduce){.eventLayer[data-event-type=\"four\"] .eventInner')],
  ['Score Layer base CSS never disables broadcast event animations for reduced-motion devices', !scoreLayerCss.includes('@media(prefers-reduced-motion:reduce){.eventInner,.broadcastCardStage,.scoreBar{animation:none!important')],
  ['Score Layer HTML and service worker use the refreshed layout, animation and readability assets', scoreLayerHtml.includes('scorelayer.css?v=4.4.17') && serviceWorker.includes('scorelayer.css?v=4.4.17') && serviceWorker.includes('jangid-cricinfo-static-v47') && serviceWorker.includes('scorelayer-obs-consistent.css?v=1.0.2') && scoreLayerHtml.includes('scorelayer-readability.css?v=1.1.1') && scoreLayerHtml.includes('scorelayer-obs-consistent.css?v=1.0.2') && scoreLayerHtml.includes('scorelayer.js?v=8.1.10') && scoreLayerHtml.includes('scorelayer-broadcast-v2.css?v=9.0.4')],
  ['Realtime public snapshots preserve the owner-only Undo stack for the same match and innings', control.includes('function preservePrivateUndoHistory(publicMatch,candidates=[])') && control.includes('preservePrivateUndoHistory(incomingMine,[MATCH,STATE.activeMatch,...(STATE.matches||[])])') && control.includes('undoStack:JSON.parse(JSON.stringify(privateMatch.activeInnings.undoStack))') && !control.includes('clone(privateMatch.activeInnings.undoStack)')],
  ['New broadcast events clear the previous card and reset its Control Board button', control.includes('card:null,cardId:Date.now(),event,eventStyle:') && control.includes("Object.prototype.hasOwnProperty.call(extra,'card')") && control.includes('syncCardButtonState(activeCardType)') && control.includes('Broadcast event cleanup could not sync') && control.includes('publishedEventId')],
  ['OBS Score Layer keeps a fixed four-panel horizontal layout and scales from its source canvas', obsConsistentCss.includes('container-type:size') && obsConsistentCss.includes('height:10.7cqh') && obsConsistentCss.includes('width:97cqw') && obsConsistentCss.includes('grid-template-areas:"batting score target bowling"') && scoreLayerHtml.includes('scorelayer-obs-consistent.css?v=1.0.2')],
  ['OBS cards and event art scale proportionally with the Browser Source canvas', obsConsistentCss.includes('width:68.75cqw') && obsConsistentCss.includes('font-size:7.8cqw') && obsConsistentCss.includes('max-height:84cqh')],
  ['Custom Score Layer design fonts and logos use container-relative sizing', scoreLayer.includes('const designCqi=value=>') && scoreLayer.includes('const scoreSize=designCqi(score)') && scoreLayer.includes('compactLogoSize')],
  ['Tournament Schedule is a separate action with dedicated wickets and best-player tabs', tournament.includes("['wickets','Wickets']") && tournament.includes("['best','Best Players']") && tournament.includes('data-tm-tab="schedule"')],
  ['Realtime listener starts without a false Promise catch', bridge.includes('subscribePublic();') && !bridge.includes('subscribePublic().catch(')],
  ['World Cup 2026 has twenty stable, separate vector score designs and a dedicated group selector', studioEditor.includes('function buildWorldCup2026Templates()') && studioEditor.includes("id:'wc26-'+String(index+1).padStart(2,'0')") && studioEditor.includes('id="jcStudioGroup"') && studioEditor.includes("category==='score'?40:20") && studioEditor.includes("groupId:'worldcup2026'")],
  ['Existing Studio score designs are preserved and World Cup layouts are seeded only once', studioEditor.includes("groupId:category==='score'&&t.groupId==='worldcup2026'?'worldcup2026':'existing'") && studioEditor.includes('worldCup2026Seeded') && studioEditor.includes('Existing Designs')],
  ['Public Studio templates are saved in separate Firestore documents and rehydrated', bridge.includes('async function savePublicStudioDesign(uid, design)') && bridge.includes("kind:kind+'-template'") && bridge.includes("where('uid','==',uid)") && bridge.includes("restore('templates','score')")],
  ['Admin Studio permits 40 score layouts while cards and animations remain limited to 20', bridge.includes("['templates','Score Layer',40]") && bridge.includes("['cardTemplates','Card',20]") && bridge.includes("['animationTemplates','Animation',20]") && adminHtml.includes('scoreboard-studio.js?v=4.6.0') && adminHtml.includes('scoreboard-studio.css?v=4.6.0')],
  ['OBS card layer clears legacy horizontal transform and remains centered', obsConsistentCss.includes('#cardLayer.cardLayer') && obsConsistentCss.includes('transform:none!important') && obsConsistentCss.includes('#cardLayer.cardLayer.isVisible')],
  ['OBS manual cards no longer disable every Studio element animation', !readabilityCss.includes('animation:none!important;transition:none!important') && readabilityCss.includes('jlStudioMotion-') && scoreLayer.includes("selectedStudioOverlay(b.cardDesign||b.studioDesign,'card')")],
  ['OBS event animation reads the combined Studio animation library', scoreLayer.includes("selectedStudioOverlay(b.animationDesign||b.studioDesign,'animation')") && scoreLayerStudioCss.includes('.jlStudioMotion-fireworks')],
  ['Offline scoring and Firebase pending-sync queues remain intact', offlineStore.includes('indexedDB.open') && offlineLoader.includes('async function cacheMatch') && offlineLoader.includes('async function cacheBroadcast') && offlineLoader.includes('async function syncNow') && offlineLoader.includes('verifiedUid!==uid')],
  ['OBS and site pages share the refreshed Firebase bridge and versioned Score Layer assets', scoreLayerHtml.includes('firebase/firebase-api-bridge.mjs?v=5.1.5') && html.includes('firebase/firebase-api-bridge.mjs?v=5.1.5') && serviceWorker.includes('firebase/firebase-api-bridge.mjs?v=5.1.5') && scoreLayerHtml.includes('firebase-api-loader.js?v=5.1.8') && scoreLayerHtml.includes('scorelayer.js?v=8.1.10') && scoreLayerHtml.includes('event-animation-themes.css?v=5.0.4') && scoreLayerHtml.includes('scorelayer-broadcast-v2.css?v=9.0.4') && scoreLayerHtml.includes('scorelayer-obs-consistent.css?v=1.0.2') && serviceWorker.includes('scoreboard-studio.js?v=4.6.0') && serviceWorker.includes('jangid-cricinfo-static-v47')],
];
for (const [label, ok] of checks) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label);
  if (!ok) failures.push(label);
}
console.log('Checked ' + sourceFiles.length + ' JavaScript files and ' + cssFiles.length + ' CSS files.');
if (failures.length) {
  console.error('\nStatic validation failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Static validation passed.');
