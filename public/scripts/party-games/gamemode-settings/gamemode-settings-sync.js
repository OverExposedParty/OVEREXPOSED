async function SetGamemodeContainer() {
  SetGameSettingsButtons();
  if (partyCode) {
    if (
      currentPartyData?.players &&
      typeof syncGamemodeSettingsReadySound === 'function'
    ) {
      syncGamemodeSettingsReadySound(currentPartyData, {
        initializeOnly: true
      });
    }
    try {
      allUsersReady = await GetAllUsersReady();
      await refreshOnlinePlayerCountRestrictions();
    } catch (error) {
      console.error('Failed to initialize online gamemode container:', error);
      allUsersReady = false;
      clearPlayerCountRestrictionError();
    }
  } else {
    clearPlayerCountRestrictionError();
  }
  updateStartGameButton(allUsersReady);
  try {
    await SetGamemodeButtons(true);
  } catch (error) {
    console.error('Failed to initialize gamemode buttons on load:', error);
  }
}

async function UpdateGamemodeContainer() {
  if (partyCode) {
    const existingData = await getExistingPartyData(partyCode);
    const latestParty = existingData?.[0];
    if (!latestParty) {
      if (typeof resetOnlineSettingsAfterMissingParty === 'function') {
        await resetOnlineSettingsAfterMissingParty('missing-during-settings-refresh');
      }
      return;
    }
    if (latestParty && typeof UpdateUserIcons === 'function') {
      currentPartyData = latestParty;
      await UpdateUserIcons(latestParty);
    }
    if (typeof syncGamemodeSettingsReadySound === 'function') {
      syncGamemodeSettingsReadySound(latestParty);
    }
    allUsersReady = await GetAllUsersReady();
    await refreshOnlinePlayerCountRestrictions();
  } else {
    clearPlayerCountRestrictionError();
  }
  updateStartGameButton(allUsersReady);
  SetGamemodeButtons();
}

function removeSetting(settingsObj, key) {
  if (!settingsObj || typeof settingsObj !== 'object') return settingsObj;
  const newSettings = { ...settingsObj };
  delete newSettings[key];
  return newSettings;
}

