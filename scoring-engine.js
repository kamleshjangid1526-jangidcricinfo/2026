/*
 * Jangid Cricinfo scoring engine.
 * Local-first API contract: /api/match/state and /api/match/finish remain the
 * persistence boundary so a Firebase repository can replace the local JSON
 * adapter later without changing scoring rules or the OBS client.
 */
(() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const el = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtOvers = balls => `${Math.floor(Math.max(0, Number(balls)||0)/6)}.${Math.max(0, Number(balls)||0)%6}`;
  const runRate = innings => innings?.balls ? (Number(innings.score||0)/(Number(innings.balls)/6)).toFixed(2) : '0.00';
  const innings = () => MATCH?.activeInnings || null;
  const getTeam = id => (STATE?.teams||[]).find(t => String(t.id)===String(id));
  const player = (teamId,id) => (getTeam(teamId)?.players||[]).find(p=>String(p.id)===String(id));
  const playerLabel = (teamId,id) => player(teamId,id)?.name || 'Player';
  function recoverLiveMatch() {
    if(MATCH?.status==='live' && MATCH.activeInnings) return MATCH;
    // A stale/non-live MATCH object must not block recovery of a different valid live snapshot.
    // Only live records with an innings are eligible, so finished/abandoned matches are never revived.
    const currentId=String(MATCH?.id||'');
    const candidates=[STATE?.activeMatch,...(STATE?.savedLiveMatches||[]),...(STATE?.matches||[])].filter(Boolean);
    const validLive=candidates.filter(match=>match.status==='live'&&match.activeInnings&&match.id);
    const recovered=validLive.find(match=>String(match.id)===currentId)||validLive[0];
    if(recovered) {
      MATCH=clone(recovered);
      if(STATE) STATE.activeMatch=clone(recovered);
      return MATCH;
    }
    return MATCH;
  }
  const isLive = () => {
    const match=recoverLiveMatch();
    return !!match && match.status==='live' && !!match.activeInnings;
  };
  const rosterIds = teamId => (MATCH?.teamXIs?.[String(teamId)] || MATCH?.teamXIs?.[teamId] || []).map(String);
  // The Playing XI, not the full team squad and not a fixed 10-wicket rule,
  // determines when a batting innings is all out.
  function battingXIIds(i=innings()) {
    if(!i)return [];
    const selected=rosterIds(i.battingId);
    if(selected.length)return [...new Set(selected)];
    return Object.keys(i.batStats||{}).map(String);
  }
  function allOutWicketLimit(i=innings()) {
    // Match start requires at least two players; keep a safe fallback for legacy matches.
    const count=battingXIIds(i).length;
    return count>=2?count-1:10;
  }
  function isInningsAllOut(i=innings()) {
    return Number(i?.wickets||0)>=allOutWicketLimit(i);
  }
  function currentBatterStats(i, slot='striker') { return i?.batStats?.[i?.[slot]] || null; }
  function currentBowlerStats(i) { return i?.bowlStats?.[i?.currentBowler] || null; }
  function eligibleBatters(i=innings()) {
    if(!i) return [];
    return battingXIIds(i).filter(id => {
      const p=i.batStats?.[id];
      const mayReturn=p?.howOut==='Retired Hurt'||p?.howOut==='Substituted'||p?.retiredReason==='Substituted';
      return p && !p.out && (!p.retired||mayReturn) && String(id)!==String(i.striker||'') && String(id)!==String(i.nonStriker||'');
    });
  }
  function eligibleBowlers(i=innings()) {
    if(!i) return [];
    const prior=String(i.previousBowler||'');
    const limit=Math.max(1,Number(i.bowlerOverLimit||MATCH?.bowlerOverLimit||1));
    return rosterIds(i.bowlingId).filter(id => {
      const stat=i.bowlStats?.[id];
      if(!stat || Number(stat.balls||0)/6 >= limit) return false;
      if(i.awaitingBowler && prior && String(id)===prior) return false;
      return true;
    });
  }
  function settlePendingScoring(i=innings()) {
    if(!i || MATCH?.awaitingNextInnings || MATCH?.awaitingMatchFinish || MATCH?.awaitingInningsSetup) return;
    if(i._replaceSlot && i[i._replaceSlot]) i._replaceSlot=null;
    if(!i._replaceSlot) i.awaitingNewBatter=false;
    // Do not leave stale wicket/over flags after a valid replacement selection.
    if(i.currentBowler && !i.awaitingBowler) i.awaitingBowler=false;
  }
  function incomingPlayerMeta(teamId,id,stat,role){
    const p=player(teamId,id)||{};const src=stat||p;
    return {id:String(id||''),name:String(src?.name||p.name||'Player'),teamName:String(getTeam(teamId)?.name||'Team'),role:String(role||src?.role||p.role||'Player'),runs:Number(src?.runs||0),balls:Number(src?.balls||0),wickets:Number(src?.wickets||0),overs:fmtOvers(src?.balls||0)};
  }
  function ensureExtras(i) { i.extras ||= {wide:0,noBall:0,legBye:0,bye:0,total:0}; i.extras.bye ||= 0; i.extras.total ||= 0; }
  function ensureStats(i) { i.batStats ||= {}; i.bowlStats ||= {}; i.events ||= []; i.fallOfWickets ||= []; i.undoStack ||= []; i.partnership ||= {runs:0,balls:0}; ensureExtras(i); }
  // Undo history stores only the changing score state plus event-list lengths.
  // Copying the entire ball-by-ball commentary into 50 snapshots made every upload
  // grow quadratically as the innings progressed.
  function compactUndoEntry(entry) {
    const previous=clone(entry||{});
    if(Array.isArray(previous.events)) {
      previous._undoEventsLength=previous.events.length;
      previous._undoFirstEvent=previous.events.length?clone(previous.events[0]):null;
      delete previous.events;
    }
    if(Array.isArray(previous.fallOfWickets)) {
      previous._undoFallOfWicketsLength=previous.fallOfWickets.length;
      delete previous.fallOfWickets;
    }
    delete previous.undoStack;
    delete previous.lastDelivery;
    return previous;
  }
  function compactMatchUndoHistory(match) {
    const inningsList=[...(Array.isArray(match?.inningsHistory)?match.inningsHistory:[]),match?.activeInnings].filter(Boolean);
    for(const inn of inningsList) {
      ensureStats(inn);
      if(inn.undoStack.length) inn.undoStack=inn.undoStack.map(compactUndoEntry);
    }
  }
  function pushUndo(i) {
    ensureStats(i);
    i.undoStack=i.undoStack.map(compactUndoEntry);
    i.undoStack.push(compactUndoEntry(i));
    if(i.undoStack.length>50) i.undoStack.shift();
  }
  function restoreUndoEntry(snapshot,currentInnings) {
    const restored=clone(snapshot||{});
    const currentEvents=Array.isArray(currentInnings?.events)?currentInnings.events:[];
    const currentWickets=Array.isArray(currentInnings?.fallOfWickets)?currentInnings.fallOfWickets:[];
    if(Array.isArray(restored.events)) {
      // Legacy undo entry: it already contains its historical event list.
    } else {
      const length=Math.max(0,Number(restored._undoEventsLength)||0);
      let events=currentEvents.slice(0,length);
      // When the 2,000-event cap shifted the oldest delivery, put it back on Undo.
      if(length>=2000&&currentEvents.length===length&&restored._undoFirstEvent&&
         JSON.stringify(currentEvents[0]||null)!==JSON.stringify(restored._undoFirstEvent)) {
        events=[clone(restored._undoFirstEvent),...currentEvents.slice(0,Math.max(0,length-1))];
      }
      restored.events=events;
    }
    if(!Array.isArray(restored.fallOfWickets)) {
      const length=Math.max(0,Number(restored._undoFallOfWicketsLength)||0);
      restored.fallOfWickets=currentWickets.slice(0,length);
    }
    delete restored._undoEventsLength;
    delete restored._undoFirstEvent;
    delete restored._undoFallOfWicketsLength;
    restored.lastDelivery=restored.events?.[restored.events.length-1]||null;
    return restored;
  }
  function swapStrike(i) { const s=i.striker; i.striker=i.nonStriker; i.nonStriker=s; }
  function updateOverState(i,legal) {
    if(!legal) return false;
    i.overBalls=(Number(i.overBalls)||0)+1;
    i.currentOver=Math.floor((Number(i.balls)||0)/6)+1;
    if(Number(i.balls||0)>0 && Number(i.balls)%6===0) {
      swapStrike(i);
      i.previousBowler=String(i.currentBowler||'');
      i.awaitingBowler=true;
      i.overBalls=0;
      return true;
    }
    return false;
  }
  function statusAfterDelivery(i) {
    const maxBalls=Math.max(1,Number(MATCH?.oversLimit||1))*6;
    const reachedTarget=Number(MATCH?.inningsNo||1)>=2 && Number(i.target||Infinity)<=Number(i.score||0);
    const allOut=isInningsAllOut(i);
    const oversDone=Number(i.balls||0)>=maxBalls;
    if(reachedTarget || allOut || oversDone) {
      if(Number(MATCH?.inningsNo||1)===1) {
        MATCH.awaitingNextInnings=true;
        MATCH.awaitingMatchFinish=false;
      } else {
        MATCH.awaitingNextInnings=false;
        MATCH.awaitingMatchFinish=true;
      }
      i.awaitingBowler=false;
      i._replaceSlot=null;
      i.awaitingNewBatter=false;
      i.finished=true;
      i.finishedReason=reachedTarget?'target':allOut?'all-out':'overs';
      MATCH.awaitingInningsSetup=false;
      return;
    }
    MATCH.awaitingNextInnings=false;
    MATCH.awaitingMatchFinish=false;
  }
  function labelForEvent(e) {
    if(e.wicket) return 'W';
    if(e.extra==='wide') return (Number(e.total)||1)+'WD';
    if(e.extra==='noball') return (Number(e.total)||1)+'NB';
    if(e.extra==='legbye') return (Number(e.total)||0)+'LB';
    if(e.extra==='bye') return (Number(e.total)||0)+'B';
    return String(e.runs ?? 0);
  }
  async function saveMatch(shouldRender=true) {
    if(!isLive() || !MATCH?.id) throw new Error('कोई LIVE मैच नहीं मिला। Match State दोबारा जाँचें या Dashboard से Live Match खोलें।');
    MATCH.updatedAt=new Date().toISOString();
    // Migrate older saved matches' oversized Undo snapshots once, before upload.
    compactMatchUndoHistory(MATCH);
    const snapshot=clone(MATCH);
    if(STATE) {
      STATE.activeMatch=clone(snapshot);
      STATE.matches ||= [];
      const ix=STATE.matches.findIndex(m=>m.id===snapshot.id);
      if(ix>=0) STATE.matches[ix]=clone(snapshot); else STATE.matches.push(clone(snapshot));
    }
    if(shouldRender) renderScoring();
    await api('/api/match/state',{method:'POST',body:JSON.stringify({match:snapshot})});
    return true;
  }
  let deliveryQueue=Promise.resolve();
  function recordDelivery(options={}) {
    const task=deliveryQueue.then(()=>recordDeliveryNow(options));
    deliveryQueue=task.catch(error=>{console.error('Queued scoring action failed:',error);return false;});
    return task;
  }
  async function recordDeliveryNow({kind='run',runs=0,extra='',totalRuns=0,batterRuns=0}={}) {
    if(!isLive()) { alert('अभी कोई LIVE मैच नहीं है।'); return; }
    const i=innings(); ensureStats(i);
    if(MATCH.awaitingNextInnings || MATCH.awaitingMatchFinish || MATCH.awaitingInningsSetup) { alert(MATCH.awaitingNextInnings?'पहली पारी समाप्त है। दूसरी पारी शुरू करें।':'मैच की पारी पूरी हो चुकी है। Finish Match चुनें।'); return; }
    if(i._replaceSlot) { promptReplacement(i._replaceSlot); return; }
    if(i.awaitingBowler || !i.currentBowler) { promptBowler(); return; }
    if(!i.striker || !i.nonStriker || String(i.striker)===String(i.nonStriker)) { alert('दो अलग-अलग बल्लेबाज चुनें।'); return; }
    const batter=i.batStats?.[i.striker], bowler=i.bowlStats?.[i.currentBowler];
    if(!batter || !bowler) { alert('Current striker या bowler की stats नहीं मिलीं। Match Setup और Playing XI जाँचें।'); return; }
    const old=clone(MATCH); pushUndo(i);
    const isExtra=kind==='extra';
    let teamRuns=0, batRuns=0, legal=true, extraName='';
    if(!isExtra) { teamRuns=Math.max(0,Number(runs)||0); batRuns=teamRuns; }
    else {
      extraName=extra;
      teamRuns=Math.max(0,Number(totalRuns)||0);
      batRuns=Math.max(0,Number(batterRuns)||0);
      if(extra==='wide' || extra==='noball') legal=false;
      else legal=true;
      if(extra==='wide') teamRuns=Math.max(1,teamRuns);
      if(extra==='noball') teamRuns=Math.max(1,teamRuns+1); // one mandatory penalty run plus any batter runs
      if(extra==='legbye' || extra==='bye') batRuns=0;
    }
    const strikerId=String(i.striker), nonId=String(i.nonStriker), bowlerId=String(i.currentBowler);
    const batterName=batter.name||playerLabel(i.battingId,strikerId), bowlerName=bowler.name||playerLabel(i.bowlingId,bowlerId);
    const ballIndex=Number(i.balls||0), ballLabel=`${Math.floor(ballIndex/6)}.${ballIndex%6+1}`;
    i.score=Number(i.score||0)+teamRuns;
    if(batRuns) { batter.runs=Number(batter.runs||0)+batRuns; }
    if(legal) {
      i.balls=Number(i.balls||0)+1;
      batter.balls=Number(batter.balls||0)+1;
      bowler.balls=Number(bowler.balls||0)+1;
      i.partnership.balls=Number(i.partnership.balls||0)+1;
    }
    if(batRuns===4) batter.fours=Number(batter.fours||0)+1;
    if(batRuns===6) batter.sixes=Number(batter.sixes||0)+1;
    i.partnership.runs=Number(i.partnership.runs||0)+teamRuns;
    if(extraName==='wide') { i.extras.wide+=teamRuns; i.extras.total+=teamRuns; bowler.wides=Number(bowler.wides||0)+teamRuns; bowler.runs=Number(bowler.runs||0)+teamRuns; }
    else if(extraName==='noball') { const penalty=1; i.extras.noBall+=penalty; i.extras.total+=penalty; bowler.noBalls=Number(bowler.noBalls||0)+1; bowler.runs=Number(bowler.runs||0)+teamRuns; }
    else if(extraName==='legbye') { i.extras.legBye+=teamRuns; i.extras.total+=teamRuns; }
    else if(extraName==='bye') { i.extras.bye+=teamRuns; i.extras.total+=teamRuns; }
    else { bowler.runs=Number(bowler.runs||0)+teamRuns; }
    const event={type:isExtra?'extra':'run',runs:batRuns,total:teamRuns,extra:extraName||undefined,legal,ballLabel,batter:batterName,bowler:bowlerName,battingTeam: getTeam(i.battingId)?.name||'',bowlingTeam:getTeam(i.bowlingId)?.name||'',createdAt:new Date().toISOString()};
    event.label=labelForEvent(event);
    event.commentary = extraName==='wide' ? `${ballLabel} ${bowlerName} to ${batterName}: Wide ball, ${teamRuns} team run(s).` : extraName==='noball' ? `${ballLabel} ${bowlerName} to ${batterName}: No ball, ${teamRuns} team run(s).` : extraName==='legbye' ? `${ballLabel} ${bowlerName} to ${batterName}: ${teamRuns} leg-bye run(s).` : extraName==='bye' ? `${ballLabel} ${bowlerName} to ${batterName}: ${teamRuns} bye run(s).` : `${ballLabel} ${bowlerName} to ${batterName}: ${batRuns===4?'FOUR!':batRuns===6?'SIX!':`${batRuns} run(s).`}`;
    i.events.push(event); if(i.events.length>2000)i.events.shift(); i.lastDelivery=event;
    const oddRuns=teamRuns%2===1;
    if(oddRuns) swapStrike(i);
    const overEnded=updateOverState(i,legal);
    if(extraName==='noball') i.freeHit=true; else if(legal && i.freeHit) i.freeHit=false;
    if(overEnded) {
      // Every completed over requires a new bowler; quota is an additional eligibility limit, not the trigger.
      i.awaitingBowler=true;
      i.previousBowler=String(bowlerId);
    }
    statusAfterDelivery(i);
    try { const saveTask=saveMatch(false); renderScoring(); await saveTask; }
    catch(err) { MATCH=old; if(STATE)STATE.activeMatch=clone(old); renderScoring(); alert(`स्कोर device पर सेव नहीं हुआ: ${err.message}`); return; }
    const scoringGraphic=extraName==='wide'?'WIDE':extraName==='noball'?'NO BALL':extraName==='legbye'?'LEG BYE':extraName==='bye'?'BYE':batRuns===4?'FOUR':batRuns===6?'SIX':'';
    if(scoringGraphic){
      // Mobile taps can arrive quickly; wait until the event is safely queued locally
      // before allowing the next delivery to supersede it.
      try{await fireEvent(scoringGraphic);}catch(graphicError){console.warn('Scoring event graphic could not be queued:',graphicError);}
    }
    if(MATCH?.awaitingMatchFinish&&typeof window.archiveCompletedMatchNow==='function'){
      try{await window.archiveCompletedMatchNow(MATCH);}
      catch(archiveError){console.warn('Completed match archive will retry on next Control Board load:',archiveError);}
    }
    if(MATCH?.awaitingNextInnings){setTimeout(()=>{if(MATCH?.awaitingNextInnings)startSecondInnings()},180)}
    else if(i.awaitingBowler && !MATCH?.awaitingMatchFinish){setTimeout(()=>{if(MATCH?.status==='live' && MATCH?.activeInnings?.awaitingBowler)promptBowler()},350)}
    return true;
  }
  function promptExtra(extra) {
    const labels={wide:'Wide',noball:'No Ball',legbye:'Leg Bye',bye:'Bye'};
    const isBoundaryExtra=extra==='wide'||extra==='noball';
    const body=isBoundaryExtra?`<div class="field"><label>${labels[extra]} penalty is 1 run</label><small class="muted">${extra==='noball'?'Batter runs from this delivery (0–6)':'Total runs including the wide penalty'}</small><select id="extraRuns">${(extra==='noball'?[0,1,2,3,4,6]:[1,2,3,4,5,6]).map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>`:`<div class="field"><label>${labels[extra]} runs</label><select id="extraRuns">${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div>`;
    openModal(`<div class="modalHead"><h3>${labels[extra]}</h3><button class="closeBtn" data-close>×</button></div>${body}<div class="rowBtns"><button class="btn primary" id="confirmExtra">Add Extra</button><button class="btn dark" data-close>Cancel</button></div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal());
      box.querySelector('#confirmExtra').onclick=async()=>{const n=Number(box.querySelector('#extraRuns').value)||0;closeModal();if(extra==='wide')await recordDelivery({kind:'extra',extra,totalRuns:n,batterRuns:0});else if(extra==='noball')await recordDelivery({kind:'extra',extra,totalRuns:n,batterRuns:n});else await recordDelivery({kind:'extra',extra,totalRuns:n,batterRuns:0});};
    });
  }
  function promptReplacement(slot) {
    const i=innings(); if(!i)return;
    const ids=eligibleBatters(i);
    if(!ids.length) {
      i._replaceSlot=null;i.awaitingNewBatter=false;
      statusAfterDelivery(i);
      if(MATCH.awaitingNextInnings){startSecondInnings();return;}
      if(MATCH.awaitingMatchFinish){renderScoring();return;}
      saveMatch().catch(e=>alert(e.message));
      return;
    }
    openModal(`<div class="modalHead"><div><div class="eyebrow">WICKET CONFIRMED</div><h3>Choose New Batter</h3></div><button class="closeBtn" data-close>×</button></div><p class="muted">Dismissed batter सूची में दोबारा नहीं आएगा। नया खिलाड़ी चुनने तक scoring रुकी रहेगी।</p><div class="choices">${ids.map(id=>`<button class="btn ghost" data-next-batter="${safe(id)}">${safe(playerLabel(i.battingId,id))}</button>`).join('')}</div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{closeModal();renderScoring()});
      box.querySelectorAll('[data-next-batter]').forEach(b=>b.onclick=async()=>{
        const id=String(b.dataset.nextBatter||'');
        const current=innings();if(!current||!id||!eligibleBatters(current).includes(id))return alert('यह खिलाड़ी अब उपलब्ध नहीं है। सूची Refresh करके दोबारा चुनें।');
        const old=clone(MATCH),stat=current.batStats?.[id];if(!stat)return alert('खिलाड़ी का score record नहीं मिला।');
        if(slot==='striker')current.striker=id;else current.nonStriker=id;
        current._replaceSlot=null;current.awaitingNewBatter=false;
        stat.retired=false;stat.retiredReason='';
        current.partnership={runs:0,balls:0};
        settlePendingScoring(current);
        closeModal();
        try{
          await saveMatch(false);renderScoring();
          await fireEvent('NEW BATSMAN',{eventPlayer:incomingPlayerMeta(current.battingId,id,stat,'BATTER')});
          if(current.awaitingBowler && !MATCH?.awaitingNextInnings && !MATCH?.awaitingMatchFinish) promptBowler();
          else {settlePendingScoring(current);await saveMatch(false);renderScoring();}
        }catch(e){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(`New Batter सेव नहीं हुआ: ${e.message}`)}
      });
    });
  }
  function pickWicket() {
    const i=innings();if(!isLive())return alert('कोई LIVE match नहीं है।');
    if(i.freeHit) { /* run-out may still be allowed */ }
    const batters=[['striker',i.striker],['nonStriker',i.nonStriker]].filter(x=>x[1]);
    const types=['Bowled','Caught','LBW','Run Out','Stumped','Hit Wicket','Caught & Bowled','Retired Out'];
    openModal(`<div class="modalHead"><div><div class="eyebrow">DISMISSAL</div><h3>Record Wicket</h3></div><button class="closeBtn" data-close>×</button></div><div class="grid2"><div class="field"><label>Dismissal Type</label><select id="dismissalType">${types.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div><div class="field"><label>Dismissed Batter</label><select id="dismissedSlot">${batters.map(([slot,id])=>`<option value="${slot}">${slot==='striker'?'Striker':'Non-striker'} — ${safe(i.batStats[id]?.name||playerLabel(i.battingId,id))}</option>`).join('')}</select></div><div class="field"><label>Fielder (if applicable)</label><select id="dismissalFielder"><option value="">Not applicable</option>${rosterIds(i.bowlingId).map(id=>`<option value="${safe(id)}">${safe(playerLabel(i.bowlingId,id))}</option>`).join('')}</select></div></div><div class="rowBtns"><button class="btn red" id="confirmWicket">Confirm Wicket</button><button class="btn dark" data-close>Cancel</button></div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal());
      box.querySelector('#confirmWicket').onclick=async()=>{
        const type=box.querySelector('#dismissalType').value,slot=box.querySelector('#dismissedSlot').value,fielderId=box.querySelector('#dismissalFielder').value;
        if(i.freeHit && !['Run Out'].includes(type)) { alert('Free Hit पर सामान्य तरीके से wicket नहीं दिया जा सकता; Run Out चुनें।'); return; }
        const dismissedId=i[slot], batter=i.batStats[dismissedId]; if(!batter)return alert('Dismissed batter not found.');
        const old=clone(MATCH);pushUndo(i);const legal=type!=='Retired Out',bowler=i.bowlStats?.[i.currentBowler];
        const facedStat=i.batStats?.[i.striker]||batter;
        const ballIndex=Number(i.balls||0),ballLabel=`${Math.floor(ballIndex/6)}.${ballIndex%6+1}`;
        if(legal){i.balls=Number(i.balls||0)+1;facedStat.balls=Number(facedStat.balls||0)+1;if(bowler)bowler.balls=Number(bowler.balls||0)+1;i.partnership.balls=Number(i.partnership.balls||0)+1;}
        batter.out=true;batter.howOut=type;batter.assist=fielderId?playerLabel(i.bowlingId,fielderId):'';i.wickets=Number(i.wickets||0)+1;i.playersOut||=[];i.playersOut.push(String(dismissedId));
        if(!['Run Out','Retired Out'].includes(type) && bowler)bowler.wickets=Number(bowler.wickets||0)+1;
        const overEnded=updateOverState(i,legal);
        if(overEnded){i.awaitingBowler=true;i.previousBowler=String(i.currentBowler||'');}
        if(legal&&i.freeHit)i.freeHit=false;
        i.fallOfWickets.push({wicket:i.wickets,score:i.score,balls:i.balls,batter:batter.name||playerLabel(i.battingId,dismissedId),howOut:type,fielderId,fielder:fielderId?playerLabel(i.bowlingId,fielderId):''});
        const ev={type:'wicket',runs:0,total:0,legal,ballLabel,batter:batter.name||playerLabel(i.battingId,dismissedId),bowler:bowler?.name||playerLabel(i.bowlingId,i.currentBowler),wicket:{type,fielderId},fielderId,commentary:`${ballLabel} ${bowler?.name||'Bowler'} to ${batter.name||'Batter'}: WICKET! ${type}${fielderId?`, fielded by ${playerLabel(i.bowlingId,fielderId)}`:''}.`};ev.label='W';i.events.push(ev);i.lastDelivery=ev;
        // If the over ended, updateOverState may have switched ends; remove the actual dismissed player from whichever slot now contains them.
        const slotName=String(i.striker)===String(dismissedId)?'striker':String(i.nonStriker)===String(dismissedId)?'nonStriker':slot;
        i[slotName]=null;i._replaceSlot=slotName;i.awaitingNewBatter=true;
        statusAfterDelivery(i);
        if(MATCH.awaitingNextInnings||MATCH.awaitingMatchFinish){i._replaceSlot=null;i.awaitingNewBatter=false;i.awaitingBowler=false;}
        closeModal();try{await saveMatch(false);renderScoring();await fireEvent('WICKET',{wicketDetails:{batter:batter.name||playerLabel(i.battingId,dismissedId),teamName:getTeam(i.battingId)?.name||'',dismissal:type,bowler:bowler?.name||playerLabel(i.bowlingId,i.currentBowler),fielder:fielderId?playerLabel(i.bowlingId,fielderId):''}});if(MATCH?.awaitingNextInnings){setTimeout(()=>{if(MATCH?.awaitingNextInnings)startSecondInnings()},180)}else if(i._replaceSlot)promptReplacement(i._replaceSlot);else if(i.awaitingBowler){setTimeout(()=>{if(MATCH?.status==='live' && MATCH?.activeInnings?.awaitingBowler)promptBowler()},350)}}catch(e){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(`Wicket save नहीं हुआ: ${e.message}`)}
      };
    });
  }
  function promptBowler(forceChange=false) {
    const i=innings();if(!i)return;
    const isCurrent=id=>forceChange&&String(id)===String(i.currentBowler||'');
    const legalChoices=eligibleBowlers(i).filter(id=>!isCurrent(id));
    const allChoices=rosterIds(i.bowlingId).filter(id=>i.bowlStats?.[id]&&!isCurrent(id));
    const choices=legalChoices.length?legalChoices:allChoices;
    if(!choices.length) {
      i.awaitingBowler=true;renderScoring();
      openModal(`<div class="modalHead"><h3>Bowler उपलब्ध नहीं</h3><button class="closeBtn" data-close>×</button></div><p class="muted">इस Playing XI में कोई bowler record नहीं मिला। Match Setup में bowling team के players और bowling quota ठीक करें। उसके बाद Resume Setup दबाएं।</p><div class="rowBtns"><button class="btn dark" data-close>Close</button></div>`,box=>box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal()));
      return;
    }
    const override=!legalChoices.length;
    openModal(`<div class="modalHead"><div><div class="eyebrow">BOWLING CHANGE</div><h3>Select Next Bowler</h3></div><button class="closeBtn" data-close>×</button></div><p class="muted">${override?'कोई सामान्य quota-eligible bowler नहीं बचा। मजबूरी में सूची से चयन किया जा सकता है; यह Over Manual Override होगा।':'पिछले over के bowler को लगातार अगला over नहीं दिया जा सकता।'}</p><div class="choices">${choices.map(id=>{const st=i.bowlStats[id];return `<button class="btn ghost" data-next-bowler="${safe(id)}">${safe(playerLabel(i.bowlingId,id))} · ${fmtOvers(st.balls||0)} ov, ${st.wickets||0} W${override?' · Override':''}</button>`}).join('')}</div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{closeModal();renderScoring()});
      box.querySelectorAll('[data-next-bowler]').forEach(b=>b.onclick=async()=>{const id=String(b.dataset.nextBowler||'');const current=innings();if(!current?.bowlStats?.[id])return alert('Bowler record नहीं मिला।');const old=clone(MATCH);current.currentBowler=id;current.awaitingBowler=false;current.awaitingNewBatter=false;current._replaceSlot=null;if(override)current.lastBowlerOverrideAt=new Date().toISOString();closeModal();try{settlePendingScoring(current);await saveMatch(false);renderScoring();await fireEvent('NEW BOWLER',{eventPlayer:incomingPlayerMeta(current.bowlingId,id,current.bowlStats[id],'BOWLER')});settlePendingScoring(current);renderScoring()}catch(e){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(`Bowler चयन सेव नहीं हुआ: ${e.message}`)}});
    });
  }
  function renderScoring() {
    recoverLiveMatch();
    const header=el('scoreHeader'),players=el('currentPlayers'),recent=el('recentBalls'),grid=el('scoreActionGrid');
    const finish=el('finishMatch'),resume=el('resumeSetup'),nextInnings=el('startNextInningsBtn');
    if(!MATCH || !MATCH.activeInnings) {
      header.innerHTML='<div class="panel scoringEmpty"><h3>कोई LIVE मैच नहीं है</h3><p>पहले Match Setup में जाएँ या Tournament के Matches टैब से scheduled fixture शुरू करें।</p><button class="btn primary" data-go="match">Start a Match</button></div>';
      players.innerHTML='<div class="muted">मैच शुरू होने पर खिलाड़ी यहाँ दिखेंगे।</div>';recent.innerHTML='';grid?.classList.add('disabledScoreGrid');if(finish)finish.disabled=true;if(resume)resume.style.display='none';if(nextInnings)nextInnings.disabled=true;document.querySelectorAll('[data-card-button]').forEach(b=>{b.disabled=true;b.classList.remove('cardOn')});return;
    }
    const m=MATCH,i=MATCH.activeInnings,A=getTeam(m.teamA),B=getTeam(m.teamB),bat=getTeam(i.battingId),bowl=getTeam(i.bowlingId),isOpen=m.status==='live'&&!m.awaitingNextInnings&&!m.awaitingMatchFinish&&!m.awaitingInningsSetup;
    ensureStats(i);
    const scoreNow=Number(i.score||0), wicketsNow=Number(i.wickets||0), ballsNow=Number(i.balls||0), maxOvers=Math.max(1,Number(m.oversLimit||0)), maxBalls=maxOvers*6;
    const targetNow=Number(i.target||0), runsNeeded=targetNow?Math.max(0,targetNow-scoreNow):null, ballsLeft=Math.max(0,maxBalls-ballsNow);
    const requiredRate=targetNow&&ballsLeft>0?(runsNeeded/(ballsLeft/6)).toFixed(2):targetNow?'—':'—';
    const progressPct=Math.max(0,Math.min(100,maxBalls?ballsNow/maxBalls*100:0));
    const strikerNow=i.batStats?.[i.striker], nonNow=i.batStats?.[i.nonStriker], bowlerNow=i.bowlStats?.[i.currentBowler];
    const teamCard=(t,id,role)=>{const name=t?.name||(String(id)===String(m.teamA)?m.teamAName:m.teamBName)||'Team';const logo=t?.logo||(String(id)===String(m.teamA)?m.teamALogo:m.teamBLogo)||'';const initials=String(name).trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'XI';return `<div class="scoreCommandTeamLogo">${logo?`<img src="${safe(logo)}" alt="${safe(name)} logo" onerror="this.remove()">`:''}<span>${safe(initials)}</span></div><div class="scoreCommandTeamCopy"><small>${role}</small><b>${safe(name)}</b><span>${role==='BATTING TEAM'?`${safe(strikerNow?.name||'—')}  ·  ${Number(strikerNow?.runs||0)}* (${Number(strikerNow?.balls||0)})`:`${safe(bowlerNow?.name||'Bowler not selected')}  ·  ${fmtOvers(bowlerNow?.balls||0)} – ${Number(bowlerNow?.runs||0)} – ${Number(bowlerNow?.wickets||0)}`}</span></div>`};
    const topStatus=m.status==='live'?'<i class="scoreStatusPulse"></i> LIVE MATCH':'<i class="scoreStatusDone">✓</i> MATCH COMPLETED';
    const pp=String(i.powerplay||'').toUpperCase();
    const metaCards=targetNow?`
      <div class="scoreCommandMetric metricTarget"><small>TARGET</small><b>${targetNow}</b><span>To win the match</span></div>
      <div class="scoreCommandMetric metricNeed"><small>RUNS NEEDED</small><b>${runsNeeded}</b><span>${runsNeeded===0?'Target reached':'Chase equation'}</span></div>
      <div class="scoreCommandMetric metricBalls"><small>BALLS LEFT</small><b>${ballsLeft}</b><span>From ${maxOvers} overs</span></div>
      <div class="scoreCommandMetric metricRate"><small>CRR / RRR</small><b>${runRate(i)} <em>/</em> ${requiredRate}</b><span>Current / Required rate</span></div>`:`
      <div class="scoreCommandMetric metricTarget"><small>INNINGS</small><b>${Number(m.inningsNo||1)} / 2</b><span>${safe(bat?.name||'Batting team')}</span></div>
      <div class="scoreCommandMetric metricNeed"><small>OVERS LIMIT</small><b>${maxOvers}</b><span>Match format</span></div>
      <div class="scoreCommandMetric metricBalls"><small>BALLS BOWLED</small><b>${ballsNow}</b><span>${fmtOvers(ballsNow)} overs</span></div>
      <div class="scoreCommandMetric metricRate"><small>RUN RATE</small><b>${runRate(i)}</b><span>Current run rate</span></div>`;
    const stateNotice=m.result?`<div class="scoreCommandNotice isResult">🏆 ${safe(m.result)}</div>`:m.awaitingNextInnings?'<div class="scoreCommandNotice">पहली पारी पूरी हो गई है। अब दूसरी पारी शुरू करें।</div>':m.awaitingMatchFinish?'<div class="scoreCommandNotice">पारी पूरी हो गई है। Finish Match से परिणाम सेव करें।</div>':i.awaitingBowler&&isOpen?'<div class="scoreCommandNotice">ओवर पूरा हुआ — अगला गेंदबाज चुनें।</div>':'';
    header.innerHTML=`<div class="scoreCommandBoard">
      <div class="scoreCommandTop"><div class="scoreCommandTitle"><span class="scoreCommandEyebrow">JANGID CRICINFO · SCORING DESK</span><h3>${safe(m.title||'Cricket Match')}</h3><span>${safe(m.tournamentName||'Standalone match')}${m.venue||m.location?` · ${safe(m.venue||m.location)}`:''}</span></div><div class="scoreCommandStatus ${m.status==='live'?'isLive':'isDone'}">${topStatus}<span>INNINGS ${Number(m.inningsNo||1)}</span></div></div>
      <div class="scoreCommandMainGrid">
        <article class="scoreCommandTeamCard battingSide"><div class="scoreCommandRole"><span>01</span> BATTING</div><div class="scoreCommandTeamBody">${teamCard(bat,i.battingId,'BATTING TEAM')}</div><div class="scoreCommandTeamFoot battingPlayersFoot"><span>BATTERS</span><b>${safe(strikerNow?.name||'—')} <small>STR</small></b><b>${safe(nonNow?.name||'—')} <small>NON</small></b></div><div class="mobileFieldSide mobileBattersSide"><div class="mobileFieldHeading">BATTERS</div><div class="mobileFieldPlayer"><small>STR*</small><b title="${safe(strikerNow?.name||'—')}">${safe(strikerNow?.name||'—')}</b><span>${Number(strikerNow?.runs)||0} RUN · ${Number(strikerNow?.balls)||0} BALL</span></div><div class="mobileFieldPlayer"><small>NON</small><b title="${safe(nonNow?.name||'—')}">${safe(nonNow?.name||'—')}</b><span>${Number(nonNow?.runs)||0} RUN · ${Number(nonNow?.balls)||0} BALL</span></div></div></article>
        <article class="scoreCommandCenter"><div class="scoreCommandCenterTop"><span>LIVE TOTAL</span>${targetNow?`<b class="scoreCommandTarget">TARGET ${targetNow}</b>`:`<b class="scoreCommandPowerplay">${pp?`POWERPLAY ${safe(pp)}`:'INNINGS '+Number(m.inningsNo||1)}</b>`}</div><div class="scoreCommandTeamNameMobile">${safe(bat?.name||'Batting Team')}</div><div class="scoreCommandDigits"><strong>${scoreNow}</strong><i>/</i><strong>${wicketsNow}</strong></div><div class="scoreCommandOvers"><div><small>OVERS</small><b>${fmtOvers(ballsNow)} <em>/ ${maxOvers}</em></b></div><div><small>CRR</small><b>${runRate(i)}</b></div><div><small>POWERPLAY</small><b>${pp||'—'}</b></div></div><div class="scoreCommandProgress"><span style="width:${progressPct.toFixed(2)}%"></span></div></article>
        <article class="scoreCommandTeamCard bowlingSide"><div class="scoreCommandRole"><span>02</span> BOWLING</div><div class="scoreCommandTeamBody">${teamCard(bowl,i.bowlingId,'BOWLING TEAM')}</div><div class="scoreCommandTeamFoot"><span>CURRENT BOWLER</span><b>${safe(bowlerNow?.name||'—')}</b></div><div class="mobileFieldSide mobileBowlerSide"><div class="mobileFieldHeading" title="${safe(bowl?.name||'BOWLING')}">${safe(bowl?.name||'BOWLING')}</div><div class="mobileFieldPlayer"><small>NOW BOWLING</small><b title="${safe(bowlerNow?.name||'—')}">${safe(bowlerNow?.name||'—')}</b><span>${fmtOvers(bowlerNow?.balls||0)} OV · ${Number(bowlerNow?.runs)||0} R · ${Number(bowlerNow?.wickets)||0} W</span></div></div></article>
      </div>
      <div class="scoreCommandMetrics">${metaCards}</div>
      ${stateNotice}
    </div>`;
    const striker=i.batStats?.[i.striker],non=i.batStats?.[i.nonStriker],bowler=i.bowlStats?.[i.currentBowler];
    const bowlerRole=i.awaitingBowler?'LAST OVER BOWLER':'CURRENT BOWLER';
    const overRole=i.awaitingBowler?'NEXT OVER · SELECT BOWLER':`OVER ${Math.floor(ballsNow/6)+1}`;
    const batterCard=(p,role,isStriker)=>`<section class="jcFieldPlayer ${isStriker?'jcFieldStriker':'jcFieldNonStriker'}">
      <div class="jcFieldPlayerTop"><span class="jcFieldRole">${role}</span>${isStriker?'<span class="jcStrikeBadge">● ON STRIKE</span>':''}</div>
      <b class="jcFieldPlayerName" title="${safe(p?.name||'Not selected')}">${safe(p?.name||'Not selected')}</b>
      <div class="jcFieldStats">
        <div><strong>${Number(p?.runs)||0}${isStriker?'*':''}</strong><small>RUNS</small></div>
        <div><strong>${Number(p?.balls)||0}</strong><small>BALLS</small></div>
      </div>
      <div class="jcFieldExtra">${Number(p?.fours)||0}×4 <span>·</span> ${Number(p?.sixes)||0}×6</div>
    </section>`;
    players.innerHTML=`<div class="jcOnFieldGrid">
      ${batterCard(striker,'STRIKER',true)}
      ${batterCard(non,'NON-STRIKER',false)}
      <section class="jcFieldPlayer jcFieldBowler">
        <div class="jcFieldPlayerTop"><span class="jcFieldRole">${bowlerRole}</span><span class="jcOverBadge">${overRole}</span></div>
        <b class="jcFieldPlayerName" title="${safe(bowler?.name||'Bowler not selected')}">${safe(bowler?.name||'Bowler not selected')}</b>
        <div class="jcFieldStats jcBowlerStats">
          <div><strong>${fmtOvers(bowler?.balls||0)}</strong><small>OVERS</small></div>
          <div><strong>${Number(bowler?.runs)||0}</strong><small>RUNS</small></div>
          <div><strong>${Number(bowler?.wickets)||0}</strong><small>WICKETS</small></div>
        </div>
        <div class="jcFieldExtra jcBowlingTeam" title="${safe(bowl?.name||'Bowling team')}">${safe(bowl?.name||'Bowling team')} · WD ${Number(bowler?.wides)||0} · NB ${Number(bowler?.noBalls)||0}</div>
      </section>
    </div>`;
    const latestBallEvent=[...(i.events||[])].reverse().find(e=>e?.ballLabel),latestOverKey=latestBallEvent?String(latestBallEvent.ballLabel).split('.')[0]:null,currentOverEvents=latestOverKey===null?(i.events||[]).slice(-6):(i.events||[]).filter(e=>String(e?.ballLabel||'').split('.')[0]===latestOverKey).slice(-12);recent.innerHTML=currentOverEvents.map(e=>`<span class="ball ${e.wicket?'ballWicket':e.runs===4?'ballFour':e.runs===6?'ballSix':''}" title="${safe(e.commentary||'')} ">${safe(e.label||labelForEvent(e))}</span>`).join('')||'<span class="muted">पहली गेंद का इंतज़ार…</span>';
    const disabled=!isOpen || !!i._replaceSlot || !!i.awaitingNewBatter || !!i.awaitingBowler || !i.currentBowler;
    grid?.classList.toggle('disabledScoreGrid',disabled);grid?.querySelectorAll('button').forEach(b=>b.disabled=disabled);
    if(finish)finish.disabled=m.status!=='live';
    if(nextInnings){const canStart=m.status==='live'&&Number(m.inningsNo||1)===1&&!m.awaitingMatchFinish;nextInnings.disabled=!canStart;nextInnings.setAttribute('aria-disabled',String(!canStart));nextInnings.title=canStart?(m.awaitingNextInnings||m.awaitingInningsSetup?'दूसरी पारी की टीम और खिलाड़ी चुनें':'पहली पारी अभी जारी है — दबाने पर इसे समाप्त करके दूसरी पारी शुरू होगी'):'दूसरी पारी में Finish Match का उपयोग करें';nextInnings.textContent=(m.awaitingNextInnings||m.awaitingInningsSetup)?'▶ Set Up Next Innings':'▶ Start Next Innings';}
    if(resume){const pendingBatter=!!(i.awaitingNewBatter||i._replaceSlot),pendingBowler=!!i.awaitingBowler;const showResume=m.status==='live'&&(pendingBatter||pendingBowler);resume.style.display=showResume?'inline-flex':'none';resume.textContent=pendingBatter?'Select New Batter':pendingBowler?'Select Next Bowler':'Resume Match Setup';resume.disabled=false;}
    const activeCard=STATE?.broadcast?.card?.type||null;
    document.querySelectorAll('[data-card-button]').forEach(b=>{const selected=!!activeCard&&b.dataset.cardButton===activeCard;b.disabled=!['live','finished'].includes(m.status);b.classList.toggle('cardOn',selected);b.setAttribute('aria-pressed',String(selected));});
    document.querySelectorAll('[data-powerplay]').forEach(b=>{const selected=String(b.dataset.powerplay||'').toUpperCase()===pp;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    ['manualStrikeChange','changeBatter','changeBowler','retiredHurt','undoBall'].forEach(id=>{const b=el(id);if(b)b.disabled=m.status!=='live'||!isOpen;});
  }
  async function undoLastDelivery() {
    if(!isLive())return alert('कोई LIVE मैच नहीं है।');
    const i=innings();ensureStats(i);
    if(!i.undoStack.length)return alert('Undo करने के लिए कोई पिछली scoring action नहीं है।');
    const stack=i.undoStack.slice(),snapshot=stack.pop();
    const mOld=clone(MATCH);
    MATCH.activeInnings={...restoreUndoEntry(snapshot,i),undoStack:stack};MATCH.awaitingNextInnings=false;MATCH.awaitingMatchFinish=false;MATCH.awaitingInningsSetup=false;
    try {await saveMatch(false);renderScoring();await saveBroadcast({event:null,card:null,cardId:Date.now()});}
    catch(e){MATCH=mOld;if(STATE)STATE.activeMatch=clone(mOld);renderScoring();alert(`Undo save नहीं हुआ: ${e.message}`)}
  }
  async function requestNextInnings() {
    if(!isLive())return alert('कोई LIVE match नहीं है।');
    if(Number(MATCH.inningsNo||1)!==1)return alert('दूसरी पारी में Finish Match का उपयोग करें।');
    if(!MATCH.awaitingNextInnings&&!MATCH.awaitingInningsSetup){
      const i=innings();
      if(!confirm(`पहली पारी अभी पूरी नहीं हुई है। वर्तमान स्कोर ${Number(i.score||0)}/${Number(i.wickets||0)} (${fmtOvers(i.balls||0)} overs) है। क्या इसे यहीं समाप्त करके दूसरी पारी शुरू करनी है?`))return;
      const old=clone(MATCH);
      MATCH.awaitingNextInnings=true;MATCH.awaitingMatchFinish=false;
      i.finished=true;i.finishedReason='manual';i.awaitingBowler=false;i.awaitingNewBatter=false;i._replaceSlot=null;
      try{await saveMatch(false);renderScoring();}
      catch(err){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();return alert(`पहली पारी समाप्त नहीं हो सकी: ${err.message}`)}
    }
    await startSecondInnings();
  }

  async function startSecondInnings() {
    if(!isLive())return;
    const m=MATCH,first=m.activeInnings;
    if(Number(m.inningsNo||1)!==1)return alert('अगली पारी पहले ही शुरू हो चुकी है।');
    if(!m.awaitingNextInnings && !m.awaitingInningsSetup)return;
    if(el('modalRoot')?.querySelector('#confirmInnings2'))return;
    const batId=first.bowlingId,bowlId=first.battingId;
    const batIds=([...new Set((rosterIds(batId).length?rosterIds(batId):Object.keys(first.bowlStats||{})).map(String))]).filter(id=>player(batId,id));
    const bowlIds=([...new Set((rosterIds(bowlId).length?rosterIds(bowlId):Object.keys(first.batStats||{})).map(String))]).filter(id=>player(bowlId,id));
    if(batIds.length<2||!bowlIds.length)return alert('दूसरी पारी शुरू करने के लिए batting team में कम-से-कम 2 और bowling team में 1 player चाहिए।');
    const optionList=(ids,teamId)=>ids.map(id=>`<option value="${safe(id)}">${safe(playerLabel(teamId,id))}</option>`).join('');
    openModal(`<div class="modalHead"><div><div class="eyebrow">INNINGS BREAK</div><h3>Start Second Innings</h3></div><button class="closeBtn" data-close>×</button></div><p class="muted">पहली पारी ${safe(getTeam(first.battingId)?.name||'Team')} ने ${first.score}/${first.wickets} बनाए। लक्ष्य ${Number(first.score||0)+1} है।</p><div class="grid3"><div class="field"><label>Striker</label><select id="inn2Striker">${optionList(batIds,batId)}</select></div><div class="field"><label>Non-striker</label><select id="inn2Non">${optionList(batIds,batId)}</select></div><div class="field"><label>Opening bowler</label><select id="inn2Bowler">${optionList(bowlIds,bowlId)}</select></div></div><div class="rowBtns"><button class="btn primary" id="confirmInnings2">Start Innings 2</button><button class="btn dark" data-close>Cancel</button></div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal());
      box.querySelector('#confirmInnings2').onclick=async()=>{
        const striker=box.querySelector('#inn2Striker').value,non=box.querySelector('#inn2Non').value,bowler=box.querySelector('#inn2Bowler').value;
        if(!striker||!non||striker===non)return alert('Striker और Non-striker अलग-अलग चुनें।');
        const old=clone(MATCH);first.finished=true;first.finishedReason=first.finishedReason||'manual-or-automatic';const history=[...(MATCH.inningsHistory||[]),clone(first)];
        const maxOvers=Math.max(1,Number(MATCH.oversLimit||1)),limit=Math.max(1,Number(MATCH.bowlerOverLimit||Math.ceil(maxOvers/5)));
        const next={number:2,battingId:batId,bowlingId:bowlId,target:Number(first.score||0)+1,score:0,wickets:0,balls:0,events:[],striker,nonStriker:non,currentBowler:bowler,playersOut:[],batStats:{},bowlStats:{},partnership:{runs:0,balls:0},fallOfWickets:[],extras:{wide:0,noBall:0,legBye:0,bye:0,total:0},overBalls:0,currentOver:1,bowlerOverLimit:limit,freeHit:false,undoStack:[],awaitingBowler:false};
        for(const id of batIds){const p=player(batId,id);next.batStats[id]={id,name:p.name,runs:0,balls:0,fours:0,sixes:0,out:false,retired:false,howOut:'',assist:''};}
        for(const id of bowlIds){const p=player(bowlId,id);next.bowlStats[id]={id,name:p.name,runs:0,balls:0,wickets:0,wides:0,noBalls:0,maidens:0,overRuns:0,oversLimit:limit};}
        MATCH.inningsHistory=history;MATCH.activeInnings=next;MATCH.inningsNo=2;MATCH.awaitingNextInnings=false;MATCH.awaitingMatchFinish=false;MATCH.awaitingInningsSetup=false;closeModal();
        try{await saveMatch(false);renderScoring();await fireEvent('INNINGS BREAK');}catch(e){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(e.message)}
      };
    });
  }
  async function finalizeMatch(resultType,winnerTeamId='') {
    if(!MATCH?.id)throw new Error('Match record नहीं मिला।');
    const old=clone(MATCH);
    try {
      const res=await api('/api/match/finish',{method:'POST',body:JSON.stringify({matchId:MATCH.id,resultType,winnerTeamId})});
      if(STATE){STATE.activeMatch=null;STATE.matches||=[];const ix=STATE.matches.findIndex(x=>x.id===res.match.id);if(ix>=0)STATE.matches[ix]=res.match;else STATE.matches.push(res.match);}
      const finished=res.match||{};
      const inningsForResult=[...(finished.inningsHistory||[])];
      if(finished.activeInnings && !inningsForResult.some(x=>String(x?.number)===String(finished.activeInnings.number))) inningsForResult.push(finished.activeInnings);
      const scoreForTeam=teamId=>{const inn=inningsForResult.find(x=>String(x?.battingId)===String(teamId));return inn?`${Number(inn.score||0)}/${Number(inn.wickets||0)} (${fmtOvers(inn.balls||0)})`:''};
      const winnerName=finished.resultType==='winner'?(String(finished.winnerTeamId)===String(finished.teamA)?(finished.teamAName||'Team A'):(finished.teamBName||'Team B')):'';
      const resultDetails={winnerName,result:finished.result||'Match complete',resultType:finished.resultType||resultType,teamAName:finished.teamAName||'Team A',teamBName:finished.teamBName||'Team B',teamAScore:scoreForTeam(finished.teamA),teamBScore:scoreForTeam(finished.teamB)};
      MATCH=finished;await saveBroadcast({event:'RESULT',eventStyle:'result',resultDetails,matchId:finished.id,card:null,cardId:Date.now()}).catch(()=>{});
      await refresh();showPage('dashboard');alert('मैच सफलतापूर्वक समाप्त हुआ। परिणाम और स्कोरकार्ड सेव हो गए हैं।');
      return res;
    } catch(err) { MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(`Match finish नहीं हुआ: ${err.message}`);throw err; }
  }
  function openChangeBatter() {
    const i=innings();
    if(!isLive())return alert('कोई LIVE match नहीं है।');
    if(MATCH.awaitingNextInnings||MATCH.awaitingMatchFinish||MATCH.awaitingInningsSetup)return alert('पहले वर्तमान innings setup पूरा करें।');
    const activeIds=new Set([String(i.striker||''),String(i.nonStriker||'')]);
    const candidates=battingXIIds(i).filter(id=>{const st=i.batStats?.[id];return !!st&&!st.out&&!activeIds.has(String(id));});
    if(!candidates.length)return alert('इस Playing XI में कोई ऐसा खिलाड़ी उपलब्ध नहीं है जिसका विकेट नहीं गिरा हो।');
    const strikerName=i.batStats?.[i.striker]?.name||playerLabel(i.battingId,i.striker);
    const nonName=i.batStats?.[i.nonStriker]?.name||playerLabel(i.battingId,i.nonStriker);
    openModal(`<div class="modalHead"><div><div class="eyebrow">BATTER MANAGEMENT</div><h3>Change Batter</h3></div><button class="closeBtn" data-close>×</button></div><p class="muted">जिस स्थान पर खिलाड़ी बदलना है उसे चुनें। बदले गए खिलाड़ी के पुराने रन और गेंदें Scorecard में सुरक्षित रहेंगे।</p><div class="field"><label>किसे बदलना है?</label><select id="changeBatterSlot"><option value="striker">Striker — ${safe(strikerName)}</option><option value="nonStriker">Non-Striker — ${safe(nonName)}</option></select></div><div class="field"><label>नया Batter चुनें</label><select id="changeBatterPlayer">${candidates.map(id=>`<option value="${safe(id)}">${safe(playerLabel(i.battingId,id))}</option>`).join('')}</select></div><div class="rowBtns"><button class="btn primary" id="confirmChangeBatter">Confirm Change</button><button class="btn dark" data-close>Cancel</button></div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal());
      box.querySelector('#confirmChangeBatter').onclick=async()=>{
        const slot=box.querySelector('#changeBatterSlot').value;
        const incoming=String(box.querySelector('#changeBatterPlayer').value||'');
        const outgoing=String(i[slot]||'');
        const incomingStat=i.batStats?.[incoming];
        if(!incoming||!incomingStat||incoming===String(i.striker)||incoming===String(i.nonStriker))return alert('एक उपलब्ध और अलग खिलाड़ी चुनें।');
        if(incomingStat.out)return alert('जिस खिलाड़ी का विकेट गिर चुका है, उसे वापस नहीं चुन सकते।');
        const old=clone(MATCH);pushUndo(i);
        const outgoingStat=i.batStats?.[outgoing];
        if(outgoingStat){outgoingStat.retired=true;outgoingStat.retiredReason='Substituted';outgoingStat.howOut='Substituted';}
        incomingStat.retired=false;incomingStat.retiredReason='';incomingStat.howOut=incomingStat.howOut==='Retired Hurt'?'':incomingStat.howOut;
        i[slot]=incoming;i.partnership={runs:0,balls:0};i._replaceSlot=null;i.awaitingNewBatter=false;settlePendingScoring(i);
        i.events.push({type:'batter-change',runs:0,total:0,legal:false,ballLabel:`${Math.floor((i.balls||0)/6)}.${(i.balls||0)%6}`,batter:incomingStat.name||playerLabel(i.battingId,incoming),commentary:`${incomingStat.name||playerLabel(i.battingId,incoming)} replaced ${outgoingStat?.name||'the batter'} in the ${slot==='striker'?'striker':'non-striker'} position.`});
        closeModal();
        try{await saveMatch(false);renderScoring();void fireEvent('NEW BATSMAN',{eventPlayer:incomingPlayerMeta(i.battingId,incoming,incomingStat,'BATTER')});renderScoring();}
        catch(e){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(`Batter change सेव नहीं हुआ: ${e.message}`);}
      };
    });
  }
  function retireHurt() {
    const i=innings();if(!isLive())return alert('कोई LIVE मैच नहीं है।');
    const slots=[['striker',i.striker],['nonStriker',i.nonStriker]].filter(x=>x[1]);
    openModal(`<div class="modalHead"><h3>Retired Hurt</h3><button class="closeBtn" data-close>×</button></div><p class="muted">Retired Hurt wicket के रूप में नहीं गिना जाएगा। वापसी बाद में roster के हिसाब से संभव होनी चाहिए।</p><div class="choices">${slots.map(([s,id])=>`<button class="btn ghost" data-retire-slot="${s}">${s==='striker'?'Striker':'Non-striker'} — ${safe(i.batStats[id]?.name||playerLabel(i.battingId,id))}</button>`).join('')}</div><div class="rowBtns"><button class="btn dark" data-close>Cancel</button></div>`,box=>{
      box.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal());
      box.querySelectorAll('[data-retire-slot]').forEach(b=>b.onclick=async()=>{const slot=b.dataset.retireSlot,id=i[slot],stat=i.batStats[id];if(!stat)return;const old=clone(MATCH);stat.retired=true;stat.howOut='Retired Hurt';i[slot]=null;const available=eligibleBatters(i);if(available.length){i._replaceSlot=slot;i.awaitingNewBatter=true;}else {i._replaceSlot=null;i.awaitingNewBatter=false;}const ev={type:'retired-hurt',runs:0,total:0,legal:false,ballLabel:`${Math.floor((i.balls||0)/6)}.${(i.balls||0)%6+1}`,batter:stat.name,bowler:currentBowlerStats(i)?.name||'',commentary:`${stat.name} retired hurt.`};ev.label='RH';i.events.push(ev);closeModal();try{await saveMatch(false);renderScoring();if(i._replaceSlot)promptReplacement(i._replaceSlot);else if(i.awaitingBowler)promptBowler();}catch(e){MATCH=old;if(STATE)STATE.activeMatch=clone(old);renderScoring();alert(e.message)}});
    });
  }
  // Expose the functions referenced by the existing Control Board. They were absent in V3,
  // which caused the scoring view, Finish Match, and score entry to fail at runtime.
  window.renderScoring=renderScoring;
  window.saveMatch=saveMatch;
  window.finalizeMatch=finalizeMatch;
  window.startSecondInnings=startSecondInnings;
  window.requestNextInnings=requestNextInnings;
  window.resumeScoringSetup=()=>{const i=innings();if(!i)return;if(MATCH?.awaitingNextInnings||MATCH?.awaitingInningsSetup)startSecondInnings();else if(i.awaitingNewBatter&&i._replaceSlot)promptReplacement(i._replaceSlot);else if(i.awaitingBowler)promptBowler();};
  window.JangidScoring={recordDelivery,undoLastDelivery,saveMatch,finalizeMatch,renderScoring,startSecondInnings,requestNextInnings,openChangeBatter,getAllOutWicketLimit:allOutWicketLimit,isInningsAllOut};
  const scoringActionSelector='[data-run],[data-extra],#wicketBtn,#undoBall,#changeBowler,#retiredHurt,#changeBatter,#startNextInningsBtn';
  let lastMobileScoringPointer=null,mobileClickSuppressionTimer=null;
  const isMobileScoringViewport=()=>!!window.matchMedia?.('(max-width:700px)').matches;
  async function dispatchScoringAction(button,event){
    const run=button.closest('[data-run]');
    const extra=button.closest('[data-extra]');
    if(run){event.preventDefault();await recordDelivery({kind:'run',runs:Number(run.dataset.run)||0});return true;}
    if(extra){event.preventDefault();promptExtra(extra.dataset.extra);return true;}
    if(button.closest('#wicketBtn')){event.preventDefault();pickWicket();return true;}
    if(button.closest('#undoBall')){event.preventDefault();await undoLastDelivery();return true;}
    if(button.closest('#changeBowler')){event.preventDefault();promptBowler(true);return true;}
    if(button.closest('#retiredHurt')){event.preventDefault();retireHurt();return true;}
    if(button.closest('#changeBatter')){event.preventDefault();openChangeBatter();return true;}
    if(button.closest('#startNextInningsBtn')){event.preventDefault();requestNextInnings();return true;}
    return false;
  }
  // The compact mobile desk scores on touch release; desktop retains its ordinary click path.
  // A short-lived one-shot guard prevents one physical tap from counting twice.
  document.addEventListener('pointerup',async event=>{
    if(!isMobileScoringViewport())return;
    if(event.pointerType&&event.pointerType!=='touch'&&event.pointerType!=='pen')return;
    const node=event.target instanceof Element?event.target:null;
    const button=node?.closest(scoringActionSelector);
    if(!button)return;
    event.preventDefault();
    lastMobileScoringPointer={button,at:Date.now()};
    clearTimeout(mobileClickSuppressionTimer);
    mobileClickSuppressionTimer=setTimeout(()=>{
      lastMobileScoringPointer=null;
      mobileClickSuppressionTimer=null;
    },800);
    await dispatchScoringAction(button,event);
  },{passive:false});
  document.addEventListener('click',async event=>{
    const node=event.target instanceof Element?event.target:null;
    const button=node?.closest(scoringActionSelector);
    if(!button)return;
    if(isMobileScoringViewport()&&lastMobileScoringPointer&&lastMobileScoringPointer.button===button&&Date.now()-lastMobileScoringPointer.at<800){
      event.preventDefault();event.stopImmediatePropagation();
      clearTimeout(mobileClickSuppressionTimer);mobileClickSuppressionTimer=null;lastMobileScoringPointer=null;
      return;
    }
    await dispatchScoringAction(button,event);
  });
})();
