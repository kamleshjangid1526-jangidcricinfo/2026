/* Jangid Cricinfo — no-code Scoreboard Design Studio (local/Firestore-ready data contract). */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const FONT_MAP = {
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    arial: 'Arial, Helvetica, sans-serif',
    condensed: '"Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", sans-serif',
    trebuchet: '"Trebuchet MS", sans-serif',
    georgia: 'Georgia, serif',
    mono: '"Courier New", Consolas, monospace',
    impact: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif'
  };
  const RESOLUTIONS = {
    '1920x1080': { label: '1920 × 1080 · Full HD', ratio: '16 / 9' },
    '1280x720': { label: '1280 × 720 · HD', ratio: '16 / 9' },
    '2560x1440': { label: '2560 × 1440 · QHD', ratio: '16 / 9' },
    '1080x1920': { label: '1080 × 1920 · Vertical', ratio: '9 / 16' }
  };
  const DATA_ITEMS = [
    ['teamLogo','Batting Team Logo','Teams'],['battingTeam','Batting Team Name','Teams'],['bowlingTeam','Bowling Team Name','Teams'],['teamA','Team A Name','Teams'],['teamB','Team B Name','Teams'],
    ['batter1','Striker Full Card','Batters'],['strikerName','Striker Name','Batters'],['strikerRuns','Striker Runs','Batters'],['strikerBalls','Striker Balls','Batters'],['strikerFours','Striker Fours','Batters'],['strikerSixes','Striker Sixes','Batters'],['strikerSR','Striker Strike Rate','Batters'],
    ['batter2','Non-Striker Full Card','Batters'],['nonStrikerName','Non-Striker Name','Batters'],['nonStrikerRuns','Non-Striker Runs','Batters'],['nonStrikerBalls','Non-Striker Balls','Batters'],['nonStrikerFours','Non-Striker Fours','Batters'],['nonStrikerSixes','Non-Striker Sixes','Batters'],['nonStrikerSR','Non-Striker Strike Rate','Batters'],
    ['score','Team Score / Wickets','Match'],['totalRuns','Total Runs','Match'],['wickets','Wickets','Match'],['overs','Overs','Match'],['innings','Innings Number','Match'],['phase','Powerplay / Phase','Match'],['matchStatus','Match Status','Match'],['target','Target','Chase'],['runsRequired','Runs Required','Chase'],['ballsRemaining','Balls Remaining','Chase'],['crr','Current Run Rate (CRR)','Chase'],['rrr','Required Run Rate (RRR)','Chase'],
    ['partnership','Partnership Full','Partnership'],['partnershipRuns','Partnership Runs','Partnership'],['partnershipBalls','Partnership Balls','Partnership'],
    ['bowlerName','Bowler Name','Bowler'],['bowlerFigures','Bowler Figures','Bowler'],['bowlerOvers','Bowler Overs','Bowler'],['bowlerRuns','Bowler Runs','Bowler'],['bowlerWickets','Bowler Wickets','Bowler'],['bowlerMaidens','Bowler Maidens','Bowler'],['bowlerEconomy','Bowler Economy','Bowler'],
    ['balls','Current Over Ball-by-Ball','Extras & Balls'],['lastOver','Last Over Summary','Extras & Balls'],['extras','Total Extras','Extras & Balls'],['wideRuns','Wide Runs','Extras & Balls'],['noBallRuns','No-ball Runs','Extras & Balls'],['byeRuns','Bye Runs','Extras & Balls'],['legByeRuns','Leg-bye Runs','Extras & Balls'],['lastWicket','Last Wicket','Extras & Balls'],['fallOfWickets','Fall of Wickets Summary','Extras & Balls'],['brand','Jangid Cricinfo Brand','Brand'],['cardTitle','Card Title','Card Data'],['eventName','Event Name / FOUR / SIX / WICKET','Card Data'],['playerName','Selected Player Name','Card Data'],['playerRole','Selected Player Role','Card Data'],['playerTeam','Selected Player Team','Card Data'],['playerRuns','Selected Player Runs','Card Data'],['playerBalls','Selected Player Balls','Card Data'],['playerFours','Selected Player Fours','Card Data'],['playerSixes','Selected Player Sixes','Card Data'],['playerStrikeRate','Selected Player Strike Rate','Card Data'],['playerWickets','Selected Player Wickets','Card Data'],['playerOvers','Selected Player Overs','Card Data'],['playerEconomy','Selected Player Economy','Card Data'],['matchResult','Match Result / Winning Team','Card Data'],['partnershipStrikers','Partnership Player Names','Partnership'],['partnershipScore','Partnership Runs and Balls','Partnership']
  ];
  const SHAPE_ITEMS = [
    ['rect','Rectangle','Basic'],['roundRect','Rounded Rectangle','Basic'],['ellipse','Ellipse','Basic'],['circle','Circle','Basic'],['triangle','Triangle','Basic'],['rtTriangle','Right Triangle','Basic'],['diamond','Diamond','Basic'],['pentagon','Pentagon','Polygons'],['hexagon','Hexagon','Polygons'],['octagon','Octagon','Polygons'],['parallelogram','Parallelogram','Polygons'],['trapezoid','Trapezoid','Polygons'],['chevron','Chevron','Arrows'],['rightArrow','Right Arrow','Arrows'],['leftArrow','Left Arrow','Arrows'],['upArrow','Up Arrow','Arrows'],['downArrow','Down Arrow','Arrows'],['leftRightArrow','Left-Right Arrow','Arrows'],['upDownArrow','Up-Down Arrow','Arrows'],['star4','4-Point Star','Stars'],['star5','5-Point Star','Stars'],['star6','6-Point Star','Stars'],['star8','8-Point Star','Stars'],['heart','Heart','Special'],['lightning','Lightning Bolt','Special'],['plus','Plus','Special'],['cross','Cross','Special'],['cloud','Cloud','Callouts'],['speech','Speech Bubble','Callouts'],['callout','Rounded Callout','Callouts'],['flowProcess','Flowchart Process','Flowchart'],['flowDecision','Flowchart Decision','Flowchart'],['flowData','Flowchart Data','Flowchart'],['flowDocument','Flowchart Document','Flowchart'],['flowTerminator','Flowchart Terminator','Flowchart'],['flowPreparation','Flowchart Preparation','Flowchart'],['flowDatabase','Flowchart Database','Flowchart'],['flowStoredData','Flowchart Stored Data','Flowchart'],['flowManualInput','Flowchart Manual Input','Flowchart'],['flowDelay','Flowchart Delay','Flowchart'],['flowDisplay','Flowchart Display','Flowchart'],['flowMerge','Flowchart Merge','Flowchart'],['flowExtract','Flowchart Extract','Flowchart'],['flowSort','Flowchart Sort','Flowchart'],['flowConnector','Flowchart Connector','Flowchart'],['flowOffPage','Flowchart Off-page Connector','Flowchart'],['bentArrow','Bent Arrow','Arrows'],['uTurnArrow','U-turn Arrow','Arrows'],['notchedRightArrow','Notched Right Arrow','Arrows'],['circularArrow','Circular Arrow','Arrows'],['leftRightUpArrow','Left-Right-Up Arrow','Arrows'],['brace','Brace','Special'],['bracket','Bracket','Special'],['arc','Arc','Lines'],['line','Line','Lines'],['doubleLine','Double Line','Lines'],['freehand','Freehand Polygon','Custom']
  ];
  const ANIMATIONS = ['none','slideUp','slideDown','slideLeft','slideRight','fade','zoom','pop','bounce','flip','rotate','wipe','flash','glitch','blur','fireworks','spark','slam','shatter','orbit','spotlight'];
  const CATEGORIES = {
    score:{key:'templates',activeKey:'activeTemplateId',label:'Score Layer Designer',width:1920,height:260,description:'OBS Lower Third / Scorebar'},
    card:{key:'cardTemplates',activeKey:'activeCardTemplateId',label:'Card Designer',width:1100,height:620,description:'Player, partnership, wicket and result cards'},
    animation:{key:'animationTemplates',activeKey:'activeAnimationTemplateId',label:'Animation Designer',width:1200,height:620,description:'Event transitions and motion graphics'}
  };
  const uid = () => `el_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const safeNum = (n, min, max, fallback = 0) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : fallback));
  const safeColor = (value, fallback = '#171033') => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));

  function makeItem(type, key, label, x, y, w, h, z, extra = {}) {
    return {
      id: uid(), type, key: key || '', label, x, y, w, h, z, rotation: 0,
      hidden: false, locked: false, fontFamily: 'condensed', fontSize: type === 'shape' ? 18 : 34,
      fontWeight: 900, color: '#ffffff', fill: 'transparent', fill2: '#4b2a92', fillMode: 'solid',
      gradientAngle: 110, stroke: '#ff168f', strokeWidth: 0, opacity: 100, radius: 0,
      align: 'center', valign: 'middle', letterSpacing: 0, text: label, shapeType: 'rect', textTransform: 'none', shadow: true, shadowColor:'#000000', shadowBlur:9, animationType: 'none',
      points: [[0, 0], [100, 0], [100, 100], [0, 100]], imageData:'', imageFit:'cover', imagePositionX:50, imagePositionY:50, ...extra
    };
  }
  function defaultTemplate(name = 'World Cup Inspired', category = 'score') {
    const meta=CATEGORIES[category]||CATEGORIES.score;
    const items = category==='score' ? [
      makeItem('shape', '', 'Full background', 0, 0, 100, 100, 0, { fill: '#171033', fill2: '#25145a', fillMode: 'gradient', gradientAngle: 108, stroke: '#171033', strokeWidth: 0, shapeType: 'rect' }),
      makeItem('shape', '', 'Left angular panel', 0, 0, 35, 100, 1, { fill: '#241654', fill2: '#392075', fillMode: 'gradient', gradientAngle: 8, stroke: '#7650bb', strokeWidth: 1, shapeType: 'parallelogram' }),
      makeItem('shape', '', 'Score highlight panel', 35, 8, 32, 84, 2, { fill: '#2b1a5c', fill2: '#4a1a68', fillMode: 'gradient', gradientAngle: 120, stroke: '#ff168f', strokeWidth: 2, shapeType: 'chevron' }),
      makeItem('shape', '', 'Bowler panel', 68, 8, 32, 84, 1, { fill: '#211448', fill2: '#171033', fillMode: 'gradient', gradientAngle: 100, stroke: '#513c80', strokeWidth: 1, shapeType: 'parallelogram' }),
      makeItem('shape', '', 'Bottom accent', 0, 96, 100, 4, 3, { fill: '#ff168f', fill2: '#00a9ff', fillMode: 'gradient', gradientAngle: 0, stroke: '#ff168f', strokeWidth: 0, shapeType: 'rect' }),
      makeItem('data', 'teamLogo', 'Batting Team Logo', 1.8, 34, 4.3, 32, 5, { fontSize: 34, fill: 'transparent', color: '#ffffff', radius: 0, stroke: 'transparent', strokeWidth: 0 }),
      makeItem('data', 'batter1', 'Striker / Batter 1', 6.5, 16, 26, 32, 5, { fontSize: 34, align: 'left', fill: 'transparent', strokeWidth: 0 }),
      makeItem('data', 'batter2', 'Non-striker / Batter 2', 6.5, 51, 26, 32, 5, { fontSize: 31, align: 'left', fill: 'transparent', strokeWidth: 0 }),
      makeItem('data', 'target', 'Target', 39, 6, 18, 18, 6, { fontSize: 23, fill: 'transparent', color: '#ffffff', radius: 0, stroke: 'transparent', strokeWidth: 0 }),
      makeItem('data', 'score', 'Team Score', 39, 27, 19, 51, 6, { fontSize: 72, fontWeight: 1000, letterSpacing: -2, fill: 'transparent', align: 'center' }),
      makeItem('data', 'overs', 'Overs', 58.5, 39, 8, 28, 6, { fontSize: 32, color: '#bdeaff', fill: 'transparent' }),
      makeItem('data', 'phase', 'P1 / P2 / P3', 36.5, 82, 18, 14, 6, { fontSize: 15, fill: 'transparent' }),
      makeItem('data', 'bowlerName', 'Bowler Name', 70, 19, 27, 26, 6, { fontSize: 35, align: 'left', fill: 'transparent' }),
      makeItem('data', 'bowlerFigures', 'Bowler Figures', 70, 47, 27, 18, 6, { fontSize: 24, color: '#7edcff', align: 'left', fill: 'transparent' }),
      makeItem('data', 'balls', 'Current Over Balls', 70, 70, 28, 22, 6, { fontSize: 18, fill: 'transparent', align: 'left' })
    ] : category==='card' ? [
      makeItem('shape','','Card Background',0,0,100,100,0,{fill:'#101b31',fill2:'#273c62',fillMode:'gradient',stroke:'#55c7ff',strokeWidth:2,radius:20,shapeType:'roundRect'}),
      makeItem('shape','','Accent Band',0,0,100,15,1,{fill:'#a9288e',fill2:'#4f4cc8',fillMode:'gradient',strokeWidth:0,shapeType:'rect'}),
      makeItem('data','playerName','Player Name',6,22,60,18,3,{fontSize:48,align:'left'}),
      makeItem('data','playerRuns','Runs',6,45,25,20,3,{fontSize:64,align:'left',color:'#ffe08a'}),
      makeItem('data','playerBalls','Balls',34,48,18,14,3,{fontSize:30,align:'left'}),
      makeItem('data','playerStrikeRate','Strike Rate',57,48,22,14,3,{fontSize:28,align:'left'}),
      makeItem('data','battingTeam','Team',6,78,42,10,3,{fontSize:22,align:'left',color:'#a8dfff'}),
      makeItem('data','playerRole','Role',56,78,15,10,3,{fontSize:20,align:'left',color:'#a8dfff'})
    ] : [
      makeItem('shape','','Animation Backplate',0,0,100,100,0,{fill:'#101b31',fill2:'#283a70',fillMode:'gradient',stroke:'#56cfff',strokeWidth:2,radius:22,shapeType:'roundRect'}),
      makeItem('shape','','Glow Stripe',4,8,3,84,1,{fill:'#ff168f',fill2:'#00c8ff',fillMode:'gradient',strokeWidth:0,shapeType:'roundRect'}),
      makeItem('data','eventName','Event Title',12,22,78,35,3,{text:'SIX!',fontSize:94,color:'#ffffff',align:'center'}),
      makeItem('text','','Event Subtitle',14,62,74,14,3,{text:'MAXIMUM · BIG HIT',fontSize:28,color:'#ffe08a',align:'center'}),
      makeItem('data','battingTeam','Batting Team',14,82,35,10,3,{fontSize:20,color:'#bfe7ff',align:'left'}),
      makeItem('data','score','Current Score',55,82,30,10,3,{fontSize:20,color:'#ffe08a',align:'right'})
    ];
    return { id: uid(), category, name, width:meta.width, height:meta.height, backgroundImage: '', backgroundFit: 'contain', animationPreset:category==='animation'?'fireworks':'none', published:false, elements: items };
  }
  function freshDocument() {
    const score=defaultTemplate('World Cup Inspired','score');
    const card=defaultTemplate('Player Feature Card','card');
    const animation=defaultTemplate('Event Animation Starter','animation');
    return { version: 2, enabled: false, activeTemplateId: score.id, activeCardTemplateId:card.id, activeAnimationTemplateId:animation.id, activeCategory:'score', previewResolution: '1920x1080', templates: [score], cardTemplates:[card], animationTemplates:[animation] };
  }
  let doc = freshDocument();
  let selectedId = null, drawMode = '', drawPoints = [], drag = null, undoStack = [], undoIndex = -1, saveTimer = null, initialized = false;

  let currentCategory='score';
  function categoryList(category=currentCategory) { const meta=CATEGORIES[category]||CATEGORIES.score; return doc[meta.key] || (doc[meta.key]=[]); }
  function activeId(category=currentCategory) { const meta=CATEGORIES[category]||CATEGORIES.score; return doc[meta.activeKey]; }
  function setActiveId(id,category=currentCategory) { const meta=CATEGORIES[category]||CATEGORIES.score; doc[meta.activeKey]=id; }
  function activeTemplate() { const list=categoryList(); return list.find(t => t.id === activeId()) || list[0]; }
  function elements() { return activeTemplate()?.elements || []; }
  function selected() { return elements().find(e => e.id === selectedId) || null; }
  function setCategory(category) { if(!CATEGORIES[category])return; currentCategory=category;doc.activeCategory=category;const t=activeTemplate();selectedId=t?.elements?.[0]?.id||null;cancelDraw(false);resetHistory();renderAll();setHint(`${CATEGORIES[category].label} खुल गया। यह Design Library अलग सुरक्षित रहेगी।`); }
  function normalizeTemplates(list,category) {
    const meta=CATEGORIES[category];
    return (Array.isArray(list)?list:[]).slice(0,20).map(t => ({
      id:String(t.id||uid()),category,name:String(t.name||'My Design').slice(0,50),width:safeNum(t.width,400,4000,meta.width),height:safeNum(t.height,180,2400,meta.height),published:!!t.published,
      animationPreset:ANIMATIONS.includes(t.animationPreset)?t.animationPreset:(category==='animation'?'fireworks':'none'),
      backgroundImage:typeof t.backgroundImage==='string'&&t.backgroundImage.length<=600000&&/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(t.backgroundImage)?t.backgroundImage:'',
      backgroundFit:['cover','contain','stretch'].includes(t.backgroundFit)?t.backgroundFit:'contain',backgroundPositionX:safeNum(t.backgroundPositionX,0,100,50),backgroundPositionY:safeNum(t.backgroundPositionY,0,100,50),
      elements:Array.isArray(t.elements)?t.elements.slice(0,100).map(e=>({
        ...makeItem(e.type||'data',e.key||'',e.label||'Element',e.x,e.y,e.w,e.h,e.z,e),id:String(e.id||uid()),
        x:safeNum(e.x,0,100,0),y:safeNum(e.y,0,100,0),w:safeNum(e.w,1,100,10),h:safeNum(e.h,1,100,20),z:safeNum(e.z,0,200,1),
        rotation:safeNum(e.rotation,-180,180,0),opacity:safeNum(e.opacity,0,100,100),fontSize:safeNum(e.fontSize,6,220,30),fontWeight:safeNum(e.fontWeight,100,1000,800),
        strokeWidth:safeNum(e.strokeWidth,0,30,0),radius:safeNum(e.radius,0,100,0),letterSpacing:safeNum(e.letterSpacing,-8,30,0),shadowColor:safeColor(e.shadowColor,'#000000'),shadowBlur:safeNum(e.shadowBlur,0,30,9),
        points:Array.isArray(e.points)?e.points.slice(0,150).map(p=>[safeNum(p?.[0],0,100,0),safeNum(p?.[1],0,100,0)]):[[0,0],[100,0],[100,100],[0,100]]
      })):[]
    }));
  }
  function normaliseDocument(input) {
    if (!input || !Array.isArray(input.templates) || !input.templates.length) return freshDocument();
    const next=clone(input);next.version=2;next.enabled=!!next.enabled;
    next.templates=normalizeTemplates(next.templates,'score');
    next.cardTemplates=normalizeTemplates(next.cardTemplates,'card');
    next.animationTemplates=normalizeTemplates(next.animationTemplates,'animation');
    if(!next.cardTemplates.length)next.cardTemplates=[defaultTemplate('Player Feature Card','card')];
    if(!next.animationTemplates.length)next.animationTemplates=[defaultTemplate('Event Animation Starter','animation')];
    if(!next.templates.some(t=>t.id===next.activeTemplateId))next.activeTemplateId=next.templates[0].id;
    if(!next.cardTemplates.some(t=>t.id===next.activeCardTemplateId))next.activeCardTemplateId=next.cardTemplates[0].id;
    if(!next.animationTemplates.some(t=>t.id===next.activeAnimationTemplateId))next.activeAnimationTemplateId=next.animationTemplates[0].id;
    next.activeCategory=['score','card','animation'].includes(next.activeCategory)?next.activeCategory:'score';
    currentCategory=next.activeCategory;
    return next;
  }
  function setHint(message, isError = false) {
    const hint = $('jcStudioStatus'); if (!hint) return;
    hint.textContent = message; hint.dataset.error = isError ? 'true' : 'false';
  }
  function checkpoint() {
    const snap = JSON.stringify(activeTemplate());
    if (undoStack[undoIndex] === snap) return;
    undoStack = undoStack.slice(0, undoIndex + 1); undoStack.push(snap);
    if (undoStack.length > 60) undoStack.shift();
    undoIndex = undoStack.length - 1; updateUndoButtons();
  }
  function updateUndoButtons() {
    const undo = $('jcStudioUndo'), redo = $('jcStudioRedo');
    if (undo) undo.disabled = undoIndex <= 0;
    if (redo) redo.disabled = undoIndex >= undoStack.length - 1;
  }
  function queuePersist(message = 'Design auto-saved.') {
    window.__jcStudioDirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        if (typeof window.persistScoreboardStudio !== 'function') throw new Error('Control Board save connection is not ready.');
        await window.persistScoreboardStudio(doc);
        window.__jcStudioDirty = false;
        setHint(doc.enabled ? 'Saved and applied. This design will be used for your next matches.' : 'Draft saved. Press Save & Apply to publish it to OBS.');
      } catch (error) { setHint(`Save नहीं हुआ: ${error.message}`, true); }
    }, 450);
  }
  function setActiveTemplate(id) {
    const t = categoryList().find(x => x.id === id); if (!t) return;
    setActiveId(id); selectedId = t.elements[0]?.id || null; resetHistory(); renderAll(); queuePersist();
  }
  function resetHistory() { undoStack = []; undoIndex = -1; checkpoint(); }
  function addElement(type, key = '', label = 'New Element', extra = {}) {
    const list = elements();
    const maxZ = list.reduce((m, e) => Math.max(m, Number(e.z) || 0), 0);
    let item;
    if (type === 'shape') item = makeItem('shape', '', label, 28 + (list.length % 5) * 3, 30 + (list.length % 4) * 4, 20, 24, maxZ + 1, { fill: '#312064', fill2: '#ff168f', fillMode: 'solid', stroke: '#ff168f', strokeWidth: 2, shapeType: 'rect', ...extra });
    else if(type==='image') item=makeItem('image','',label,28,28,30,38,maxZ+1,{imageFit:'cover',imagePositionX:50,imagePositionY:50});
    else {
      const pos = {
        teamLogo:[2,34,4.3,32], batter1:[8,18,22,30], batter2:[8,54,22,28], target:[40,6,18,18],
        score:[40,28,18,48], overs:[58,40,9,24], phase:[36.5,82,18,14], bowlerName:[70,18,26,25],
        bowlerFigures:[70,46,26,18], balls:[70,70,28,22], brand:[2,2,18,12],
        strikerName:[8,16,25,15],strikerRuns:[8,32,13,18],strikerBalls:[22,36,10,12],strikerFours:[34,36,8,12],strikerSixes:[44,36,8,12],strikerSR:[54,36,12,12],
        nonStrikerName:[8,56,25,14],nonStrikerRuns:[8,72,13,14],nonStrikerBalls:[22,72,10,12],nonStrikerFours:[34,72,8,12],nonStrikerSixes:[44,72,8,12],nonStrikerSR:[54,72,12,12],
        battingTeam:[2,2,25,12],bowlingTeam:[73,2,25,12],teamA:[2,2,25,12],teamB:[73,2,25,12],partnership:[30,75,30,12],partnershipRuns:[30,75,15,12],partnershipBalls:[45,75,12,12],crr:[48,38,10,12],rrr:[60,38,10,12],runsRequired:[55,52,16,12],ballsRemaining:[55,68,16,12],innings:[42,4,15,12],matchStatus:[42,88,18,10],extras:[66,72,15,12],wideRuns:[66,72,10,10],noBallRuns:[77,72,10,10],byeRuns:[66,84,10,10],legByeRuns:[77,84,10,10],fallOfWickets:[2,84,45,12],lastWicket:[2,84,35,12],lastOver:[66,72,30,12],bowlerOvers:[70,24,12,14],bowlerRuns:[84,24,10,14],bowlerWickets:[70,42,10,14],bowlerMaidens:[82,42,10,14],bowlerEconomy:[70,60,16,12],totalRuns:[40,28,18,14],wickets:[59,28,10,14]
      }[key] || [35, 35, 20, 20];
      item = makeItem(type, key, label, ...pos, maxZ + 1, { fontSize: key === 'score' ? 72 : key === 'phase' ? 15 : 30, align: key === 'batter1' || key === 'batter2' || key.startsWith('bowler') ? 'left' : 'center', fill: 'transparent', strokeWidth: 0 });
    }
    list.push(item); selectedId = item.id; checkpoint(); renderAll(); queuePersist();
  }
  async function compressStudioImage(file){
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type||''))throw new Error('केवल PNG, JPG या WebP image स्वीकार है।');
    if(file.size>8*1024*1024)throw new Error('Image 8 MB से छोटी रखें।');
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Image पढ़ी नहीं जा सकी।'));r.onload=()=>resolve(String(r.result||''));r.readAsDataURL(file);});
    const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('Image खुल नहीं सकी।'));im.src=data;});
    if(img.width>10000||img.height>10000)throw new Error('Image dimensions 10000 px से कम रखें।');
    const scale=Math.min(1,1600/img.width,1200/img.height),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas उपलब्ध नहीं है।');ctx.drawImage(img,0,0,c.width,c.height);
    let out=c.toDataURL('image/webp',.78);if(!out.startsWith('data:image/webp;base64,'))out=c.toDataURL('image/png');if(out.length>600000)throw new Error('Compress करने के बाद image 600 KB से बड़ी है।');return out;
  }
  async function insertImageElement(file){
    try{const data=await compressStudioImage(file);const t=activeTemplate();if(!t)return;const maxZ=Math.max(0,...elements().map(e=>Number(e.z)||0));const item=makeItem('image','',file.name||'Image',24,24,32,42,maxZ+1,{imageData:data,imageFit:'cover'});elements().push(item);selectedId=item.id;checkpoint();renderAll();queuePersist();setHint('Image element canvas पर add हो गया। Size, crop focus और fit को Selected element में बदल सकते हैं।');}
    catch(err){setHint(`Image insert नहीं हुआ: ${err.message}`,true);}
  }
  async function uploadLayoutImage(file) {
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type||'')) { setHint('केवल PNG, JPG या WebP layout image upload करें।',true); return; }
    if(file.size > 8*1024*1024) { setHint('Image 8 MB से छोटी रखें। इसे PNG/WebP में compress करके दोबारा upload करें।',true); return; }
    try {
      const dataUrl = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Image file पढ़ी नहीं जा सकी।'));reader.onload=()=>resolve(String(reader.result||''));reader.readAsDataURL(file);});
      const img = await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Image खुल नहीं सकी।'));image.src=dataUrl;});
      if(img.width>10000 || img.height>10000) throw new Error('Image dimensions 10000 px से अधिक नहीं होनी चाहिए।');
      const scale=Math.min(1,1920/img.width,560/img.height);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d'); if(!ctx) throw new Error('Image canvas उपलब्ध नहीं है।');
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
      let compressed='';
      for(const quality of [.88,.78,.68,.58]) { compressed=canvas.toDataURL('image/webp',quality); if(compressed.length<=560000) break; }
      if(!compressed.startsWith('data:image/webp;base64,')) compressed=canvas.toDataURL('image/png');
      if(compressed.length>600000) throw new Error('Compress करने के बाद भी image 450 KB से बड़ी है। छोटी या कम detailed image इस्तेमाल करें।');
      const t=activeTemplate(); if(!t) throw new Error('पहले template चुनें।');
      t.backgroundImage=compressed; t.backgroundFit='cover';t.backgroundPositionX=50;t.backgroundPositionY=50;
      checkpoint(); renderAll(); queuePersist();
      const kb=Math.round(compressed.length*3/4/1024);
      setHint(`✓ Layout image uploaded (${img.width} × ${img.height}, लगभग ${kb} KB). अब Add live data से score/players जोड़ें और उन्हें image के ऊपर रखें।`);
    } catch(err) { console.error('Layout image upload failed',err); setHint(`Upload नहीं हुआ: ${err.message||err}`,true); }
  }

  function renderShell() {
    const root = $('scoreboardStudio'); if (!root) return;
    const groupedFields=[...new Set(DATA_ITEMS.map(x=>x[2]))].map(group=>`<optgroup label="${group}">${DATA_ITEMS.filter(x=>x[2]===group).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</optgroup>`).join('');
    const groupedShapes=[...new Set(SHAPE_ITEMS.map(x=>x[2]))].map(group=>`<optgroup label="${group}">${SHAPE_ITEMS.filter(x=>x[2]===group).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</optgroup>`).join('');
    root.innerHTML = `
      <div class="jc-studio-categories" role="tablist" aria-label="Design workspaces">
        <button type="button" data-category="score" class="isActive">🏏 Score Layer Designer</button>
        <button type="button" data-category="card">▣ Card Designer</button>
        <button type="button" data-category="animation">✦ Animation Designer</button>
      </div>
      <div class="jc-studio-header"><div><span class="eyebrow">POWERPOINT-STYLE BROADCAST DESIGNER</span><h3 id="jcStudioCategoryTitle">Score Layer Designer</h3><p id="jcStudioCategoryDescription">अपना Lower Third बनाएं और Cricket Data Fields जोड़ें।</p></div><div class="jc-studio-header-actions"><label>Design<select id="jcStudioTemplate"></select></label><label>Preview output<select id="jcStudioResolution"><option value="1920x1080">1920 × 1080 · Full HD</option><option value="1280x720">1280 × 720 · HD</option><option value="2560x1440">2560 × 1440 · QHD</option><option value="1080x1920">1080 × 1920 · Vertical</option></select></label><label>Motion preview<select id="jcStudioAnimationPreset">${ANIMATIONS.map(a=>`<option value="${a}">${a}</option>`).join('')}</select></label></div></div>
      <div class="jc-studio-toolbar">
        <div class="jc-tool-group jc-layout-upload-group"><b>Artwork / Background</b><label class="jc-upload-layout-btn" for="jcStudioLayoutUpload">⬆ Upload PNG / JPG / WebP</label><input id="jcStudioLayoutUpload" class="jc-studio-file-input" type="file" accept="image/png,image/jpeg,image/webp"><label class="jc-layout-fit-label">Image fit<select id="jcStudioBackgroundFit"><option value="contain">Contain</option><option value="cover">Cover / Crop</option><option value="stretch">Stretch</option></select></label><label class="jc-layout-fit-label">Crop X <input id="jcStudioCropX" type="range" min="0" max="100" value="50"></label><label class="jc-layout-fit-label">Crop Y <input id="jcStudioCropY" type="range" min="0" max="100" value="50"></label><button type="button" data-layout-clear>Remove artwork</button><small>Transparent PNG/WebP artwork upload करें। Cricket data fields को artwork के ऊपर रखें।</small></div>
        <div class="jc-tool-group"><b>Insert Elements</b><button type="button" data-add-image>＋ Image Element</button><input id="jcStudioElementImageUpload" class="jc-studio-file-input" type="file" accept="image/png,image/jpeg,image/webp"></div><div class="jc-tool-group"><b>Cricket Data Library</b><select id="jcStudioFieldPicker" aria-label="Cricket data field">${groupedFields}</select><button type="button" data-add-picked-field>＋ Add Field</button><button type="button" data-add-text>＋ Text Box</button></div>
        <div class="jc-tool-group"><b>PowerPoint Shapes</b><select id="jcStudioShapePicker" aria-label="Shape gallery">${groupedShapes}</select><button type="button" data-add-picked-shape>＋ Add Shape</button><button type="button" data-draw="polygon">Draw Polygon</button><button type="button" data-draw="freehand">Freehand</button><button type="button" data-finish-draw disabled>Finish Shape</button><button type="button" data-cancel-draw disabled>Cancel</button></div>
      </div>
      <div class="jc-studio-main"><div class="jc-studio-workarea"><div class="jc-studio-canvas-toolbar"><button type="button" id="jcStudioSelectTool" class="isActive">↖ Select / Move</button><button type="button" id="jcStudioUndo" disabled>↶ Undo</button><button type="button" id="jcStudioRedo" disabled>↷ Redo</button><select id="jcStudioAlignPicker" aria-label="Align selected element"><option value="">Align selected…</option><option value="left">Align Left</option><option value="centerX">Center Horizontally</option><option value="right">Align Right</option><option value="top">Align Top</option><option value="centerY">Center Vertically</option><option value="bottom">Align Bottom</option></select><button type="button" data-align-canvas>Apply Align</button><button type="button" data-canvas-layer="front">Bring to Front</button><button type="button" data-canvas-layer="back">Send to Back</button><span>Drag to move · Resize from corner · Ctrl+Z Undo · Delete to remove</span></div><div class="jc-studio-viewport" id="jcStudioViewport"><div class="jc-studio-band" id="jcStudioBand"><div class="jc-studio-canvas" id="jcStudioCanvas"></div></div></div><div class="jc-studio-bottom"><span id="jcStudioResolutionLabel">Preview: 1920 × 1080</span><span id="jcStudioCanvasSizeLabel">Design canvas: 1920 × 260</span></div></div>
        <aside class="jc-studio-side"><section class="jc-studio-section"><div class="jc-studio-section-head"><b>Layers</b><span id="jcStudioLayerCount">0 items</span></div><div id="jcStudioLayers" class="jc-studio-layers"></div></section><section class="jc-studio-section"><div class="jc-studio-section-head"><b>Selected element</b><span id="jcStudioSelectedLabel">Nothing selected</span></div><div id="jcStudioProperties" class="jc-studio-properties"><p class="muted smallHelp">Canvas पर किसी element को चुनें।</p></div></section></aside>
      </div>
      <div class="jc-studio-footer"><div class="jc-studio-template-actions"><label>Design name<input id="jcStudioTemplateName" maxlength="50" value="My Broadcast Design"></label><button type="button" data-template-save>Save / Publish</button><button type="button" data-template-duplicate>Duplicate</button><button type="button" data-template-delete class="isDanger">Delete Design</button></div><div class="jc-studio-publish"><button type="button" data-template-reset>Reset Starter</button><button type="button" data-save-draft>Save Draft</button><button type="button" data-save-apply class="isPrimary">✓ Publish Design</button></div></div><div class="jc-studio-status" id="jcStudioStatus" role="status">Design preview is local until it is saved and published.</div>`;
    wireShell();
  }
  function wireShell() {
    const root = $('scoreboardStudio');
    root.addEventListener('click', e => {
      if(e.target.closest('[data-category]')){setCategory(e.target.closest('[data-category]').dataset.category);return;}
      if(e.target.closest('[data-add-image]')){$('jcStudioElementImageUpload').click();return;}
      if(e.target.closest('[data-add-picked-field]')){const key=$('jcStudioFieldPicker').value,entry=DATA_ITEMS.find(x=>x[0]===key);addElement('data',key,entry?.[1]||key);return;}
      if(e.target.closest('[data-add-picked-shape]')){const shape=$('jcStudioShapePicker').value,entry=SHAPE_ITEMS.find(x=>x[0]===shape);addElement('shape','',entry?.[1]||'Shape',{shapeType:shape});return;}
      if (e.target.closest('[data-add-text]')) { addElement('text', '', 'Custom Text'); return; }
      if (e.target.closest('[data-layout-clear]')) { const t=activeTemplate(); if(t?.backgroundImage && confirm('Uploaded layout image हटाएँ? बाकी score fields सुरक्षित रहेंगे.')){t.backgroundImage='';checkpoint();renderAll();queuePersist();setHint('Uploaded layout image removed. Live score fields remain on the canvas.');} return; }
      const draw = e.target.closest('[data-draw]'); if (draw) { startDraw(draw.dataset.draw); return; }
      if (e.target.closest('[data-finish-draw]')) { finishDraw(); return; }
      if (e.target.closest('[data-cancel-draw]')) { cancelDraw(); return; }
      if (e.target.closest('[data-align-canvas]')) { alignSelectedToCanvas($('jcStudioAlignPicker')?.value); return; }
      const canvasLayer=e.target.closest('[data-canvas-layer]');if(canvasLayer){setCanvasLayer(canvasLayer.dataset.canvasLayer);return;}
      if (e.target.closest('[data-template-save]')) { saveTemplate(); return; }
      if (e.target.closest('[data-template-duplicate]')) { duplicateTemplate(); return; }
      if (e.target.closest('[data-template-delete]')) { deleteTemplate(); return; }
      if (e.target.closest('[data-template-reset]')) { resetCurrentTemplate(); return; }
      if (e.target.closest('[data-disable-studio]')) { doc.enabled=false; persistNow(false); return; }
      if (e.target.closest('[data-save-draft]')) { persistNow(false); return; }
      if (e.target.closest('[data-save-apply]')) { persistNow(true); return; }
      const action = e.target.closest('[data-layer-action]'); if (action) { layerAction(action.dataset.layerAction, action.dataset.id); return; }
      const align = e.target.closest('[data-align]'); if (align) { updateSelected({ align: align.dataset.align }); checkpoint(); renderAll(); queuePersist(); return; }
    });
    root.addEventListener('input', e => { const field = e.target.closest('[data-prop]'); if (field) updateProperty(field, false); });
    root.addEventListener('change', e => { const field = e.target.closest('[data-prop]'); if (field) { updateProperty(field, true); } });
    $('jcStudioTemplate').addEventListener('change', e => setActiveTemplate(e.target.value));
    $('jcStudioAnimationPreset').addEventListener('change',e=>{const t=activeTemplate();if(!t)return;t.animationPreset=e.target.value;checkpoint();renderViewport();queuePersist();});
    $('jcStudioResolution').addEventListener('change', e => { doc.previewResolution = e.target.value; renderViewport(); });
    $('jcStudioLayoutUpload').addEventListener('change', async e => { const file=e.target.files?.[0]; e.target.value=''; if(file) await uploadLayoutImage(file); });
    $('jcStudioBackgroundFit').addEventListener('change', e => { const t=activeTemplate(); if(!t)return; t.backgroundFit=['cover','contain','stretch'].includes(e.target.value)?e.target.value:'cover'; checkpoint(); renderViewport(); queuePersist(); });
    $('jcStudioCropX').addEventListener('input',e=>{const t=activeTemplate();if(!t)return;t.backgroundPositionX=safeNum(e.target.value,0,100,50);renderViewport();});$('jcStudioCropX').addEventListener('change',()=>{checkpoint();queuePersist();});
    $('jcStudioCropY').addEventListener('input',e=>{const t=activeTemplate();if(!t)return;t.backgroundPositionY=safeNum(e.target.value,0,100,50);renderViewport();});$('jcStudioCropY').addEventListener('change',()=>{checkpoint();queuePersist();});
    $('jcStudioElementImageUpload').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await insertImageElement(file);});
    $('jcStudioUndo').addEventListener('click', undo); $('jcStudioRedo').addEventListener('click', redo);
    $('jcStudioSelectTool').addEventListener('click', () => cancelDraw());
    $('jcStudioCanvas').addEventListener('pointerdown', canvasPointerDown);
    $('jcStudioCanvas').addEventListener('pointermove', canvasPointerMove);
    $('jcStudioCanvas').addEventListener('pointerup', canvasPointerUp);
    $('jcStudioCanvas').addEventListener('pointercancel', canvasPointerUp);
    $('jcStudioCanvas').addEventListener('dblclick', e => { if (drawMode === 'polygon') { e.preventDefault(); finishDraw(); } });
    document.addEventListener('keydown', e => {
      const graphicsHost=root.closest('#graphics'), adminHost=root.closest('#adminStudioTab');
      const hostActive=!!(graphicsHost&&!graphicsHost.classList.contains('hidden') || adminHost&&!adminHost.classList.contains('hidden'));
      if (!root.isConnected || !hostActive) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected() && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); deleteSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    });
  }
  function renderAll() {
    renderTemplateOptions(); renderViewport(); renderLayers(); renderProperties(); updateUndoButtons(); updateDrawButtons();
  }
  function renderTemplateOptions() {
    const select = $('jcStudioTemplate'); if (!select) return;
    const meta=CATEGORIES[currentCategory],list=categoryList(),active=activeTemplate();
    select.innerHTML = list.map(t => `<option value="${safeText(t.id)}" ${t.id === activeId() ? 'selected' : ''}>${safeText(t.name)}</option>`).join('');
    $('jcStudioTemplateName').value = active?.name || 'My Design';
    $('jcStudioResolution').value = doc.previewResolution || '1920x1080';
    if($('jcStudioBackgroundFit')) $('jcStudioBackgroundFit').value = active?.backgroundFit || 'contain';if($('jcStudioCropX'))$('jcStudioCropX').value=String(active?.backgroundPositionX??50);if($('jcStudioCropY'))$('jcStudioCropY').value=String(active?.backgroundPositionY??50);
    if($('jcStudioAnimationPreset')) $('jcStudioAnimationPreset').value=active?.animationPreset||'none';
    $('jcStudioCategoryTitle').textContent=meta.label;$('jcStudioCategoryDescription').textContent=meta.description;
    document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('isActive',b.dataset.category===currentCategory));
    $('jcStudioCanvasSizeLabel').textContent=`Design canvas: ${active?.width||meta.width} × ${active?.height||meta.height}`;
  }
  function renderViewport() {
    const viewport = $('jcStudioViewport'), band = $('jcStudioBand'), canvas = $('jcStudioCanvas'); if (!viewport || !band || !canvas) return;
    const res = RESOLUTIONS[doc.previewResolution] || RESOLUTIONS['1920x1080'];
    viewport.style.aspectRatio = res.ratio; viewport.dataset.resolution = doc.previewResolution;
    $('jcStudioResolutionLabel').textContent = `Preview output: ${res.label}`;
    const tpl=activeTemplate();
    const meta=CATEGORIES[currentCategory];
    const isScore=currentCategory==='score';
    band.classList.toggle('isOverlayCanvas',!isScore);
    band.style.aspectRatio=`${tpl?.width||meta.width} / ${tpl?.height||meta.height}`;
    band.style.bottom=isScore?'0':'auto';band.style.top=isScore?'auto':'50%';band.style.left=isScore?'0':'50%';band.style.width=isScore?'100%':(currentCategory==='card'?'min(86%, 900px)':'min(90%, 980px)');
    band.style.transform=isScore?'none':'translate(-50%,-50%)';
    canvas.style.backgroundImage = tpl?.backgroundImage ? `url(\"${tpl.backgroundImage}\")` : 'none';
    canvas.style.backgroundSize = tpl?.backgroundFit==='stretch' ? '100% 100%' : (tpl?.backgroundFit==='contain'?'contain':'cover');
    canvas.style.backgroundPosition = `${tpl?.backgroundPositionX??50}% ${tpl?.backgroundPositionY??50}%`; canvas.style.backgroundRepeat = 'no-repeat';
    canvas.classList.toggle('hasUploadedLayout', !!tpl?.backgroundImage);
    const hasThemeArtwork=!!(isScore&&tpl?.backgroundImage);
    const items = [...elements()].filter(e=>!(hasThemeArtwork&&e.type==='shape')).sort((a,b) => (a.z||0)-(b.z||0));
    canvas.innerHTML = items.map(renderEditorElement).join('');
    if(currentCategory==='animation' && tpl?.animationPreset && tpl.animationPreset!=='none') canvas.querySelectorAll('.jc-studio-item:not(.isShape)').forEach(el=>el.classList.add(`jc-anim-${tpl.animationPreset}`));
    if (drawMode && drawPoints.length) {
      const points = drawPoints.map(p => `${p[0]},${p[1]}`).join(' ');
      canvas.insertAdjacentHTML('beforeend', `<svg class="jc-studio-draw-preview" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="#00d9ff" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-dasharray="3 2"/></svg>`);
    }
    if (drawMode) canvas.dataset.drawMode = drawMode; else delete canvas.dataset.drawMode;
  }
  function previewItemContent(e) {
    const samples = {
      teamLogo: '<span class="jc-studio-logo">IND</span>',
      batter1: '<span class="jc-studio-batter"><b class="jc-studio-strike">🏏</b><span><strong>Rohit Sharma</strong><small>45* (28)</small></span></span>',
      batter2: '<span class="jc-studio-batter"><b class="jc-studio-strike empty"></b><span><strong>Virat Kohli</strong><small>32 (23)</small></span></span>',
      target: '<span class="jc-studio-target">TARGET 215</span>',
      score: '<span class="jc-studio-score">185<span>/</span>3</span>', overs: '<span class="jc-studio-overs">18.4</span>',
      phase: '<span class="jc-studio-phase"><i>P1</i><i>P2</i><i class="active">P3</i></span>',
      bowlerName: '<strong class="jc-studio-bowler">Shaheen Afridi</strong>', bowlerFigures: '<strong class="jc-studio-bowlerfig">3.4 – 31 – 1</strong>',
      balls: '<span class="jc-studio-chips"><i>1</i><i>4</i><i>·</i><i>W</i><i>2</i><i>1</i></span>', brand: '<strong class="jc-studio-brand">JANGID CRICINFO</strong>',
      battingTeam:'<b>JANGID XI</b>',bowlingTeam:'<b>MARWAR XI</b>',teamA:'<b>JANGID XI</b>',teamB:'<b>MARWAR XI</b>',
      playerName:'<b>Rohit Sharma</b>',playerRuns:'<b>45*</b>',playerBalls:'<b>28 BALLS</b>',strikerFours:'<b>4 × 4</b>',strikerSixes:'<b>2 × 6</b>',playerStrikeRate:'<b>SR 160.71</b>',
      nonStrikerName:'<b>Virat Kohli</b>',nonStrikerRuns:'<b>32</b>',nonStrikerBalls:'<b>23 BALLS</b>',nonStrikerFours:'<b>3 × 4</b>',nonStrikerSixes:'<b>1 × 6</b>',nonStrikerSR:'<b>SR 139.13</b>',
      totalRuns:'<b>185</b>',wickets:'<b>3 WKTS</b>',innings:'<b>INNINGS 2</b>',matchStatus:'<b>LIVE MATCH</b>',runsRequired:'<b>30 RUNS REQUIRED</b>',ballsRemaining:'<b>18 BALLS LEFT</b>',crr:'<b>CRR 9.15</b>',rrr:'<b>RRR 10.00</b>',
      partnership:'<b>50 RUNS · 28 BALLS</b>',partnershipRuns:'<b>50 RUNS</b>',partnershipBalls:'<b>28 BALLS</b>',bowlerOvers:'<b>3.0 OVERS</b>',bowlerRuns:'<b>24 RUNS</b>',bowlerWickets:'<b>1 WICKET</b>',bowlerMaidens:'<b>0 MAIDENS</b>',bowlerEconomy:'<b>ECON 8.00</b>',extras:'<b>EXTRAS 12</b>',wideRuns:'<b>WD 4</b>',noBallRuns:'<b>NB 2</b>',byeRuns:'<b>B 3</b>',legByeRuns:'<b>LB 3</b>',lastWicket:'<b>LAST: R. Sharma c Keeper</b>',fallOfWickets:'<b>FOW 1-36, 2-90, 3-120</b>',lastOver:'<b>LAST OVER: 1 · 4 · 0 · 1 · W · 2</b>',cardTitle:'<b>PLAYER SPOTLIGHT</b>',eventName:'<b>SIX!</b>',playerName:'<b>Rohit Sharma</b>',playerRole:'<b>BATTER</b>',playerTeam:'<b>JANGID XI</b>',playerRuns:'<b>45 RUNS</b>',playerBalls:'<b>28 BALLS</b>',playerFours:'<b>4 FOURS</b>',playerSixes:'<b>2 SIXES</b>',playerStrikeRate:'<b>SR 160.71</b>',playerWickets:'<b>2 WICKETS</b>',playerOvers:'<b>3.0 OVERS</b>',playerEconomy:'<b>ECON 7.33</b>',matchResult:'<b>JANGID XI WON BY 6 WICKETS</b>',partnershipStrikers:'<b>Rohit Sharma & Virat Kohli</b>',partnershipScore:'<b>50 RUNS · 28 BALLS</b>'
    };
    if (e.type === 'image') return e.imageData?`<img class="jc-studio-image-element" src="${e.imageData}" alt="${safeText(e.label||'Artwork')}" style="width:100%;height:100%;object-fit:${['cover','contain','fill'].includes(e.imageFit)?e.imageFit:'cover'};object-position:${safeNum(e.imagePositionX,0,100,50)}% ${safeNum(e.imagePositionY,0,100,50)}%">`:'<span class="jc-studio-customtext">Upload image for this element</span>';
    if (e.type === 'text') return `<span class="jc-studio-customtext">${safeText(e.text || 'Your text')}</span>`;
    return samples[e.key] || `<span class="jc-studio-customtext">${safeText(e.label || 'Preview')}</span>`;
  }
  function regularPolygon(sides,star=false){const pts=[];const count=star?sides*2:sides;for(let i=0;i<count;i++){const r=star&&i%2?34:46,a=(-Math.PI/2)+(i/count)*Math.PI*2;pts.push(`${50+Math.cos(a)*r},${50+Math.sin(a)*r}`);}return pts.join(' ')}
  function shapeGeometry(type,radius=16){
    const poly={triangle:'50,4 96,94 4,94',rtTriangle:'4,4 4,96 96,96',diamond:'50,3 97,50 50,97 3,50',pentagon:regularPolygon(5),hexagon:regularPolygon(6),octagon:regularPolygon(8),star4:regularPolygon(4,true),star5:regularPolygon(5,true),star6:regularPolygon(6,true),star8:regularPolygon(8,true),parallelogram:'20,4 100,4 80,96 0,96',trapezoid:'20,4 80,4 100,96 0,96',chevron:'0,5 62,5 100,50 62,95 0,95 38,50',rightArrow:'0,25 62,25 62,3 100,50 62,97 62,75 0,75',leftArrow:'100,25 38,25 38,3 0,50 38,97 38,75 100,75',upArrow:'25,100 25,38 3,38 50,0 97,38 75,38 75,100',downArrow:'25,0 75,0 75,62 97,62 50,100 3,62 25,62',leftRightArrow:'0,50 28,12 28,32 72,32 72,12 100,50 72,88 72,68 28,68 28,88',upDownArrow:'50,0 88,28 68,28 68,72 88,72 50,100 12,72 32,72 32,28 12,28',plus:'35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35',cross:'15,0 50,28 85,0 100,15 72,50 100,85 85,100 50,72 15,100 0,85 28,50 0,15',heart:'50,92 7,52 4,27 20,8 38,8 50,25 62,8 80,8 96,27 93,52',lightning:'58,0 18,55 45,55 34,100 84,38 56,38',speech:'8,8 92,8 92,78 56,78 36,98 36,78 8,78',callout:'12,8 88,8 88,76 62,76 48,94 48,76 12,76',flowDecision:'50,0 100,50 50,100 0,50',flowData:'18,0 100,0 82,100 0,100',flowDocument:'0,0 100,0 100,82 75,100 0,82',flowTerminator:'12,10 88,10 100,50 88,90 12,90 0,50',flowDatabase:'10,8 90,8 90,88 10,88',flowStoredData:'12,8 88,8 88,92 12,92',flowManualInput:'4,24 96,4 96,96 4,96',flowMerge:'50,4 96,96 4,96',flowExtract:'50,96 96,4 4,4',flowSort:'50,4 96,50 50,96 4,50',flowOffPage:'4,4 96,4 96,72 50,96 4,72',flowConnector:regularPolygon(20),bentArrow:'0,10 62,10 62,0 100,30 62,60 62,48 42,48 42,90 20,90 20,48 0,48',uTurnArrow:'0,38 42,38 42,12 62,12 62,38 100,38 100,64 62,64 62,88 42,88 42,64 0,64',notchedRightArrow:'0,18 60,18 60,0 100,50 60,100 60,82 0,82 14,50',leftRightUpArrow:'0,50 24,22 24,38 50,38 50,14 38,14 62,0 86,14 74,14 74,38 100,38 100,62 74,62 74,86 50,86 50,62 24,62 24,78',circularArrow:'12,38 18,20 35,8 58,6 77,18 88,36 97,27 96,58 67,54 76,46 69,32 57,25 42,25 31,33 26,46 28,60 38,69 52,72 62,67 70,61 84,78 68,91 48,96 27,90 11,75 4,55'};
    if(type==='ellipse'||type==='circle')return '<ellipse cx="50" cy="50" rx="48" ry="48" />';
    if(type==='rect')return '<rect x="2" y="2" width="96" height="96" rx="0" />';
    if(type==='roundRect')return `<rect x="2" y="2" width="96" height="96" rx="${safeNum(radius,0,48,16)}" />`;
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
  function shapeSvg(e, prefix) {
    const fill = e.fillMode === 'gradient' ? `url(#${prefix}_grad)` : safeColor(e.fill, '#312064');
    const stroke = safeColor(e.stroke, '#ff168f');
    const gradient = e.fillMode === 'gradient' ? `<defs><linearGradient id="${prefix}_grad" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform="rotate(${safeNum(e.gradientAngle,0,360,110)} .5 .5)"><stop offset="0%" stop-color="${safeColor(e.fill,'#312064')}"/><stop offset="100%" stop-color="${safeColor(e.fill2,'#ff168f')}"/></linearGradient></defs>` : '';
    const geometry=(e.shapeType==='polygon'||e.shapeType==='freehand')?`<polygon points="${(e.points||[]).map(p=>`${safeNum(p[0],0,100,0)},${safeNum(p[1],0,100,0)}`).join(' ')}" />`:shapeGeometry(e.shapeType||'rect',e.radius);
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${gradient}<g fill="${['line','doubleLine','brace','bracket','arc'].includes(e.shapeType)?'none':fill}" stroke="${stroke}" stroke-width="${safeNum(e.strokeWidth,0,12,0)}pt" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke">${geometry}</g></svg>`;
  }
  function renderEditorElement(e) {
    const style = `left:${safeNum(e.x,0,100,0)}%;top:${safeNum(e.y,0,100,0)}%;width:${safeNum(e.w,1,100,10)}%;height:${safeNum(e.h,1,100,20)}%;z-index:${safeNum(e.z,0,200,1)};transform:rotate(${safeNum(e.rotation,-180,180,0)}deg);--jc-fs:${safeNum(e.fontSize,6,220,30)};--jc-color:${safeColor(e.color,'#ffffff')};--jc-fill:${e.fill === 'transparent' ? 'transparent' : safeColor(e.fill,'#171033')};--jc-stroke:${safeColor(e.stroke,'#ff168f')};--jc-stroke-width:${safeNum(e.strokeWidth,0,12,0)}pt;--jc-radius:${safeNum(e.radius,0,100,8)}px;--jc-opacity:${safeNum(e.opacity,0,100,100)/100};--jc-font:${FONT_MAP[e.fontFamily] || FONT_MAP.condensed};--jc-weight:${safeNum(e.fontWeight,100,1000,900)};--jc-align:${['left','center','right'].includes(e.align)?e.align:'center'};--jc-justify:${e.align==='left'?'flex-start':e.align==='right'?'flex-end':'center'};--jc-letter:${safeNum(e.letterSpacing,-8,30,0)}px;--jc-valign:${e.valign==='top'?'flex-start':e.valign==='bottom'?'flex-end':'center'};--jc-text-transform:${['uppercase','lowercase','capitalize'].includes(e.textTransform)?e.textTransform:'none'};--jc-text-shadow:${e.shadow===false?'none':`0 2px ${safeNum(e.shadowBlur,0,30,9)}px ${safeColor(e.shadowColor,'#000000')}`};`;
    const isShape = e.type === 'shape';
    const content = isShape ? shapeSvg(e, `shape_${String(e.id).replace(/[^a-z0-9]/gi,'')}`) : previewItemContent(e);
    const anim=e.animationType&&e.animationType!=='none'?e.animationType:(currentCategory==='animation'?(activeTemplate()?.animationPreset||'none'):'none');
    const animationClass=ANIMATIONS.includes(anim)&&anim!=='none'?`jc-anim-${anim}`:'';
    return `<div class="jc-studio-item ${isShape?'isShape':''} ${animationClass} ${e.id===selectedId?'isSelected':''} ${e.locked?'isLocked':''} ${e.hidden?'isHidden':''}" data-element-id="${safeText(e.id)}" style="${style}" title="${safeText(e.label)}">${content}${e.id===selectedId && !e.locked ? '<span class="jc-studio-resize" data-resize="true" title="Drag to resize"></span>' : ''}</div>`;
  }
  function renderLayers() {
    const list = $('jcStudioLayers'); if (!list) return;
    const sorted = [...elements()].sort((a,b) => (b.z||0)-(a.z||0));
    $('jcStudioLayerCount').textContent = `${sorted.length} items`;
    list.innerHTML = sorted.map(e => `<div class="jc-studio-layer ${e.id===selectedId?'isSelected':''}" data-select-layer="${safeText(e.id)}"><button type="button" class="jc-studio-layer-name">${e.type==='shape'?'◆':e.type==='text'?'T':'◈'} ${safeText(e.label)}</button><button type="button" data-layer-action="up" data-id="${safeText(e.id)}" title="Bring forward">↑</button><button type="button" data-layer-action="down" data-id="${safeText(e.id)}" title="Send backward">↓</button><button type="button" data-layer-action="hide" data-id="${safeText(e.id)}" title="Hide / show">${e.hidden?'◉':'◎'}</button><button type="button" data-layer-action="lock" data-id="${safeText(e.id)}" title="Lock / unlock">${e.locked?'🔒':'🔓'}</button></div>`).join('');
    list.querySelectorAll('[data-select-layer]').forEach(row => row.addEventListener('click', e => { if (e.target.closest('[data-layer-action]')) return; selectedId = row.dataset.selectLayer; renderAll(); }));
  }
  function field(label, key, value, type='text', attrs='') {
    const id = `jc-prop-${key}`;
    if (type === 'color') return `<label class="jc-studio-prop">${label}<input id="${id}" data-prop="${key}" type="color" value="${safeColor(value,'#ffffff')}"></label>`;
    if (type === 'select') return `<label class="jc-studio-prop">${label}<select id="${id}" data-prop="${key}">${attrs}</select></label>`;
    if (type === 'textarea') return `<label class="jc-studio-prop full">${label}<textarea id="${id}" data-prop="${key}" rows="2">${safeText(value)}</textarea></label>`;
    return `<label class="jc-studio-prop">${label}<input id="${id}" data-prop="${key}" type="${type}" value="${safeText(value)}" ${attrs}></label>`;
  }
  function renderProperties() {
    const panel = $('jcStudioProperties'), e = selected(); if (!panel) return;
    $('jcStudioSelectedLabel').textContent = e?.label || 'Nothing selected';
    if (!e) { panel.innerHTML = '<p class="muted smallHelp">Canvas पर किसी element को चुनें।</p>'; return; }
    const common = `${field('Name', 'label', e.label)}${field('X position (%)', 'x', e.x, 'number','min="0" max="100" step="0.1"')}${field('Y position (%)', 'y', e.y, 'number','min="0" max="100" step="0.1"')}${field('Width (%)', 'w', e.w, 'number','min="1" max="100" step="0.1"')}${field('Height (%)', 'h', e.h, 'number','min="1" max="100" step="0.1"')}${field('Rotate (°)', 'rotation', e.rotation, 'number','min="-180" max="220" step="1"')}${field('Opacity (%)', 'opacity', e.opacity, 'number','min="0" max="100" step="1"')}`;
    let specific = '';
    if (e.type === 'image') {
      specific = `${field('Image fit','imageFit',e.imageFit||'cover','select','<option value="cover">Cover / Crop</option><option value="contain">Contain</option><option value="fill">Stretch</option>')}${field('Crop focus X (%)','imagePositionX',e.imagePositionX??50,'number','min="0" max="100" step="1"')}${field('Crop focus Y (%)','imagePositionY',e.imagePositionY??50,'number','min="0" max="100" step="1"')}<p class="muted smallHelp full">Image को बदलने के लिए पहले element delete करके नया Image Element जोड़ें।</p>`;
    } else if (e.type === 'shape') {
      specific = `${field('Shape type','shapeType','', 'select',SHAPE_ITEMS.map(([v,l,g])=>`<option value="${v}">${g} · ${l}</option>`).join(''))}${field('Fill mode','fillMode',e.fillMode,'select','<option value="solid">Solid colour</option><option value="gradient">Linear gradient</option>')}${field('Fill colour','fill',e.fill,'color')}${field('Gradient second colour','fill2',e.fill2,'color')}${field('Gradient angle (°)','gradientAngle',e.gradientAngle,'number','min="0" max="360" step="1"')}${field('Border colour','stroke',e.stroke,'color')}${field('Border thickness (pt)','strokeWidth',e.strokeWidth,'number','min="0" max="12" step="0.25"')}${field('Corner roundness (canvas units)','radius',e.radius,'number','min="0" max="48" step="0.5"')}${field('Shadow','shadow',e.shadow?'yes':'no','select','<option value="yes">On</option><option value="no">Off</option>')}`;
    } else {
      specific = `${e.type==='text'?field('Text content','text',e.text,'textarea'):''}${field('Font family','fontFamily',e.fontFamily,'select','<option value="condensed">Sports Condensed</option><option value="system">Modern Sans</option><option value="arial">Arial</option><option value="trebuchet">Trebuchet</option><option value="georgia">Georgia</option><option value="mono">Monospace</option><option value="impact">Impact</option>')}${field('Font size (design px)','fontSize',e.fontSize,'number','min="6" max="220" step="1"')}${field('Font weight','fontWeight',e.fontWeight,'number','min="100" max="1000" step="100"')}${field('Text colour','color',e.color,'color')}${field('Background colour','fill',e.fill==='transparent'?'#171033':e.fill,'color')}${field('Border colour','stroke',e.stroke,'color')}${field('Border thickness (pt)','strokeWidth',e.strokeWidth,'number','min="0" max="12" step="0.25"')}${field('Corner roundness (canvas units)','radius',e.radius,'number','min="0" max="48" step="0.5"')}${field('Text alignment','align',e.align,'select','<option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>')}${field('Letter spacing (px)','letterSpacing',e.letterSpacing,'number','min="-8" max="30" step="0.5"')}${field('Vertical align','valign',e.valign,'select','<option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option>')}${field('Text transform','textTransform',e.textTransform,'select','<option value="none">Normal</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize</option>')}${field('Text shadow','shadow',e.shadow?'yes':'no','select','<option value="yes">On</option><option value="no">Off</option>')}${field('Shadow colour','shadowColor',e.shadowColor||'#000000','color')}${field('Shadow blur (px)','shadowBlur',e.shadowBlur??9,'number','min="0" max="30" step="1"')}${field('Element animation','animationType',e.animationType||'none','select',ANIMATIONS.map(a=>`<option value="${a}">${a}</option>`).join(''))}`;
    }
    panel.innerHTML = `<div class="jc-studio-property-grid">${common}${specific}</div><div class="jc-studio-align"><span>Quick text align</span><button type="button" data-align="left">Left</button><button type="button" data-align="center">Center</button><button type="button" data-align="right">Right</button></div><div class="jc-studio-selected-actions"><button type="button" data-layer-action="duplicate" data-id="${safeText(e.id)}">Duplicate</button><button type="button" data-layer-action="delete" data-id="${safeText(e.id)}" class="isDanger">Delete</button></div>`;
    panel.querySelectorAll('[data-prop]').forEach(el => { if (el.tagName === 'SELECT') el.value = String(e[el.dataset.prop] ?? ''); });
  }
  function updateProperty(fieldEl, commit) {
    const item = selected(); if (!item) return;
    const key = fieldEl.dataset.prop; let value = fieldEl.value;
    if(key==='shadow')value=value==='yes';
    const numeric = ['x','y','w','h','rotation','opacity','fontSize','fontWeight','strokeWidth','radius','gradientAngle','letterSpacing','imagePositionX','imagePositionY','shadowBlur'];
    if (numeric.includes(key)) {
      const ranges = {x:[0,100],y:[0,100],w:[1,100],h:[1,100],rotation:[-180,180],opacity:[0,100],fontSize:[6,220],fontWeight:[100,1000],strokeWidth:[0,12],radius:[0,48],gradientAngle:[0,360],letterSpacing:[-8,20],imagePositionX:[0,100],imagePositionY:[0,100],shadowBlur:[0,30]};
      value = safeNum(value, ...ranges[key], 0);
    } else if (['fill','fill2','stroke','color','shadowColor'].includes(key)) value = safeColor(value, '#ffffff');
    else value = String(value).slice(0, key === 'text' ? 300 : 80);
    item[key] = value;
    renderViewport();
    if (commit) { checkpoint(); renderLayers(); queuePersist(); }
  }
  function layerAction(action, id) {
    const item = elements().find(e => e.id === id); if (!item) return;
    if (action === 'hide') item.hidden = !item.hidden;
    else if (action === 'lock') item.locked = !item.locked;
    else if (action === 'delete') { deleteSelected(id); return; }
    else if (action === 'duplicate') { const copy = clone(item); copy.id = uid(); copy.label = `${copy.label} copy`; copy.x = safeNum(copy.x + 2,0,100,0); copy.y = safeNum(copy.y + 2,0,100,0); copy.z = Math.max(0,...elements().map(e=>e.z||0))+1; elements().push(copy); selectedId = copy.id; }
    else if (action === 'up' || action === 'down') { const max = Math.max(0,...elements().map(e=>e.z||0)); item.z = safeNum(item.z + (action === 'up' ? 1 : -1), 0, max + 1, 1); }
    checkpoint(); renderAll(); queuePersist();
  }
  function updateSelected(patch) { const item = selected(); if (item) Object.assign(item, patch); }
  function alignSelectedToCanvas(mode) {
    const item=selected();if(!item){setHint('पहले Canvas पर कोई element चुनें।',true);return;}
    if(!mode){setHint('Align करने के लिए position चुनें।',true);return;}
    if(mode==='left')item.x=0;else if(mode==='centerX')item.x=(100-item.w)/2;else if(mode==='right')item.x=100-item.w;
    else if(mode==='top')item.y=0;else if(mode==='centerY')item.y=(100-item.h)/2;else if(mode==='bottom')item.y=100-item.h;
    checkpoint();renderAll();queuePersist();setHint('Selected element Canvas के अनुसार align हो गया।');
  }
  function setCanvasLayer(direction){
    const item=selected();if(!item){setHint('पहले Canvas पर कोई element चुनें।',true);return;}
    const list=elements(),max=Math.max(0,...list.map(e=>Number(e.z)||0));
    item.z=direction==='front'?max+1:0;checkpoint();renderAll();queuePersist();setHint(direction==='front'?'Element सबसे आगे आ गया।':'Element सबसे पीछे चला गया।');
  }
  function deleteSelected(id = selectedId) { const list = elements(), index = list.findIndex(e => e.id === id); if (index < 0) return; list.splice(index,1); selectedId = list[Math.max(0,index-1)]?.id || null; checkpoint(); renderAll(); queuePersist(); }
  function canvasPoint(e) {
    const rect = $('jcStudioCanvas').getBoundingClientRect();
    return { x: safeNum(((e.clientX - rect.left) / rect.width) * 100, 0, 100, 0), y: safeNum(((e.clientY - rect.top) / rect.height) * 100, 0, 100, 0) };
  }
  function canvasPointerDown(e) {
    if (drawMode === 'polygon') { e.preventDefault(); const p = canvasPoint(e); drawPoints.push([p.x,p.y]); renderViewport(); updateDrawButtons(); return; }
    if (drawMode === 'freehand') { e.preventDefault(); drag = { drawing: true, points: [canvasPoint(e)] }; $('jcStudioCanvas').setPointerCapture(e.pointerId); return; }
    const el = e.target.closest('.jc-studio-item');
    if (!el) { selectedId = null; renderAll(); return; }
    const item = elements().find(x => x.id === el.dataset.elementId); if (!item) return;
    selectedId = item.id;
    if (item.locked) { renderAll(); return; }
    const isResize = !!e.target.closest('[data-resize]');
    drag = { id: item.id, mode: isResize ? 'resize' : 'move', start: canvasPoint(e), origin: {x:item.x,y:item.y,w:item.w,h:item.h}, pointerId:e.pointerId };
    $('jcStudioCanvas').setPointerCapture(e.pointerId); renderLayers(); renderProperties();
    e.preventDefault();
  }
  function canvasPointerMove(e) {
    if (drawMode === 'freehand' && drag?.drawing) {
      const p = canvasPoint(e), last = drag.points[drag.points.length-1];
      if (!last || Math.hypot(p.x-last.x,p.y-last.y) > 0.55) drag.points.push(p);
      drawPoints = drag.points.map(p=>[p.x,p.y]); renderViewport(); return;
    }
    if (!drag || drag.drawing) return;
    const item = elements().find(x => x.id === drag.id); if (!item) return;
    const p = canvasPoint(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (drag.mode === 'move') { item.x = safeNum(drag.origin.x+dx,0,100-item.w,drag.origin.x); item.y = safeNum(drag.origin.y+dy,0,100-item.h,drag.origin.y); }
    else { item.w = safeNum(drag.origin.w+dx,1,100-item.x,drag.origin.w); item.h = safeNum(drag.origin.h+dy,1,100-item.y,drag.origin.h); }
    renderViewport();
  }
  function canvasPointerUp(e) {
    if (drawMode === 'freehand' && drag?.drawing) {
      drawPoints = drag.points.map(p=>[p.x,p.y]); drag = null; finishDraw(); return;
    }
    if (drag && !drag.drawing) { drag = null; checkpoint(); renderAll(); queuePersist(); }
  }
  function startDraw(mode) { drawMode = mode; drawPoints = []; drag = null; setHint(mode === 'polygon' ? 'Polygon mode: canvas पर कम से कम 3 points पर click करें, फिर Finish Shape दबाएँ।' : 'Freehand mode: mouse दबाकर shape बनाएँ और छोड़ दें।'); updateDrawButtons(); }
  function finishDraw() {
    if (drawPoints.length < 3) { setHint('Shape बनाने के लिए कम से कम 3 points चाहिए।', true); return; }
    const minX = Math.min(...drawPoints.map(p=>p[0])), minY = Math.min(...drawPoints.map(p=>p[1]));
    const maxX = Math.max(...drawPoints.map(p=>p[0])), maxY = Math.max(...drawPoints.map(p=>p[1]));
    const width = Math.max(1,maxX-minX), height = Math.max(1,maxY-minY);
    const points = drawPoints.map(([x,y])=>[safeNum(((x-minX)/width)*100,0,100,0),safeNum(((y-minY)/height)*100,0,100,0)]);
    const item = makeItem('shape','',drawMode==='polygon'?'Custom Polygon':'Freehand Shape',minX,minY,width,height,Math.max(0,...elements().map(e=>e.z||0))+1,{shapeType:'freehand',points,fill:'#392075',fill2:'#ff168f',fillMode:'gradient',stroke:'#ff8ac6',strokeWidth:2});
    elements().push(item); selectedId = item.id; cancelDraw(false); checkpoint(); renderAll(); queuePersist(); setHint('Custom shape added. Fill, gradient and border can now be edited.');
  }
  function cancelDraw(update = true) { drawMode = ''; drawPoints = []; drag = null; if (update) renderViewport(); updateDrawButtons(); }
  function updateDrawButtons() {
    const finish = document.querySelector('[data-finish-draw]'), cancel = document.querySelector('[data-cancel-draw]');
    if (finish) finish.disabled = drawMode !== 'polygon' || drawPoints.length < 3;
    if (cancel) cancel.disabled = !drawMode;
    $('jcStudioSelectTool')?.classList.toggle('isActive', !drawMode);
  }
  function undo() {
    if (undoIndex <= 0) return; undoIndex--; applySnapshot(undoStack[undoIndex]);
  }
  function redo() {
    if (undoIndex >= undoStack.length - 1) return; undoIndex++; applySnapshot(undoStack[undoIndex]);
  }
  function applySnapshot(snap) {
    try { const saved = JSON.parse(snap), t = activeTemplate(); Object.assign(t, saved); selectedId = t.elements[0]?.id || null; renderAll(); queuePersist(); } catch {}
  }
  async function saveTemplate() {
    const t = activeTemplate(); if (!t) return;
    t.name = String($('jcStudioTemplateName').value || 'My Scoreboard').trim().slice(0,50) || 'My Scoreboard';
    t.category=currentCategory;t.published = true; checkpoint(); renderTemplateOptions();
    await persistNow(true);
  }
  function duplicateTemplate() {
    const t = clone(activeTemplate()); if (!t) return;
    t.id = uid(); t.name = `${t.name} Copy`.slice(0,50); t.published=false; t.elements.forEach(e=>{e.id=uid()}); const list=categoryList(); if(list.length>=20){setHint('इस Designer में अधिकतम 20 designs रख सकते हैं।',true);return;} list.push(t);setActiveId(t.id);selectedId=t.elements[0]?.id||null;resetHistory();renderAll();queuePersist();setHint('Design duplicate हो गया। अब इसे अलग edit कर सकते हैं।');
  }
  function deleteTemplate() {
    const list=categoryList(); if (list.length <= 1) { setHint('हर Designer में कम से कम एक Design रहना जरूरी है।', true); return; }
    const t = activeTemplate(); if (!confirm(`Delete design “${t.name}”?`)) return;
    const next=list.filter(x=>x.id!==t.id);const meta=CATEGORIES[currentCategory];doc[meta.key]=next;setActiveId(next[0].id);selectedId=next[0].elements[0]?.id||null;resetHistory();renderAll();queuePersist();
  }
  function resetCurrentTemplate() {
    if (!confirm('Current template को World Cup starter design से replace करें?')) return;
    const old=activeTemplate(), next=defaultTemplate(old?.name||'Starter Design',currentCategory); next.id=old.id; const list=categoryList(),ix=list.findIndex(t=>t.id===old.id); list[ix]=next; selectedId=next.elements[0]?.id||null; resetHistory(); renderAll(); queuePersist();
  }
  async function persistNow(apply) {
    if (saveTimer) clearTimeout(saveTimer);
    window.__jcStudioDirty = true;
    activeTemplate().name = String($('jcStudioTemplateName').value || activeTemplate().name).trim().slice(0,50) || 'My Design';
    activeTemplate().category=currentCategory;
    if (apply) { activeTemplate().published=true; if(currentCategory==='score')doc.enabled=true; }
    try {
      if (typeof window.persistScoreboardStudio !== 'function') throw new Error('Control Board save connection is not ready.');
      await window.persistScoreboardStudio(doc); window.__jcStudioDirty = false; renderAll();
      setHint(apply ? `✓ ${CATEGORIES[currentCategory].label} प्रकाशित हो गया। ${currentCategory==='score'?'यह Score Layer के लिए उपलब्ध है।':'यह design अपनी अलग '+(currentCategory==='card'?'Card':'Animation')+' Library में उपलब्ध है।'}` : 'Draft account पर सुरक्षित है। Publish करने पर संबंधित Library में आएगा।');
    } catch (error) { setHint(`Save नहीं हुआ: ${error.message}`, true); }
  }
  window.initScoreboardStudio = function (stored) {
    if (!initialized) { renderShell(); initialized=true; }
    if (stored && !window.__jcStudioDirty) {
      doc = normaliseDocument(stored); selectedId = activeTemplate()?.elements[0]?.id || null; resetHistory();
    } else if (!stored && !window.__jcStudioDirty) {
      doc = freshDocument(); selectedId = activeTemplate()?.elements[0]?.id || null; resetHistory();
    }
    renderAll();
  };
  window.getScoreboardStudioDocument = () => clone(doc);
})();
