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
const [control, engine, bridge, tournament, scoreLayer, scoreLayerCss, workflowCss, html, offlineStore, offlineLoader, serviceWorker, mobileCss, eventCss, offlineUi, freshScoreCss, mobileTapCss, readabilityCss, scoreLayerHtml] = await Promise.all([
  read('control.js'), read('scoring-engine.js'), read('firebase/firebase-api-bridge.mjs'),
  read('tournament-manager.js'), read('scorelayer.js'), read('scorelayer.css'),
  read('control-workflow.css'), read('control.html'), read('offline-store.js'),
  read('firebase-api-loader.js'), read('sw.js'), read('mobile-scoring-v2.css'),
  read('event-animation-themes.css'), read('offline-status-ui.js'), read('scorelayer-broadcast-v2.css'),
  read('mobile-scoring-tap-targets.css'), read('scorelayer-readability.css'), read('scorelayer.html')
]);

const layoutStart = control.indexOf('const LAYERS=[');
const layoutEnd = control.indexOf('];', layoutStart);
const layerCount = layoutStart >= 0 && layoutEnd > layoutStart
  ? [...control.slice(layoutStart, layoutEnd).matchAll(/'[^']+'/g)].length : 0;
const animStart = control.indexOf('const ANIMS=[');
const animEnd = control.indexOf('];', animStart);
const animationNames = animStart >= 0 && animEnd > animStart
  ? [...control.slice(animStart, animEnd).matchAll(/'([^']+)'/g)].map(match => match[1]).filter(name => name !== 'none') : [];
const checks = [
  ['20 International Score Layer shape layouts are available', layerCount === 20],
  ['All 20 Score Layer layouts have dedicated shape treatments', Array.from({length:20},(_,i)=>freshScoreCss.includes('.jlInternationalScorebar.layer'+(i+1)+' .jcIntlPanel')).every(Boolean)],
  ['20 independent colour palettes are available', ((control.match(/const COLORS=\[/)?.[0]||'').length>0 && [...control.slice(control.indexOf('const COLORS=['),control.indexOf('];',control.indexOf('const COLORS=['))).matchAll(/'[^']+'/g)].length===20)],
  ['All 20 event animation names have matching Score Layer styles', animationNames.length === 20 && animationNames.every(name => scoreLayerCss.toLowerCase().includes(name.toLowerCase()))],
  ['New event resets previous animation state before replay', scoreLayer.includes('function resetEventAnimation(el)') && scoreLayer.includes('void el.offsetWidth;') && scoreLayer.includes('resetEventAnimation(el);clearTimeout(el._hide)') && scoreLayer.includes("el.removeAttribute('data-event-type')")],
  ['Layout and colour are independent', control.includes('changing a layout must never overwrite') && control.includes("$('colorSelect').addEventListener('change'")],
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
  ['Broadcast saves avoid rewriting the complete cached account profile', offlineLoader.includes('cachedState.broadcast={...(cachedState.broadcast||{}),...clone(payload)};') && !offlineLoader.includes('await saveState(cachedState);}emitPublic(publicPayload(cachedState?.activeMatch,cachedState?.broadcast))')],
  ['Pending broadcast graphics are replayed after Score Layer refresh', offlineLoader.includes("const pendingBroadcast=await store.get(key(uid,'broadcast'))") && offlineLoader.includes('...clone(pendingBroadcast.payload)')],
  ['Latest broadcast graphics remain available offline after a successful upload clears the queue', offlineLoader.includes("store?.put('broadcast:last:'+uid,clone(payload))") && offlineLoader.includes("store.get('broadcast:last:'+uid)")],
  ['Online sync is lightly debounced and coalesced during an active upload', offlineLoader.includes('function scheduleSync(delay=220)') && offlineLoader.includes('syncRequested=true') && offlineLoader.includes('(rerunSync||syncRequested)')],
  ['Existing-live-match details reach Control Board recovery flow', bridge.includes('Array.isArray(error.matches)') && control.includes('e.details?.matches')],
  ['Tournament scheduling stays in dedicated Schedule Match view', tournament.includes('data-tm-tab="schedule"') && tournament.includes('function renderSchedule(t)')],
  ['Matches tab only renders live matches', tournament.includes("const live=list.filter(m=>m.status==='live')")],
  ['International Score Layer keeps both batter lines, score, target team and bowler separate', scoreLayer.includes('jcIntlBattingPanel') && scoreLayer.includes('jcIntlScorePanel') && scoreLayer.includes('jcIntlTargetPanel') && scoreLayer.includes('jcIntlBowlingPanel') && scoreLayer.includes('targetTeam.name')],
  ['Batting team name replaces the generic batting label', scoreLayer.includes('jcIntlTeamName') && scoreLayer.includes('esc(batting.name') && !scoreLayer.includes('<strong>BATTERS</strong>')],
  ['Partnership is separated into the lower half of the target panel', scoreLayer.includes('jcIntlTargetPartnership') && scoreLayer.includes('jcIntlTargetMain') && !scoreLayer.includes('class="jcIntlPartnership"')],
  ['Batter R-B, 4s, 6s and strike rate are visible', scoreLayer.includes('player?.fours') && scoreLayer.includes('player?.sixes') && scoreLayer.includes('strikeRate') && scoreLayer.includes('jcIntlBatterHead')],
  ['Bowler O-M-R-W, economy and this-over balls are visible', scoreLayer.includes('bowlerMaidens') && scoreLayer.includes('economy') && scoreLayer.includes('jcIntlBallRail') && scoreLayer.includes('jcIntlThisOver')],
  ['Partnership, extras and powerplay or free-hit state are visible', scoreLayer.includes('partnershipRuns') && scoreLayer.includes('extrasTotal') && scoreLayer.includes('i.freeHit') && scoreLayer.includes('activePowerplay')],
  ['Control Board loads scoring engine and Firebase bridge', html.includes('scoring-engine.js') && html.includes('firebase/firebase-api-bridge.mjs')],
  ['Offline storage is loaded before API bridge', html.indexOf('offline-store.js') >= 0 && html.indexOf('offline-store.js') < html.indexOf('firebase-api-loader.js')],
  ['Offline match writes are durably queued before Firebase save', offlineLoader.includes('await cacheMatch(body.match)') && offlineLoader.includes("store?.put(queueKey,{match:snapshot")],
  ['Offline queue reads the saved match snapshot and uploads it to Firebase', offlineLoader.includes('const match=queued?.match') && !offlineLoader.includes('queued.value?.match') && offlineLoader.includes("JSON.stringify({match})")],
  ['Offline queue syncs automatically when connection returns', offlineLoader.includes("addEventListener('online'") && offlineLoader.includes('syncNow();') && offlineLoader.includes('setInterval(()=>{if(navigator.onLine)syncNow();},30000)')],
  ['Public match pages can show a cached match snapshot offline', offlineLoader.includes("const matchCacheKey='public:match:'") && offlineLoader.includes("await store?.put(matchCacheKey,result.body||{})") && offlineLoader.includes('इस Scoreboard का पिछला Match snapshot')],
  ['Static assets use a scoped service worker cache', serviceWorker.includes("addEventListener('fetch'") && serviceWorker.includes('skipWaiting') && offlineUi.includes("navigator.serviceWorker.register")],
  ['Mobile scoring layout is loaded and selected only on scoring page', html.includes('mobile-scoring-v2.css') && control.includes("body.classList.toggle('jc-scoring-view',id==='scoring')") && mobileCss.includes('overflow:hidden;overscroll-behavior:none')],
  ['International lower-third height is slightly reduced but remains responsive', freshScoreCss.includes('height:clamp(96px,6.85vw,122px)') && freshScoreCss.includes('container-type:inline-size') && freshScoreCss.includes('cqi')],
  ['International Control Board preview contains full player and bowler details', control.includes('ROHIT') && control.includes('58 (31)') && control.includes('THIS OVER') && freshScoreCss.includes('.jlInternationalPreview')],
  ['Independent FOUR, SIX and WICKET motion themes are connected', control.includes('eventThemeFour') && control.includes('eventThemeSix') && control.includes('eventThemeWicket') && eventCss.includes('jcRipple') && eventCss.includes('jcSurge') && eventCss.includes('jcShards')],
  ['FOUR/SIX event overlays have transparent interiors and no borders', freshScoreCss.includes('.eventLayer[data-event-type="four"] .eventInner') && freshScoreCss.includes('.eventLayer[data-event-type="six"] .eventInner') && freshScoreCss.includes('background:transparent!important') && freshScoreCss.includes('border:0!important') && freshScoreCss.includes('content:none!important')],
  ['Firebase authentication persists across refreshes with browser-local persistence', bridge.includes('browserLocalPersistence') && bridge.includes('setPersistence(auth, browserLocalPersistence)') && !bridge.includes('browserSessionPersistence')],
  ['Firebase waits for restored local auth state before resolving the signed-in user', bridge.includes("if (typeof auth.authStateReady === 'function') await auth.authStateReady();") && bridge.includes('await authPersistenceReady;')],
  ['Mobile scoring buttons have larger tap targets and the CARDS opener stays visible', mobileTapCss.includes('min-height:38px!important') && mobileTapCss.includes('flex:0 0 36px!important') && mobileTapCss.includes('visibility:visible!important') && html.includes('mobile-scoring-tap-targets.css?v=1.0.0')],
  ['Score Layer details are more readable without changing its total height', readabilityCss.includes('.jcIntlBatterName') && readabilityCss.includes('.jcIntlBowlerName') && !/(?:^|[;{])\s*(?:min-|max-)?height\s*:/.test(readabilityCss) && scoreLayerHtml.includes('scorelayer-readability.css?v=1.0.0')],
  ['Service worker precaches the refreshed auth module and responsive CSS', serviceWorker.includes('firebase/firebase-api-bridge.mjs?v=5.0.9') && serviceWorker.includes('mobile-scoring-tap-targets.css?v=1.0.0') && serviceWorker.includes('scorelayer-readability.css?v=1.0.0') && serviceWorker.includes('jangid-cricinfo-static-v37')],
  ['Broadcast cards include an explicit close action', scoreLayer.includes('broadcastCardClose') && scoreLayer.includes("setAttribute('aria-label','Close card')")],
  ['Event animations never wait out a display-duration queue', control.includes('eventPublishGeneration') && control.includes('enqueueCurrentEvent') && !control.includes('await new Promise(resolve=>setTimeout(resolve,duration+100))')],
  ['A newer event cancels delayed event-sequence timers', control.includes('cancelEventSequenceTimers') && control.includes('eventSequenceTimers.clear()') && control.includes('generation!==eventPublishGeneration')],
  ['Non-event graphics saves preserve the event ID', control.includes('hasEventUpdate=Object.prototype.hasOwnProperty.call(extra,\'event\')') && control.includes('else if(hasEventUpdate){') && control.includes('payload.eventId=++broadcastSequence;') && control.includes('else if(STATE?.broadcast?.eventId!==undefined)payload.eventId=STATE.broadcast.eventId;') && !control.includes('...extra,eventId:++broadcastSequence')],
  ['Score Layer stores event IDs and ignores duplicate or stale replay', scoreLayer.includes('jc:last-event:') && scoreLayer.includes('localStorage.setItem(lastEventStorageKey,lastEventId)') && scoreLayer.includes('incomingId===String(lastEventId??\'\')') && scoreLayer.includes('eventScopeInitialized')],
  ['Scoring recovers a temporarily missing active match from the saved live-state cache', engine.includes('function recoverLiveMatch()') && engine.includes('STATE?.savedLiveMatches') && engine.includes('recoverLiveMatch();')],
  ['Firebase Sync retries failed uploads with capped exponential backoff', offlineLoader.includes('syncFailureCount>0&&navigator.onLine') && offlineLoader.includes('Math.min(30000,1000*Math.pow(2')],
  ['Public Broadcast includes event animation maps, duration and event timestamp', bridge.includes('eventAnimations: broadcast.eventAnimations') && bridge.includes('eventDurations: broadcast.eventDurations') && bridge.includes('eventAt: broadcast.eventAt')],
  ['Broadcast events are scoped to the active match and stamped at publish time', control.includes('payload.eventAt=extra.event?Number(extra.eventAt||Date.now()):null') && control.includes('matchId:MATCH?.id||meta.matchId||null,eventAt:Date.now()')],
  ['Score Layer plays the first new event after opening while suppressing older snapshots', scoreLayer.includes('const scoreLayerLoadedAt=Date.now()') && scoreLayer.includes('const isOldSnapshot=!!eventAt&&eventAt<scoreLayerLoadedAt') && scoreLayer.includes('b.matchId&&String(b.matchId)!==String(matchId)')],
  ['FOUR, SIX and WICKET themes are not disabled by reduced-motion media rules', !eventCss.includes('@media(prefers-reduced-motion:reduce){.eventLayer[data-event-type=\"four\"] .eventInner')],
  ['Score Layer base CSS never disables broadcast event animations for reduced-motion devices', !scoreLayerCss.includes('@media(prefers-reduced-motion:reduce){.eventInner,.broadcastCardStage,.scoreBar{animation:none!important')],
  ['Score Layer HTML and service worker use the refreshed animation stylesheet', scoreLayerHtml.includes('scorelayer.css?v=4.4.17') && serviceWorker.includes('scorelayer.css?v=4.4.17') && serviceWorker.includes('jangid-cricinfo-static-v37') && scoreLayerHtml.includes('scorelayer-readability.css?v=1.0.0')],
  ['Tournament Schedule is a separate action with dedicated wickets and best-player tabs', tournament.includes("['wickets','Wickets']") && tournament.includes("['best','Best Players']") && tournament.includes('data-tm-tab="schedule"')],
  ['Realtime listener starts without a false Promise catch', bridge.includes('subscribePublic();') && !bridge.includes('subscribePublic().catch(')]
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
