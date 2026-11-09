import { auth, firestore } from './firebase-init.mjs';
import {
  collection, doc, getDoc, getDocs, runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const FORMATS = new Set(['league', 'groups-knockout', 'knockout']);
const clean = (v, n = 120) => String(v ?? '').trim().slice(0, n);
const uidOrThrow = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('पहले Firebase में Login करें।');
  return uid;
};
const tournamentsRef = (uid = uidOrThrow()) => collection(firestore, 'users', uid, 'tournaments');
const tournamentRef = (id, uid = uidOrThrow()) => doc(firestore, 'users', uid, 'tournaments', String(id));
const teamsRef = (uid = uidOrThrow()) => collection(firestore, 'users', uid, 'teams');
const teamRef = (id, uid = uidOrThrow()) => doc(firestore, 'users', uid, 'teams', String(id));
const newId = () => `tr_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;

function normalizeTournament(raw = {}, id) {
  const format = FORMATS.has(raw.format) ? raw.format : 'league';
  const groupCount = format === 'groups-knockout' ? Math.max(2, Math.min(8, Math.floor(Number(raw.groupCount) || 2))) : 1;
  const teamIds = Array.isArray(raw.teamIds) ? [...new Set(raw.teamIds.map(x => clean(x, 120)).filter(Boolean))] : [];
  const teamGroups = {};
  for (const teamId of teamIds) teamGroups[teamId] = format === 'groups-knockout'
    ? (validGroups(groupCount).includes(raw.teamGroups?.[teamId]) ? raw.teamGroups[teamId] : 'Group A')
    : 'League';
  return {
    id: String(id), userId: uidOrThrow(), name: clean(raw.name, 100) || 'Tournament',
    banner: typeof raw.banner === 'string' ? raw.banner : '', format, groupCount,
    venue: clean(raw.venue, 120), state: clean(raw.state, 80), district: clean(raw.district, 80),
    tehsil: clean(raw.tehsil, 80), pinCode: clean(raw.pinCode, 6),
    startDate: clean(raw.startDate, 20), endDate: clean(raw.endDate, 20),
    description: clean(raw.description, 500), teamIds, teamGroups,
    createdAt: raw.createdAt ?? null, updatedAt: raw.updatedAt ?? null
  };
}
function validGroups(count) { return Array.from({ length: count }, (_, i) => `Group ${String.fromCharCode(65 + i)}`); }
function validateInput(input = {}) {
  const name = clean(input.name, 100);
  if (!name) throw new Error('Tournament का नाम जरूरी है।');
  const format = FORMATS.has(input.format) ? input.format : 'league';
  const groupCount = format === 'groups-knockout' ? Math.max(2, Math.min(8, Math.floor(Number(input.groupCount) || 2))) : 1;
  const pinCode = clean(input.pinCode, 6);
  if (pinCode && !/^\d{6}$/.test(pinCode)) throw new Error('PIN Code 6 अंकों का होना चाहिए।');
  const startDate = clean(input.startDate, 20), endDate = clean(input.endDate, 20);
  if (startDate && endDate && endDate < startDate) throw new Error('Tournament की End Date, Start Date से पहले नहीं हो सकती।');
  const banner = typeof input.banner === 'string' ? input.banner : '';
  if (banner && (!/^data:image\/(webp|png|jpeg);base64,/i.test(banner) || banner.length > 1800000)) throw new Error('Banner compressed PNG/JPEG/WebP होना चाहिए और 1.3 MB से कम होना चाहिए।');
  return { name, format, groupCount, pinCode, startDate, endDate, banner,
    venue: clean(input.venue, 120), state: clean(input.state, 80), district: clean(input.district, 80),
    tehsil: clean(input.tehsil, 80), description: clean(input.description, 500) };
}

export async function listTournaments() {
  const snap = await getDocs(tournamentsRef());
  return snap.docs.map(s => normalizeTournament(s.data(), s.id));
}
export async function getTournament(id) {
  const snap = await getDoc(tournamentRef(id));
  return snap.exists() ? normalizeTournament(snap.data(), snap.id) : null;
}
export async function createTournament(input = {}) {
  const uid = uidOrThrow(), id = newId(), cleanData = validateInput(input);
  const payload = { ...cleanData, teamIds: [], teamGroups: {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await runTransaction(firestore, async tx => tx.set(tournamentRef(id, uid), payload));
  return normalizeTournament({ ...payload, createdAt: null, updatedAt: null }, id);
}
export async function updateTournament(id, patch = {}) {
  const uid = uidOrThrow();
  await runTransaction(firestore, async tx => {
    const ref = tournamentRef(id, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tournament नहीं मिला।');
    const current = snap.data();
    const merged = validateInput({ ...current, ...patch, banner: patch.banner === undefined ? current.banner : patch.banner });
    const nextGroups = {};
    for (const teamId of current.teamIds || []) nextGroups[teamId] = merged.format === 'groups-knockout'
      ? (validGroups(merged.groupCount).includes(current.teamGroups?.[teamId]) ? current.teamGroups[teamId] : 'Group A') : 'League';
    tx.update(ref, { ...merged, teamGroups: nextGroups, updatedAt: serverTimestamp() });
  });
  return getTournament(id);
}
export async function addTeamToTournament(tournamentId, teamId, groupName = '') {
  const uid = uidOrThrow();
  await runTransaction(firestore, async tx => {
    const tr = tournamentRef(tournamentId, uid), team = teamRef(teamId, uid);
    const [ts, teamSnap] = await Promise.all([tx.get(tr), tx.get(team)]);
    if (!ts.exists()) throw new Error('Tournament नहीं मिला।');
    if (!teamSnap.exists()) throw new Error('आपकी Team नहीं मिली।');
    const data = ts.data(), ids = Array.isArray(data.teamIds) ? [...data.teamIds] : [];
    if (ids.includes(String(teamId))) return;
    ids.push(String(teamId));
    const groups = { ...(data.teamGroups || {}) };
    if (data.format === 'groups-knockout') {
      const count = Math.max(2, Math.min(8, Number(data.groupCount) || 2)), valid = validGroups(count);
      if (groupName && !valid.includes(groupName)) throw new Error('Group का चयन सही नहीं है।');
      if (groupName) groups[teamId] = groupName;
      else {
        const counts = valid.map(g => ({ g, n: ids.filter(id => id !== String(teamId) && groups[id] === g).length }));
        counts.sort((a, b) => a.n - b.n); groups[teamId] = counts[0].g;
      }
    } else groups[teamId] = 'League';
    tx.update(tr, { teamIds: ids, teamGroups: groups, updatedAt: serverTimestamp() });
  });
  return getTournament(tournamentId);
}
export async function removeTeamFromTournament(tournamentId, teamId) {
  const uid = uidOrThrow();
  await runTransaction(firestore, async tx => {
    const ref = tournamentRef(tournamentId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tournament नहीं मिला।');
    const data = snap.data(), ids = (data.teamIds || []).filter(id => String(id) !== String(teamId));
    if (ids.length === (data.teamIds || []).length) throw new Error('यह Team इस Tournament में नहीं है।');
    const groups = { ...(data.teamGroups || {}) }; delete groups[teamId];
    tx.update(ref, { teamIds: ids, teamGroups: groups, updatedAt: serverTimestamp() });
  });
  return getTournament(tournamentId);
}
export async function saveTournamentGroups(tournamentId, submitted = {}) {
  const uid = uidOrThrow();
  await runTransaction(firestore, async tx => {
    const ref = tournamentRef(tournamentId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tournament नहीं मिला।');
    const data = snap.data();
    if (data.format !== 'groups-knockout') throw new Error('यह Tournament Group format में नहीं है।');
    const valid = validGroups(Math.max(2, Math.min(8, Number(data.groupCount) || 2))), groups = {};
    for (const id of data.teamIds || []) {
      const group = clean(submitted[id] || data.teamGroups?.[id] || 'Group A', 20);
      if (!valid.includes(group)) throw new Error(`Team ${id} के लिए Group सही नहीं है।`);
      groups[id] = group;
    }
    tx.update(ref, { teamGroups: groups, updatedAt: serverTimestamp() });
  });
  return getTournament(tournamentId);
}
// Deliberately no deleteTournament(): match/fixture references must be migrated first to avoid orphaned records.
