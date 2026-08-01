const onlineGameSettingsHandlers = [
  'refreshActivePartyLobbyLock',
  'ToggleOnlineMode',
  'resetOnlineSettingsAfterMissingParty',
  'resumeHostedOnlinePartyFromUrl'
];

const missingOnlineGameSettingsHandlers = onlineGameSettingsHandlers.filter(
  handler => typeof window[handler] !== 'function'
);

if (missingOnlineGameSettingsHandlers.length > 0) {
  throw new Error(
    `Online game settings modules failed to load: ${missingOnlineGameSettingsHandlers.join(', ')}`
  );
}

resumeHostedOnlinePartyFromUrl().catch((error) => {
  console.error('Failed to resume hosted party settings:', error);
});
startActivePartyLobbyLockRefresh();
