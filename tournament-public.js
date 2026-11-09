(()=>{const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const id=new URLSearchParams(location.search).get('id');const $=x=>document.getElementById(x);const fmt=m=>{const i=m.activeInnings||{};return `${Number(i.score||0)}/${Number(i.wickets||0)} · ${Math.floor((Number(i.balls)||0)/6)}.${(Number(i.balls)||0)%6} ov`};function render(d){const t=d.tournament||{};document.title=`${t.name||'Tournament'} · Jangid Cricinfo`;$('tpStatus').textContent=`${t.liveCount||0} Live · ${t.matchCount||0} Total Matches`;$('tpHero').style.backgroundImage=`linear-gradient(100deg,#061526f2,#0b5148d9),${t.bannerUrl?`url("${esc(t.bannerUrl)}")`:'radial-gradient(circle at right,#d2993c,#063a50)'}`;$('tpHero').innerHTML=`<small>JANGID CRICINFO · PUBLIC TOURNAMENT</small><h1>${esc(t.name||'Tournament')}</h1><p>${esc(t.description||'Tournament live centre, teams, match fixtures and points table.')}</p><div class="tpHeroMeta"><span>${t.teamCount||0} Teams</span><span>${t.matchCount||0} Matches</span><span>🔴 ${t.liveCount||0} Live</span><span>✓ ${t.completedCount||0} Completed</span><span>${esc(t.startDate||'Date TBA')} – ${esc(t.endDate||'')}</span></div>`;$('tpOverview').innerHTML=[[t.venue||'Venue TBA','Venue'],[[t.district,t.state,t.pinCode].filter(Boolean).join(', ')||'Location TBA','Location'],[t.format||'league','Format'],[t.scheduledCount||0,'Upcoming matches']].map(x=>`<article class="tpInfo"><b>${esc(x[0])}</b><small>${esc(x[1])}</small></article>`).join('');const matches=d.matches||[];const card=m=>{const label=m.status==='live'?'🔴 LIVE':m.status==='finished'?'✓ COMPLETED':m.status==='cancelled'?'✕ CANCELLED':'◷ UPCOMING';const resultText=typeof m.result==='object'&&m.result?(m.result.outcome==='winner'?`Winner: ${m.result.winnerTeamName}`:m.result.outcome==='tie'?'Tie':'No Result'):m.result||m.title||'Match scheduled';const body=`<small>${label} · ${esc(m.stage||'League')} · ${esc(m.dateTime||m.startedAt||'')}</small><h3>${esc(m.teamAName||'Team A')} vs ${esc(m.teamBName||'Team B')}</h3><div class="tpScore">${m.activeInnings?fmt(m):esc(resultText)}</div><small>${esc(m.venue||m.location||'')}</small>`;return m.matchId||m.activeInnings?`<a class="tpMatch ${m.status==='live'?'live':''}" href="scoreboard.html?match=${encodeURIComponent(m.matchId||m.id)}">${body}</a>`:`<article class="tpMatch ${m.status==='live'?'live':''}">${body}</article>`;};$('tpLive').innerHTML=matches.filter(m=>m.status==='live').map(card).join('')||'<div class="tpInfo">इस Tournament में अभी कोई Live Match नहीं है।</div>';$('tpMatches').innerHTML=matches.map(card).join('')||'<div class="tpInfo">Fixtures अभी उपलब्ध नहीं हैं।</div>';$('tpTeams').innerHTML=(d.teams||[]).map(t=>`<article class="tpTeam"><div class="tpTeamHead">${t.logo?`<img src="${esc(t.logo)}" alt="">`:''}<div><b>${esc(t.name)}</b><small>${(t.players||[]).length} Players</small></div></div><div class="tpPlayerList">${(t.players||[]).map(p=>`<span>${esc(p.name)} · ${esc(p.role)}${p.captain?' · Captain':''}${p.viceCaptain?' · Vice-Captain':''}</span>`).join('')||'<span>Player list not published</span>'}</div></article>`).join('')||'<div class="tpInfo">Teams अभी उपलब्ध नहीं हैं।</div>';$('tpPoints').innerHTML=(t.pointsTables||[]).map(tb=>`<h3>${esc(tb.groupName||'League')}</h3><div class="tpTableWrap"><table class="tpTable"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr></thead><tbody>${(tb.teams||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.teamName)}</td><td>${r.played||0}</td><td>${r.wins||0}</td><td>${r.losses||0}</td><td>${r.points||0}</td><td>${Number(r.netRunRate||0).toFixed(3)}</td></tr>`).join('')}</tbody></table></div>`).join('')||'<div class="tpInfo">Points Table मैच के परिणाम आने पर उपलब्ध होगी।</div>';}if(!id){$('tpStatus').textContent='Tournament ID नहीं मिला।';return;}
let loading=false, queued=false, lastKey='', currentData=null, statusByMatch=new Map();
async function loadTournament(){
 if(loading){queued=true;return;} loading=true;
 try{
  const response=await fetch(`/api/public/tournament/${encodeURIComponent(id)}`,{cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw new Error(data.error||'Tournament data अभी उपलब्ध नहीं है।');
  currentData=data;
  statusByMatch=new Map((data.matches||[]).map(m=>[String(m.id),String(m.status||'scheduled')]));
  const key=JSON.stringify([data.tournament?.updatedAt,data.matches?.map(m=>[m.id,m.updatedAt,m.status,m.activeInnings?.score])]);
  if(key!==lastKey){render(data);lastKey=key;}
  $('tpStatus').textContent='Public Tournament · Live Firebase Updates';
 }catch(error){$('tpStatus').textContent=`Tournament डेटा उपलब्ध नहीं: ${error.message||'Firebase setup अधूरी है।'}`;}
 finally{loading=false;if(queued){queued=false;loadTournament();}}
}
const stream=new EventSource('/events');
stream.onmessage=e=>{
 try{
  const payload=JSON.parse(e.data);
  if(!currentData||!Array.isArray(payload.matches)){loadTournament();return;}
  const selected=(payload.matches||[]).filter(m=>String(m.tournamentId||'')===String(id));
  const completedNow=selected.some(m=>m.status==='finished'&&statusByMatch.get(String(m.id))!=='finished');
  const t=(payload.tournaments||[]).find(x=>String(x.id)===String(id));
  const matchKey=JSON.stringify(selected.map(m=>[m.id,m.updatedAt,m.status,m.activeInnings?.score,m.activeInnings?.wickets,m.activeInnings?.balls]));
  if(matchKey!==lastKey){
    currentData.matches=selected;
    if(t)currentData.tournament={...currentData.tournament,matchCount:t.matchCount,liveCount:t.liveCount,completedCount:t.completedCount,scheduledCount:t.scheduledCount};
    statusByMatch=new Map(selected.map(m=>[String(m.id),String(m.status||'scheduled')]));
    render(currentData);lastKey=matchKey;
  }
  if(completedNow)loadTournament();
 }catch{loadTournament();}
};
stream.onerror=()=>{$('tpStatus').textContent='Live connection दोबारा जुड़ रही है…';};
loadTournament();
window.addEventListener('pagehide',()=>stream.close(),{once:true});
})();
