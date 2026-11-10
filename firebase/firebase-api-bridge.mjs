import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth, browserSessionPersistence, setPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, onSnapshot, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const DEFAULT_LIMITS = Object.freeze({ scoreLayouts:20, eventAnimations:20, graphicCards:20, liveScoring:true, publicScoreboard:true, obsScoreLayer:true });
const PLANS = Object.freeze({
  basic:{id:'basic',name:'Basic',daily:100,minDays:1,maxDays:5,tournament:false,label:'Single Match'},
  pro:{id:'pro',name:'Pro',daily:200,minDays:3,maxDays:15,tournament:true,label:'All Features'}
});
const CONTACT = Object.freeze({ phone:'9928262424', whatsapp:'919928262424', email:'kamlesh.jangid1526@gmail.com' });
const missing = ['apiKey','messagingSenderId','appId'].filter(k => !firebaseConfig?.[k] || String(firebaseConfig[k]).startsWith('PASTE_'));
if (missing.length) {
  const configError = new Error(`Jangid Cricinfo की Firebase सेटिंग अभी अधूरी है। Firebase Console → Project settings → Your apps से Web App की सार्वजनिक config जोड़नी होगी: ${missing.join(', ')}.`);
  window.JangidBackendStatus = { mode: 'github-pages-firebase', connected: false, missingConfig: missing };
  window.__JC_FIREBASE_BRIDGE_REJECT__?.(configError);
  throw configError;
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
// Keep authenticated state only for the current browser session, not indefinitely on a shared device.
const authPersistenceReady = setPersistence(auth, browserSessionPersistence);
const db = getFirestore(app);
const nowIso = () => new Date().toISOString();
const rid = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const cleanData = value => JSON.parse(JSON.stringify(value, (_k,v) => v === undefined ? null : v));
const ownerDoc = (uid, name, id) => doc(db,'users',uid,name,id);
const ownerCol = (uid, name) => collection(db,'users',uid,name);
const publicDoc = (name,id) => doc(db,name,id);
const publicCol = name => collection(db,name);
const readBody = init => { try { return init?.body ? JSON.parse(init.body) : {}; } catch { return {}; } };
const fail = (status,error,extra={}) => ({status,body:{ok:false,error,...extra}});
const ok = body => ({status:200,body:{ok:true,...body}});
const cleanText = (v,n=140) => String(v ?? '').trim().slice(0,n);
const mobileDigits = v => String(v||'').replace(/\D/g,'');
const dateMs = v => { const n=Date.parse(v||''); return Number.isFinite(n)?n:0; };
const toList = snap => snap.docs.map(d => ({id:d.id,...d.data()}));
async function currentUser() {
  await authPersistenceReady;
  return auth.currentUser;
}
async function profileFor(uid) { const s=await getDoc(doc(db,'users',uid)); return s.exists()?{uid:s.id,...s.data()}:null; }
async function adminFor(uid) { const s=await getDoc(doc(db,'admins',uid)); return s.exists() && s.data().enabled === true; }
async function requireUser() {
  const user=await currentUser(); if(!user) throw Object.assign(new Error('पहले Email और Password से Login करें।'),{status:401});
  const profile=await profileFor(user.uid); if(!profile) throw Object.assign(new Error('इस Login का प्रोफाइल नहीं मिला। दोबारा खाता बनाएँ या Admin से सहायता लें।'),{status:401});
  if(profile.status==='disabled') { await signOut(auth); throw Object.assign(new Error('यह खाता बंद है। Admin से संपर्क करें।'),{status:403}); }
  return {user,profile};
}
async function requireAdmin() {
  const ctx=await requireUser();
  if(!await adminFor(ctx.user.uid)) throw Object.assign(new Error('Admin access अभी इस Firebase खाते के लिए चालू नहीं किया गया है।'),{status:403});
  return ctx;
}
function subscriptionInfo(profile) {
  const s=profile?.subscription, expiry=dateMs(s?.expiresAt);
  if(s?.status==='active' && expiry>Date.now()) return {active:true,plan:s.planId,daysLeft:Math.ceil((expiry-Date.now())/86400000)};
  return {active:false,plan:null,daysLeft:0};
}
function publicUser(profile,isAdmin=false) {
  const s=subscriptionInfo(profile);
  return {id:profile.uid,uid:profile.uid,mobile:profile.mobile||'',fullName:profile.fullName||'',email:profile.email||'',address:profile.address||'',role:isAdmin?'admin':'user',status:profile.status||'active',subscription:profile.subscription||null,activePlan:s.plan,daysLeft:s.daysLeft,createdAt:profile.createdAt||null,lastLoginAt:profile.lastLoginAt||null,serviceLimits:{...DEFAULT_LIMITS,...(profile.serviceLimits||{})}};
}
function gate(profile, plan='basic') {
  const s=subscriptionInfo(profile);
  if(!s.active) throw Object.assign(new Error('मैच शुरू करने के लिए Admin से Activation ID लें और उसे Activate करें।'),{status:402,code:'ACTIVE_PLAN_REQUIRED'});
  if(plan==='pro' && s.plan!=='pro') throw Object.assign(new Error('इस सुविधा के लिए Pro Plan चाहिए।'),{status:402,code:'PRO_PLAN_REQUIRED'});
  if(profile.serviceLimits?.liveScoring===false) throw Object.assign(new Error('Admin ने इस खाते के Live Scoring को बंद किया है।'),{status:403});
  return s;
}
async function listOwner(uid,name) { return toList(await getDocs(ownerCol(uid,name))); }
async function getOwner(uid,name,id) { const s=await getDoc(ownerDoc(uid,name,id)); return s.exists()?{id:s.id,...s.data()}:null; }
async function saveOwner(uid,name,id,value) { await setDoc(ownerDoc(uid,name,id),cleanData(value),{merge:true}); }
async function profileAndState(uid, profile, admin=false) {
  const [teams,tournaments,matches,draft,broadcast]=await Promise.all([
    listOwner(uid,'teams'),listOwner(uid,'tournaments'),listOwner(uid,'matches'),
    getOwner(uid,'drafts','current'),getOwner(uid,'broadcasts','current')
  ]);
  const activeMatches=matches.filter(m=>m.status==='live').sort((a,b)=>dateMs(b.updatedAt)-dateMs(a.updatedAt));
  const activeMatch=activeMatches[0]||null;
  return {user:publicUser(profile,admin),localTestMode:false,backendMode:'firebase-github-pages',firebaseConnection:'connected',plans:Object.values(PLANS),teams,tournaments,matches,activeMatch,savedLiveMatches:activeMatches,matchDraft:draft?.draft||null,broadcast:broadcast||{},demoData:{hasDemo:false,matchId:null,tournamentId:null,tournamentName:'Jangid Demo Cup'},contact:CONTACT};
}
async function teamDetails(uid,id) { return await getOwner(uid,'teams',id); }
async function enrichMatch(uid,match) {
  const [a,b,t]=await Promise.all([teamDetails(uid,match.teamA),teamDetails(uid,match.teamB),match.tournamentId?getOwner(uid,'tournaments',match.tournamentId):null]);
  return {...match,userId:uid,ownerUid:uid,teamAName:a?.name||match.teamAName||'Team A',teamBName:b?.name||match.teamBName||'Team B',teamALogo:a?.logo||match.teamALogo||'',teamBLogo:b?.logo||match.teamBLogo||'',tournamentName:t?.name||match.tournamentName||''};
}
async function publishMatch(uid,match) {
  const enriched=await enrichMatch(uid,match);
  // Match payloads are complete snapshots. Replace the whole public document so Undo/corrections
  // cannot leave stale nested batter/bowler statistics behind.
  await setDoc(publicDoc('publicMatches',match.id),cleanData(enriched));
  // Public tournament counts are derived from publicMatches snapshots; do not rewrite
  // every public team document on each ball, which would waste Spark daily writes.
  return enriched;
}
async function saveMatch(uid,match) {
  const m={...match,userId:uid,ownerUid:uid,updatedAt:nowIso(),lastActivityAt:nowIso()};
  // Replace the complete private match snapshot; merge mode can retain removed nested stat keys.
  await setDoc(ownerDoc(uid,'matches',m.id),cleanData(m));
  if(m.status==='live') await setDoc(ownerDoc(uid,'meta','active'),{matchId:m.id,updatedAt:nowIso()});
  else {
    const a=await getOwner(uid,'meta','active'); if(a?.matchId===m.id) await deleteDoc(ownerDoc(uid,'meta','active'));
  }
  await publishMatch(uid,m);
  return m;
}
async function loadPublicMatches() { return toList(await getDocs(query(publicCol('publicMatches'),orderBy('updatedAt','desc'),limit(250)))); }
async function loadPublicTournaments() { return toList(await getDocs(query(publicCol('publicTournaments'),orderBy('updatedAt','desc'),limit(100)))).filter(x=>x.published!==false); }
async function loadPublicBroadcasts() { return toList(await getDocs(query(publicCol('publicBroadcasts'),orderBy('updatedAt','desc'),limit(100)))); }
const publicCache = { publicMatches: [], publicTournaments: [], publicBroadcasts: [] };
function emitPublicCache(changedCollection = 'initial') {
  const visible = [...publicCache.publicMatches].sort((a,b)=>dateMs(b.updatedAt||b.startedAt||b.dateTime)-dateMs(a.updatedAt||a.startedAt||a.dateTime)).slice(0,250);
  const tournaments = publicCache.publicTournaments.filter(x=>x.published!==false).map(t=>({
    ...t,
    matchCount:visible.filter(m=>m.tournamentId===t.id).length,
    liveCount:visible.filter(m=>m.tournamentId===t.id&&m.status==='live').length,
    completedCount:visible.filter(m=>m.tournamentId===t.id&&m.status==='finished').length,
    scheduledCount:visible.filter(m=>m.tournamentId===t.id&&m.status==='scheduled').length
  }));
  const broadcastMap = {};
  for(const b of publicCache.publicBroadcasts) broadcastMap[b.id]={...b};
  window.__JC_EMIT_PUBLIC__?.({activeMatches:visible.filter(x=>x.status==='live'),matches:visible,tournaments,broadcasts:broadcastMap,changedCollection});
}
let publicUnsubs=[];
function subscribePublic(_onUpdate=emitPublicCache,onError=()=>{}) {
  // One listener per public collection per page. EventSource widgets share this cached stream.
  if(!publicUnsubs.length) {
    for(const name of ['publicMatches','publicTournaments','publicBroadcasts']) {
      const source = name==='publicMatches' ? query(publicCol(name),orderBy('updatedAt','desc'),limit(250)) : query(publicCol(name),orderBy('updatedAt','desc'),limit(100));
      publicUnsubs.push(onSnapshot(source,snapshot=>{
        publicCache[name]=toList(snapshot);
        emitPublicCache(name);
      },onError));
    }
  }
  emitPublicCache('initial');
  return () => { /* shared listeners stay open until page exit to serve all widgets */ };
}
window.__JC_FIREBASE_BRIDGE_RESOLVE__({handleApi,subscribePublic});

async function getPublicTournament(id) {
  const s=await getDoc(publicDoc('publicTournaments',id)); if(!s.exists()||s.data().published===false)return null;
  const raw=s.data();
  const [matches,teams]=await Promise.all([
    getDocs(query(publicCol('publicMatches'),where('tournamentId','==',id))),
    getDocs(query(publicCol('publicTeams'),where('tournamentId','==',id)))
  ]);
  const ms=toList(matches).sort((a,b)=>dateMs(a.dateTime||a.startedAt)-dateMs(b.dateTime||b.startedAt));
  const ts=toList(teams);
  const teamRows=new Map(ts.map(t=>[String(t.teamId||t.id),{id:String(t.teamId||t.id),name:t.name,logo:t.logo||'',players:t.players||[]} ]));
  const pointsTables=await pointsForTournament(raw,ms,[...teamRows.values()]);
  const info={id,name:raw.name||'Tournament',venue:raw.venue||'',state:raw.state||'',district:raw.district||'',tehsil:raw.tehsil||'',pinCode:raw.pinCode||'',startDate:raw.startDate||'',endDate:raw.endDate||'',description:raw.description||'',format:raw.format||'league',bannerUrl:raw.banner||'',teamCount:ts.length,matchCount:ms.length,liveCount:ms.filter(x=>x.status==='live').length,completedCount:ms.filter(x=>x.status==='finished').length,scheduledCount:ms.filter(x=>x.status==='scheduled').length,pointsTables};
  return {tournament:info,teams:[...teamRows.values()],matches:ms};
}
async function refreshPublicTournament(uid,tid) {
  const t=await getOwner(uid,'tournaments',tid); if(!t)return;
  const teams=await listOwner(uid,'teams');
  const selected=teams.filter(x=>(t.teamIds||[]).map(String).includes(String(x.id))).map(x=>({id:x.id,ownerUid:uid,tournamentId:tid,name:x.name,logo:x.logo||'',players:(x.players||[]).map(p=>({id:p.id,name:p.name,role:p.role,captain:!!p.captain,viceCaptain:!!p.viceCaptain}))}));
  const oldPublicTeams=await getDocs(query(publicCol('publicTeams'),where('tournamentId','==',tid)));
  const keepTeamIds=new Set(selected.map(x=>String(x.id)));
  const teamBatch=writeBatch(db);
  for(const old of oldPublicTeams.docs) if(!keepTeamIds.has(String(old.data().teamId||''))) teamBatch.delete(old.ref);
  for(const tm of selected) teamBatch.set(publicDoc('publicTeams',`${tid}_${tm.id}`),cleanData({...tm,teamId:tm.id}),{merge:true});
  await teamBatch.commit();
  const docValue={id:tid,ownerUid:uid,published:t.published!==false,name:t.name||'Tournament',venue:t.venue||'',state:t.state||'',district:t.district||'',tehsil:t.tehsil||'',pinCode:t.pinCode||'',startDate:t.startDate||'',endDate:t.endDate||'',description:t.description||'',format:t.format||'league',groupCount:t.groupCount||1,teamIds:(t.teamIds||[]).map(String),teamGroups:t.teamGroups||{},banner:t.banner||'',updatedAt:nowIso()};
  await setDoc(publicDoc('publicTournaments',tid),cleanData(docValue),{merge:true});
}
async function loadBroadcast(uid,full=true) {
  const b=await getOwner(uid,'broadcasts','current')||{};
  if(!full)return {...b,studioDesign:undefined,cardDesign:undefined,animationDesign:undefined};
  const [studio,card,animation,sponsors]=await Promise.all([
    getOwner(uid,'libraries','studio'),getOwner(uid,'libraries','card'),getOwner(uid,'libraries','animation'),getOwner(uid,'libraries','sponsors')
  ]);
  return {...b,studioDesign:studio?.value||b.studioDesign||null,cardDesign:card?.value||b.cardDesign||null,animationDesign:animation?.value||b.animationDesign||null,sponsorLibrary:sponsors?.value||null};
}
async function loadPublicBroadcast(uid) {
  const snap = await getDoc(publicDoc('publicBroadcasts', uid));
  if (!snap.exists()) return {};
  const base = snap.data() || {};
  const [studio, card, animation] = await Promise.all([
    getDoc(publicDoc('publicBroadcastDesigns', `${uid}_studio`)),
    getDoc(publicDoc('publicBroadcastDesigns', `${uid}_card`)),
    getDoc(publicDoc('publicBroadcastDesigns', `${uid}_animation`))
  ]);
  return { ...base, studioDesign: studio.exists() ? studio.data().value : null,
    cardDesign: card.exists() ? card.data().value : null,
    animationDesign: animation.exists() ? animation.data().value : null };
}
async function savePublicBroadcast(uid, broadcast) {
  const previousSnap = await getDoc(publicDoc('publicBroadcasts', uid));
  const previous = previousSnap.exists() ? previousSnap.data() : {};
  const keys = ['studioDesign','cardDesign','animationDesign'];
  for (const key of keys) if (broadcast[key] !== undefined) {
    const category = key.replace('Design','').toLowerCase();
    await setDoc(publicDoc('publicBroadcastDesigns', `${uid}_${category}`),
      { ownerUid: uid, uid, kind: category, value: cleanData(broadcast[key]), updatedAt: nowIso() }, { merge: true });
  }
  const has = key => broadcast[key] !== undefined ? !!broadcast[key] : !!previous[`has${key[0].toUpperCase()}${key.slice(1)}`];
  const summary = { ownerUid: uid, updatedAt: nowIso(), layer: broadcast.layer || previous.layer || 1, color: broadcast.color || previous.color || 1,
    hasStudioDesign: has('studioDesign'), hasCardDesign: has('cardDesign'), hasAnimationDesign: has('animationDesign'),
    studioDesignUpdatedAt: broadcast.studioDesignUpdatedAt || previous.studioDesignUpdatedAt || null,
    cardDesignUpdatedAt: broadcast.cardDesignUpdatedAt || previous.cardDesignUpdatedAt || null,
    animationDesignUpdatedAt: broadcast.animationDesignUpdatedAt || previous.animationDesignUpdatedAt || null,
    sponsorLibraryUpdatedAt: broadcast.sponsorLibraryUpdatedAt || previous.sponsorLibraryUpdatedAt || null,
    sponsorDisplay: broadcast.sponsorDisplay !== undefined ? broadcast.sponsorDisplay : previous.sponsorDisplay || null,
    event: broadcast.event !== undefined ? broadcast.event : previous.event || null,
    card: broadcast.card !== undefined ? broadcast.card : previous.card || null,
    cardId: broadcast.cardId !== undefined ? broadcast.cardId : previous.cardId || null,
    animation: broadcast.animation !== undefined ? broadcast.animation : previous.animation || null,
    eventId: broadcast.eventId !== undefined ? broadcast.eventId : previous.eventId || null,
    matchId: broadcast.matchId !== undefined ? broadcast.matchId : previous.matchId || null,
    selectedLayout: broadcast.selectedLayout || previous.selectedLayout || null };
  await setDoc(publicDoc('publicBroadcasts', uid), cleanData(summary), { merge: true });
}
async function saveLargeLibrary(uid,key,value) {
  const map={studio:['studioTemplates','templates'],card:['cardTemplates','cardTemplates'],animation:['animationTemplates','animationTemplates'],sponsors:['sponsors','sponsors']};
  const [collectionName,arrayName]=map[key];
  const items=Array.isArray(value?.[arrayName])?value[arrayName]:[];
  if(items.length>60) throw new Error('इस Library में बहुत अधिक items हैं। अधिकतम 60 रखें।');
  const batch=writeBatch(db);
  const old=await getDocs(ownerCol(uid,collectionName));
  old.docs.forEach(d=>batch.delete(d.ref));
  for(const item of items) {
    if(!item?.id) continue;
    const ref=ownerDoc(uid,collectionName,String(item.id)); batch.set(ref,cleanData(item));
  }
  batch.set(ownerDoc(uid,'libraries',key),{value:{...value,[arrayName]:undefined},updatedAt:nowIso()},{merge:true});
  await batch.commit();
}
async function getLargeLibrary(uid,key) {
  const map={studio:['studioTemplates','templates'],card:['cardTemplates','cardTemplates'],animation:['animationTemplates','animationTemplates'],sponsors:['sponsors','sponsors']};
  const [collectionName,arrayName]=map[key];
  const [meta,items]=await Promise.all([getOwner(uid,'libraries',key),listOwner(uid,collectionName)]);
  return meta?{...meta.value,[arrayName]:items}:null;
}
async function saveGlobalLibrary(key,value) {
  const map={studio:['globalStudioTemplates','templates'],card:['globalCardTemplates','cardTemplates'],animation:['globalAnimationTemplates','animationTemplates'],sponsors:['globalSponsors','sponsors']};
  const [collectionName,arrayName]=map[key]; const items=Array.isArray(value?.[arrayName])?value[arrayName]:[];
  if(items.length>60) throw new Error('Library में अधिकतम 60 items रखे जा सकते हैं।');
  const batch=writeBatch(db); const old=await getDocs(publicCol(collectionName)); old.docs.forEach(d=>batch.delete(d.ref));
  items.forEach(item=>{if(item?.id)batch.set(publicDoc(collectionName,String(item.id)),cleanData(item));});
  batch.set(publicDoc('globalLibraries',key),{meta:{...value,[arrayName]:undefined},updatedAt:nowIso()},{merge:true}); await batch.commit();
}
async function getGlobalLibrary(key) {
  const map={studio:['globalStudioTemplates','templates'],card:['globalCardTemplates','cardTemplates'],animation:['globalAnimationTemplates','animationTemplates'],sponsors:['globalSponsors','sponsors']};
  const [collectionName,arrayName]=map[key]; const [meta,items]=await Promise.all([getDoc(publicDoc('globalLibraries',key)),getDocs(publicCol(collectionName))]);
  return meta.exists()?{...meta.data().meta,[arrayName]:toList(items)}:{[arrayName]:toList(items)};
}
async function adminState(uid,profile) {
  if(!await adminFor(uid)) throw Object.assign(new Error('इस खाते को Admin की अनुमति नहीं मिली है।'),{status:403});
  const [users,codes,studio,sponsors]=await Promise.all([getDocs(publicCol('users')),getDocs(publicCol('activationCodes')),getGlobalLibrary('studio'),getGlobalLibrary('sponsors')]);
  const userRows=toList(users).map(u=>({id:u.uid||u.id,...publicUser({uid:u.uid||u.id,...u},false)}));
  const codeRows=toList(codes);
  const currentUser=publicUser(profile,true);
  return {currentUser,users:userRows,activationCodes:codeRows,plans:PLANS,contact:CONTACT,studioDesign:studio,sponsorLibrary:sponsors};
}
async function publishTeam(tid,uid,tournamentIds=[]) {
  for(const tournamentId of tournamentIds) await refreshPublicTournament(uid,tournamentId);
}
async function pointsForTournament(t, matches, teams) {
  const ids=(t.teamIds||[]).map(String), groupMap=t.teamGroups||{};
  const groupNames=t.format==='groups-knockout'?[...new Set(ids.map(id=>groupMap[id]||'Group A'))]:['League'];
  return groupNames.map(groupName=>{
    const members=ids.filter(id=>(t.format==='groups-knockout'?(groupMap[id]||'Group A'):'League')===groupName);
    const rows=new Map(members.map(id=>{const team=teams.find(x=>x.id===id);return [id,{teamId:id,teamName:team?.name||'Team',played:0,wins:0,losses:0,ties:0,noResults:0,points:0,runsFor:0,ballsFaced:0,runsAgainst:0,ballsBowled:0,netRunRate:0}]}));
    for(const m of matches.filter(x=>x.status==='finished'&&['league','group','group-stage','round-robin'].includes(String(x.stage||'league'))&&members.includes(String(x.teamA))&&members.includes(String(x.teamB)))){
      const a=rows.get(String(m.teamA)),b=rows.get(String(m.teamB)); if(!a||!b)continue; a.played++;b.played++;
      if(m.resultType==='no-result'){a.noResults++;b.noResults++;a.points++;b.points++;continue;}
      if(m.resultType==='tie'){a.ties++;b.ties++;a.points++;b.points++;continue;}
      const winner=String(m.winnerTeamId||'');
      if(winner===String(m.teamA)){a.wins++;a.points+=2;b.losses++;}else if(winner===String(m.teamB)){b.wins++;b.points+=2;a.losses++;}
      const innings=[...(m.inningsHistory||[]),m.activeInnings].filter(Boolean);
      for(const inn of innings){const batting=inn.battingId===m.teamA?a:inn.battingId===m.teamB?b:null;const bowling=inn.bowlingId===m.teamA?a:inn.bowlingId===m.teamB?b:null;if(batting){batting.runsFor+=Number(inn.score)||0;batting.ballsFaced+=Number(inn.balls)||0;}if(bowling){bowling.runsAgainst+=Number(inn.score)||0;bowling.ballsBowled+=Number(inn.balls)||0;}}
    }
    const standings=[...rows.values()].map(r=>({...r,netRunRate:(r.ballsFaced&&r.ballsBowled)?(r.runsFor/(r.ballsFaced/6))-(r.runsAgainst/(r.ballsBowled/6)):0})).sort((a,b)=>b.points-a.points||b.netRunRate-a.netRunRate||b.wins-a.wins);
    return {groupName,teams:standings};
  });
}

async function handleApi(url,init={}) {
  const path=url.pathname, method=String(init.method||'GET').toUpperCase(), body=readBody(init);
  try {
    await authPersistenceReady;
    if(path==='/api/health' && method==='GET') return ok({app:'Jangid Cricinfo',version:'4.5.0',mode:'github-pages-firebase',storage:'cloud-firestore',firebaseConnected:true});
    if(path==='/api/register' && method==='POST') {
      const email=cleanText(body.email,160).toLowerCase(), password=String(body.password||'');
      const fullName=cleanText(body.fullName,100),mobile=mobileDigits(body.mobile),address=cleanText(body.address,220);
      if(!email||!/^\S+@\S+\.\S+$/.test(email)) return fail(400,'खाता बनाने के लिए सही Email लिखें।');
      if(!/^\d{10}$/.test(mobile)) return fail(400,'10 अंकों का मोबाइल नंबर लिखें।');
      if(!fullName) return fail(400,'पूरा नाम लिखें।');
      if(password.length<8) return fail(400,'Password कम से कम 8 अक्षरों का रखें।');
      const cred=await createUserWithEmailAndPassword(auth,email,password);
      const profile={uid:cred.user.uid,email,mobile,fullName,address,status:'active',subscription:null,serviceLimits:DEFAULT_LIMITS,createdAt:nowIso(),lastLoginAt:null};
      await setDoc(doc(db,'users',cred.user.uid),cleanData(profile));
      try { await sendEmailVerification(cred.user); } catch {}
      await signOut(auth);
      return ok({user:publicUser(profile,false),verificationEmailSent:true});
    }
    if((path==='/api/login'||path==='/api/admin/login') && method==='POST') {
      const email=cleanText(body.email,160).toLowerCase();
      if(!email) return fail(400,'कृपया अपना Email लिखें।');
      const cred=await signInWithEmailAndPassword(auth,email,String(body.password||''));
      const profile=await profileFor(cred.user.uid);
      if(!profile||profile.status==='disabled'){await signOut(auth);return fail(403,'यह खाता बंद है या प्रोफाइल नहीं मिला।');}
      const admin=await adminFor(cred.user.uid);
      if(path==='/api/admin/login'&&!admin){await signOut(auth);return fail(403,'यह Login Admin खाते के लिए अधिकृत नहीं है।');}
      await updateDoc(doc(db,'users',cred.user.uid),{lastLoginAt:nowIso()});
      return ok({user:publicUser({...profile,lastLoginAt:nowIso()},admin)});
    }
    if(path==='/api/logout' && method==='POST'){await signOut(auth);return ok({});}
    if(path==='/api/password/reset' && method==='POST'){const email=cleanText(body.email,160).toLowerCase();if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail(400,'अपना registered Email लिखें।');await sendPasswordResetEmail(auth,email);return ok({message:'Password reset link आपके Email पर भेज दिया गया है।'});}
    if(path==='/api/state' && method==='GET') {
      const {user,profile}=await requireUser(); const admin=await adminFor(user.uid);
      return {status:200,body:await profileAndState(user.uid,profile,admin)};
    }
    if(path==='/api/public' && method==='GET') {
      const [matches,tournaments,broadcasts]=await Promise.all([loadPublicMatches(),loadPublicTournaments(),loadPublicBroadcasts()]);
      const visible=matches.sort((a,b)=>dateMs(b.updatedAt||b.startedAt||b.dateTime)-dateMs(a.updatedAt||a.startedAt||a.dateTime)).slice(0,250);
      const tRows=tournaments.map(t=>({...t,matchCount:visible.filter(m=>m.tournamentId===t.id).length,liveCount:visible.filter(m=>m.tournamentId===t.id&&m.status==='live').length,completedCount:visible.filter(m=>m.tournamentId===t.id&&m.status==='finished').length,scheduledCount:visible.filter(m=>m.tournamentId===t.id&&m.status==='scheduled').length}));
      const map={}; broadcasts.forEach(x=>map[x.id]={...x});
      return {status:200,body:{plans:PLANS,contact:CONTACT,liveMatches:visible.filter(x=>x.status==='live'),matches:visible,tournaments:tRows,broadcasts:map,siteName:'Jangid Cricinfo'}};
    }
    if(path==='/api/public/studio-library' && method==='GET') {
      const library=await getGlobalLibrary('studio');
      const published=list=>(Array.isArray(list)?list:[]).filter(item=>item&&item.published===true);
      return ok({studioDesign:{...library,templates:published(library.templates),cardTemplates:published(library.cardTemplates),animationTemplates:published(library.animationTemplates)}});
    }
    if(path==='/api/public/sponsor-library' && method==='GET') {const library=await getGlobalLibrary('sponsors');return ok({sponsors:(library.sponsors||[]).filter(x=>x.published===true),updatedAt:library.updatedAt||null});}
    const publicMatch=path.match(/^\/api\/public\/match\/([^/]+)$/);
    if(publicMatch&&method==='GET'){const s=await getDoc(publicDoc('publicMatches',decodeURIComponent(publicMatch[1])));return s.exists()?{status:200,body:{ok:true,match:{id:s.id,...s.data()}}}:fail(404,'यह Match उपलब्ध नहीं है।');}
    const publicTournament=path.match(/^\/api\/public\/tournament\/([^/]+)$/);
    if(publicTournament&&method==='GET'){const result=await getPublicTournament(decodeURIComponent(publicTournament[1]));return result?{status:200,body:{ok:true,...result}}:fail(404,'यह Tournament प्रकाशित नहीं है।');}
    const publicBroadcast=path.match(/^\/api\/public\/broadcast\/([^/]+)$/);
    if(publicBroadcast&&method==='GET'){const uid=decodeURIComponent(publicBroadcast[1]);const b=await loadPublicBroadcast(uid);return ok({broadcast:b,version:b.updatedAt||null});}
    if(path==='/api/admin/state'&&method==='GET'){const {user,profile}=await requireAdmin();return {status:200,body:await adminState(user.uid,profile)};}
    if(path==='/api/admin/studio-library'&&method==='GET'){await requireAdmin();return ok({studioDesign:await getGlobalLibrary('studio')});}
    if(path==='/api/admin/studio-library'&&method==='POST'){
      await requireAdmin();
      const design=body.studioDesign||{};
      if(!Array.isArray(design.templates)||!design.templates.length)return fail(400,'कम से कम एक Score Layer design सेव रखें।');
      for(const [key,label] of [['templates','Score Layer'],['cardTemplates','Card'],['animationTemplates','Animation']]){
        const rows=design[key]===undefined?[]:design[key];
        if(!Array.isArray(rows)||rows.length>20)return fail(400,`${label} Library में अधिकतम 20 designs रख सकते हैं।`);
        if(rows.some(item=>!item||!item.id||!Array.isArray(item.elements)||item.elements.length>100))return fail(400,`${label} design का data सही नहीं है।`);
      }
      await saveGlobalLibrary('studio',design);
      return ok({studioDesign:await getGlobalLibrary('studio'),publishedCount:{score:(design.templates||[]).filter(x=>x.published===true).length,card:(design.cardTemplates||[]).filter(x=>x.published===true).length,animation:(design.animationTemplates||[]).filter(x=>x.published===true).length}});
    }
    if(path==='/api/admin/sponsor-library'&&method==='GET'){await requireAdmin();return ok({sponsorLibrary:await getGlobalLibrary('sponsors')});}

    const teamMatch=path.match(/^\/api\/team(?:\/([^/]+))?(?:\/player(?:\/([^/]+))?)?$/);
    if(teamMatch) {
      const {user,profile}=await requireUser(),teamId=teamMatch[1]?decodeURIComponent(teamMatch[1]):null,playerId=teamMatch[2]?decodeURIComponent(teamMatch[2]):null;
      if(method==='POST'&&!teamId){const name=cleanText(body.name,80);if(!name)return fail(400,'Team का नाम लिखें।');const team={id:rid('t_'),ownerUid:user.uid,userId:user.uid,name,logo:body.logo||'',players:[],createdAt:nowIso(),updatedAt:nowIso()};await saveOwner(user.uid,'teams',team.id,team);return ok({team});}
      if(!teamId)return fail(405,'यह Team action उपलब्ध नहीं है।');
      const team=await teamDetails(user.uid,teamId);if(!team)return fail(404,'Team नहीं मिली।');
      if(playerId&&method==='PUT'){const player=(team.players||[]).find(p=>String(p.id)===playerId);if(!player)return fail(404,'Player नहीं मिला।');Object.assign(player,{name:cleanText(body.name,80)||player.name,role:cleanText(body.role,30)||player.role});team.updatedAt=nowIso();await saveOwner(user.uid,'teams',teamId,team);const tr=await listOwner(user.uid,'tournaments');await publishTeam(teamId,user.uid,tr.filter(t=>(t.teamIds||[]).includes(teamId)).map(t=>t.id));return ok({team});}
      if(playerId&&method==='DELETE'){team.players=(team.players||[]).filter(p=>String(p.id)!==playerId);team.updatedAt=nowIso();await saveOwner(user.uid,'teams',teamId,team);return ok({team});}
      if(!playerId&&method==='PUT'){if(body.name)team.name=cleanText(body.name,80);team.updatedAt=nowIso();await saveOwner(user.uid,'teams',teamId,team);const tr=await listOwner(user.uid,'tournaments');await publishTeam(teamId,user.uid,tr.filter(t=>(t.teamIds||[]).includes(teamId)).map(t=>t.id));return ok({team});}
      if(!playerId&&method==='DELETE'){const matches=await listOwner(user.uid,'matches');if(matches.some(m=>m.status==='live'&&(m.teamA===teamId||m.teamB===teamId)))return fail(409,'इस Team का Match अभी LIVE है। पहले Match समाप्त करें।');await deleteDoc(ownerDoc(user.uid,'teams',teamId));const ts=await listOwner(user.uid,'tournaments');for(const t of ts){t.teamIds=(t.teamIds||[]).filter(x=>x!==teamId);delete t.teamGroups?.[teamId];await saveOwner(user.uid,'tournaments',t.id,t);await refreshPublicTournament(user.uid,t.id);}return ok({deletedId:teamId});}
      if(!playerId&&method==='POST'){const name=cleanText(body.name,80);if(!name)return fail(400,'Player का नाम लिखें।');if((team.players||[]).length>=100)return fail(400,'एक Team में अधिकतम 100 Players रख सकते हैं।');const player={id:rid('p_'),name,role:cleanText(body.role,30)||'batsman',captain:!!body.captain,viceCaptain:!!body.viceCaptain};if(player.captain)team.players=team.players.map(p=>({...p,captain:false}));if(player.viceCaptain)team.players=team.players.map(p=>({...p,viceCaptain:false}));team.players.push(player);team.updatedAt=nowIso();await saveOwner(user.uid,'teams',teamId,team);const ts=await listOwner(user.uid,'tournaments');await publishTeam(teamId,user.uid,ts.filter(t=>(t.teamIds||[]).includes(teamId)).map(t=>t.id));return ok({team,player});}
    }

    if(path==='/api/tournament'&&method==='POST'){
      const {user}=await requireUser();gate(await profileFor(user.uid),'pro');const name=cleanText(body.name,100);if(!name)return fail(400,'Tournament का नाम लिखें।');
      const format=['league','groups-knockout','knockout'].includes(body.format)?body.format:'league';const t={id:rid('tr_'),ownerUid:user.uid,userId:user.uid,name,venue:cleanText(body.venue,140),state:cleanText(body.state,80),district:cleanText(body.district,80),tehsil:cleanText(body.tehsil,80),pinCode:cleanText(body.pinCode,6),startDate:cleanText(body.startDate,20),endDate:cleanText(body.endDate,20),description:cleanText(body.description,500),banner:body.banner||'',format,groupCount:format==='groups-knockout'?Math.max(2,Math.min(8,Number(body.groupCount)||2)):1,teamIds:[],teamGroups:{},published:true,createdAt:nowIso(),updatedAt:nowIso()};
      await saveOwner(user.uid,'tournaments',t.id,t);await refreshPublicTournament(user.uid,t.id);return ok({tournament:t});
    }
    const tournamentRoute=path.match(/^\/api\/tournament\/([^/]+)(?:\/(team(?:\/([^/]+))?|groups|fixtures(?:\/generate)?))?$/);
    if(tournamentRoute){
      const {user,profile}=await requireUser(),tid=decodeURIComponent(tournamentRoute[1]),action=tournamentRoute[2]||'',subId=tournamentRoute[3]?decodeURIComponent(tournamentRoute[3]):null;
      let t=await getOwner(user.uid,'tournaments',tid);if(!t)return fail(404,'Tournament नहीं मिला।');
      if(action==='team'&&method==='POST'){gate(profile,'pro');const team=await teamDetails(user.uid,String(body.teamId||''));if(!team)return fail(404,'Team नहीं मिली।');if(!(t.teamIds||[]).includes(team.id))t.teamIds.push(team.id);t.teamGroups||={};t.teamGroups[team.id]=cleanText(body.groupName,40)||(t.format==='groups-knockout'?'Group A':'League');t.updatedAt=nowIso();await saveOwner(user.uid,'tournaments',tid,t);await refreshPublicTournament(user.uid,tid);return ok({tournament:t,team});}
      if(action.startsWith('team/')&&method==='DELETE'){gate(profile,'pro');t.teamIds=(t.teamIds||[]).filter(id=>id!==subId);delete t.teamGroups?.[subId];await saveOwner(user.uid,'tournaments',tid,t);await refreshPublicTournament(user.uid,tid);return ok({tournament:t});}
      if(action==='groups'&&method==='PUT'){gate(profile,'pro');t.teamGroups={...(t.teamGroups||{}),...(body.teamGroups||body.groups||{})};await saveOwner(user.uid,'tournaments',tid,t);await refreshPublicTournament(user.uid,tid);return ok({tournament:t});}
      if(action==='fixtures'&&method==='POST'){gate(profile,'pro');const fixture=await createFixture(user.uid,t,body);return ok({fixture});}
      if(action==='fixtures/generate'&&method==='POST'){gate(profile,'pro');const result=await generateFixtures(user.uid,t,body);return ok(result);}
      if(!action&&method==='PUT'){gate(profile,'pro');const name=cleanText(body.name??t.name,100);if(!name)return fail(400,'Tournament का नाम जरूरी है।');Object.assign(t,{name,venue:cleanText(body.venue??t.venue,140),state:cleanText(body.state??t.state,80),district:cleanText(body.district??t.district,80),tehsil:cleanText(body.tehsil??t.tehsil,80),pinCode:cleanText(body.pinCode??t.pinCode,6),startDate:cleanText(body.startDate??t.startDate,20),endDate:cleanText(body.endDate??t.endDate,20),description:cleanText(body.description??t.description,500),format:body.format||t.format,groupCount:Number(body.groupCount||t.groupCount||1),updatedAt:nowIso()});if(body.bannerClear)t.banner='';else if(body.banner)t.banner=body.banner;await saveOwner(user.uid,'tournaments',tid,t);await refreshPublicTournament(user.uid,tid);return ok({tournament:t});}
      if(!action&&method==='DELETE'){const matches=await listOwner(user.uid,'matches');if(matches.some(m=>m.tournamentId===tid&&m.status==='live'))return fail(409,'इस Tournament में एक Match LIVE है। पहले उसे Finish करें।');await deleteDoc(ownerDoc(user.uid,'tournaments',tid));await deleteDoc(publicDoc('publicTournaments',tid));return ok({deletedId:tid});}
    }

    if(path==='/api/match/draft'){
      const {user}=await requireUser();if(method==='POST'){await saveOwner(user.uid,'drafts','current',{draft:body.draft||{},updatedAt:nowIso()});return ok({draft:body.draft||{}});}if(method==='DELETE'){await deleteDoc(ownerDoc(user.uid,'drafts','current'));return ok({});}
    }
    if(path==='/api/match/start'&&method==='POST'){const {user,profile}=await requireUser();gate(profile,'basic');const match=await startMatch(user.uid,body);return ok({match});}
    if(path==='/api/match/state'&&method==='POST'){const {user,profile}=await requireUser();gate(profile,'basic');const match=body.match;if(!match?.id||match.userId!==user.uid||match.status!=='live')return fail(400,'Match डेटा गलत है।');const teams=await Promise.all([teamDetails(user.uid,match.teamA),teamDetails(user.uid,match.teamB)]);if(!teams[0]||!teams[1]||match.teamA===match.teamB)return fail(400,'Match की Teams सही नहीं हैं।');await saveMatch(user.uid,match);return ok({});}
    if(path==='/api/match/finish'&&method==='POST'){const {user,profile}=await requireUser();gate(profile,'basic');const m=await getOwner(user.uid,'matches',String(body.matchId||''));if(!m)return fail(404,'Live Match नहीं मिला।');if(m.status!=='live')return fail(409,'यह Match LIVE नहीं है।');const type=['winner','tie','no-result'].includes(body.resultType)?body.resultType:'winner';if(type==='winner'){if(![m.teamA,m.teamB].includes(String(body.winnerTeamId)))return fail(400,'Winner Team चुनें।');m.winnerTeamId=String(body.winnerTeamId);m.resultType='winner';m.result=`${m.winnerTeamId===m.teamA?m.teamAName:m.teamBName} won`;}else{m.winnerTeamId=null;m.resultType=type==='tie'?'tie':'no-result';m.result=type==='tie'?'Match tied':'No Result';}m.status='finished';m.completedAt=nowIso();m.updatedAt=m.completedAt;await saveMatch(user.uid,m);return ok({match:m});}
    if(path==='/api/match/recover-stale'&&method==='POST'){const {user}=await requireUser();const m=await getOwner(user.uid,'matches',String(body.matchId||''));if(!m)return fail(404,'Match नहीं मिला।');if(m.status!=='live')return fail(409,'यह Match अब LIVE नहीं है।');m.status='abandoned';m.resultType='abandoned';m.result='Abandoned / closed by account owner';m.completedAt=nowIso();await saveMatch(user.uid,m);return ok({match:m,preservedScorecard:true});}
    const matchDelete=path.match(/^\/api\/match\/([^/]+)$/);if(matchDelete&&method==='DELETE'){const {user}=await requireUser();const id=decodeURIComponent(matchDelete[1]);const m=await getOwner(user.uid,'matches',id);if(!m)return fail(404,'Match नहीं मिला।');await deleteDoc(ownerDoc(user.uid,'matches',id));await deleteDoc(publicDoc('publicMatches',id));return ok({deletedId:id});}
    if(path==='/api/broadcast'&&method==='POST'){
      const {user,profile}=await requireUser();gate(profile,'basic');const uid=user.uid;
      const b={...(await getOwner(uid,'broadcasts','current')||{}),...body,updatedAt:nowIso()};
      for(const key of ['studioDesign','cardDesign','animationDesign','sponsorLibrary']) {
        if(body[key]!==undefined) {
          const coll=key==='studioDesign'?'studio':key==='cardDesign'?'card':key==='animationDesign'?'animation':'sponsors';
          await saveLargeLibrary(uid,coll,body[key]);
        }
      }
      const publicPayload={...b};
      for(const key of ['studioDesign','cardDesign','animationDesign','sponsorLibrary']) delete b[key];
      await saveOwner(uid,'broadcasts','current',b);
      await savePublicBroadcast(uid,publicPayload);
      return ok({});
    }
    if(path==='/api/activate'&&method==='POST'){
      const {user,profile}=await requireUser();const code=cleanText(body.code,24).toUpperCase();if(!code)return fail(400,'Activation ID लिखें।');
      const ref=doc(db,'activationCodes',code);let updated;
      await runTransaction(db,async tx=>{const [c,u]=await Promise.all([tx.get(ref),tx.get(doc(db,'users',user.uid))]);if(!c.exists())throw new Error('Activation ID गलत है या पहले इस्तेमाल हो चुकी है।');const rec=c.data(),p=PLANS[rec.planId];if(rec.mobile!==profile.mobile)throw new Error('यह Activation ID दूसरे मोबाइल नंबर के लिए है।');if(rec.used||rec.status==='revoked')throw new Error('यह Activation ID पहले इस्तेमाल हो चुकी है या बंद है।');if(!p)throw new Error('Activation Plan सही नहीं है।');const start=new Date(),expiry=new Date(start.getTime()+Number(rec.days)*86400000);const subscription={planId:p.id,status:'active',days:Number(rec.days),price:Number(rec.price)||0,activatedAt:start.toISOString(),startsAt:start.toISOString(),expiresAt:expiry.toISOString(),activationId:code};tx.update(ref,{used:true,usedAt:start.toISOString(),usedBy:user.uid,startsAt:start.toISOString(),expiresAt:expiry.toISOString()});tx.update(doc(db,'users',user.uid),{subscription,updatedAt:nowIso()});updated=subscription;});return ok({user:publicUser({...profile,subscription:updated},await adminFor(user.uid))});
    }
    if(path==='/api/admin/code'&&method==='POST'){
      const {user}=await requireAdmin();const mobile=mobileDigits(body.mobile),planId=body.planId,days=Number(body.days);if(!/^\d{10}$/.test(mobile))return fail(400,'10 अंकों का मोबाइल नंबर लिखें।');const plan=PLANS[planId];if(!plan||!Number.isInteger(days)||days<1||days>3650)return fail(400,'Plan या दिनों की संख्या सही नहीं है।');const code=cleanText(body.code,18).toUpperCase()||Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');const ref=doc(db,'activationCodes',code);if((await getDoc(ref)).exists())return fail(409,'यह Activation ID पहले से मौजूद है।');const activation={id:code,code,mobile,planId,days,price:days*plan.daily,used:false,status:'pending',createdAt:nowIso(),createdBy:user.uid,autoGenerated:!body.code};await setDoc(ref,activation);return ok({activation});
    }
    const revoke=path.match(/^\/api\/admin\/codes\/([^/]+)\/revoke$/);if(revoke&&method==='POST'){await requireAdmin();const ref=doc(db,'activationCodes',decodeURIComponent(revoke[1]));const s=await getDoc(ref);if(!s.exists())return fail(404,'Activation ID नहीं मिली।');await updateDoc(ref,{status:'revoked',revokedAt:nowIso()});return ok({});}
    if(path==='/api/admin/change-password'&&method==='POST'){await requireAdmin();const user=await currentUser();const next=String(body.newPassword||''),current=String(body.currentPassword||'');if(next.length<12)return fail(400,'नया Password कम से कम 12 अक्षरों का रखें।');if(!current)return fail(400,'पहले वाला Password लिखें।');const credential=EmailAuthProvider.credential(user.email,current);await reauthenticateWithCredential(user,credential);await updatePassword(user,next);return ok({});}
    const userAction=path.match(/^\/api\/admin\/users\/([^/]+)(?:\/(status|services))?$/);
    if(userAction){await requireAdmin();const target=decodeURIComponent(userAction[1]),sub=userAction[2]||'';if(sub==='status'&&method==='POST'){const status=body.status==='disabled'?'disabled':'active';await updateDoc(doc(db,'users',target),{status,updatedAt:nowIso()});if(status==='disabled'){const owned=await listOwner(target,'matches');for(const m of owned.filter(x=>x.status==='live')){m.status='abandoned';m.resultType='abandoned';m.result='Account disabled by Admin';m.completedAt=nowIso();m.updatedAt=m.completedAt;await saveMatch(target,m);}}return ok({status});}if(sub==='services'&&method==='POST'){const limits={scoreLayouts:Math.max(0,Math.min(20,Number(body.scoreLayouts)||0)),eventAnimations:Math.max(0,Math.min(20,Number(body.eventAnimations)||0)),graphicCards:Math.max(0,Math.min(20,Number(body.graphicCards)||0)),liveScoring:body.liveScoring!==false,publicScoreboard:body.publicScoreboard!==false,obsScoreLayer:body.obsScoreLayer!==false};await updateDoc(doc(db,'users',target),{serviceLimits:limits,updatedAt:nowIso()});return ok({serviceLimits:limits});}if(!sub&&method==='DELETE'){await updateDoc(doc(db,'users',target),{status:'disabled',deletedAt:nowIso(),updatedAt:nowIso()});return ok({disabled:true});}}
    if(path==='/api/admin/studio-library'&&method==='POST'){await requireAdmin();await saveGlobalLibrary('studio',body.studioDesign||{});return ok({studioDesign:await getGlobalLibrary('studio')});}
    if(path==='/api/admin/sponsor-library'&&method==='POST'){await requireAdmin();await saveGlobalLibrary('sponsors',body.sponsorLibrary||{});return ok({sponsorLibrary:await getGlobalLibrary('sponsors')});}
    if(path==='/api/public/studio-library'&&method==='GET')return ok({studioDesign:await getGlobalLibrary('studio')});
    if(path==='/api/public/sponsor-library'&&method==='GET'){const l=await getGlobalLibrary('sponsors');return ok({sponsors:(l.sponsors||[]).filter(x=>x.published),updatedAt:l.updatedAt||null});}
    if(path==='/api/demo'&&method==='DELETE'){const {user}=await requireUser();const matches=await listOwner(user.uid,'matches');for(const m of matches.filter(x=>x.isDemo)){await deleteDoc(ownerDoc(user.uid,'matches',m.id));await deleteDoc(publicDoc('publicMatches',m.id));}return ok({});}
    return fail(404,`यह ऑनलाइन सुविधा अभी उपलब्ध नहीं है: ${method} ${path}`);
  } catch(error) {
    console.error('Jangid Firebase API error:',error);
    const details={...(error.code?{code:error.code}:{}),...(error.matchId?{matchId:error.matchId}:{}),...(Array.isArray(error.matches)?{matches:error.matches.map(m=>({id:m.id,title:m.title||'Local Match',teamAName:m.teamAName||'Team A',teamBName:m.teamBName||'Team B',activeInnings:m.activeInnings||{}}))}:{})};
    return fail(error.status||400,error.message||'अनुरोध पूरा नहीं हो पाया।',details);
  }
}

async function createFixture(uid,t,b) {
  const [a,bTeam]=await Promise.all([teamDetails(uid,String(b.teamA||'')),teamDetails(uid,String(b.teamB||''))]);
  if(!a||!bTeam||a.id===bTeam.id)throw new Error('दो अलग-अलग Teams चुनें।');
  if(!(t.teamIds||[]).includes(a.id)||!(t.teamIds||[]).includes(bTeam.id))throw new Error('पहले दोनों Teams को Tournament में जोड़ें।');
  const when=new Date(String(b.dateTime||''));if(!Number.isFinite(when.getTime()))throw new Error('मैच की सही तारीख और समय चुनें।');
  const overs=Math.max(1,Math.min(100,Math.floor(Number(b.overs)||20))),stage=cleanText(b.stage,30)||(t.format==='groups-knockout'?'group':'league');
  const groupA=t.teamGroups?.[a.id]||'Group A',groupB=t.teamGroups?.[bTeam.id]||'Group A';
  if(t.format==='groups-knockout'&&['league','group'].includes(stage)&&groupA!==groupB)throw new Error('Group Stage में एक ही Group की Teams चुनें।');
  const m={id:rid('fix_'),ownerUid:uid,userId:uid,tournamentId:t.id,tournamentName:t.name,title:cleanText(b.title,100)||`${a.name} vs ${bTeam.name}`,teamA:a.id,teamB:bTeam.id,teamAName:a.name,teamBName:bTeam.name,stage,groupName:stage==='group'?groupA:cleanText(b.groupName,40),oversLimit:overs,bowlerOverLimit:Math.max(1,Math.ceil(overs/5)),venue:cleanText(b.venue||t.venue,140),location:cleanText(b.venue||t.venue,140),state:t.state||'',district:t.district||'',tehsil:t.tehsil||'',pinCode:t.pinCode||'',dateTime:when.toISOString(),scheduledAt:when.toISOString(),status:'scheduled',inningsHistory:[],activeInnings:null,result:null,createdAt:nowIso()};
  await saveOwner(uid,'matches',m.id,m);await publishMatch(uid,m);return m;
}
async function generateFixtures(uid,t,b) {
  const all=(await listOwner(uid,'teams')).filter(x=>(t.teamIds||[]).includes(x.id));if(all.length<2)throw new Error('Fixtures बनाने के लिए कम से कम 2 Teams चाहिए।');
  const stage=cleanText(b.stage,30)||(t.format==='groups-knockout'?'group':'league');const overs=Math.max(1,Math.min(100,Number(b.overs)||20));
  let groups=[all];if(t.format==='groups-knockout'&&stage==='group'){const map=new Map();for(const team of all){const g=t.teamGroups?.[team.id]||'Group A';if(!map.has(g))map.set(g,[]);map.get(g).push(team);}groups=[...map.values()];}
  const pairs=[];for(const group of groups){for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++)pairs.push({a:group[i],b:group[j]});}
  const existing=await listOwner(uid,'matches');const filtered=pairs.filter(p=>!existing.some(m=>m.tournamentId===t.id&&m.stage===stage&&((m.teamA===p.a.id&&m.teamB===p.b.id)||(m.teamA===p.b.id&&m.teamB===p.a.id))));
  if(filtered.length>200)throw new Error('एक बार में 200 से अधिक Fixtures नहीं बनाए जा सकते।');
  const first=new Date(b.firstDateTime||`${b.firstDate||t.startDate||nowIso().slice(0,10)}T10:00:00`);if(!Number.isFinite(first.getTime()))throw new Error('पहली तारीख और समय सही लिखें।');
  const perDay=Math.max(1,Math.min(20,Number(b.matchesPerDay)||2)),gap=Math.max(1,Math.min(24,Number(b.gapHours)||3));const created=[];
  for(let i=0;i<filtered.length;i++){const when=new Date(first.getTime()+Math.floor(i/perDay)*86400000+(i%perDay)*gap*3600000);const p=filtered[i];const m={id:rid('fix_'),ownerUid:uid,userId:uid,tournamentId:t.id,tournamentName:t.name,title:`${p.a.name} vs ${p.b.name}`,teamA:p.a.id,teamB:p.b.id,teamAName:p.a.name,teamBName:p.b.name,stage,groupName:t.format==='groups-knockout'?(t.teamGroups?.[p.a.id]||'Group A'):'League',oversLimit:overs,bowlerOverLimit:Math.max(1,Math.ceil(overs/5)),venue:cleanText(b.venue||t.venue,140),location:cleanText(b.venue||t.venue,140),dateTime:when.toISOString(),scheduledAt:when.toISOString(),status:'scheduled',inningsHistory:[],activeInnings:null,result:null,createdAt:nowIso()};await saveOwner(uid,'matches',m.id,m);await publishMatch(uid,m);created.push(m);}
  return {created:created.length,skipped:pairs.length-filtered.length,fixtures:created};
}
async function startMatch(uid,b) {
  const [teams,tournaments,matches]=await Promise.all([listOwner(uid,'teams'),listOwner(uid,'tournaments'),listOwner(uid,'matches')]);
  const A=teams.find(t=>t.id===String(b.teamA)),B=teams.find(t=>t.id===String(b.teamB));if(!A||!B||A.id===B.id)throw new Error('दो अलग-अलग Teams चुनें।');
  const active=matches.find(m=>m.status==='live');if(active)throw Object.assign(new Error('आपके खाते में एक Match पहले से LIVE है। पहले उसे Finish करें।'),{status:409,code:'ACTIVE_MATCH_EXISTS',matchId:active.id,matches:[active]});
  const t=tournaments.find(x=>x.id===String(b.tournamentId||''));if(b.tournamentId&&!t)throw new Error('चुना हुआ Tournament नहीं मिला।');
  if(t&&(!(t.teamIds||[]).includes(A.id)||!(t.teamIds||[]).includes(B.id)))throw new Error('दोनों Teams को पहले Tournament में जोड़ें।');
  const fixtureId=String(b.fixtureId||'');const fixture=fixtureId?matches.find(x=>x.id===fixtureId&&x.status==='scheduled'):null;if(fixtureId&&!fixture)throw new Error('यह Fixture पहले ही शुरू हो चुका है या नहीं मिला।');
  if(fixture&&(fixture.tournamentId!==t?.id||fixture.teamA!==A.id||fixture.teamB!==B.id))throw new Error('Fixture और चुनी गई Teams मेल नहीं खातीं।');
  const valid=(team,arr)=>[...new Set((Array.isArray(arr)?arr:[]).map(String))].filter(id=>(team.players||[]).some(p=>p.id===id));
  const xiA=valid(A,b.xiA),xiB=valid(B,b.xiB);if(xiA.length<2||xiB.length<2)throw new Error('दोनों Teams की Playing XI में कम से कम 2 Players चुनें।');
  if(![A.id,B.id].includes(String(b.tossWinner)))throw new Error('Toss Winner चुनें।');
  const decision=b.tossDecision==='field'?'field':'bat',batFirst=decision==='field'?(b.tossWinner===A.id?B.id:A.id):b.tossWinner,bowlFirst=batFirst===A.id?B.id:A.id;
  const batTeam=batFirst===A.id?A:B,bowlTeam=bowlFirst===A.id?A:B,batXi=batFirst===A.id?xiA:xiB,bowlXi=bowlFirst===A.id?xiA:xiB;
  const striker=String(b.striker||''),nonStriker=String(b.nonStriker||''),bowler=String(b.currentBowler||'');
  if(!batXi.includes(striker)||!batXi.includes(nonStriker)||striker===nonStriker||!bowlXi.includes(bowler))throw new Error('Striker, Non-Striker और Bowler सही Playing XI से चुनें।');
  const overs=Math.max(1,Math.min(100,Math.floor(Number(b.overs)||10))),overLimit=Math.max(1,Math.min(overs,Math.floor(Number(b.bowlerOverLimit)||1)));
  const inn={number:1,battingId:batFirst,bowlingId:bowlFirst,target:null,score:0,wickets:0,balls:0,events:[],striker,nonStriker,currentBowler:bowler,playersOut:[],batStats:{},bowlStats:{},partnership:{runs:0,balls:0},fallOfWickets:[],extras:{wide:0,noBall:0,legBye:0,bye:0,total:0},overBalls:0,currentOver:1,bowlerOverLimit:overLimit,freeHit:false,undoStack:[],inningsHistory:[]};
  batXi.forEach(id=>{const p=batTeam.players.find(x=>x.id===id);if(p)inn.batStats[id]={id,name:p.name,runs:0,balls:0,fours:0,sixes:0,out:false,retired:false,howOut:'',assist:''};});
  bowlXi.forEach(id=>{const p=bowlTeam.players.find(x=>x.id===id);if(p)inn.bowlStats[id]={id,name:p.name,runs:0,balls:0,wickets:0,wides:0,noBalls:0,maidens:0,overRuns:0,oversLimit:overLimit};});
  const id=fixture?.id||rid('m_'),now=nowIso();const match={id,ownerUid:uid,userId:uid,title:cleanText(b.title,100)||'Local Match',tournamentId:t?.id||null,tournamentName:t?.name||'',stage:cleanText(b.stage,30)||'league',groupName:cleanText(b.groupName,40),teamA:A.id,teamB:B.id,teamAName:A.name,teamBName:B.name,teamALogo:A.logo||'',teamBLogo:B.logo||'',oversLimit:overs,bowlerOverLimit:overLimit,tossWinner:String(b.tossWinner),tossDecision:decision,tossMode:b.tossMode==='auto'?'auto':'manual',ballType:['tennis','leather'].includes(String(b.ballType))?String(b.ballType):'leather',venue:cleanText(b.venue||b.location,140),state:cleanText(b.state||t?.state,80),district:cleanText(b.district||t?.district,80),tehsil:cleanText(b.tehsil||t?.tehsil,80),pinCode:cleanText(b.pinCode||t?.pinCode,6),umpireOne:cleanText(b.umpireOne,80),umpireTwo:cleanText(b.umpireTwo,80),scorerName:cleanText(b.scorerName,80),location:cleanText(b.venue||b.location||t?.venue||'Venue to be confirmed',140),startedAt:now,updatedAt:now,lastActivityAt:now,scheduledAt:fixture?.dateTime||null,dateTime:String(b.dateTime||fixture?.dateTime||now),status:'live',inningsNo:1,teamXIs:{[A.id]:xiA,[B.id]:xiB},activeInnings:inn,inningsHistory:[],result:null,createdAt:fixture?.createdAt||now};
  // Transactional active pointer prevents two tabs from starting two matches at once.
  const publicMatch=await enrichMatch(uid,match);
  await runTransaction(db,async tx=>{const activeRef=ownerDoc(uid,'meta','active'),activeSnap=await tx.get(activeRef);if(activeSnap.exists()){const activeId=activeSnap.data().matchId;const activeMatch=await tx.get(ownerDoc(uid,'matches',activeId));if(activeMatch.exists()&&activeMatch.data().status==='live')throw Object.assign(new Error('आपके खाते में एक Match पहले से LIVE है।'),{status:409,code:'ACTIVE_MATCH_EXISTS',matchId:activeId,matches:[{id:activeId,...activeMatch.data()}]});}
    tx.set(ownerDoc(uid,'matches',id),cleanData(match));tx.set(activeRef,{matchId:id,updatedAt:now});tx.set(publicDoc('publicMatches',id),cleanData(publicMatch));});
  await deleteDoc(ownerDoc(uid,'drafts','current')).catch(()=>{});if(match.tournamentId)await refreshPublicTournament(uid,match.tournamentId);return match;
}

// Start realtime listeners for pages that need updates, and publish the initial snapshot.
subscribePublic();
window.__JC_FIREBASE_BACKEND_STATUS__ = { mode:'github-pages-firebase', connected:true, projectId:firebaseConfig.projectId };
window.JangidBackendStatus = { mode:'github-pages-firebase', connected:true, projectId:firebaseConfig.projectId, provider:'Firebase Auth + Firestore' };
