(() => {
  const base = { mode: 'github-pages-firebase', hosting: 'github-pages', provider: 'firebase-firestore' };
  window.JangidBackendStatus = window.JangidBackendStatus || { ...base, connected: false, message: 'Firebase setup जाँच रही है…' };
  window.JangidRepositoryContract = Object.freeze({
    auth: ['register', 'login', 'logout', 'resetPassword'],
    teams: ['list', 'create', 'update', 'remove', 'addPlayer', 'updatePlayer', 'removePlayer'],
    tournaments: ['list', 'create', 'update', 'delete', 'publish'],
    matches: ['schedule', 'start', 'saveBall', 'undo', 'finish', 'resume'],
    broadcast: ['readState', 'subscribe', 'saveSettings'],
    note: 'GitHub Pages static hosting with Firebase browser SDK. Firebase Web App config and Firestore Rules must be set before live use.'
  });
})();
