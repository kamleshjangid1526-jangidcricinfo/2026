/**
 * Jangid Cricinfo - Tournament Control Bridge (Phase 11)
 *
 * This is an opt-in bridge for the future Control Board integration.
 * It deliberately does not replace the legacy /api/state or /api/tournament
 * calls until the full app migration and Firebase authentication flow are tested.
 */
import { auth } from './firebase-init.mjs';
import * as Tournament from './tournament-service.mjs';
import * as Teams from './team-player-service.mjs';

function requireSignedIn() {
  if (!auth.currentUser?.uid) throw new Error('पहले Firebase में Login करें।');
  return auth.currentUser.uid;
}

export async function loadTournamentWorkspace() {
  requireSignedIn();
  const [tournaments, teams] = await Promise.all([
    Tournament.listTournaments(),
    Teams.listTeams()
  ]);
  return {
    tournaments,
    teams,
    // Match records are intentionally not included: they remain on the legacy
    // API until their own migration phase is complete.
    matches: [],
    source: 'firebase-firestore'
  };
}

export async function createTournamentFromControlBoard(payload) {
  requireSignedIn();
  return Tournament.createTournament(payload);
}

export async function updateTournamentFromControlBoard(id, payload) {
  requireSignedIn();
  return Tournament.updateTournament(id, payload);
}

export async function addExistingTeamToTournament(tournamentId, teamId, groupName = '') {
  requireSignedIn();
  return Tournament.addTeamToTournament(tournamentId, teamId, groupName);
}

export async function removeTeamFromTournamentOnly(tournamentId, teamId) {
  requireSignedIn();
  // Removes only the tournament membership; does not delete the Team or Players.
  return Tournament.removeTeamFromTournament(tournamentId, teamId);
}

export async function saveTournamentGroupAssignments(tournamentId, teamGroups) {
  requireSignedIn();
  return Tournament.saveTournamentGroups(tournamentId, teamGroups);
}

export async function createTeamAndAttachToTournament(tournamentId, name) {
  requireSignedIn();
  const team = await Teams.createTeam({ name });
  try {
    await Tournament.addTeamToTournament(tournamentId, team.id);
  } catch (error) {
    // Keep the new Team intact for recovery; do not silently delete user data.
    error.createdTeamId = team.id;
    throw error;
  }
  return team;
}

export async function addPlayerToTournamentTeam(teamId, player) {
  requireSignedIn();
  return Teams.addPlayer(teamId, player);
}

export async function getTournamentControlBridgeStatus() {
  return {
    authenticated: Boolean(auth.currentUser?.uid),
    uid: auth.currentUser?.uid || null,
    bridge: 'phase-11-opt-in',
    legacyApiReplaced: false,
    matchDataMigrated: false
  };
}
