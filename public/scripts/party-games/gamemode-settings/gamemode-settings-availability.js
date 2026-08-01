function showNsfwSettingBlockedNotification(contentType) {
  const isGameRule = contentType === 'game-rule';
  window.showSystemNotificationPopup?.({
    key: 'nsfw-content-blocked',
    type: isGameRule ? 'nsfw_game_rule_blocked' : 'nsfw_pack_blocked',
    category: 'system',
    image: '/images/icons/difficulty/nsfw.svg',
    dismissWhenNsfwEnabled: true,
    label: 'SFW mode',
    title: isGameRule
      ? 'NSFW game rule unavailable'
      : 'NSFW pack unavailable',
    body: `Enable NSFW content in Settings to use this ${
      isGameRule ? 'game rule' : 'pack'
    }.`,
    action: {
      type: 'open_settings',
      target: 'settings-nsfw'
    }
  });
}

function bindNsfwBlockedNotification(control, contentType) {
  if (control.dataset.nsfwBlockedNotificationBound === 'true') return;
  control.dataset.nsfwBlockedNotificationBound = 'true';

  control.addEventListener(
    'click',
    (event) => {
      if (
        isNsfwContentEnabled() ||
        control.getAttribute('aria-disabled') !== 'true'
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      showNsfwSettingBlockedNotification(contentType);
    },
    true
  );
}

async function SetGamemodeButtons(initialLoad = false) {
  if (isNsfwContentEnabled()) {
    nsfwButtons.forEach((button) => {
      bindNsfwBlockedNotification(button, 'pack');
      button.disabled = false;
      button.removeAttribute('aria-disabled');
      button.classList.remove('disabled');

      if (!button.classList.contains('button-toggle')) return;
      const key = button.getAttribute('data-key');
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'false');
      }
    });
    gameRulesNsfwButtons.forEach((button) => {
      bindNsfwBlockedNotification(button, 'game-rule');
      if ('disabled' in button) {
        button.disabled = false;
      }
      button.removeAttribute('aria-disabled');
      button.classList.remove('disabled');

      if (!button.classList.contains('button-toggle')) return;
      const key = button.getAttribute('data-key');
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'false');
      }
      SetButtonStyle(button, false);
    });
  } else {
    nsfwButtons.forEach((button) => {
      bindNsfwBlockedNotification(button, 'pack');
      button.disabled = false;
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('disabled');
      button.classList.remove('active');

      if (!button.classList.contains('button-toggle')) return;
      const key = button.getAttribute('data-key');
      localStorage.setItem(key, 'false');
      SetButtonStyle(button, false);
    });
    gameRulesNsfwButtons.forEach((button) => {
      bindNsfwBlockedNotification(button, 'game-rule');
      if ('disabled' in button) {
        button.disabled = false;
      }
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('disabled');
      button.classList.remove('active');

      if (!button.classList.contains('button-toggle')) return;
      const key = button.getAttribute('data-key');
      localStorage.setItem(key, 'false');
      if (button.closest('.rules-settings-container')) {
        gamemodeSettings = removeSetting(gamemodeSettings, key);
      }
      SetButtonStyle(button, false);
    });
  }

  if (partyCode) {
    onlingSettingsButtons.forEach((button) => {
      if ('disabled' in button) {
        button.disabled = false;
      }
      button.classList.remove('inactive');
    });
    offlineSettingsButtons.forEach((button) => {
      if ('disabled' in button) {
        button.disabled = true;
      }
      button.classList.add('inactive');
      button.classList.remove('active');
    });
  } else {
    onlingSettingsButtons.forEach((button) => {
      if ('disabled' in button) {
        button.disabled = true;
      }
      button.classList.add('inactive');
      button.classList.remove('active');
    });
    offlineSettingsButtons.forEach((button) => {
      if ('disabled' in button) {
        button.disabled = false;
      }
      button.classList.remove('inactive');
    });
  }
  if (
    partyGamesInformation[partyGameMode].forceOnline === true &&
    initialLoad
  ) {
    await ToggleOnlineMode(true);
  }
}

window.addEventListener('oe-nsfw-setting-changed', (event) => {
  if (event.detail?.changed === false) return;

  Promise.resolve(SetGamemodeButtons())
    .then(() => {
      if (typeof UpdateSettings === 'function') {
        return UpdateSettings();
      }
    })
    .catch((error) => {
      console.error('Failed to refresh NSFW game settings:', error);
    });
});
