import { auth, firestore } from "../firebase-init.mjs";
import {
  collection, doc, getDoc, getDocs, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const ROLES = new Set(["batsman", "bowler", "allrounder", "wicketkeeper"]);
const clean = (value, max = 80) => String(value ?? "").trim().slice(0, max);

function ownerUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("पहले Firebase में Login करें।");
  return uid;
}
function teamsRef(uid = ownerUid()) {
  return collection(firestore, "users", uid, "teams");
}
function teamRef(teamId, uid = ownerUid()) {
  return doc(firestore, "users", uid, "teams", clean(teamId, 120));
}
function normalizePlayer(input = {}, id) {
  const name = clean(input.name);
  if (!name) throw new Error("Player का नाम जरूरी है।");
  const role = ROLES.has(String(input.role)) ? String(input.role) : "batsman";
  return { id: id || clean(input.id, 120), name, role,
    captain: input.captain === true, viceCaptain: input.viceCaptain === true };
}
function normalizeTeam(input = {}) {
  const name = clean(input.name);
  if (!name) throw new Error("Team का नाम जरूरी है।");
  const logo = typeof input.logo === "string" ? input.logo : "";
  if (logo && (!/^data:image\/(webp|png|jpeg);base64,/i.test(logo) || logo.length > 500000)) {
    throw new Error("Team logo compressed image होना चाहिए और उसका आकार 500 KB से कम होना चाहिए।");
  }
  return { name, logo };
}
function withUniqueLeaders(players, selected) {
  return players.map(p => ({ ...p,
    captain: selected.captain ? p.id === selected.captain : p.captain,
    viceCaptain: selected.viceCaptain ? p.id === selected.viceCaptain : p.viceCaptain
  }));
}

// Firestore structure: users/{uid}/teams/{teamId}; players stay embedded
// in the team document to preserve the existing Control Board data shape.
export async function listTeams() {
  const snap = await getDocs(teamsRef());
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function createTeam(input) {
  const uid = ownerUid();
  const data = normalizeTeam(input);
  const ref = doc(teamsRef(uid));
  const team = { ...data, userId: uid, players: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await runTransaction(firestore, async tx => tx.set(ref, team));
  return { id: ref.id, ...team };
}
export async function updateTeam(teamId, patch) {
  const uid = ownerUid(), ref = teamRef(teamId, uid);
  const data = {};
  if (patch.name !== undefined) data.name = clean(patch.name);
  if (patch.logo !== undefined) data.logo = normalizeTeam({ name: "valid", logo: patch.logo }).logo;
  if (data.name !== undefined && !data.name) throw new Error("Team का नाम खाली नहीं हो सकता।");
  await runTransaction(firestore, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Team नहीं मिली।");
    tx.update(ref, { ...data, updatedAt: serverTimestamp() });
  });
  return (await getDoc(ref)).data();
}
export async function deleteTeam(teamId) {
  const uid = ownerUid(), ref = teamRef(teamId, uid);
  await runTransaction(firestore, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Team नहीं मिली।");
    tx.delete(ref);
  });
  return true;
}
export async function addPlayer(teamId, input) {
  const uid = ownerUid(), ref = teamRef(teamId, uid), player = normalizePlayer(input, crypto.randomUUID());
  await runTransaction(firestore, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Team नहीं मिली।");
    const players = Array.isArray(snap.data().players) ? snap.data().players : [];
    if (players.some(p => p.captain) && player.captain) player.captain = false;
    if (players.some(p => p.viceCaptain) && player.viceCaptain) player.viceCaptain = false;
    tx.update(ref, { players: [...players, player], updatedAt: serverTimestamp() });
  });
  return player;
}
export async function updatePlayer(teamId, playerId, patch) {
  const uid = ownerUid(), ref = teamRef(teamId, uid);
  let updated;
  await runTransaction(firestore, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Team नहीं मिली।");
    const players = Array.isArray(snap.data().players) ? snap.data().players : [];
    if (!players.some(p => p.id === playerId)) throw new Error("Player नहीं मिला।");
    const old = players.find(p => p.id === playerId);
    const next = normalizePlayer({ ...old, ...patch }, playerId);
    const selected = { captain: patch.captain === true ? playerId : null,
      viceCaptain: patch.viceCaptain === true ? playerId : null };
    updated = withUniqueLeaders(players.map(p => p.id === playerId ? next : p), selected);
    tx.update(ref, { players: updated, updatedAt: serverTimestamp() });
  });
  return updated.find(p => p.id === playerId);
}
export async function removePlayer(teamId, playerId) {
  const uid = ownerUid(), ref = teamRef(teamId, uid);
  await runTransaction(firestore, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Team नहीं मिली।");
    const players = Array.isArray(snap.data().players) ? snap.data().players : [];
    const next = players.filter(p => p.id !== playerId);
    if (next.length === players.length) throw new Error("Player नहीं मिला।");
    tx.update(ref, { players: next, updatedAt: serverTimestamp() });
  });
  return true;
}

// Converts one legacy server-side team object without changing its IDs/roster.
// Call only after a verified backup and an explicit migration decision.
export function convertLegacyTeam(team) {
  if (!team || !team.id || !team.userId) throw new Error("पुराना Team record अधूरा है।");
  const base = normalizeTeam(team);
  const players = (Array.isArray(team.players) ? team.players : []).map(p => normalizePlayer(p, clean(p.id, 120)));
  return { id: clean(team.id, 120), userId: clean(team.userId, 120), ...base, players };
}
