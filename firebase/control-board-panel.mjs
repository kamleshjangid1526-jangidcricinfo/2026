/**
 * Jangid Cricinfo Phase 17 - Firebase Tournament + Fixture Status UI.
 * This is an opt-in workspace. Legacy API/state and match scoring remain untouched.
 */
const byId = (id) => document.getElementById(id);
const status = (message, kind = 'info') => {
  const node = byId('jcFirebaseStatus');
  if (!node) return;
  node.textContent = message;
  node.dataset.kind = kind;
};
const setBusy = (busy) => {
  for (const id of ['jcFirebaseLogin', 'jcFirebaseLogout', 'jcFirebaseLoad']) {
    const node = byId(id);
    if (node) node.disabled = busy;
  }
};
const safe = (value) => String(value ?? '');
let authApi;
let bridgeApi;
let fixtureApi;
let unsubscribe;
let workspace = { tournaments: [], teams: [] };

async function loadModules() {
  if (!authApi) authApi = await import('./auth-service.mjs');
  if (!bridgeApi) bridgeApi = await import('./tournament-control-bridge.mjs');
  if (!fixtureApi) fixtureApi = await import('./tournament-fixture-service.mjs');
}
function make(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function field(labelText, control) {
  const wrap = make('label', undefined, 'jc-fixture-field');
  wrap.append(make('span', labelText), control);
  return wrap;
}
function input(type, value, attrs = {}) {
  const node = document.createElement('input');
  node.type = type;
  if (value !== undefined) node.value = value;
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, String(val));
  return node;
}
function select(options) {
  const node = document.createElement('select');
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    node.append(option);
  }
  return node;
}
async function refreshFixtures(tournamentId, target) {
  target.replaceChildren(make('p', 'Fixtures लोड हो रहे हैं…', 'muted'));
  try {
    const rows = await fixtureApi.listTournamentFixtures(tournamentId);
    target.replaceChildren();
    if (!rows.length) {
      target.append(make('p', 'अभी कोई Firebase Fixture नहीं है।', 'muted'));
      return;
    }
    const statusLabel = { scheduled: 'Scheduled', live: 'LIVE', finished: 'Completed', cancelled: 'Cancelled' };
    for (const row of rows) {
      const card = make('article', undefined, 'jc-fixture-row');
      const details = make('div');
      details.append(make('strong', `${safe(row.teamAName)} vs ${safe(row.teamBName)}`));
      details.append(make('small', `${safe(row.dateTime).replace('T', ' ')} · ${safe(row.stage)} · ${safe(row.overs)} overs · ${safe(row.venue)}`));
      details.append(make('small', `स्थिति: ${statusLabel[row.status] || safe(row.status)}`));
      if (row.result) {
        const resultText = row.result.outcome === 'winner' ? `विजेता: ${row.result.winnerTeamName}`
          : row.result.outcome === 'tie' ? 'परिणाम: Tie' : 'परिणाम: No Result';
        details.append(make('small', resultText));
      }
      card.append(details);

      const actions = make('div', undefined, 'jc-fixture-actions');
      const transitions = {
        scheduled: [['live', 'Start / Live करें'], ['cancelled', 'Cancel करें']],
        cancelled: [['scheduled', 'फिर Scheduled करें']],
        live: [['finished', 'Finish Match करें']],
        finished: []
      };
      const choices = transitions[row.status] || [];
      if (choices.length) {
        const next = select([['', 'स्थिति बदलें…'], ...choices]);
        const resultBox = make('div', undefined, 'jc-fixture-result-fields');
        resultBox.hidden = true;
        const outcome = select([['winner', 'Winning Team'], ['tie', 'Tie'], ['no_result', 'No Result']]);
        const winner = select([[String(row.teamAId), safe(row.teamAName)], [String(row.teamBId), safe(row.teamBName)]]);
        const note = input('text', '', { maxlength: 180, placeholder: 'परिणाम नोट (वैकल्पिक)' });
        resultBox.append(field('मैच परिणाम', outcome), field('विजेता', winner), field('नोट', note));
        outcome.addEventListener('change', () => { winner.disabled = outcome.value !== 'winner'; });
        next.addEventListener('change', () => { resultBox.hidden = next.value !== 'finished'; });
        const apply = make('button', 'Update Status', 'btn primary');
        apply.type = 'button';
        apply.addEventListener('click', async () => {
          if (!next.value) return status('पहले नई स्थिति चुनें।', 'warning');
          if (next.value === 'finished' && outcome.value === 'winner' && !winner.value) return status('विजेता Team चुनें।', 'warning');
          if (next.value === 'finished' && !confirm('मैच को Completed घोषित करके परिणाम सेव करें?')) return;
          apply.disabled = true;
          try {
            await fixtureApi.updateTournamentFixtureStatus(tournamentId, row.id, next.value, {
              outcome: outcome.value, winnerTeamId: winner.value, note: note.value
            });
            status('Fixture की स्थिति अपडेट हो गई। Public Tournament Page पर भी अपडेट भेजा गया (यदि प्रकाशित है)।', 'success');
            await refreshFixtures(tournamentId, target);
          } catch (error) {
            status(`स्थिति अपडेट नहीं हुई: ${error?.message || error}`, 'error');
            apply.disabled = false;
          }
        });
        actions.append(next, resultBox, apply);
      }
      if (['scheduled', 'cancelled'].includes(row.status)) {
        const del = make('button', 'Delete Fixture', 'btn dangerMini');
        del.type = 'button';
        del.addEventListener('click', async () => {
          if (!confirm('इस Firebase Fixture को हटाएँ?')) return;
          del.disabled = true;
          try {
            await fixtureApi.deleteTournamentFixture(tournamentId, row.id);
            status('Fixture हटाया गया।', 'success');
            await refreshFixtures(tournamentId, target);
          } catch (error) {
            status(`Fixture नहीं हटाया: ${error?.message || error}`, 'error');
            del.disabled = false;
          }
        });
        actions.append(del);
      }
      if (actions.childNodes.length) card.append(actions);
      target.append(card);
    }
  } catch (error) {
    target.replaceChildren(make('p', `Fixtures नहीं मिले: ${error?.message || error}`, 'muted'));
  }
}
function addFixtureWorkspace(parent, tournament) {
  const section = make('section', undefined, 'jc-fixture-workspace');
  section.append(make('h4', `${safe(tournament.name)} — Firebase Fixtures`));
  const teams = (workspace.teams || []).filter(team => (tournament.teamIds || []).map(String).includes(String(team.id)));
  if (teams.length < 2) {
    section.append(make('p', 'Fixture बनाने के लिए इस Tournament में कम-से-कम दो Firebase Teams जोड़ें।', 'muted'));
  } else {
    const teamOptions = teams.map(team => [String(team.id), safe(team.name || 'Team')]);
    const teamA = select(teamOptions), teamB = select(teamOptions);
    if (teamOptions.length > 1) teamB.selectedIndex = 1;
    const date = input('date', tournament.startDate || new Date().toISOString().slice(0, 10), { required: 'required' });
    const time = input('time', '14:00', { required: 'required' });
    const venue = input('text', tournament.venue || '', { maxlength: 120, placeholder: 'मैदान' });
    const overs = input('number', '20', { min: 1, max: 50, required: 'required' });
    const stage = select([['league','League'],['group','Group'],['quarterfinal','Quarterfinal'],['semifinal','Semifinal'],['final','Final']]);
    const form = make('div', undefined, 'jc-fixture-form');
    form.append(field('Team A', teamA), field('Team B', teamB), field('तारीख', date), field('समय', time), field('मैदान', venue), field('Overs', overs), field('Stage', stage));
    const save = make('button', '＋ Firebase Fixture सेव करें', 'btn primary');
    save.type = 'button';
    save.addEventListener('click', async () => {
      if (!date.value || !time.value) return status('तारीख और समय भरें।', 'warning');
      if (teamA.value === teamB.value) return status('दो अलग-अलग Teams चुनें।', 'warning');
      save.disabled = true;
      try {
        const a = teams.find(x => String(x.id) === teamA.value);
        const b = teams.find(x => String(x.id) === teamB.value);
        await fixtureApi.saveTournamentFixture(tournament.id, {
          teamAId: teamA.value, teamBId: teamB.value,
          teamAName: a?.name || 'Team A', teamBName: b?.name || 'Team B',
          dateTime: `${date.value}T${time.value}`, venue: venue.value,
          overs: Number(overs.value), stage: stage.value, status: 'scheduled'
        });
        status('Firebase Fixture सफलतापूर्वक सेव हुआ। यह अभी पुराने Live Match सिस्टम से अलग है।', 'success');
        await refreshFixtures(tournament.id, list);
      } catch (error) {
        status(`Fixture सेव नहीं हुआ: ${error?.message || error}`, 'error');
      } finally { save.disabled = false; }
    });
    section.append(form, save);
  }
  const list = make('div', undefined, 'jc-fixture-list');
  section.append(make('h5', 'Saved Firebase Fixtures'), list);
  parent.append(section);
  refreshFixtures(tournament.id, list);
}
function showWorkspace(data) {
  workspace = {
    tournaments: Array.isArray(data.tournaments) ? data.tournaments : [],
    teams: Array.isArray(data.teams) ? data.teams : []
  };
  const box = byId('jcFirebaseWorkspace');
  if (!box) return;
  box.replaceChildren();
  box.append(make('p', `Firebase में ${workspace.tournaments.length} Tournament और ${workspace.teams.length} Teams मिलीं।`));
  box.append(make('p', 'यह Firebase परीक्षण Workspace है। Fixture की स्थिति Scheduled → Live → Completed या Cancelled की जा सकती है; पुराने Live Scoring Engine से यह अभी अलग है।', 'muted'));
  for (const tournament of workspace.tournaments.slice(0, 20)) {
    const item = make('section', undefined, 'jc-firebase-tournament');
    const head = make('div', undefined, 'jc-firebase-tournament-head');
    head.append(make('strong', `${safe(tournament.name || 'Unnamed Tournament')} · ${safe(tournament.status || 'draft')}`));
    const publish = make('button', 'Public Page पर Publish', 'btn primary');
    publish.type = 'button';
    publish.addEventListener('click', async () => {
      publish.disabled = true;
      try {
        const api = await import('./public-tournament-service.mjs');
        const result = await api.publishTournament(tournament.id);
        status(`Public Publish सफल: ${result.teamCount} Teams प्रकाशित हुईं। Public URL: tournament-public.html?id=${encodeURIComponent(result.id)}`, 'success');
      } catch (error) { status(`Publish नहीं हुआ: ${error?.message || error}`, 'error'); }
      finally { publish.disabled = false; }
    });
    head.append(publish);
    item.append(head);
    addFixtureWorkspace(item, tournament);
    box.append(item);
  }
  if (!workspace.tournaments.length) box.append(make('p', 'अभी Firebase में कोई Tournament नहीं मिला।'));
}
function renderPanel() {
  const section = document.getElementById('tournament');
  if (!section || document.getElementById('jcFirebasePanel')) return;
  const panel = make('section', undefined, 'panel');
  panel.id = 'jcFirebasePanel';
  panel.innerHTML = `
    <div class="panelHead"><div><span class="eyebrow">FIREBASE · PHASE 17</span><h3>Firebase Tournament & Fixture Workspace</h3>
    <p class="muted smallHelp">यह opt-in Firebase Workspace है। पुराने Control Board, Match Scoring और data.json को अभी नहीं बदलता।</p></div></div>
    <div class="grid2">
      <div class="field"><label for="jcFirebaseEmail">Firebase Email</label><input id="jcFirebaseEmail" type="email" autocomplete="username" placeholder="अपना Firebase Email"></div>
      <div class="field"><label for="jcFirebasePassword">Firebase Password</label><input id="jcFirebasePassword" type="password" autocomplete="current-password" placeholder="Firebase Password"></div>
    </div>
    <div class="rowBtns" style="margin-top:12px;flex-wrap:wrap">
      <button type="button" class="btn primary" id="jcFirebaseLogin">Firebase Login</button>
      <button type="button" class="btn dark" id="jcFirebaseLoad" disabled>Load Tournament & Fixtures</button>
      <button type="button" class="btn ghost" id="jcFirebaseLogout" disabled>Firebase Logout</button>
    </div>
    <p id="jcFirebaseStatus" class="notice" role="status" aria-live="polite">Firebase configuration मिलने पर यहाँ connection status दिखेगा।</p>
    <div id="jcFirebaseWorkspace" class="notice" aria-live="polite">अभी कोई Firebase डेटा लोड नहीं किया गया है।</div>
    <small class="muted">Firebase के लिए अलग Email/Password चाहिए। अपना पासवर्ड किसी के साथ साझा न करें।</small>`;
  const style = document.createElement('style');
  style.textContent = `
    #jcFirebasePanel .jc-firebase-tournament{border:1px solid var(--line,#294056);border-radius:12px;padding:14px;margin:12px 0;background:rgba(8,20,34,.28)}
    #jcFirebasePanel .jc-firebase-tournament-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    #jcFirebasePanel .jc-fixture-workspace{margin-top:14px;padding-top:12px;border-top:1px solid var(--line,#294056)}
    #jcFirebasePanel .jc-fixture-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:10px 0}
    #jcFirebasePanel .jc-fixture-field{display:grid;gap:5px;font-size:12px}
    #jcFirebasePanel .jc-fixture-field input,#jcFirebasePanel .jc-fixture-field select{width:100%;min-width:0}
    #jcFirebasePanel .jc-fixture-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line,#294056)}
    #jcFirebasePanel .jc-fixture-row small{display:block;opacity:.75;margin-top:4px}
    #jcFirebasePanel .jc-fixture-actions{display:grid;gap:7px;min-width:min(100%,220px)}
    #jcFirebasePanel .jc-fixture-result-fields{display:grid;gap:7px;padding:8px;border:1px solid var(--line,#294056);border-radius:8px}
    #jcFirebasePanel .jc-fixture-result-fields[hidden]{display:none}
    @media(max-width:560px){#jcFirebasePanel .jc-fixture-row{align-items:flex-start;flex-direction:column}}
  `;
  panel.append(style);
  const manager = section.querySelector('#tmRoot');
  if (manager) manager.after(panel); else section.append(panel);

  byId('jcFirebaseLogin').addEventListener('click', async () => {
    const email = byId('jcFirebaseEmail').value.trim(), password = byId('jcFirebasePassword').value;
    if (!email || !password) return status('Firebase Email और Password भरें।', 'warning');
    setBusy(true);
    try {
      await loadModules();
      const user = await authApi.loginWithEmail(email, password);
      status(`Firebase Login सफल: ${user.email || user.uid}`, 'success');
      byId('jcFirebaseLoad').disabled = false;
      byId('jcFirebaseLogout').disabled = false;
    } catch (error) {
      const message = String(error?.message || error);
      status(message.includes('firebase-config') || message.includes('Firebase config')
        ? 'Firebase configure नहीं है। firebase-config.example.js की कॉपी firebase-config.js बनाकर Web App config भरना बाकी है।'
        : `Firebase Login नहीं हुआ: ${message}`, 'error');
    } finally { setBusy(false); }
  });
  byId('jcFirebaseLoad').addEventListener('click', async () => {
    setBusy(true);
    try {
      await loadModules();
      const data = await bridgeApi.loadTournamentWorkspace();
      showWorkspace(data);
      status('Firebase Tournament और Fixture Workspace लोड हुआ।', 'success');
    } catch (error) { status(`डेटा लोड नहीं हुआ: ${error?.message || error}`, 'error'); }
    finally { setBusy(false); }
  });
  byId('jcFirebaseLogout').addEventListener('click', async () => {
    setBusy(true);
    try {
      await loadModules();
      await authApi.logout();
      byId('jcFirebaseLoad').disabled = true;
      byId('jcFirebaseLogout').disabled = true;
      byId('jcFirebaseWorkspace').textContent = 'Firebase से Logout हो गया।';
      workspace = { tournaments: [], teams: [] };
      status('Firebase Logout सफल।', 'success');
    } catch (error) { status(`Logout नहीं हुआ: ${error?.message || error}`, 'error'); }
    finally { setBusy(false); }
  });
  loadModules().then(() => {
    unsubscribe = authApi.watchAuth(user => {
      if (user) {
        status(`Firebase session active: ${user.email || user.uid}`, 'success');
        byId('jcFirebaseLoad').disabled = false;
        byId('jcFirebaseLogout').disabled = false;
      }
    });
  }).catch(() => status('Firebase configuration अभी नहीं मिली। पुराना Control Board सामान्य रूप से चलता रहेगा।', 'warning'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderPanel, { once: true });
else renderPanel();
window.addEventListener('pagehide', () => { if (typeof unsubscribe === 'function') unsubscribe(); }, { once: true });
