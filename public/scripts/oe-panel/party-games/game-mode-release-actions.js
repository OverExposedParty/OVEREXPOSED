(function () {
  const ACTION_PREFIX = 'bump-version-';

  function getBumpType(action) {
    const value = String(action || '');
    return value.startsWith(ACTION_PREFIX)
      ? value.slice(ACTION_PREFIX.length)
      : null;
  }

  async function releaseGameMode(row, bumpType) {
    const gameType = String(row?.gamemodeKey || '').trim();
    const currentVersion = String(row?.configuredVersionRaw || '').trim();
    if (!gameType || !currentVersion || currentVersion === 'Legacy') {
      window.alert('This game mode does not have a configured release version.');
      return;
    }

    const confirmed = window.confirm(
      `Create a ${bumpType} release for ${row.gamemode || gameType} from v${currentVersion}?`
    );
    if (!confirmed) return;

    const releaseNote = window.prompt(
      'Describe what changed in this release (3-500 characters):',
      ''
    );
    if (releaseNote == null) return;
    const normalizedReleaseNote = releaseNote.trim();
    if (normalizedReleaseNote.length < 3 || normalizedReleaseNote.length > 500) {
      window.alert('Release notes must contain between 3 and 500 characters.');
      return;
    }

    try {
      const response = await fetch(
        `/api/oe-panel/game-modes/${encodeURIComponent(gameType)}/version`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bump: bumpType,
            expectedVersion: currentVersion,
            releaseNote: normalizedReleaseNote
          })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(
          payload?.error?.message || 'The game-mode release could not be saved.'
        );
      }

      Object.assign(row, payload.data?.row || {});
      window.alert(
        payload.data?.message ||
          `${row.gamemode || gameType} was released successfully.`
      );
      window.dispatchEvent(
        new CustomEvent('oe-panel-party-games-data-changed')
      );
    } catch (error) {
      window.alert(error.message || 'The game-mode release could not be saved.');
    }
  }

  window.addEventListener('oe-panel-table-row-action', (event) => {
    if (event.detail?.gridId !== 'party-games-grid-1') return;
    const bumpType = getBumpType(event.detail?.action);
    if (!['major', 'minor', 'patch'].includes(bumpType)) return;
    releaseGameMode(event.detail.row, bumpType);
  });

  window.OE_PANEL_GAME_MODE_RELEASES = {
    getBumpType,
    releaseGameMode
  };
})();
