function SetGameSettingsButtons() {
  ResetActivePacks(GetAnyPackActive());

  placeholderGamemodeSettings
    .querySelectorAll('.button-toggle')
    .forEach((button) => {
      const alreadyBound = button.dataset.listenerBound === 'true';
      const key = button.getAttribute('data-key');
      let savedState = localStorage.getItem(key) || 'true';

      if (!isNsfwContentEnabled() && button.classList.contains('nsfw')) {
        savedState = 'false';
        localStorage.setItem(key, 'false');
      }
      if (button.dataset.settingsRequired == 'true') savedState = 'true';

      if (key && savedState === 'true') {
        button.classList.add('active');
        SetButtonStyle(button, false);

        if (
          button.closest('.rules-settings-container') &&
          !button.classList.contains('inactive')
        ) {
          gamemodeSettings[key] = true;
        } else if (button.closest('.packs-content-container')) {
          if (!gamemodeSelectedPacks.includes(key)) {
            gamemodeSelectedPacks.push(key);
          }
        }
      } else if (key && savedState === 'false') {
        button.classList.remove('active');
        if (button.dataset.settingsDependency) {
          document
            .querySelector('.rules-settings-container')
            .querySelector(`[data-key="${button.dataset.settingsDependency}"]`)
            .classList.add('inactive');
        }
      }

      if (alreadyBound) {
        return;
      }

      button.dataset.listenerBound = 'true';
      button.addEventListener('click', () => {
        if (button.disabled) return;

        const activeCount = packButtons.filter((btn) =>
          btn.classList.contains('active')
        ).length;

        if (
          button.closest('.packs-content-container') &&
          activeCount <= 1 &&
          button.classList.contains('active')
        ) {
          return;
        }

        button.classList.toggle('active');
        const key = button.getAttribute('data-key');
        const isActive = button.classList.contains('active');
        const settingsButtonDependency = document
          .querySelector('.rules-settings-container')
          ?.querySelector(`[data-key="${button.dataset.settingsDependency}"]`);

        SetButtonStyle(button, false);

        if (key) {
          localStorage.setItem(key, isActive ? 'true' : 'false');

          if (button.closest('.packs-content-container')) {
            if (isActive) {
              if (!gamemodeSelectedPacks.includes(key)) {
                gamemodeSelectedPacks.push(key);
                debugLog('selected', gamemodeSelectedPacks);
              }
            } else {
              gamemodeSelectedPacks = gamemodeSelectedPacks.filter(
                (k) => k !== key
              );
            }

            if (settingsButtonDependency) {
              if (isActive) {
                settingsButtonDependency.classList.remove('inactive');
              } else {
                settingsButtonDependency.classList.add('inactive');
              }
            }
          } else if (button.closest('.rules-settings-container')) {
            if (isActive && !button.classList.contains('inactive')) {
              gamemodeSettings[key] = true;
            } else {
              gamemodeSettings = removeSetting(gamemodeSettings, key);
            }
          }

          const isPack = Boolean(
            button.closest('.packs-content-container')
          );
          window.OEAnalytics?.track(
            isPack ? 'game.pack_changed' : 'game.rule_changed',
            isPack
              ? { packKey: key, enabled: isActive }
              : { ruleKey: key, enabled: isActive, value: isActive },
            {
              gameMode: partyGameMode,
              playMode: partyCode ? 'online' : 'offline'
            }
          );
        }

        UpdateSettings();
        SetGamemodeButtons(true);
      });
    });

  placeholderGamemodeSettings
    .querySelectorAll('.increment-container')
    .forEach((container) => {
      const alreadyBound = container.dataset.listenerBound === 'true';
      const key = container.getAttribute('data-key');
      const countDisplay = container.querySelector('.count-display');
      const incrementBtn = container.querySelector('.increment');
      const decrementBtn = container.querySelector('.decrement');
      let count = parseInt(container.getAttribute('data-count'));
      const increment = parseInt(container.getAttribute('data-increment'));
      const min = parseInt(container.getAttribute('data-count-min'));
      const max = parseInt(container.getAttribute('data-count-max'));

      const clampCount = (value) => {
        const parsedValue = Number(value);
        if (!Number.isFinite(parsedValue)) return count;

        const clampedValue = Math.min(max, Math.max(min, parsedValue));
        const offsetFromMinimum = clampedValue - min;
        const alignedValue =
          min + Math.round(offsetFromMinimum / increment) * increment;

        return Math.min(max, Math.max(min, alignedValue));
      };

      const savedValue = localStorage.getItem(key);
      if (savedValue) {
        if (savedValue !== null && /^-?\d+$/.test(savedValue)) {
          count = clampCount(savedValue);
          localStorage.setItem(key, String(count));
          countDisplay.textContent = String(count);
          container.dataset.count = String(count);
        } else {
          localStorage.setItem(key, String(count));
          container.dataset.count = String(count);
          countDisplay.textContent = String(count);
        }
      } else {
        localStorage.setItem(key, count);
      }

      if (
        container.closest('.rules-settings-container') &&
        !container.classList.contains('inactive')
      ) {
        gamemodeSettings[key] = count;
      } else if (
        container.dataset.contentType === 'role' &&
        !container.classList.contains('inactive')
      ) {
        gamemodeRoleCounts[key] = count;
      }

      function updateCount(newCount) {
        const previousCount = count;
        count = newCount;
        container.setAttribute('data-count', count);
        container.dataset.count = String(count);
        countDisplay.textContent = count;
        localStorage.setItem(key, count);
        UpdateSettings();
        window.OEAnalytics?.track(
          'game.rule_changed',
          {
            ruleKey: key,
            value: count,
            previousValue: previousCount
          },
          {
            gameMode: partyGameMode,
            playMode: partyCode ? 'online' : 'offline'
          }
        );
      }

      if (alreadyBound) {
        return;
      }

      container.dataset.listenerBound = 'true';

      incrementBtn.addEventListener('click', () => {
        if (count + increment <= max) updateCount(count + increment);
      });

      decrementBtn.addEventListener('click', () => {
        if (count - increment >= min) updateCount(count - increment);
      });
    });

  UpdateSettings();
}
