bindGamemodeSettingsActions();

const gamemodeSettingsReady =
  typeof initializeGamemodeSettingsWhenReady === 'function'
    ? initializeGamemodeSettingsWhenReady().catch((error) => {
        console.error('Failed to initialize gamemode settings:', error);
      })
    : Promise.resolve();

if (window.OEReady) {
  window.OEReady.register('gamemode-settings-initialized', gamemodeSettingsReady);
}
