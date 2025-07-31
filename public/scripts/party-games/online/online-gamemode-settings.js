function parseGameSettings(settingsString) {
  if (!settingsString) return [];
  return settingsString.split(',').filter(Boolean);
}