async function UpdateSettings({ syncOnlineParty = true } = {}) {
  const canSyncOnlineParty =
    syncOnlineParty &&
    window.onlinePartySettingsResumePending !== true &&
    window.onlinePartyTeardownInProgress !== true;
  const syncPartyCode = partyCode;
  gamemodeSelectedPacks = [];
  gamemodeSettings = {};
  gamemodeRoleCounts = {};

  ResetActivePacks(GetAnyPackActive());

  const activePackButtons = Array.from(packButtons).filter((btn) =>
    btn.classList.contains('active')
  );

  activePackButtons.forEach((btn) => {
    const key = btn.dataset.key;
    if (!key) return;

    if (!gamemodeSelectedPacks.includes(key)) {
      gamemodeSelectedPacks.push(key);
    }

    const dependencyKey = btn.dataset.settingsDependency;
    if (dependencyKey) {
      const settingsButtonDependency = document
        .querySelector('.rules-settings-container')
        ?.querySelector(`[data-key="${dependencyKey}"]`);

      if (settingsButtonDependency) {
        settingsButtonDependency.classList.remove('inactive');

        const depCount =
          settingsButtonDependency.dataset.count ||
          settingsButtonDependency.getAttribute('data-count');

        if (depCount) {
          const alias = key.replace('pack-', '');
          gamemodeSettings[alias] = Number(depCount);
        }
      }
    }
  });

  const activeSettingsButtons = Array.from(settingsButtons).filter(
    (btn) =>
      btn.classList.contains('active') &&
      btn.closest('.rules-settings-container') &&
      !btn.classList.contains('inactive')
  );

  activeSettingsButtons.forEach((btn) => {
    const key = btn.dataset.key;
    if (!key) return;

    const count = btn.dataset.count;
    if (typeof count !== 'undefined' && count !== null) {
      gamemodeSettings[key] = Number(count);
    } else {
      gamemodeSettings[key] = true;
    }

    if (btn.dataset.gameRuleTimeLimit !== undefined) {
      const gameRuleTimeLimit = Number(btn.dataset.gameRuleTimeLimit);
      if (Number.isFinite(gameRuleTimeLimit)) {
        gamemodeSettings[`${key}-game-rule-time-limit`] = gameRuleTimeLimit;
      }
    }
  });

  const incrementContainers = placeholderGamemodeSettings.querySelectorAll(
    '.increment-container'
  );

  incrementContainers.forEach((container) => {
    if (container.dataset.contentType === 'role') return;
    if (
      !container.closest('.rules-settings-container') ||
      container.classList.contains('inactive')
    )
      return;

    const key = container.dataset.key;
    const count =
      container.dataset.count || container.getAttribute('data-count');
    if (!key || typeof count === 'undefined') return;

    gamemodeSettings[key] = Number(count);
  });

  roleButtons.forEach((container) => {
    if (container.classList.contains('inactive')) return;
    const key = container.dataset.key;
    const count = container.dataset.count;
    if (!key || typeof count === 'undefined') return;
    gamemodeRoleCounts[key] = Number(count);
  });

  packButtons.forEach((button) => {
    SetButtonStyle(button, false);
  });
  settingsButtons.forEach((button) => {
    SetButtonStyle(button, false);
  });

  if (syncPartyCode && canSyncOnlineParty) {
    try {
      const existingData = await getExistingPartyData(syncPartyCode);

      if (
        partyCode !== syncPartyCode ||
        window.onlinePartyTeardownInProgress === true
      ) {
        return;
      }

      const currentPartyData = existingData[0];

      if (!currentPartyData) {
        if (typeof resetOnlineSettingsAfterMissingParty === 'function') {
          await resetOnlineSettingsAfterMissingParty('missing-during-settings-save');
        }
        return;
      }

      const oldConfig = currentPartyData.config || {};
      const oldSession = currentPartyData.session || {};

      const mergedConfig = {
        gamemode:
          oldConfig.gamemode || currentPartyData.gamemode || partyGameMode,
        gameRules: gamemodeSettings,
        selectedPacks: gamemodeSelectedPacks,
        roleCounts: gamemodeRoleCounts,
        userInstructions:
          oldConfig.userInstructions ?? currentPartyData.userInstructions ?? '',
        shuffleSeed:
          oldConfig.shuffleSeed ??
          currentPartyData.shuffleSeed ??
          window.currentOnlineShuffleSeed ??
          Math.floor(Math.random() * 256)
      };
      debugLog(
        '[UpdateSettings] preserving shuffleSeed=',
        mergedConfig.shuffleSeed,
        {
          oldConfigShuffleSeed: oldConfig.shuffleSeed,
          currentPartyDataShuffleSeed: currentPartyData.shuffleSeed,
          currentOnlineShuffleSeed: window.currentOnlineShuffleSeed
        }
      );

      await updateOnlineParty({
        partyId: syncPartyCode,
        session: oldSession.createdAt ? oldSession : undefined,
        config: mergedConfig,
        players: currentPartyData.players
      });
    } catch (err) {
      console.error('❌ Failed to update settings party config:', err);
    }
  }

  updateStartGameButton(allUsersReady);
}

function GetAnyPackActive() {
  const anyPackTrue = packButtons.some((btn) => {
    const key = btn.getAttribute('data-key');
    if (!key) return false;

    const isNSFW = btn.classList.contains('nsfw');
    const savedState = localStorage.getItem(key) === 'true';

    if (!isNsfwContentEnabled() && isNSFW) return false;

    return savedState;
  });
  return anyPackTrue;
}

function ResetActivePacks(anyPackTrue) {
  if (!anyPackTrue && packButtons.length > 0) {
    const first = packButtons[0];
    packButtons.forEach((btn) => {
      const key = btn.getAttribute('data-key');
      if (!key) return;

      if (btn === first) {
        localStorage.setItem(key, 'true');
        btn.classList.add('active');
        SetButtonStyle(btn, false);
      } else {
        localStorage.setItem(key, 'false');
        btn.classList.remove('active');
        SetButtonStyle(btn, false);
      }
    });
  }
}

window.SetGamemodeContainer = SetGamemodeContainer;
window.UpdateGamemodeContainer = UpdateGamemodeContainer;
window.UpdateSettings = UpdateSettings;
