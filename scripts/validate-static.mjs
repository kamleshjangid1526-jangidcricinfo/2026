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
const [control, engine, bridge, tournament, scoreLayer, scoreLayerCss, workflowCss, html, offlineStore, offlineLoader, serviceWorker, mobileCss, eventCss, offlineUi, freshScoreCss] = await Promise.all([
  read('control.js'), read('scoring-engine.js'), read('firebase/firebase-api-bridge.mjs'),
  read('tournament-manager.js'), read('scorelayer.js'), read('scorelayer.css'),
  read('control-workflow.css'), read('control.html'), read('offline-store.js'),
  read('firebase-api-loader.js'), read('sw.js'), read('mobile-scoring-v2.css'),
  read('event-animation-themes.css'), read('offline-status-ui.js'), read('scorelayer-broadcast-v2.css')
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
  ['One World Cup reference Score Layer layout is available', layerCount === 1],
  ['All 20 event animation names have matching Score Layer styles', animationNames.length === 20 && animationNames.every(name => scoreLayerCss.toLowerCase().includes(name.toLowerCase()))],
  ['Layout and colour are independent', control.includes('changing a layout must never overwrite') && control.includes("$('colorSelect').addEventListener('change'")],
  ['Single-screen scoring layout prevents vertical page scrolling', workflowCss.includes('overflow:hidden;overscroll-behavior:none')],
  ['Scoring engine exposes save and finish handlers', engine.includes('window.saveMatch=saveMatch') && engine.includes('window.finalizeMatch=finalizeMatch')],
  ['Firebase saves full live-match snapshots', bridge.includes("if(m.status==='live') await setDoc(ownerDoc(uid,'meta','active')") && bridge.includes('await publishMatch(uid,m)')],
  ['Existing-live-match details reach Control Board recovery flow', bridge.includes('Array.isArray(error.matches)') && control.includes('e.details?.matches')],
  ['Tournament scheduling stays in dedicated Schedule Match view', tournament.includes('data-tm-tab="schedule"') && tournament.includes('function renderSchedule(t)')],
  ['Matches tab only renders live matches', tournament.includes("const live=list.filter(m=>m.status==='live')")],
  ['International Score Layer keeps both batter lines, score, target team and bowler separate', scoreLayer.includes('jcIntlBattingPanel') && scoreLayer.includes('jcIntlScorePanel') && scoreLayer.includes('jcIntlTargetPanel') && scoreLayer.includes('jcIntlBowlingPanel') && scoreLayer.includes('targetTeam.name')],
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
  ['International lower-third has a readable responsive 102-128px 1080p/720p height', freshScoreCss.includes('.jlInternationalScorebar') && freshScoreCss.includes('height:clamp(102px,7.2vw,128px)') && freshScoreCss.includes('container-type:inline-size') && freshScoreCss.includes('cqi')],
  ['International Control Board preview contains full player and bowler details', control.includes('MAXWELL') && control.includes('116 (87)') && control.includes('THIS OVER') && freshScoreCss.includes('.jlInternationalPreview')],
  ['Independent FOUR, SIX and WICKET motion themes are connected', control.includes('eventThemeFour') && control.includes('eventThemeSix') && control.includes('eventThemeWicket') && eventCss.includes('jcRipple') && eventCss.includes('jcSurge') && eventCss.includes('jcShards')],
  ['Broadcast cards include an explicit close action', scoreLayer.includes('broadcastCardClose') && scoreLayer.includes("setAttribute('aria-label','Close card')")],
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
