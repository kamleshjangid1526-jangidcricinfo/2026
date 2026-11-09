import { auth, firestore } from './firebase-init.mjs';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const clean = (v, max = 160) => String(v ?? '').trim().slice(0, max);
const uidOrThrow = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('पहले Firebase में Login करें।');
  return uid;
};
const privateTournamentRef = (uid, id) => doc(firestore, 'users', uid, 'tournaments', String(id));
const privateTeamsRef = uid => collection(firestore, 'users', uid, 'teams');
const publicRef = id => doc(firestore, 'publicTournaments', String(id));

function safeTeam(team) {
  return {
    id: clean(team.id, 120), name: clean(team.name, 80),
    logo: typeof team.logo === 'string' && team.logo.length <= 180000 ? team.logo : '',
    players: (Array.isArray(team.players) ? team.players : []).slice(0, 30).map(p => ({
      id: clean(p.id, 100), name: clean(p.name, 80), role: clean(p.role, 24),
      captain: p.captain === true, viceCaptain: p.viceCaptain === true
    }))
  };
}

// Publish only the selected tournament and its selected teams. Matches/scores
// are intentionally omitted until the match data migration is complete.
export async function publishTournament(tournamentId) {
  const uid = uidOrThrow();
  const tSnap = await getDoc(privateTournamentRef(uid, tournamentId));
  if (!tSnap.exists()) throw new Error('आपका Tournament नहीं मिला।');
  const t = tSnap.data();
  const teamSnap = await getDocs(privateTeamsRef(uid));
  const wanted = new Set(Array.isArray(t.teamIds) ? t.teamIds.map(String) : []);
  const teams = teamSnap.docs.filter(s => wanted.has(s.id)).map(s => safeTeam({ id: s.id, ...s.data() }));
  const banner = typeof t.banner === 'string' && t.banner.length <= 350000 ? t.banner : '';
  const payload = {
    id: String(tournamentId), ownerUid: uid, published: true,
    name: clean(t.name, 100) || 'Tournament', description: clean(t.description, 500),
    bannerUrl: banner, format: clean(t.format, 30) || 'league', groupCount: Number(t.groupCount) || 1,
    venue: clean(t.venue, 120), state: clean(t.state, 80), district: clean(t.district, 80),
    tehsil: clean(t.tehsil, 80), pinCode: clean(t.pinCode, 6),
    startDate: clean(t.startDate, 20), endDate: clean(t.endDate, 20),
    teamGroups: t.teamGroups && typeof t.teamGroups === 'object' ? t.teamGroups : {},
    teams, teamCount: teams.length, matchCount: 0, liveCount: 0, completedCount: 0, scheduledCount: 0,
    updatedAt: serverTimestamp()
  };
  await setDoc(publicRef(tournamentId), payload, { merge: true });
  return { id: String(tournamentId), published: true, teamCount: teams.length };
}

export async function unpublishTournament(tournamentId) {
  const uid = uidOrThrow();
  const ref = publicRef(tournamentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { id: String(tournamentId), published: false };
  if (snap.data().ownerUid !== uid) throw new Error('इस Tournament को Unpublish करने की अनुमति नहीं है।');
  await deleteDoc(ref);
  return { id: String(tournamentId), published: false };
}

export async function getPublicTournament(tournamentId) {
  const snap = await getDoc(publicRef(tournamentId));
  if (!snap.exists() || snap.data().published !== true) return null;
  const d = snap.data();
  const fixtureSnap = await getDocs(collection(firestore, 'publicTournaments', snap.id, 'fixtures'));
  const fixtures = fixtureSnap.docs.map(x => ({ ...x.data(), id: x.id })).sort((a,b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')));
  return { ...d, id: snap.id, tournament: d, matches: fixtures, fixtures, teams: Array.isArray(d.teams) ? d.teams : [] };
}

export async function listPublicTournaments() {
  const snap = await getDocs(collection(firestore, 'publicTournaments'));
  return snap.docs.map(s => ({ ...s.data(), id: s.id })).filter(t => t.published === true)
    .sort((a, b) => String(b.updatedAt?.seconds || '').localeCompare(String(a.updatedAt?.seconds || '')));
}


/**
 * Subscribe to a published tournament and its public fixture subcollection.
 * This removes reliance on the legacy /events SSE endpoint for Firebase-hosted pages.
 * Returns an unsubscribe function.
 */
export function watchPublicTournament(tournamentId, onData, onError = () => {}) {
  const tid = String(tournamentId);
  let tournamentData = null;
  let fixtures = [];
  let stopFixtures = null;
  let stopped = false;
  const emit = () => {
    if (!stopped) onData(tournamentData ? {
      ...tournamentData, id: tid, tournament: tournamentData,
      matches: fixtures, fixtures,
      teams: Array.isArray(tournamentData.teams) ? tournamentData.teams : []
    } : null);
  };
  const stopTournament = onSnapshot(publicRef(tid), (snap) => {
    if (!snap.exists() || snap.data().published !== true) {
      tournamentData = null; fixtures = [];
      if (stopFixtures) { stopFixtures(); stopFixtures = null; }
      emit(); return;
    }
    tournamentData = snap.data();
    if (!stopFixtures) {
      stopFixtures = onSnapshot(publicFixtures(tid), (fixtureSnap) => {
        fixtures = fixtureSnap.docs.map(x => ({ ...x.data(), id: x.id }))
          .sort((a,b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')));
        emit();
      }, onError);
    } else emit();
  }, onError);
  return () => {
    stopped = true;
    stopTournament();
    if (stopFixtures) stopFixtures();
  };
}
