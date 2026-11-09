import { auth, firestore } from './firebase-init.mjs';
import {
  collection, doc, getDoc, getDocs, runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const ROLES = new Set(['batsman', 'bowler', 'allrounder', 'wicketkeeper']);
const cleanText = (value, max, fallback = '') => String(value ?? fallback).trim().slice(0, max);
const ownerUid = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('पहले Firebase में Login करें।');
  return uid;
};
const teamsRef = (uid = ownerUid()) => collection(firestore, 'users', uid, 'teams');
const teamRef = (teamId, uid = ownerUid()) => doc(firestore, 'users', uid, 'teams', String(teamId));
const makeId = prefix => `${prefix}_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;

function normalizePlayer(player = {}) {
  const role = ROLES.has(String(player.role || '').toLowerCase()) ? String(player.role).toLowerCase() : 'batsman';
  return {
    id: cleanText(player.id, 100) || makeId('p'),
    name: cleanText(player.name, 80, 'Player') || 'Player',
    role,
    captain: player.captain === true,
    viceCaptain: player.viceCaptain === true
  };
}
function normalizeTeam(data = {}, id) {
  return {
    id: String(id),
    userId: ownerUid(),
    name: cleanText(data.name, 80, 'Team') || 'Team',
    logo: typeof data.logo === 'string' ? data.logo : '',
    players: Array.isArray(data.players) ? data.players.map(normalizePlayer) : [],
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
}
function validateLogo(logo) {
  if (!logo) return '';
  if (typeof logo !== 'string' || !/^data:image\/(webp|png|jpeg);base64,/i.test(logo) || logo.length > 500000) {
    throw new Error('Team logo compressed PNG/JPEG/WebP image होना चाहिए।');
  }
  return logo;
}
function enforceCaptainUniqueness(players) {
  let captain = false, vice = false;
  return players.map(p => {
    const next = { ...p };
    if (next.captain) { next.captain = !captain; captain = true; }
    if (next.viceCaptain) { next.viceCaptain = !vice; vice = true; }
    return next;
  });
}

// Returns the same team object shape consumed by the existing Control Board.
export async function listTeams() {
  const snap = await getDocs(teamsRef());
  return snap.docs.map(s => normalizeTeam(s.data(), s.id));
}
export async function getTeam(teamId) {
  const snap = await getDoc(teamRef(teamId));
  return snap.exists() ? normalizeTeam(snap.data(), snap.id) : null;
}
export async function createTeam({ name, logo = '' } = {}) {
  const uid = ownerUid();
  const id = makeId('t');
  const payload = { name: cleanText(name, 80, 'Team') || 'Team', logo: validateLogo(logo), players: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await runTransaction(firestore, async tx => tx.set(teamRef(id, uid), payload));
  return normalizeTeam({ ...payload, createdAt: null, updatedAt: null }, id);
}
export async function updateTeam(teamId, patch = {}) {
  const uid = ownerUid();
  await runTransaction(firestore, async tx => {
    const ref = teamRef(teamId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Team नहीं मिली।');
    const next = {};
    if (patch.name !== undefined) {
      const name = cleanText(patch.name, 80);
      if (!name) throw new Error('Team का नाम जरूरी है।');
      next.name = name;
    }
    if (patch.logo !== undefined) next.logo = validateLogo(patch.logo);
    next.updatedAt = serverTimestamp();
    tx.update(ref, next);
  });
  return getTeam(teamId);
}
export async function deleteTeam(teamId) {
  const uid = ownerUid();
  await runTransaction(firestore, async tx => {
    const ref = teamRef(teamId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Team नहीं मिली।');
    tx.delete(ref);
  });
  return { ok: true, id: String(teamId) };
}
export async function addPlayer(teamId, player = {}) {
  const uid = ownerUid();
  let updated;
  await runTransaction(firestore, async tx => {
    const ref = teamRef(teamId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Team नहीं मिली।');
    const data = snap.data(), players = Array.isArray(data.players) ? data.players.map(normalizePlayer) : [];
    let next = normalizePlayer(player);
    if (players.some(p => p.id === next.id)) next.id = makeId('p');
    if (next.captain) players.forEach(p => p.captain = false);
    if (next.viceCaptain) players.forEach(p => p.viceCaptain = false);
    players.push(next);
    tx.update(ref, { players: enforceCaptainUniqueness(players), updatedAt: serverTimestamp() });
    updated = next;
  });
  return { player: updated, team: await getTeam(teamId) };
}
export async function updatePlayer(teamId, playerId, patch = {}) {
  const uid = ownerUid();
  await runTransaction(firestore, async tx => {
    const ref = teamRef(teamId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Team नहीं मिली।');
    const data = snap.data(), players = Array.isArray(data.players) ? data.players.map(normalizePlayer) : [];
    const index = players.findIndex(p => p.id === String(playerId));
    if (index < 0) throw new Error('Player नहीं मिला।');
    const current = players[index];
    if (patch.name !== undefined) {
      const name = cleanText(patch.name, 80);
      if (!name) throw new Error('Player का नाम जरूरी है।');
      current.name = name;
    }
    if (patch.role !== undefined) {
      const role = String(patch.role).toLowerCase();
      if (!ROLES.has(role)) throw new Error('Player role सही नहीं है।');
      current.role = role;
    }
    if (patch.captain === true) players.forEach(p => p.captain = p.id === current.id);
    else if (patch.captain === false) current.captain = false;
    if (patch.viceCaptain === true) players.forEach(p => p.viceCaptain = p.id === current.id);
    else if (patch.viceCaptain === false) current.viceCaptain = false;
    tx.update(ref, { players: enforceCaptainUniqueness(players), updatedAt: serverTimestamp() });
  });
  return getTeam(teamId);
}
export async function removePlayer(teamId, playerId) {
  const uid = ownerUid();
  await runTransaction(firestore, async tx => {
    const ref = teamRef(teamId, uid), snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Team नहीं मिली।');
    const players = Array.isArray(snap.data().players) ? snap.data().players : [];
    const next = players.filter(p => String(p.id) !== String(playerId));
    if (next.length === players.length) throw new Error('Player नहीं मिला।');
    tx.update(ref, { players: next, updatedAt: serverTimestamp() });
  });
  return getTeam(teamId);
}
