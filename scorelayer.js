'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const q=new URLSearchParams(location.search);const owner=q.get('owner');
let lastEventId=null,lastCardId=null,lastRenderMatchId=null,eventVisible=false,latestBroadcast={},latestSSEBroadcast={},latestMatch=null,ownerBroadcast={},ownerBroadcastVersion='',ownerBroadcastRequestedVersion='',ownerBroadcastUserId='';
let sponsorLibrary=[],sponsorLibraryVersion='',sponsorLibraryRequested=false,lastSponsorManualToken='',lastSponsorTimeoutToken='',sponsorAutoState={matchId:'',innings:0,over:0,status:''},pendingSponsor=null,sponsorVisible=false,sponsorHideTimer=null,sponsorRotationIndex=0,sponsorRotationBase='',dismissedCardId=null;
const accentByColor={1:'#58c8ff',2:'#43e09b',3:'#ff6074',4:'#ffae4d',5:'#c59bff',6:'#f5d06c',7:'#ffffff',8:'#44e1d5',9:'#ef8493',10:'#dce5ef'};
function currentTeamName(id,m){return id===m.teamA?m.teamAName:id===m.teamB?m.teamBName:id}
function eventMarkup(ev,meta={}){
 const e=String(ev||'');
 if(e==='WICKET')return '<div class="eventInner wicketEventInner"><img class="eventSticker batterSticker walkingSticker" src="assets/stickers/batter-sticker.png" alt="Departing batter illustration"><img class="eventSticker umpireSticker" src="assets/stickers/umpire-out-sticker.png" alt="Umpire OUT signal illustration"><div class="eventTitle">OUT</div><div class="eventSub">WICKET</div></div>  ';
 if(e==='FOUR')return '<div class="eventInner eventFour"><img class="eventSticker batBallSticker" src="assets/stickers/bat-ball-sticker.png" alt="Bat and ball motion illustration"><div class="celebrateIcon">4</div><div class="eventTitle">FOUR</div><div class="eventSub">BOUNDARY</div><div class="fireworks">✦ ✦ ✦ ✦ ✦</div></div>';
 if(e==='SIX')return '<div class="eventInner eventSix"><img class="eventSticker batBallSticker sixSticker" src="assets/stickers/bat-ball-sticker.png" alt="Bat and ball power-hit illustration"><div class="celebrateIcon bigSix">6</div><div class="eventTitle">SIX</div><div class="eventSub">MAXIMUM</div><div class="fireworks">✹ ✦ ✹ ✦ ✹</div><img class="eventSticker confettiSticker" src="assets/stickers/celebration-sticker.png" alt="Celebration illustration"></div>';
 if(e==='FIFTY')return '<div class="eventInner"><img class="eventSticker batterSticker" src="assets/stickers/batter-sticker.png" alt="Batter celebration illustration"><div class="eventTitle">FIFTY</div><div class="eventSub">HALF-CENTURY</div></div>';
 if(e==='CENTURY')return '<div class="eventInner"><img class="eventSticker batterSticker" src="assets/stickers/batter-sticker.png" alt="Batter century celebration illustration"><div class="eventTitle">CENTURY</div><div class="eventSub">100 RUNS</div><img class="eventSticker confettiSticker" src="assets/stickers/celebration-sticker.png" alt="Celebration illustration"></div>';
 if(e==='NEW BATSMAN')return '<div class="eventInner"><img class="eventSticker batterSticker" src="assets/stickers/batter-sticker.png" alt="Incoming batter illustration"><div class="eventTitle">NEW BATSMAN</div><div class="eventSub">WALKING TO THE CREASE</div></div>';
 if(e==='NEW BOWLER')return '<div class="eventInner"><img class="eventSticker bowlerSticker" src="assets/stickers/bowler-sticker.png" alt="Bowler action illustration"><div class="eventTitle">NEW BOWLER</div><div class="eventSub">OVER CHANGE</div></div>';
 if(e==='NO BALL')return '<div class="eventInner"><div class="badgeIcon">NB</div><div class="eventTitle">NO BALL</div><div class="eventSub">EXTRA DELIVERY</div></div>';
 if(e==='FREE HIT')return '<div class="eventInner"><div class="badgeIcon free">FH</div><div class="eventTitle">FREE HIT</div><div class="eventSub">NEXT BALL</div></div>';
 if(e==='WIDE'||e==='LEG BYE'||e==='BYE')return `<div class="eventInner"><div class="badgeIcon">${e==='WIDE'?'WD':e==='BYE'?'B':'LB'}</div><div class="eventTitle">${e}</div><div class="eventSub">EXTRA RUNS</div></div>`;
 if(e==='RESULT'){const d=meta.resultDetails||{};const scores=[d.teamAName&&d.teamAScore?`${d.teamAName} ${d.teamAScore}`:'',d.teamBName&&d.teamBScore?`${d.teamBName} ${d.teamBScore}`:''].filter(Boolean).join(' · ');const title=d.winnerName?`${d.winnerName} WON`:d.resultType==='tie'?'MATCH TIED':d.resultType==='no-result'?'NO RESULT':'MATCH RESULT';return `<div class="eventInner resultEventInner"><div class="badgeIcon trophy">🏆</div><div class="eventTitle">${esc(title)}</div><div class="eventSub">${esc(d.result||'MATCH COMPLETE')}</div>${scores?`<small class="resultScores">${esc(scores)}</small>`:''}</div>`;}
 if(e==='INNINGS BREAK')return '<div class="eventInner"><div class="badgeIcon">II</div><div class="eventTitle">INNINGS BREAK</div></div>';
 if(e==='PARTNERSHIP'||e==='50 PARTNERSHIP')return `<div class="eventInner"><div class="badgeIcon free">🤝</div><div class="eventTitle">${esc(e)}</div><div class="eventSub">IMPORTANT PARTNERSHIP</div></div>`;
 return `<div class="eventInner"><div class="eventTitle">${esc(e)}</div></div>`;
}
function fmtOvers(balls){return `${Math.floor((Number(balls)||0)/6)}.${(Number(balls)||0)%6}`}
function teamMeta(id,m,role){
 const same=(a,b)=>String(a??'')===String(b??'');
 const isA=same(id,m.teamA),isB=same(id,m.teamB);
 const name=isA?(m.teamAName||'Team A'):isB?(m.teamBName||'Team B'):(id|| (role==='BAT'?'Batting Team':'Bowling Team'));
 const logo=isA?(m.teamALogo||''):isB?(m.teamBLogo||''):'';
 return {id,name:String(name),logo,role};
}
function initials(name){return String(name||'XI').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'XI'}
function logoBadge(t){const hasLogo=!!t.logo;const long=String(t.name||'').trim().length>13;return `<span class="jlTeamLogo ${hasLogo?'hasLogo':'jlTeamNameFallback'}" title="${esc(t.name)}">${hasLogo?`<img src="${esc(t.logo)}" alt="${esc(t.name)} logo" onerror="window.jlLogoFallback(this)">`:''}<i>${esc(initials(t.name))}</i><span class="jlLogoFallbackName"><span class="jlFallbackTrack ${long?'isLong':''}"><b>${esc(t.name)}</b>${long?`<b aria-hidden="true">${esc(t.name)}</b>`:''}</span></span></span>`}
window.jlLogoFallback=function(img){const badge=img?.closest('.jlTeamLogo');if(!badge)return;img.remove();badge.classList.remove('hasLogo');badge.classList.add('jlTeamNameFallback');badge.querySelector('i')?.setAttribute('hidden','hidden');badge.closest('.jlTeam')?.classList.add('noLogo')};
function compactLogo(t){return `<span class="jlScoreLogo">${t.logo?`<img src="${esc(t.logo)}" alt="" onerror="this.remove()">`:`<i>${esc(initials(t.name))}</i>`}</span>`}
function overEvents(events){if(!events?.length)return [];let last=null;for(let x=events.length-1;x>=0;x--){if(events[x]?.ballLabel){last=events[x];break}}if(!last)return events.slice(-6);const over=String(last.ballLabel).split('.')[0];return events.filter(e=>String(e?.ballLabel||'').split('.')[0]===over).slice(-12)}
function deliveryInfo(e){
 const raw=String(e?.extra||'').toLowerCase();
 if(e?.wicket)return {label:'W',cls:'isWicket',title:e.commentary||'Wicket'};
 if(raw==='wide'||raw==='wd'){const n=Math.max(0,(Number(e?.total)||1)-1);return {label:n?`${n}WD`:'WD',cls:'isWide',title:e.commentary||'Wide'}};
 if(raw==='noball'||raw==='no ball'||raw==='nb'){const n=Math.max(0,(Number(e?.total)||1)-1);return {label:n?`${n}NB`:'NB',cls:'isNoBall',title:e.commentary||'No ball'}};
 if(raw==='legbye'||raw==='leg bye'||raw==='lb')return {label:'LB',cls:'isLegBye',title:e.commentary||'Leg bye'};
 if(raw==='bye'||raw==='b')return {label:`${Math.max(1,Number(e?.total)||1)}B`,cls:'isBye',title:e.commentary||'Bye'};
 const runs=Number(e?.runs)||0;
 if(runs===4)return {label:'4',cls:'isFour',title:e.commentary||'Four'};
 if(runs===6)return {label:'6',cls:'isSix',title:e.commentary||'Six'};
 return {label:runs===0?'·':String(runs),cls:runs===0?'isDot':'isRun',title:e.commentary||`${runs} run${runs===1?'':'s'}`};
}
const DESIGN_FONT_STACKS={system:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',arial:'Arial, Helvetica, sans-serif',condensed:'"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif',trebuchet:'"Trebuchet MS", sans-serif',georgia:'Georgia, serif',mono:'"Courier New", Consolas, monospace',impact:'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'};
function designHex(hex,fallback){const x=String(hex||'');return /^#[0-9a-f]{6}$/i.test(x)?x:fallback}
function designRgba(hex,alpha){const c=designHex(hex,'#071626'),n=parseInt(c.slice(1),16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${Math.max(0,Math.min(1,Number(alpha)||0))})`}
function applyScoreDesign(d){
 const layer=document.getElementById('scoreBar'),card=document.getElementById('cardLayer'),event=document.getElementById('eventLayer');
 if(!layer)return;const enabled=!!d?.enabled;layer.dataset.custom=enabled?'true':'false';if(card)card.dataset.custom=enabled?'true':'false';if(event)event.dataset.custom=enabled?'true':'false';
 let style=document.getElementById('scoreDesignOverrides');if(!style){style=document.createElement('style');style.id='scoreDesignOverrides';document.head.appendChild(style)}
 if(!enabled){style.textContent='';return}
 const n=(v,min,max,f)=>Math.max(min,Math.min(max,Number(v)||f));
 const width=n(d.width,55,100,92),scale=n(d.scale,65,125,100),score=n(d.scoreFont,20,88,56),meta=n(d.metaFont,7,24,11),logo=n(d.logoSize,18,64,36),opacity=n(d.opacity,25,100,94)/100,radius=n(d.radius,0,40,15),border=n(d.border,0,6,1);
 const bg=designHex(d.bg,'#071626'),accent=designHex(d.accent,'#58c8ff'),text=designHex(d.text,'#f4f9ff'),font=DESIGN_FONT_STACKS[d.fontFamily]||DESIGN_FONT_STACKS.system;
 const position=['bottom-center','bottom-left','bottom-right','top-center','top-left','top-right'].includes(d.position)?d.position:'bottom-center';
 const top=position.startsWith('top'),center=position.endsWith('center'),left=position.endsWith('left'),right=position.endsWith('right');
 const adjustedWidth=center?width:Math.min(width,94),l=center?'50%':left?'3vw':'auto',r=right?'3vw':'auto';
 const xform=`${center?'translateX(-50%) ':''}scale(${scale/100})`,origin=`${center?'center':left?'left':'right'} ${top?'top':'bottom'}`;
 let outerRadius=`${radius}px`,clip='none';
 if(d.shape==='square'){outerRadius='0px'}else if(d.shape==='pill'){outerRadius='999px'}else if(d.shape==='angled'){outerRadius='0px';clip='polygon(1.2% 0,98.8% 0,100% 50%,98.8% 100%,1.2% 100%,0 50%)'}else if(d.shape==='chamfer'){outerRadius='0px';clip='polygon(2% 0,100% 0,98% 100%,0 100%)'}else if(d.shape==='hex'){outerRadius='0px';clip='polygon(3% 0,97% 0,100% 50%,97% 100%,3% 100%,0 50%)'}
 const innerRadius=d.shape==='square'||['angled','chamfer','hex'].includes(d.shape)?'0px':d.shape==='pill'?'18px':`${Math.max(3,Math.round(radius*.6))}px`;
 const muted=designRgba(text,.72),line=designRgba(accent,.7),panel=designRgba(bg,Math.min(.98,opacity*.9)),scorePanel=designRgba(accent,.15);
 style.textContent=`
#scoreBar.scoreBar[data-custom="true"]{left:${l}!important;right:${r}!important;top:${top?'3vh':'auto'}!important;bottom:${top?'auto':'2.25vh'}!important;width:${adjustedWidth}vw!important;max-width:${adjustedWidth}vw!important;min-width:0!important;transform:${xform}!important;transform-origin:${origin}!important;border-radius:${outerRadius}!important;clip-path:${clip}!important;border:${border}px solid ${accent}!important;background:${designRgba(bg,opacity)}!important;color:${text}!important;font-family:${font}!important;--accent:${accent};--jl-surface:${designRgba(bg,opacity)};--jl-panel:${panel};--jl-line:${line};--jl-ink:${text};--jl-muted:${muted};--jl-score-panel:${scorePanel};--jl-logo-bg:${panel};--jl-score-font:${score}px;--jl-wicket-font:${Math.max(16,Math.round(score*.72))}px;--jl-meta-font:${meta}px;--jl-stat-font:${Math.round(meta*1.45)}px;--jl-small-font:${Math.max(7,Math.round(meta*.78))}px;--jl-logo-size:${logo}px;--jl-inner-radius:${innerRadius};--jl-ball-radius:${d.shape==='square'?'0px':d.shape==='pill'?'999px':innerRadius};--jl-logo-radius:${d.shape==='square'||['angled','chamfer','hex'].includes(d.shape)?'4px':'50%'}}
#scoreBar.scoreBar[data-custom="true"] .jlTeam,#scoreBar.scoreBar[data-custom="true"] .jlScoreWrap,#scoreBar.scoreBar[data-custom="true"] .jlBatters,#scoreBar.scoreBar[data-custom="true"] .jlBowler,#scoreBar.scoreBar[data-custom="true"] .jlBalls,#scoreBar.scoreBar[data-custom="true"] .jlChase,#scoreBar.scoreBar[data-custom="true"] .jlBrandBay{background:${panel}!important;border-color:${line}!important;color:${text}!important;border-radius:${innerRadius}!important;font-family:${font}!important}
#scoreBar.scoreBar[data-custom="true"] .jlScoreWrap{background:${scorePanel}!important;border-width:${Math.max(1,border)}px!important}
#scoreBar.scoreBar[data-custom="true"] .jlRuns{font-size:${score}px!important;line-height:.95!important;color:${text}!important}
#scoreBar.scoreBar[data-custom="true"] .jlWickets{font-size:${Math.max(16,Math.round(score*.72))}px!important;line-height:.95!important;color:${accent}!important}
#scoreBar.scoreBar[data-custom="true"] .jlTeamName,#scoreBar.scoreBar[data-custom="true"] .jlScoreTeamName,#scoreBar.scoreBar[data-custom="true"] .jlBatterName,#scoreBar.scoreBar[data-custom="true"] .jlBowlerName{font-size:${meta}px!important;font-family:${font}!important;color:${text}!important}
#scoreBar.scoreBar[data-custom="true"] .jlBatterRuns,#scoreBar.scoreBar[data-custom="true"] .jlBowlerFigures{font-size:${Math.round(meta*1.45)}px!important;color:${text}!important}
#scoreBar.scoreBar[data-custom="true"] .jlScoreMeta,#scoreBar.scoreBar[data-custom="true"] .jlBatterBalls,#scoreBar.scoreBar[data-custom="true"] .jlBatterBoundaries,#scoreBar.scoreBar[data-custom="true"] .jlBowlerMeta,#scoreBar.scoreBar[data-custom="true"] .jlSectionLabel,#scoreBar.scoreBar[data-custom="true"] .jlNeedTag,#scoreBar.scoreBar[data-custom="true"] .jlBallsLeft,#scoreBar.scoreBar[data-custom="true"] .jlChaseTag{font-size:${Math.max(7,Math.round(meta*.78))}px!important;font-family:${font}!important;color:${muted}!important}
#scoreBar.scoreBar[data-custom="true"] .jlTeamLogo{width:${logo}px!important;height:${logo}px!important;flex-basis:${logo}px!important;border-color:${accent}!important;border-radius:${d.shape==='square'||['angled','chamfer','hex'].includes(d.shape)?'4px':'50%'}!important}
#scoreBar.scoreBar[data-custom="true"] .jlScoreLogo{width:${Math.max(14,Math.round(logo*.48))}px!important;height:${Math.max(14,Math.round(logo*.48))}px!important;flex-basis:${Math.max(14,Math.round(logo*.48))}px!important}
#scoreBar.scoreBar[data-custom="true"] .jlBallChip{border-radius:${d.shape==='square'?'0px':d.shape==='pill'?'999px':innerRadius}!important;border-color:${line}!important;font-family:${font}!important}
#cardLayer.cardLayer[data-custom="true"] .broadcastCardStage{font-family:${font}!important;color:${text}!important;border-color:${accent}!important;border-radius:${innerRadius}!important;--accent:${accent}}
#cardLayer.cardLayer[data-custom="true"] .broadcastCardStage :is(h1,h2,h3,.playerBigStat,.broadcastCardTitle strong){font-family:${font}!important;color:${text}!important}
#eventLayer[data-custom="true"] .eventInner{font-family:${font}!important}
`;
}
function studioTemplate(studio){
 if(!studio||!studio.enabled||!Array.isArray(studio.templates))return null;
 return studio.templates.find(t=>String(t.id)===String(studio.activeTemplateId))||studio.templates[0]||null;
}
function studioNum(v,min,max,fallback=0){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function studioColor(v,fallback){return /^#[0-9a-f]{6}$/i.test(String(v||''))?v:fallback}
function studioInitials(name){const parts=String(name||'XI').trim().split(/\s+/).filter(Boolean);return (parts.length>1?parts.slice(0,2).map(x=>x[0]).join(''):((parts[0]||'XI').slice(0,2))).toUpperCase()||'XI'}
function studioFont(name){return ({system:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',arial:'Arial, Helvetica, sans-serif',condensed:'"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif',trebuchet:'"Trebuchet MS", sans-serif',georgia:'Georgia, serif',mono:'"Courier New", Consolas, monospace',impact:'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'})[name]||'system-ui, sans-serif'}
function studioPolygon(sides,star=false){const pts=[],count=star?sides*2:sides;for(let i=0;i<count;i++){const r=star&&i%2?34:46,a=(-Math.PI/2)+(i/count)*Math.PI*2;pts.push(`${50+Math.cos(a)*r},${50+Math.sin(a)*r}`)}return pts.join(' ')}
function studioShapeGeometry(type){
 const poly={triangle:'50,4 96,94 4,94',rtTriangle:'4,4 4,96 96,96',diamond:'50,3 97,50 50,97 3,50',pentagon:studioPolygon(5),hexagon:studioPolygon(6),octagon:studioPolygon(8),star4:studioPolygon(4,true),star5:studioPolygon(5,true),star6:studioPolygon(6,true),star8:studioPolygon(8,true),parallelogram:'20,4 100,4 80,96 0,96',trapezoid:'20,4 80,4 100,96 0,96',chevron:'0,5 62,5 100,50 62,95 0,95 38,50',rightArrow:'0,25 62,25 62,3 100,50 62,97 62,75 0,75',leftArrow:'100,25 38,25 38,3 0,50 38,97 38,75 100,75',upArrow:'25,100 25,38 3,38 50,0 97,38 75,38 75,100',downArrow:'25,0 75,0 75,62 97,62 50,100 3,62 25,62',leftRightArrow:'0,50 28,12 28,32 72,32 72,12 100,50 72,88 72,68 28,68 28,88',upDownArrow:'50,0 88,28 68,28 68,72 88,72 50,100 12,72 32,72 32,28 12,28',plus:'35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35',cross:'15,0 50,28 85,0 100,15 72,50 100,85 85,100 50,72 15,100 0,85 28,50 0,15',heart:'50,92 7,52 4,27 20,8 38,8 50,25 62,8 80,8 96,27 93,52',lightning:'58,0 18,55 45,55 34,100 84,38 56,38',speech:'8,8 92,8 92,78 56,78 36,98 36,78 8,78',callout:'12,8 88,8 88,76 62,76 48,94 48,76 12,76',flowDecision:'50,0 100,50 50,100 0,50',flowData:'18,0 100,0 82,100 0,100',flowDocument:'0,0 100,0 100,82 75,100 0,82',flowTerminator:'12,10 88,10 100,50 88,90 12,90 0,50',flowDatabase:'10,8 90,8 90,88 10,88',flowStoredData:'12,8 88,8 88,92 12,92',flowManualInput:'4,24 96,4 96,96 4,96',flowMerge:'50,4 96,96 4,96',flowExtract:'50,96 96,4 4,4',flowSort:'50,4 96,50 50,96 4,50',flowOffPage:'4,4 96,4 96,72 50,96 4,72',flowConnector:studioPolygon(20),bentArrow:'0,10 62,10 62,0 100,30 62,60 62,48 42,48 42,90 20,90 20,48 0,48',uTurnArrow:'0,38 42,38 42,12 62,12 62,38 100,38 100,64 62,64 62,88 42,88 42,64 0,64',notchedRightArrow:'0,18 60,18 60,0 100,50 60,100 60,82 0,82 14,50',leftRightUpArrow:'0,50 24,22 24,38 50,38 50,14 38,14 62,0 86,14 74,14 74,38 100,38 100,62 74,62 74,86 50,86 50,62 24,62 24,78',circularArrow:'12,38 18,20 35,8 58,6 77,18 88,36 97,27 96,58 67,54 76,46 69,32 57,25 42,25 31,33 26,46 28,60 38,69 52,72 62,67 70,61 84,78 68,91 48,96 27,90 11,75 4,55'};
 if(type==='ellipse'||type==='circle')return '<ellipse cx="50" cy="50" rx="48" ry="48" />';
 if(type==='roundRect')return '<rect x="2" y="2" width="96" height="96" rx="16" />';
 if(type==='line')return '<path d="M 3 50 L 97 50" fill="none" />';
 if(type==='brace')return '<path d="M88 4 C28 4 74 50 14 50 C74 50 28 96 88 96" fill="none" />';
 if(type==='bracket')return '<path d="M82 4 H20 V96 H82" fill="none" />';
 if(type==='arc')return '<path d="M8 82 A43 43 0 0 1 92 18" fill="none" />';
 if(type==='flowDelay')return '<path d="M8 8 H48 A42 42 0 0 1 48 92 H8 Z" />';
 if(type==='flowDisplay')return '<path d="M20 8 H80 L98 50 L80 92 H20 L2 50 Z M35 92 V100 M65 92 V100 M25 100 H75" />';
 if(type==='doubleLine')return '<path d="M 3 35 L 97 35 M 3 65 L 97 65" fill="none" />';
 if(type==='cloud')return '<path d="M22 76 C4 72 3 48 20 40 C18 19 46 10 59 28 C80 19 99 42 87 60 C84 77 68 80 55 76 Z" />';
 if(type==='flowProcess')return '<rect x="3" y="8" width="94" height="84" rx="5" />';
 if(type==='flowDatabase')return '<path d="M8 18 C8 5 92 5 92 18 V82 C92 95 8 95 8 82 Z M8 18 C8 31 92 31 92 18" />';
 if(type==='flowStoredData')return '<path d="M12 10 C12 2 88 2 88 10 V90 C88 98 12 98 12 90 Z M12 10 C12 18 88 18 88 10" />';
 if(type==='flowPreparation')return '<polygon points="20,5 80,5 100,50 80,95 20,95 0,50" />';
 if(poly[type])return `<polygon points="${poly[type]}" />`;
 return '<rect x="2" y="2" width="96" height="96" rx="8" />';
}
function studioShapeMarkup(e){
 const id=`studio_${String(e.id||'shape').replace(/[^a-z0-9]/gi,'')}`,fill=e.fillMode==='gradient'?`url(#${id}_g)`:studioColor(e.fill,'#241654'),stroke=studioColor(e.stroke,'#ff168f');
 const gradient=e.fillMode==='gradient'?`<defs><linearGradient id="${id}_g" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform="rotate(${studioNum(e.gradientAngle,0,360,110)} .5 .5)"><stop offset="0%" stop-color="${studioColor(e.fill,'#241654')}"/><stop offset="100%" stop-color="${studioColor(e.fill2,'#ff168f')}"/></linearGradient></defs>`:'';
 const geometry=(e.shapeType==='polygon'||e.shapeType==='freehand')?`<polygon points="${(Array.isArray(e.points)?e.points:[]).slice(0,150).map(p=>`${studioNum(p?.[0],0,100,0)},${studioNum(p?.[1],0,100,0)}`).join(' ')}" />`:studioShapeGeometry(e.shapeType||'rect');
 return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${gradient}<g fill="${['line','doubleLine','brace','bracket','arc'].includes(e.shapeType)?'none':fill}" stroke="${stroke}" stroke-width="${studioNum(e.strokeWidth,0,30,0)}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke">${geometry}</g></svg>`;
}
function studioBatterMarkup(p,isStriker){
 const name=esc(p?.name||'—'),runs=Number(p?.runs)||0,balls=Number(p?.balls)||0;
 return `<span class="jlStudioBatter"><b class="strikeMark ${isStriker?'':'empty'}">🏏</b><span class="batterInfo"><strong>${name}</strong><small>${runs}${isStriker?'*':''} (${balls})</small></span></span>`;
}
function studioDataMarkup(e,m,i,batting,bw,extra={}){
 const key=e.key||'',striker=i.batStats?.[i.striker],non=i.batStats?.[i.nonStriker],bowling=teamMeta(i.bowlingId??m.teamB,m,'BOWL');
 const runs=Number(i.score)||0,wickets=Number(i.wickets)||0,balls=Number(i.balls)||0,target=Number(i.target)||0;
 const maxBalls=Math.max(0,Number(m.oversLimit||m.overs||20)*6),ballsRemaining=Math.max(0,maxBalls-balls),runsRequired=target?Math.max(0,target-runs):0;
 const crr=balls?(runs/(balls/6)).toFixed(2):'0.00',rrr=target&&ballsRemaining?(runsRequired/(ballsRemaining/6)).toFixed(2):'—';
 const card=extra.card||{},cardData=card.data||card,cp=cardData.player||{},eventName=String(extra.event||cardData.name||card.type||'').toUpperCase();
 const extras=i.extras||{},part=card.type==='partnership'?{runs:cardData.runs??i.partnership?.runs,balls:cardData.balls??i.partnership?.balls}:i.partnership||{},fow=Array.isArray(i.fallOfWickets)?i.fallOfWickets:[],lastWicket=fow[fow.length-1],events=Array.isArray(i.events)?i.events:[];
 const selectedPlayer=Object.keys(cp).length?cp:(card.type==='bowler'?bw:(striker||{}));
 const selectedRuns=Number(selectedPlayer?.runs)||0,selectedBalls=Number(selectedPlayer?.balls)||0;
 const selectedSR=selectedBalls?(selectedRuns*100/selectedBalls).toFixed(2):'0.00';
 const strikerSR=striker?.balls?(Number(striker.runs||0)*100/Number(striker.balls)).toFixed(2):'0.00',nonSR=non?.balls?(Number(non.runs||0)*100/Number(non.balls)).toFixed(2):'0.00';
 const bowlerOvers=bw?fmtOvers(bw.balls||0):'0.0',economy=bw?.balls?(Number(bw.runs||0)/(Number(bw.balls)/6)).toFixed(2):'0.00';
 const lastOverEvents=overEvents(events).map(ev=>deliveryInfo(ev).label).join(' · ');
 const teamA=teamMeta(m.teamA,m,'TEAM A'),teamB=teamMeta(m.teamB,m,'TEAM B');
 const values={
  teamLogo:`<span class="jlStudioLogo">${batting.logo?`<img src="${esc(batting.logo)}" alt="${esc(batting.name)} logo" onerror="this.remove()">`:esc(studioInitials(batting.name))}</span>`,
  battingTeam:esc(batting.name),bowlingTeam:esc(bowling.name),teamA:esc(teamA.name),teamB:esc(teamB.name),
  batter1:studioBatterMarkup(striker,true),batter2:studioBatterMarkup(non,false),strikerName:esc(striker?.name||'—'),strikerRuns:`${Number(striker?.runs)||0}${String(i.striker||'')?'*':''}`,strikerBalls:String(Number(striker?.balls)||0),strikerFours:String(Number(striker?.fours)||0),strikerSixes:String(Number(striker?.sixes)||0),strikerSR:strikerSR,
  nonStrikerName:esc(non?.name||'—'),nonStrikerRuns:String(Number(non?.runs)||0),nonStrikerBalls:String(Number(non?.balls)||0),nonStrikerFours:String(Number(non?.fours)||0),nonStrikerSixes:String(Number(non?.sixes)||0),nonStrikerSR:nonSR,
  target:target?`TARGET ${target}`:'TARGET —',score:`${runs}/${wickets}`,totalRuns:String(runs),wickets:String(wickets),overs:fmtOvers(balls),innings:`INNINGS ${Number(m.inningsNo||i.number||1)}`,phase:String(i.powerplay||'OFF'),matchStatus:String(m.status||'LIVE').toUpperCase(),runsRequired:target?String(runsRequired):'—',ballsRemaining:target?String(ballsRemaining):'—',crr,rrr,
  partnership:`${Number(part.runs)||0} RUNS · ${Number(part.balls)||0} BALLS`,partnershipRuns:String(Number(part.runs)||0),partnershipBalls:String(Number(part.balls)||0),partnershipStrikers:`${striker?.name||'—'} & ${non?.name||'—'}`,partnershipScore:`${Number(part.runs)||0} RUNS · ${Number(part.balls)||0} BALLS`,
  bowlerName:esc(bw?.name||'—'),bowlerFigures:bw?`${bowlerOvers} – ${Number(bw.runs)||0} – ${Number(bw.wickets)||0}`:'0.0 – 0 – 0',bowlerOvers,bowlerRuns:String(Number(bw?.runs)||0),bowlerWickets:String(Number(bw?.wickets)||0),bowlerMaidens:String(Number(bw?.maidens)||0),bowlerEconomy:economy,
  balls:`<span class="jlStudioChips">${overEvents(events).map(ev=>{const d=deliveryInfo(ev);return `<i class="${d.cls}" title="${esc(d.title)}">${esc(d.label)}</i>`}).join('')||'<i>—</i>'}</span>`,lastOver:lastOverEvents||'—',extras:String(Number(extras.total)||0),wideRuns:String(Number(extras.wide)||0),noBallRuns:String(Number(extras.noBall)||0),byeRuns:String(Number(extras.bye)||0),legByeRuns:String(Number(extras.legBye)||0),lastWicket:lastWicket?`${lastWicket.batter||'Batter'} · ${lastWicket.score||0}/${lastWicket.wicket||0}`:'—',fallOfWickets:fow.map(x=>`${x.wicket||''}-${x.score||0}`).join(' · ')||'—',cardTitle:String(cardData.title||cardData.name||'PLAYER CARD'),eventName,playerName:esc(cp.name||cardData.name||selectedPlayer?.name||'—'),playerRole:esc(cardData.role||card.type||'PLAYER').toUpperCase(),playerTeam:esc(cardData.teamName||batting.name),playerRuns:String(selectedRuns),playerBalls:String(selectedBalls),playerFours:String(Number(selectedPlayer?.fours)||0),playerSixes:String(Number(selectedPlayer?.sixes)||0),playerStrikeRate:selectedSR,playerWickets:String(Number(selectedPlayer?.wickets)||0),playerOvers:fmtOvers(selectedPlayer?.balls||0),playerEconomy:selectedPlayer?.balls?(Number(selectedPlayer.runs||0)/(Number(selectedPlayer.balls)/6)).toFixed(2):'0.00',matchResult:esc(card.type==='result'?(cardData.name||m.result||'MATCH RESULT'):(m.result||'MATCH RESULT')),brand:'JANGID CRICINFO'
 };
 if(key==='teamLogo'||key==='batter1'||key==='batter2'||key==='balls')return values[key];
 if(key==='teamName')return values.battingTeam;
 return `<span class="jlStudioDynamicValue">${values[key]??esc(e.text||e.label||'—')}</span>`;
}
function renderStudioBar(layer,m,b,template){
 const i=m.activeInnings,batting=teamMeta(i.battingId??m.teamA,m,'BAT'),bw=i.bowlStats?.[i.currentBowler];
 layer.className='scoreBar jlStudioScoreLayer';layer.dataset.studio='true';layer.dataset.custom='false';layer.dataset.template=String(template.id||'');
 applyScoreDesign({enabled:false});
 const items=(template.elements||[]).filter(e=>!e.hidden).slice(0,100).sort((a,c)=>(Number(a.z)||0)-(Number(c.z)||0));
 layer.innerHTML=`<div class="jlStudioRoot">${items.map(e=>{
  const x=studioNum(e.x,0,100,0),y=studioNum(e.y,0,100,0),w=studioNum(e.w,1,100,10),h=studioNum(e.h,1,100,20),font=studioFont(e.fontFamily);
  const fill=e.fillMode==='gradient'?`linear-gradient(${studioNum(e.gradientAngle,0,360,110)}deg,${studioColor(e.fill,'#241654')},${studioColor(e.fill2,'#ff168f')})`:e.fill==='transparent'?'transparent':studioColor(e.fill,'#171033');
  const css=`left:${x}%;top:${y}%;width:${w}%;height:${h}%;z-index:${studioNum(e.z,0,200,1)};--studio-fs:${studioNum(e.fontSize,6,220,30)};--studio-color:${studioColor(e.color,'#ffffff')};--studio-fill:${fill};--studio-stroke:${studioColor(e.stroke,'#ff168f')};--studio-stroke-width:${studioNum(e.strokeWidth,0,20,0)}px;--studio-radius:${studioNum(e.radius,0,100,8)}px;--studio-opacity:${studioNum(e.opacity,0,100,100)/100};--studio-font:${font};--studio-weight:${studioNum(e.fontWeight,100,1000,900)};--studio-align:${['left','center','right'].includes(e.align)?e.align:'center'};--studio-justify:${e.align==='left'?'flex-start':e.align==='right'?'flex-end':'center'};--studio-letter:${studioNum(e.letterSpacing,-8,20,0)}px;--studio-rotation:${studioNum(e.rotation,-180,180,0)}deg;--studio-valign:${e.valign==='top'?'flex-start':e.valign==='bottom'?'flex-end':'center'};--studio-transform:${['uppercase','lowercase','capitalize'].includes(e.textTransform)?e.textTransform:'none'};--studio-shadow:${e.shadow===false?'none':'0 2px 9px #0008'};`;
  const content=e.type==='shape'?studioShapeMarkup(e):e.type==='image'&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(String(e.imageData||''))?`<img src="${e.imageData}" alt="" style="width:100%;height:100%;object-fit:${['cover','contain','fill'].includes(e.imageFit)?e.imageFit:'cover'};object-position:${studioNum(e.imagePositionX,0,100,50)}% ${studioNum(e.imagePositionY,0,100,50)}%">`:e.type==='text'?`<span>${esc(e.text||e.label||'')}</span>`:studioDataMarkup(e,m,i,batting,bw);
  return `<div class="jlStudioItem ${e.type==='shape'?'isShape':''} ${e.type==='text'?'isText':''}" data-studio-id="${esc(e.id||'')}" style="${css}">${content}</div>`;
 }).join('')}</div>`;
 const root=layer.querySelector('.jlStudioRoot');
 const background=typeof template.backgroundImage==='string' && template.backgroundImage.length<=600000 && /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(template.backgroundImage) ? template.backgroundImage : '';
 if(root && background){root.style.backgroundImage=`url("${background}")`;root.style.backgroundSize=template.backgroundFit==='stretch'?'100% 100%':(template.backgroundFit==='contain'?'contain':'cover');root.style.backgroundPosition=`${studioNum(template.backgroundPositionX,0,100,50)}% ${studioNum(template.backgroundPositionY,0,100,50)}%`;root.style.backgroundRepeat='no-repeat';}
}


function studioOverlayTemplateMarkup(template,m,{kind='card',card=null,event=null}={}){
 if(!template||!Array.isArray(template.elements))return '';
 const i=m.activeInnings||{},batting=teamMeta(i.battingId??m.teamA,m,'BAT'),bw=i.bowlStats?.[i.currentBowler];
 const width=studioNum(template.width,400,4000,kind==='card'?1100:1200),height=studioNum(template.height,180,2400,620);
 const items=template.elements.filter(e=>!e.hidden).slice(0,100).sort((a,c)=>(Number(a.z)||0)-(Number(c.z)||0));
 const background=typeof template.backgroundImage==='string'&&template.backgroundImage.length<=600000&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(template.backgroundImage)?template.backgroundImage:'';
 return `<div class="jlStudioRoot jlStudioOverlayRoot jlStudio${kind==='card'?'Card':'Animation'}Root" style="--studio-width:${width};aspect-ratio:${width}/${height};${background?`background-image:url('${background}')`:''};background-size:${['contain','stretch','cover'].includes(template.backgroundFit)?(template.backgroundFit==='stretch'?'100% 100%':template.backgroundFit):'contain'};background-position:${studioNum(template.backgroundPositionX,0,100,50)}% ${studioNum(template.backgroundPositionY,0,100,50)}%">${items.map(e=>{
  const x=studioNum(e.x,0,100,0),y=studioNum(e.y,0,100,0),w=studioNum(e.w,1,100,10),h=studioNum(e.h,1,100,20),font=studioFont(e.fontFamily);
  const fill=e.fillMode==='gradient'?`linear-gradient(${studioNum(e.gradientAngle,0,360,110)}deg,${studioColor(e.fill,'#241654')},${studioColor(e.fill2,'#ff168f')})`:e.fill==='transparent'?'transparent':studioColor(e.fill,'#171033');
  const css=`left:${x}%;top:${y}%;width:${w}%;height:${h}%;z-index:${studioNum(e.z,0,200,1)};--studio-fs:${studioNum(e.fontSize,6,220,30)};--studio-color:${studioColor(e.color,'#ffffff')};--studio-fill:${fill};--studio-stroke:${studioColor(e.stroke,'#ff168f')};--studio-stroke-width:${studioNum(e.strokeWidth,0,30,0)}px;--studio-radius:${studioNum(e.radius,0,100,8)}px;--studio-opacity:${studioNum(e.opacity,0,100,100)/100};--studio-font:${font};--studio-weight:${studioNum(e.fontWeight,100,1000,900)};--studio-align:${['left','center','right'].includes(e.align)?e.align:'center'};--studio-justify:${e.align==='left'?'flex-start':e.align==='right'?'flex-end':'center'};--studio-letter:${studioNum(e.letterSpacing,-8,30,0)}px;--studio-rotation:${studioNum(e.rotation,-180,180,0)}deg;--studio-valign:${e.valign==='top'?'flex-start':e.valign==='bottom'?'flex-end':'center'};--studio-transform:${['uppercase','lowercase','capitalize'].includes(e.textTransform)?e.textTransform:'none'};--studio-shadow:${e.shadow===false?'none':'0 2px 9px #0008'};`;
  const content=e.type==='shape'?studioShapeMarkup(e):e.type==='image'&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(String(e.imageData||''))?`<img src="${e.imageData}" alt="" style="width:100%;height:100%;object-fit:${['cover','contain','fill'].includes(e.imageFit)?e.imageFit:'cover'};object-position:${studioNum(e.imagePositionX,0,100,50)}% ${studioNum(e.imagePositionY,0,100,50)}%">`:e.type==='text'?`<span>${esc(e.text||e.label||'')}</span>`:studioDataMarkup(e,m,i,batting,bw,{card,event});
  const anim=String(e.animationType||template.animationPreset||'none');const animClass=['slideUp','slideDown','slideLeft','slideRight','fade','zoom','pop','bounce','flip','rotate','wipe','flash','glitch','blur','fireworks','spark','slam','shatter','orbit','spotlight'].includes(anim)&&anim!=='none'?`jlStudioMotion-${anim}`:'';
  return `<div class="jlStudioItem ${e.type==='shape'?'isShape':''} ${e.type==='text'?'isText':''} ${animClass}" style="${css}">${content}</div>`;
 }).join('')}</div>`;
}
function selectedStudioOverlay(design){
 if(!design?.enabled||!design.template||!Array.isArray(design.template.elements))return null;
 return design.template;
}

function renderBar(m,b){
 const i=m.activeInnings;if(!i)return;
 const layer=document.getElementById('scoreBar');
 const savedStudio=studioTemplate(b?.studioDesign);
 if(savedStudio){renderStudioBar(layer,m,b,savedStudio);return;}
 layer.dataset.studio='false';
 const layout=Math.max(1,Math.min(20,Number(b.layer)||1)),color=Math.max(1,Math.min(10,Number(b.color)||1));
 layer.className=`scoreBar layer${layout} jlCompactPattern color${color}${layout<=7?` referenceEra${layout}`:''}`;layer.dataset.layout=String(layout);layer.dataset.family='compact';layer.dataset.color=String(color);
 const referenceAccents={1:'#00c7dc',2:'#d6b34b',3:'#8c9daa',4:'#23a4da',5:'#e81d87',6:'#df2e8c',7:'#138d45'};
 layer.style.setProperty('--accent',layout<=7?referenceAccents[layout]:(accentByColor[color]||accentByColor[1]));
 applyScoreDesign(b.design||{});
 const battingId=i.battingId??m.teamA;
 const batting=teamMeta(battingId,m,'BAT');
 const s=i.batStats?.[i.striker],n=i.batStats?.[i.nonStriker],bw=i.bowlStats?.[i.currentBowler];
 const runs=Number(i.score)||0,wickets=Number(i.wickets)||0,balls=Number(i.balls)||0;
 const overs=fmtOvers(balls);
 const target=Number(i.target)||0;
 const activePowerplay=String(i.powerplay||'').trim().toUpperCase();
 const batLine=(p,kind)=>`<div class="jlBatterRow ${kind==='striker'?'isStriker':'isNonStriker'}"><span class="jlStrikeIcon" aria-label="${kind==='striker'?'On strike':''}">${kind==='striker'?'🏏':''}</span><b class="jlBatterName ${String(p?.name||'').length>15?'isLong':''}">${esc(p?.name||(kind==='striker'?'—':'—'))}</b><span class="jlBatterStats"><strong class="jlBatterRuns">${Number(p?.runs)||0}${kind==='striker'?'*':''}</strong><small class="jlBatterBalls">(${Number(p?.balls)||0})</small></span></div>`;
 const deliveries=overEvents(i.events||[]).map(e=>{const d=deliveryInfo(e);return `<span class="jlBallChip ${d.cls}" title="${esc(d.title)}">${d.label}</span>`}).join('');
 const bowlerOvers=bw?fmtOvers(bw.balls||0):'0.0';
 const bowlerRuns=Number(bw?.runs)||0,bowlerWickets=Number(bw?.wickets)||0;
 const targetBadge=target>0?`<span class="jlTargetBadge">TARGET ${target}</span>`:'';
 const pp=['P1','P2','P3'].map(pp=>`<span class="jlPhaseTag ${activePowerplay===pp?'isActive':''}">${pp}</span>`).join('');
 layer.innerHTML=`
  <div class="jlBatters">
   ${compactLogo(batting)}
   <div class="jlBatterList">${batLine(s,'striker')}${batLine(n,'nonStriker')}</div>
  </div>
  <div class="jlScoreWrap">
   <div class="jlScoreTop">${targetBadge}<div class="jlPowerplayGroup">${pp}</div></div>
   <div class="jlScoreMain"><strong class="jlRuns">${runs}</strong><span class="jlSlash">/</span><strong class="jlWickets">${wickets}</strong><span class="jlOversValue">${overs}</span></div>
  </div>
  <div class="jlBowler">
   <b class="jlBowlerName ${String(bw?.name||'').length>15?'isLong':''}">${esc(bw?.name||'—')}</b>
   <strong class="jlBowlerFigures">${bowlerOvers} – ${bowlerRuns} – ${bowlerWickets}</strong>
  </div>
  <div class="jlBalls"><div class="jlBallRail">${deliveries||'<span class="jlBallEmpty">—</span>'}</div></div>`;
}


function tableRows(players,kind){
 if(!players?.length)return '<tr><td colspan="8" class="emptyCell">No player figures recorded yet.</td></tr>';
 if(kind==='batting')return players.map(p=>`<tr><td>${esc(p.name)}${p.isStriker?' *':p.isNonStriker?' †':''}</td><td>${p.notBatted?'Did not bat':p.out?esc(p.howOut||'Out'):p.retired?(p.retiredReason==='Substituted'?'Substituted': 'Retired Hurt'):'not out'}</td><td>${p.runs||0}</td><td>${p.balls||0}</td><td>${p.fours||0}</td><td>${p.sixes||0}</td><td>${p.balls?((p.runs||0)/(p.balls||1)*100).toFixed(2):'0.00'}</td></tr>`).join('');
 return players.map(p=>`<tr><td>${esc(p.name)}</td><td>${fmtOvers(p.balls||0)}</td><td>${p.maidens||0}</td><td>${p.runs||0}</td><td>${p.wickets||0}</td><td>${p.wides||0}</td><td>${p.noBalls||0}</td><td>${p.balls?(p.runs/(p.balls/6)).toFixed(2):'0.00'}</td></tr>`).join('');
}
function cardMarkup(card,m){
 const x=card?.data||{},type=card?.type||'batter',i=m.activeInnings||{};
 const inningsLine=`${x.score??i.score??0}/${x.wickets??i.wickets??0} · ${fmtOvers(x.balls??i.balls??0)} overs`;
 const header=`<div class="broadcastCardHead"><span>JANGID CRICINFO</span><small>LIVE BROADCAST GRAPHICS</small></div>`;
 if(type==='teamBatting'){
   const batPlayers=(x.players||[]).filter(p=>p);
   return `${header}<div class="broadcastCardTitle"><div class="cardEyebrow">FULL INNINGS BATTING CARD</div><h1>${esc(x.teamName||x.name||'Batting Team')}</h1><strong>${x.score||0}/${x.wickets||0}</strong><span>${fmtOvers(x.balls||0)} overs · CRR ${x.runRate||'0.00'}</span></div><div class="broadcastTableWrap"><table class="broadcastTable battingTable"><thead><tr><th>Batter</th><th>Status</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${tableRows(batPlayers,'batting')}</tbody></table></div><div class="broadcastCardFoot"><span>Extras ${x.extras?.total||0} (WD ${x.extras?.wide||0} · NB ${x.extras?.noBall||0} · LB ${x.extras?.legBye||0} · B ${x.extras?.bye||0})</span><span>PARTNERSHIP ${x.partnership?.runs||0} runs · ${x.partnership?.balls||0} balls</span><span>TOTAL ${x.score||0}/${x.wickets||0}</span></div><div class="broadcastFow">FALL OF WICKETS · ${(x.fallOfWickets||[]).map(f=>`${f.wicket}-${f.score} (${esc(f.batter)})`).join(' · ')||'—'}</div>`;
 }
 if(type==='teamBowling'){
   const bowlPlayers=(x.players||[]).filter(p=>p);
   return `${header}<div class="broadcastCardTitle"><div class="cardEyebrow">FULL TEAM BOWLING CARD</div><h1>${esc(x.teamName||x.name||'Bowling Team')}</h1><span>Opposition ${inningsLine}</span></div><div class="broadcastTableWrap"><table class="broadcastTable bowlingTable"><thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>WD</th><th>NB</th><th>ECON</th></tr></thead><tbody>${tableRows(bowlPlayers,'bowling')}</tbody></table></div><div class="broadcastCardFoot"><span>Team economy · ${x.balls?(x.score/(x.balls/6)).toFixed(2):'0.00'}</span><span>JANGID CRICINFO</span></div>`;
 }
 if(type==='chase'){
  const need=Math.max(0,Number(x.runsNeeded??((Number(i.target)||0)-(Number(i.score)||0)))),left=Math.max(0,Number(x.ballsRemaining??((Number(m.oversLimit)||0)*6-(Number(i.balls)||0))));
  const rrr=x.rrr??(left?(need/(left/6)).toFixed(2):'0.00');
  return `${header}<div class="chaseGraphicCard"><div class="chaseGraphicTitle">${esc(x.name||'RUNS NEEDED')}</div><div class="chaseGraphicEquation"><strong>${need}</strong><span>RUNS NEEDED</span><i>IN</i><strong>${left}</strong><span>BALLS REMAINING</span></div><div class="chaseGraphicMeta"><span>TARGET <b>${Number(x.target||i.target||0)}</b></span><span>CRR <b>${esc(x.runRate||'0.00')}</b></span><span>RRR <b>${esc(String(rrr))}</b></span></div><div class="chaseGraphicFooter">${esc(x.teamName||'Batting Team')} · ${Number(x.score??i.score??0)}/${Number(x.wickets??i.wickets??0)}</div></div>`;
 }
 if(type==='batter'){
  const p=x.player||{};return `${header}<div class="playerFeature batterFeature"><div class="playerFeatureLabel">BATTER AT THE CREASE</div><div class="playerMedallion">🏏</div><h1>${esc(x.name||'Batter')}</h1><div class="playerTeamLabel">${esc(x.teamName||'')}</div><div class="playerBigStat">${p.runs||0}<small> RUNS</small></div><div class="playerMiniStats"><span>${p.balls||0}<small>BALLS</small></span><span>${p.fours||0}<small>FOURS</small></span><span>${p.sixes||0}<small>SIXES</small></span><span>${p.balls?((p.runs||0)/p.balls*100).toFixed(2):'0.00'}<small>SR</small></span></div></div>`;
 }
 if(type==='bowler'){
  const p=x.player||{};return `${header}<div class="playerFeature bowlerFeature"><div class="playerFeatureLabel">CURRENT BOWLER</div><div class="playerMedallion">🎯</div><h1>${esc(x.name||'Bowler')}</h1><div class="playerTeamLabel">${esc(x.teamName||'')}</div><div class="playerBigStat">${p.wickets||0}<small> WICKETS</small></div><div class="playerMiniStats"><span>${fmtOvers(p.balls||0)}<small>OVERS</small></span><span>${p.runs||0}<small>RUNS</small></span><span>${p.maidens||0}<small>MAIDENS</small></span><span>${p.balls?(p.runs/(p.balls/6)).toFixed(2):'0.00'}<small>ECON</small></span></div></div>`;
 }
 if(type==='player'){
  const p=x.player||{};return `${header}<div class="playerFeature playerSpotlightFeature"><div class="playerFeatureLabel">PLAYER SPOTLIGHT · ${esc(x.role||'PLAYER')}</div><div class="playerMedallion">🏏</div><h1>${esc(x.name||'Player')}</h1><div class="playerTeamLabel">${esc(x.teamName||'')}</div><div class="playerBigStat">${p.runs??p.wickets??0}<small> ${p.runs!==undefined?'RUNS':'WICKETS'}</small></div><div class="playerMiniStats"><span>${p.balls||0}<small>BALLS</small></span><span>${p.fours||0}<small>FOURS</small></span><span>${p.sixes||0}<small>SIXES</small></span><span>${p.balls?((p.runs||0)/p.balls*100).toFixed(2):'0.00'}<small>SR</small></span></div></div>`;
 }
 if(type==='newBatter'||type==='nextBatter'){
  const p=x.player||{};return `${header}<div class="playerFeature nextFeature"><div class="playerFeatureLabel">${type==='newBatter'?'NEW BATTER':'NEXT BATTER'}</div><div class="playerMedallion">🏏</div><h1>${esc(x.name||'Batter')}</h1><div class="playerTeamLabel">${esc(x.teamName||'')}</div><p>Ready to take the crease</p><div class="playerMiniStats"><span>${p.runs||0}<small>RUNS</small></span><span>${p.balls||0}<small>BALLS</small></span></div></div>`;
 }
 if(type==='newBowler'){
  const p=x.player||{};return `${header}<div class="playerFeature bowlerFeature"><div class="playerFeatureLabel">NEW BOWLER</div><div class="playerMedallion">🎯</div><h1>${esc(x.name||'Bowler')}</h1><div class="playerTeamLabel">${esc(x.teamName||'')}</div><div class="playerMiniStats"><span>${fmtOvers(p.balls||0)}<small>OVERS</small></span><span>${p.runs||0}<small>RUNS</small></span><span>${p.wickets||0}<small>WICKETS</small></span><span>${p.maidens||0}<small>MAIDENS</small></span></div></div>`;
 }
 if(type==='inningsBreak'){
  return `${header}<div class="playerFeature inningsBreakFeature"><div class="playerMedallion">⏸</div><div class="playerFeatureLabel">INNINGS BREAK</div><h1>${esc(x.teamName||x.name||'Batting Team')}</h1><div class="playerBigStat">${x.score||0}/${x.wickets||0}</div><div class="playerTeamLabel">${fmtOvers(x.balls||0)} overs completed</div>${x.target?`<p>Target: ${Number(x.target)}</p>`:''}</div>`;
 }
 if(type==='partnership')return `${header}<div class="playerFeature partnershipFeature"><div class="playerFeatureLabel">CURRENT PARTNERSHIP</div><h1>${esc(x.striker?.name||'Striker')} <small>&</small> ${esc(x.nonStriker?.name||'Non-striker')}</h1><div class="playerBigStat">${x.runs||0}<small> RUNS</small></div><div class="playerMiniStats"><span>${x.balls||0}<small>BALLS</small></span><span>${esc(x.teamName||'')}</span></div></div>`;
 return `${header}<div class="playerFeature resultFeature"><div class="playerMedallion">🏆</div><div class="playerFeatureLabel">MATCH RESULT</div><h1>${esc(x.name||m.result||'Match Result')}</h1><div class="playerBigStat">${x.score??i.score??0}/${x.wickets??i.wickets??0}</div><div class="playerTeamLabel">JANGID CRICINFO</div></div>`;
}

async function loadSponsorLibrary(version=''){
 if(sponsorLibraryRequested&&String(version||'')===String(sponsorLibraryVersion||''))return;
 sponsorLibraryRequested=true;
 try{const r=await fetch('/api/public/sponsor-library?v='+encodeURIComponent(version||''),{cache:'no-store'});if(!r.ok)throw new Error('Sponsor library unavailable');const j=await r.json();sponsorLibrary=Array.isArray(j.sponsors)?j.sponsors.filter(x=>x&&x.published===true):[];sponsorLibraryVersion=String(j.updatedAt||version||'');if(latestMatch)processSponsorBroadcast(latestMatch,latestBroadcast,true);}
 catch(e){console.warn('Sponsor Library could not load:',e);sponsorLibraryRequested=false;}
}
function sponsorMarkup(s,reason){
 const logo=/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(String(s.logoData||''))?s.logoData:'';
 return `<div class="jcSponsorFrame position-${esc(s.position||'center')} style-${esc(s.style||'gold')} anim-${esc(s.animation||'reveal')}" data-reason="${esc(reason||'manual')}"><div class="jcSponsorEnergy" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>${logo?`<div class="jcSponsorLogoBox"><img src="${logo}" alt="${esc(s.name)}"></div>`:''}<div class="jcSponsorCopy"><div class="jcSponsorEyebrow">PROUD SPONSOR</div><div class="jcSponsorName">${esc(s.name||'Sponsor')}</div>${s.tagline?`<div class="jcSponsorTagline">${esc(s.tagline)}</div>`:''}</div><div class="jcSponsorSweep" aria-hidden="true"></div></div>`;
}
function clearSponsorTimer(){if(sponsorHideTimer){clearTimeout(sponsorHideTimer);sponsorHideTimer=null;}}
function hideSponsorLayer(){const el=document.getElementById('sponsorLayer');clearSponsorTimer();sponsorVisible=false;if(el){el.classList.remove('isVisible','isExiting');el.style.display='none';el.innerHTML='';}}
function canShowSponsor(){const cardEl=document.getElementById('cardLayer');return !eventVisible&&!(cardEl?.classList.contains('isVisible')&&cardEl.style.display!=='none');}
function showSponsorNow(s,reason='manual'){
 const el=document.getElementById('sponsorLayer');if(!el||!s)return false;
 if(!canShowSponsor()){pendingSponsor={sponsor:s,reason};return false;}
 clearSponsorTimer();sponsorVisible=true;pendingSponsor=null;el.innerHTML=sponsorMarkup(s,reason);el.className='jcSponsorLayer';el.dataset.animation=String(s.animation||'reveal');el.style.setProperty('--jc-sponsor-intro',`${Math.max(300,Number(s.introMs)||1100)}ms`);el.style.setProperty('--jc-sponsor-outro',`${Math.max(200,Number(s.outroMs)||700)}ms`);el.style.display='grid';requestAnimationFrame(()=>el.classList.add('isVisible'));
 const intro=Math.max(300,Number(s.introMs)||1100),hold=Math.max(1000,Number(s.holdMs)||5000),outro=Math.max(200,Number(s.outroMs)||700);
 sponsorHideTimer=setTimeout(()=>{if(!sponsorVisible)return;el.classList.add('isExiting');sponsorHideTimer=setTimeout(()=>{hideSponsorLayer();flushPendingSponsor()},outro);},intro+hold);
 return true;
}
function flushPendingSponsor(){if(!pendingSponsor||!canShowSponsor())return;const next=pendingSponsor;pendingSponsor=null;showSponsorNow(next.sponsor,next.reason);}
function queueSponsor(s,reason){if(!s)return;if(!canShowSponsor()){pendingSponsor={sponsor:s,reason};return;}showSponsorNow(s,reason);}
function processSponsorBroadcast(m,b,fromLibrary=false){
 const cfg=b?.sponsorDisplay||{};
 if(!cfg.enabled){pendingSponsor=null;hideSponsorLayer();return;}
 if(!sponsorLibrary.length){if(!sponsorLibraryRequested)loadSponsorLibrary(b?.sponsorLibraryUpdatedAt||b?.sponsorDisplayUpdatedAt||'');return;}
 const baseIndex=sponsorLibrary.findIndex(x=>String(x.id)===String(cfg.sponsorId));if(baseIndex<0)return;
 if(sponsorRotationBase!==String(cfg.sponsorId)){sponsorRotationBase=String(cfg.sponsorId);sponsorRotationIndex=baseIndex;}
 const chooseSponsor=(advance=false)=>{
  if(!cfg.rotate)return sponsorLibrary[baseIndex];
  if(advance){const selected=sponsorLibrary[((sponsorRotationIndex% sponsorLibrary.length)+sponsorLibrary.length)%sponsorLibrary.length];sponsorRotationIndex=(sponsorRotationIndex+1)%sponsorLibrary.length;return selected;}
  return sponsorLibrary[baseIndex];
 };
 const allowedSponsors=cfg.rotate?sponsorLibrary:sponsorLibrary.slice(baseIndex,baseIndex+1);
 const shouldTrigger=key=>allowedSponsors.some(x=>(x.triggers||[]).includes(key));
 const cue=(reason)=>queueSponsor(chooseSponsor(true),reason);
 const manual=String(cfg.manualToken||'');if(manual&&manual!==lastSponsorManualToken){lastSponsorManualToken=manual;cue('manual');}
 const timeout=String(cfg.timeoutToken||'');if(timeout&&timeout!==lastSponsorTimeoutToken){lastSponsorTimeoutToken=timeout;cue('timeout');}
 if(cfg.autoEnabled){
  const innings=Number(m?.inningsNo||m?.activeInnings?.number||1),over=Math.floor(Math.max(0,Number(m?.activeInnings?.balls)||0)/6),status=String(m?.status||'');
  if(sponsorAutoState.matchId!==String(m?.id||'')){
   sponsorAutoState={matchId:String(m?.id||''),innings,over,status};
   const startedAt=Date.parse(m?.startedAt||m?.createdAt||'')||0;
   const justStarted=!startedAt||Date.now()-startedAt<120000;
   if(status==='live'&&justStarted&&shouldTrigger('matchStart'))cue('matchStart');
  }else{
   if(innings>sponsorAutoState.innings&&shouldTrigger('inningsBreak'))cue('inningsBreak');
   const interval=Math.max(1,Number(cfg.intervalOvers||5));
   if(over>sponsorAutoState.over&&over%interval===0&&shouldTrigger('overInterval'))cue('overInterval');
   if(status==='finished'&&sponsorAutoState.status!=='finished'&&shouldTrigger('matchResult'))cue('matchResult');
   sponsorAutoState={matchId:String(m?.id||''),innings:Math.max(innings,sponsorAutoState.innings),over:Math.max(over,sponsorAutoState.over),status};
  }
 }
 if(!eventVisible&&!(document.getElementById('cardLayer')?.classList.contains('isVisible')))flushPendingSponsor();
}

function incomingCornerMarkup(eventName,meta={}){
 const p=meta.eventPlayer||{};const label=eventName==='NEW BOWLER'?'NEXT BOWLER':'NEW BATTER';
 const name=String(p.name||'Player selection pending');const team=String(p.teamName||'');
 const detail=eventName==='NEW BOWLER'?`${fmtOvers(p.balls||0)} OV · ${Number(p.wickets||0)} W · ${Number(p.runs||0)} RUNS`:`${Number(p.runs||0)} RUNS · ${Number(p.balls||0)} BALLS`;
 return `<div class="incomingPlayerToast ${eventName==='NEW BOWLER'?'isBowler':'isBatter'}"><span class="incomingKicker">${label}</span><b>${esc(name)}</b><small>${esc(team)}</small><em>${detail}</em></div>`;
}
function renderEvent(b){
 const el=document.getElementById('eventLayer'),cardEl=document.getElementById('cardLayer');
 if(!b.event){clearTimeout(el._hide);eventVisible=false;el.style.display='none';el.innerHTML='';el.classList.remove('incomingCornerLayer');lastEventId=b.eventId??lastEventId;if(!cardEl.classList.contains('isVisible'))flushPendingSponsor();return}
 if(String(b.eventId??'')===String(lastEventId??'')){if(eventVisible){el.style.display='grid';cardEl.style.display='none'}return}
 clearTimeout(el._hide);lastEventId=b.eventId;eventVisible=true;hideSponsorLayer();
 if(cardEl.classList.contains('isVisible')){dismissedCardId=String(latestBroadcast?.cardId??'');cardEl.classList.remove('isVisible');cardEl.style.display='none';cardEl.innerHTML='';document.body.classList.remove('cardActive')}
 const eventName=String(b.event||'').toUpperCase();const corner=['NEW BATSMAN','NEW BOWLER'].includes(eventName);
 const animationTemplate=!corner?selectedStudioOverlay(b.animationDesign):null;
 if(corner){el.innerHTML=incomingCornerMarkup(eventName,b);el.className=`eventLayer incomingCornerLayer ${eventName==='NEW BOWLER'?'isBowler':'isBatter'}`;el.dataset.anim=b.animation||'fade';}
 else if(eventName==='WICKET'&&b.wicketDetails){const d=b.wicketDetails;el.innerHTML=`<div class="eventInner wicketEventInner detailedWicketEvent"><div class="eventTitle">WICKET</div><b class="eventPlayerName">${esc(d.batter||'Batter')}</b><div class="eventSub">${esc(d.dismissal||'OUT')}</div><small>${esc(d.bowler||'')} ${d.fielder?` · ${esc(d.fielder)}`:''}</small></div>`;el.className='eventLayer style-wicket';el.dataset.anim=b.animation||'slam';}
 else{el.innerHTML=animationTemplate?studioOverlayTemplateMarkup(animationTemplate,latestMatch||{}, {kind:'animation',event:b.event}):eventMarkup(b.event,b);el.className=`eventLayer style-${String(b.eventStyle||'generic').toLowerCase().replace(/\s+/g,'')}${animationTemplate?' studioAnimationEvent':''}`;el.dataset.anim=b.eventAnimations?.[b.event]||b.animation||'zoom';}
 el.dataset.eventType=eventName.toLowerCase().replace(/\s+/g,'-');el.style.animationDuration=`${b.duration||2200}ms`;el.style.display='grid';const inner=el.querySelector('.eventInner,.jlStudioOverlayRoot,.incomingPlayerToast');if(inner)inner.style.animationDuration=`${b.duration||2200}ms`;
 el._hide=setTimeout(()=>{eventVisible=false;el.style.display='none';el.innerHTML='';el.classList.remove('incomingCornerLayer');if(!cardEl.classList.contains('isVisible'))flushPendingSponsor()},Math.max(900,Number(b.duration||2200)-50));
}
function renderCard(b,m){
 const el=document.getElementById('cardLayer'),card=b.card;
 const currentCardId=String(b.cardId??'');
 if(card && dismissedCardId!==null && currentCardId===dismissedCardId){el.classList.remove('isVisible');el.style.display='none';el.innerHTML='';document.body.classList.remove('cardActive');return;}
 if(card && dismissedCardId!==null && currentCardId!==dismissedCardId)dismissedCardId=null;
 if(!card){el.classList.remove('isVisible');el.style.display='none';el.innerHTML='';el.removeAttribute('data-anim');lastCardId=null;document.body.classList.remove('cardActive');flushPendingSponsor();return}
 hideSponsorLayer();
 const type=card.type||'batter',newCard=String(b.cardId??'')!==String(lastCardId),anim=b.cardAnimations?.[type]||b.cardAnimation||'zoom';
 const cardTemplate=selectedStudioOverlay(b.cardDesign);
 el.className=`cardLayer cardType-${type}${cardTemplate?' hasStudioCard':''}`;el.style.setProperty('--accent',getComputedStyle(document.getElementById('scoreBar')).getPropertyValue('--accent')||'#58c8ff');
 const custom=cardTemplate?studioOverlayTemplateMarkup(cardTemplate,m,{kind:'card',card}):cardMarkup(card,m);
 el.innerHTML=`<div class="broadcastCardStage${newCard?' cardEntering':''}${cardTemplate?' studioCardStage':''}" data-anim="${esc(anim)}" style="animation-duration:${Number(b.cardDurations?.[type]||b.cardDuration||1800)}ms">${custom}</div>`;
 el.dataset.anim=anim;el.classList.add('isVisible');el.style.display=eventVisible?'none':'grid';document.body.classList.add('cardActive');if(newCard)lastCardId=b.cardId??Date.now();
}

function render(m,b){if(!m?.activeInnings)return;latestMatch=m;latestBroadcast=b||{};renderBar(m,b||{});renderCard(b||{},m);renderEvent(b||{});processSponsorBroadcast(m,b||{});lastRenderMatchId=m.id;}
async function loadOwnerBroadcast(userId,version){
 if(!userId)return;
 if(ownerBroadcastUserId===String(userId)&&ownerBroadcastRequestedVersion===String(version||''))return;
 ownerBroadcastUserId=String(userId);ownerBroadcastRequestedVersion=String(version||'');
 try{
  const response=await fetch(`/api/public/broadcast/${encodeURIComponent(userId)}?v=${encodeURIComponent(version||'')}`,{cache:'no-store'});
  if(!response.ok)throw new Error(`Broadcast config request failed (${response.status})`);
  const payload=await response.json();
  if(payload.ok){ownerBroadcast=payload.broadcast||{};ownerBroadcastVersion=[ownerBroadcast.studioDesignUpdatedAt,ownerBroadcast.cardDesignUpdatedAt,ownerBroadcast.animationDesignUpdatedAt].join('|');if(latestMatch&&String(latestMatch.userId)===String(userId))render(latestMatch,{...ownerBroadcast,...latestSSEBroadcast});}
 }catch(error){console.warn('Could not load uploaded Score Layer layout:',error);ownerBroadcastRequestedVersion='';}
}
function boot(){
 const es=new EventSource('/events');
 es.onmessage=e=>{
  try{
   const d=JSON.parse(e.data);
   const candidates=(d.activeMatches||[]).filter(x=>(x.status==='live'||(x.status==='finished'&&owner&&x.userId===owner))&&(!owner||x.userId===owner));
   const requested=q.get('match');
   const m=requested?candidates.find(x=>x.id===requested):candidates[0];
   if(!m){const bar=document.getElementById('scoreBar');if(requested)bar.innerHTML='';return;}
   latestMatch=m;
   const incoming={...(d.broadcasts?.[m.userId]||{})};
   latestSSEBroadcast=incoming;
   const version=[incoming.studioDesignUpdatedAt,incoming.cardDesignUpdatedAt,incoming.animationDesignUpdatedAt].join('|');
   const sponsorVersion=String(incoming.sponsorLibraryUpdatedAt||incoming.sponsorDisplayUpdatedAt||'');if(sponsorVersion!==sponsorLibraryVersion&&!sponsorLibraryRequested)loadSponsorLibrary(sponsorVersion);
   const hasStudio=!!(incoming.hasStudioDesign||incoming.hasCardDesign||incoming.hasAnimationDesign);
   delete incoming.hasStudioDesign;delete incoming.hasCardDesign;delete incoming.hasAnimationDesign;
   if(version!==ownerBroadcastVersion||String(m.userId)!==ownerBroadcastUserId){
    if(hasStudio)loadOwnerBroadcast(m.userId,version);
    else {ownerBroadcast={};ownerBroadcastVersion=version;ownerBroadcastRequestedVersion=version;ownerBroadcastUserId=String(m.userId);}
   }
   render(m,{...ownerBroadcast,...incoming});
  }catch(err){console.error(err)}
 };
}
boot();
