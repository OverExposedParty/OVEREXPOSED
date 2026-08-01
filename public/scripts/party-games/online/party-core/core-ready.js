async function waitForOnlineCore() {
  const timeoutMs = 30000;

  if (window.Ready?.when) {
    await Ready.when('online-core', { timeout: timeoutMs });
  }

  const startTime = Date.now();

  while (
    typeof window.checkAndMaybeBecomeHost !== 'function' ||
    typeof window.joinParty !== 'function' ||
    typeof window.updateOnlineParty !== 'function' ||
    typeof window.addUserToParty !== 'function' ||
    typeof window.UpdateUserPartyData !== 'function' ||
    typeof window.ShowPartyDoesNotExistState !== 'function' ||
    typeof window.ShowGameAlreadyStartedState !== 'function'
  ) {
    if (Date.now() - startTime >= timeoutMs) {
      throw new Error('Online core scripts did not finish loading in time.');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

window.waitForOnlineCore = waitForOnlineCore;

// Basic Socket.IO client init
socket = io();

socket.on('connect', () => {
  debugLog('Socket connected successfully');
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err);
});
