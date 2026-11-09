import { auth, firestore } from './firebase-init.mjs';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const clean = (v, n = 120) => String(v ?? '').trim().slice(0, n);
const uidOrThrow = () => { const uid = auth.currentUser?.uid; if (!uid) throw new Error('पहले Firebase में Login करें।'); return uid; };
const privateTournament = (uid, tid) => doc(firestore, 'users', uid, 'tournaments', String(tid));
const privateFixtures = (uid, tid) => collection(firestore, 'users', uid, 'tournaments', String(tid), 'fixtures');
const privateFixture = (uid, tid, mid) => doc(firestore, 'users', uid, 'tournaments', String(tid), 'fixtures', String(mid));
const publicTournament = tid => doc(firestore, 'publicTournaments', String(tid));
const publicFixtures = tid => collection(firestore, 'publicTournaments', String(tid), 'fixtures');
const publicFixture = (tid, mid) => doc(firestore, 'publicTournaments', String(tid), 'fixtures', String(mid));
const newId = () => `fx_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;

function validate(input, tournament) {
  const teamAId = clean(input.teamAId, 120), teamBId = clean(input.teamBId, 120);
  if (!teamAId || !teamBId || teamAId === teamBId) throw new Error('दो अलग-अलग Teams चुनें।');
  const teamIds = Array.isArray(tournament.teamIds) ? tournament.teamIds.map(String) : [];
  if (!teamIds.includes(teamAId) || !teamIds.includes(teamBId)) throw new Error('दोनों Teams इसी Tournament में होनी चाहिए।');
  const dateTime = clean(input.dateTime, 32);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime) || Number.isNaN(Date.parse(dateTime))) throw new Error('मैच की तारीख और समय सही भरें।');
  const status = input.status === 'cancelled' ? 'cancelled' : 'scheduled';
  return {
    teamAId, teamBId,
    teamAName: clean(input.teamAName, 80) || 'Team A',
    teamBName: clean(input.teamBName, 80) || 'Team B',
    dateTime, stage: clean(input.stage, 60) || 'League',
    venue: clean(input.venue || tournament.venue, 120),
    overs: Math.max(1, Math.min(50, Math.floor(Number(input.overs) || 20))),
    status, notes: clean(input.notes, 240)
  };
}
function publicSafe(f) {
  return { id: f.id, teamAId: f.teamAId, teamBId: f.teamBId,
    teamAName: f.teamAName, teamBName: f.teamBName, dateTime: f.dateTime,
    stage: f.stage, venue: f.venue, overs: f.overs, status: f.status,
    notes: f.notes || '', updatedAt: serverTimestamp() };
}

export async function listTournamentFixtures(tournamentId) {
  const uid = uidOrThrow();
  const snap = await getDocs(privateFixtures(uid, tournamentId));
  return snap.docs.map(s => ({ ...s.data(), id: s.id })).sort((a,b) => a.dateTime.localeCompare(b.dateTime));
}
export async function saveTournamentFixture(tournamentId, input = {}, fixtureId = '') {
  const uid = uidOrThrow();
  const ts = await getDoc(privateTournament(uid, tournamentId));
  if (!ts.exists()) throw new Error('Tournament नहीं मिला।');
  const tournament = ts.data();
  const payload = validate(input, tournament);
  const id = fixtureId ? clean(fixtureId, 120) : newId();
  if (!/^fx_[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Fixture ID सही नहीं है।');
  const ref = privateFixture(uid, tournamentId, id);
  const existing = await getDoc(ref);
  const record = { ...payload, tournamentId: String(tournamentId), ownerUid: uid,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(ref, record);
  // Public copy is updated only when the tournament is already published.
  const pub = await getDoc(publicTournament(tournamentId));
  if (pub.exists() && pub.data().published === true && pub.data().ownerUid === uid) {
    await setDoc(publicFixture(tournamentId, id), publicSafe({ ...record, id }));
    const all = await getDocs(publicFixtures(tournamentId));
    const rows = all.docs.map(s => s.data());
    await setDoc(publicTournament(tournamentId), {
      matchCount: rows.length,
      scheduledCount: rows.filter(x => x.status === 'scheduled').length,
      liveCount: rows.filter(x => x.status === 'live').length,
      completedCount: rows.filter(x => x.status === 'finished').length,
      cancelledCount: rows.filter(x => x.status === 'cancelled').length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  return { ...record, id };
}
/**
 * Controlled fixture lifecycle. This is tournament-fixture administration only;
 * it does not start or finish the legacy live-scoring engine.
 */
export async function updateTournamentFixtureStatus(tournamentId, fixtureId, nextStatus, result = {}) {
  const uid = uidOrThrow();
  const id = clean(fixtureId, 120);
  const ref = privateFixture(uid, tournamentId, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Fixture नहीं मिला।');
  const current = snap.data();
  const transitions = {
    scheduled: ['live', 'cancelled'],
    cancelled: ['scheduled'],
    live: ['finished'],
    finished: []
  };
  const allowed = transitions[current.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`यह स्थिति बदलाव मान्य नहीं है: ${current.status} → ${nextStatus}`);
  }

  let matchResult = null;
  if (nextStatus === 'finished') {
    const outcome = clean(result.outcome, 20);
    if (!['winner', 'tie', 'no_result'].includes(outcome)) {
      throw new Error('मैच का परिणाम चुनें: Winning Team, Tie या No Result।');
    }
    if (outcome === 'winner') {
      const winnerTeamId = clean(result.winnerTeamId, 120);
      if (![current.teamAId, current.teamBId].includes(winnerTeamId)) {
        throw new Error('विजेता इसी Fixture की Team A या Team B होनी चाहिए।');
      }
      matchResult = {
        outcome,
        winnerTeamId,
        winnerTeamName: winnerTeamId === current.teamAId ? current.teamAName : current.teamBName,
        note: clean(result.note, 180)
      };
    } else {
      matchResult = { outcome, winnerTeamId: '', winnerTeamName: '', note: clean(result.note, 180) };
    }
  }

  const update = {
    status: nextStatus,
    updatedAt: serverTimestamp(),
    statusUpdatedBy: uid
  };
  if (nextStatus === 'finished') {
    update.result = matchResult;
    update.finishedAt = serverTimestamp();
  } else if (nextStatus === 'live') {
    update.startedAt = serverTimestamp();
    update.result = null;
  } else if (nextStatus === 'cancelled') {
    update.cancelledAt = serverTimestamp();
  } else if (nextStatus === 'scheduled') {
    update.result = null;
  }
  await setDoc(ref, update, { merge: true });

  const pub = await getDoc(publicTournament(tournamentId));
  if (pub.exists() && pub.data().published === true && pub.data().ownerUid === uid) {
    const publicUpdate = { ...update, id, tournamentId: String(tournamentId) };
    await setDoc(publicFixture(tournamentId, id), publicUpdate, { merge: true });
    const all = await getDocs(publicFixtures(tournamentId));
    const rows = all.docs.map(x => x.data());
    await setDoc(publicTournament(tournamentId), {
      matchCount: rows.length,
      scheduledCount: rows.filter(x => x.status === 'scheduled').length,
      liveCount: rows.filter(x => x.status === 'live').length,
      completedCount: rows.filter(x => x.status === 'finished').length,
      cancelledCount: rows.filter(x => x.status === 'cancelled').length,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  return { ...current, ...update, id, result: matchResult };
}

export async function deleteTournamentFixture(tournamentId, fixtureId) {
  const uid = uidOrThrow(), id = clean(fixtureId, 120);
  const ref = privateFixture(uid, tournamentId, id), snap = await getDoc(ref);
  if (!snap.exists()) return false;
  if (snap.data().status !== 'scheduled' && snap.data().status !== 'cancelled') throw new Error('शुरू हो चुके या पूरे मैच को Fixture से Delete नहीं कर सकते।');
  await deleteDoc(ref);
  const pub = await getDoc(publicTournament(tournamentId));
  if (pub.exists() && pub.data().published === true && pub.data().ownerUid === uid) {
    await deleteDoc(publicFixture(tournamentId, id));
    const all = await getDocs(publicFixtures(tournamentId));
    const rows = all.docs.map(s => s.data());
    await setDoc(publicTournament(tournamentId), { matchCount: rows.length,
      scheduledCount: rows.filter(x => x.status === 'scheduled').length,
      liveCount: rows.filter(x => x.status === 'live').length,
      completedCount: rows.filter(x => x.status === 'finished').length,
      cancelledCount: rows.filter(x => x.status === 'cancelled').length,
      updatedAt: serverTimestamp() }, { merge: true });
  }
  return true;
}
