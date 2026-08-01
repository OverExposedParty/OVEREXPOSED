(function () {
  function formatLateJoinOptionLabel(value) {
    return String(value || '')
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  const LATE_JOIN_CONTENT = {
    'truth-or-dare': {
      modeLabel: 'TRUTH OR DARE',
      heading: 'JOIN THE NEXT ROUND',
      description:
        'A round is already underway. Join now and you’ll be added to the game automatically when the next round begins.',
      howItWorks: 'Choose truth or dare when it’s your turn.',
      joiningLate: 'You can watch safely until the current round ends.',
      progressLabel: 'ROUND IN PROGRESS',
      countLabel: 'ROUND'
    },
    'never-have-i-ever': {
      modeLabel: 'NEVER HAVE I EVER',
      heading: 'JOIN THE NEXT QUESTION',
      description:
        'A question is already underway. Join now and you’ll be added to the game automatically when the next question begins.',
      howItWorks:
        'Choose whether you have or have never done what the card says.',
      joiningLate: 'You can watch safely until the current question ends.',
      progressLabel: 'QUESTION IN PROGRESS',
      countLabel: 'QUESTION'
    },
    'would-you-rather': {
      modeLabel: 'WOULD YOU RATHER',
      heading: 'JOIN THE NEXT QUESTION',
      description:
        'A question is already underway. Join now and you’ll be added to the game automatically when the next question begins.',
      howItWorks: 'Choose between two options, then compare answers.',
      joiningLate: 'You can watch safely until the current question ends.',
      progressLabel: 'QUESTION IN PROGRESS',
      countLabel: 'QUESTION'
    },
    'most-likely-to': {
      modeLabel: 'MOST LIKELY TO',
      heading: 'JOIN THE NEXT QUESTION',
      description:
        'A question is already underway. Join now and you’ll be added to the game automatically when the next question begins.',
      howItWorks: 'Vote for the player who best matches the prompt.',
      joiningLate: 'You can watch safely until the current question ends.',
      progressLabel: 'QUESTION IN PROGRESS',
      countLabel: 'QUESTION'
    },
    paranoia: {
      modeLabel: 'PARANOIA',
      heading: 'JOIN THE NEXT QUESTION',
      description:
        'A question is already underway. Join now and you’ll be added to the game automatically when the next question begins.',
      howItWorks: 'Read the prompt secretly, then choose the player it fits.',
      joiningLate: 'You can watch safely until the current question ends.',
      progressLabel: 'QUESTION IN PROGRESS',
      countLabel: 'QUESTION'
    },
    imposter: {
      modeLabel: 'IMPOSTER',
      heading: 'JOIN THE NEXT ROUND',
      description:
        'Roles and prompts have already been assigned. Join now and you’ll be added automatically when the next round begins.',
      howItWorks: 'Describe your prompt, blend in, then vote for the Imposter.',
      joiningLate: 'You can watch safely until the current round ends.',
      progressLabel: 'ROUND IN PROGRESS',
      countLabel: 'ROUND'
    }
  };

  const ACTIVE_ROUND_LATE_JOIN_GAMEMODES = new Set(
    Object.keys(LATE_JOIN_CONTENT)
  );

  function createWaitingRoomLateJoinBriefing(dependencies) {
    const {
      getPartyCode,
      getPartyGameMode,
      getMaxPlayerCount,
      getGamemodeSettingsContainer,
      promptWaitingRoomUserForCustomOeIcon
    } = dependencies;

    const lateJoinBriefingContainer = document.getElementById(
      'late-join-briefing'
    );
    const lateJoinGameButton = document.getElementById(
      'late-join-game-button'
    );
    let lateJoinPlayerCount = document.getElementById(
      'late-join-player-count'
    );
    let lateJoinRound = document.getElementById('late-join-round');
    let lateJoinWarningRow = document.getElementById('late-join-warning-row');
    let lateJoinRules = document.getElementById('late-join-rules');
    let lateJoinPacks = document.getElementById('late-join-packs');
    let lateJoinModeLabel = document.getElementById('late-join-mode-label');
    let lateJoinHeading = document.getElementById('late-join-heading');
    let lateJoinDescription = document.getElementById(
      'late-join-description'
    );
    let lateJoinHowItWorks = document.getElementById(
      'late-join-how-it-works'
    );
    let lateJoinLateCopy = document.getElementById('late-join-late-copy');
    let lateJoinProgressLabel = document.getElementById(
      'late-join-progress-label'
    );

    function populateLateJoinModeContent(gameMode) {
      const content = LATE_JOIN_CONTENT[gameMode];
      if (!content) return;

      lateJoinModeLabel.textContent = content.modeLabel;
      lateJoinModeLabel.hidden = false;
      lateJoinHeading.textContent = content.heading;
      lateJoinDescription.textContent = content.description;
      lateJoinHowItWorks.textContent = content.howItWorks;
      lateJoinLateCopy.textContent = content.joiningLate;
      lateJoinProgressLabel.textContent = content.progressLabel;
    }

    function ensureLateJoinBriefingElements() {
      if (!lateJoinBriefingContainer) return false;

      lateJoinPlayerCount ||= lateJoinBriefingContainer.querySelector(
        '#late-join-player-count'
      );
      lateJoinRound ||= lateJoinBriefingContainer.querySelector(
        '#late-join-round'
      );
      lateJoinWarningRow ||= lateJoinBriefingContainer.querySelector(
        '#late-join-warning-row'
      );
      lateJoinRules ||= lateJoinBriefingContainer.querySelector(
        '#late-join-rules'
      );
      lateJoinPacks ||= lateJoinBriefingContainer.querySelector(
        '#late-join-packs'
      );
      lateJoinModeLabel ||= lateJoinBriefingContainer.querySelector(
        '#late-join-mode-label'
      );
      lateJoinHeading ||= lateJoinBriefingContainer.querySelector(
        '#late-join-heading'
      );
      lateJoinDescription ||= lateJoinBriefingContainer.querySelector(
        '#late-join-description'
      );
      lateJoinHowItWorks ||= lateJoinBriefingContainer.querySelector(
        '#late-join-how-it-works'
      );
      lateJoinLateCopy ||= lateJoinBriefingContainer.querySelector(
        '#late-join-late-copy'
      );
      lateJoinProgressLabel ||= lateJoinBriefingContainer.querySelector(
        '#late-join-progress-label'
      );

      return Boolean(
        lateJoinPlayerCount &&
          lateJoinRound &&
          lateJoinWarningRow &&
          lateJoinRules &&
          lateJoinPacks &&
          lateJoinModeLabel &&
          lateJoinHeading &&
          lateJoinDescription &&
          lateJoinHowItWorks &&
          lateJoinLateCopy &&
          lateJoinProgressLabel
      );
    }

    function renderLateJoinGameList(container, items, type) {
      if (!container) return;
      container.replaceChildren();
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = `late-join-game-list-item ${type}`;

        const label = document.createElement('span');
        label.textContent = item.label;

        if (type === 'rule') {
          const settingsIcon = document.createElement('span');
          settingsIcon.className = 'late-join-rule-settings-icon';
          settingsIcon.setAttribute('aria-hidden', 'true');
          row.append(settingsIcon, label);
        } else {
          if (item.colour) {
            row.style.setProperty('--pack-colour', item.colour);
          }
          const difficultyIcons = document.createElement('span');
          difficultyIcons.className = 'late-join-difficulty-icons';
          (item.difficulties || []).forEach((difficulty) => {
            const icon = document.createElement('img');
            icon.src = `/images/icons/difficulty/${difficulty}.svg`;
            icon.alt = difficulty;
            icon.title = formatLateJoinOptionLabel(difficulty);
            difficultyIcons.appendChild(icon);
          });
          row.append(label, difficultyIcons);
        }
        container.appendChild(row);
      });
    }

    async function getGameBriefingMetadata(gameMode, activePartyCode) {
      const query = activePartyCode
        ? `?partyCode=${encodeURIComponent(activePartyCode)}`
        : '';
      const [packsResponse, rulesResponse] = await Promise.all([
        fetch(`/api/party-game-packs/${encodeURIComponent(gameMode)}${query}`),
        fetch(`/api/party-game-rules/${encodeURIComponent(gameMode)}${query}`)
      ]);
      const [packsPayload, rulesPayload] = await Promise.all([
        packsResponse.ok ? packsResponse.json() : {},
        rulesResponse.ok ? rulesResponse.json() : {}
      ]);
      const packsData = packsPayload?.data || packsPayload || {};
      const rulesData = rulesPayload?.data || rulesPayload || {};
      return {
        packs: packsData[`${gameMode}-packs`] || [],
        rules: rulesData[`${gameMode}-settings`] || []
      };
    }

    async function populateActiveGameBriefing(partyData) {
      if (!ensureLateJoinBriefingElements()) {
        console.warn('Late-join briefing elements are unavailable.');
        return;
      }

      const players = partyData.players || [];
      const config = partyData.config || {};
      const state = partyData.state || {};
      const gameMode = config.gamemode || getPartyGameMode();
      const content =
        LATE_JOIN_CONTENT[gameMode] || LATE_JOIN_CONTENT['truth-or-dare'];
      const configuredRounds = Number(config.gameRules?.rounds) || 0;
      const currentRound = Math.max(1, Number(state.completedRounds || 0) + 1);

      populateLateJoinModeContent(gameMode);
      lateJoinPlayerCount.textContent = `${players.length}/${getMaxPlayerCount()} PLAYERS`;
      lateJoinRound.textContent = configuredRounds > 0
        ? `${content.countLabel} ${Math.min(currentRound, configuredRounds)}/${configuredRounds}`
        : `${content.countLabel} ${currentRound}`;

      try {
        const { packs, rules } = await getGameBriefingMetadata(
          gameMode,
          partyData.partyId || partyData.partyCode
        );
        const selectedPacks = new Set(config.selectedPacks || []);
        const configuredRuleEntries = Object.entries(config.gameRules || {});
        const enabledRuleKeys = new Set(
          configuredRuleEntries
            .filter(([, value]) => value === true || value === 'true')
            .map(([key]) => key)
        );
        const activeRules = rules
          .map((rule) => {
            const key = rule['settings-name'];
            const value = config.gameRules?.[key];
            const isToggleEnabled = value === true || value === 'true';
            const isConfiguredValue =
              value !== undefined &&
              value !== null &&
              value !== false &&
              value !== 'false' &&
              value !== '';
            if (!isConfiguredValue) return null;
            return {
              key,
              label: isToggleEnabled
                ? formatLateJoinOptionLabel(key)
                : `${formatLateJoinOptionLabel(key)}: ${value}`
            };
          })
          .filter(Boolean);
        const activePacks = packs
          .filter((pack) => selectedPacks.has(pack['pack-name']))
          .map((pack) => ({
            key: pack['pack-name'],
            label: formatLateJoinOptionLabel(pack['pack-name']),
            colour: pack['pack-colour'] || null,
            difficulties: String(pack['pack-difficulty'] || '')
              .split(',')
              .map((difficulty) => difficulty.trim())
              .filter(Boolean)
          }));

        renderLateJoinGameList(lateJoinRules, activeRules, 'rule');
        renderLateJoinGameList(lateJoinPacks, activePacks, 'pack');

        const hasNsfwPack = packs.some(
          (pack) =>
            selectedPacks.has(pack['pack-name']) &&
            pack['pack-restriction'] === 'nsfw'
        );
        const hasNsfwRule = rules.some((rule) => {
          const restrictions = Array.isArray(rule['settings-restriction'])
            ? rule['settings-restriction']
            : [];
          return (
            enabledRuleKeys.has(rule['settings-name']) &&
            restrictions.includes('nsfw')
          );
        });
        lateJoinWarningRow.hidden = !(hasNsfwPack || hasNsfwRule);
      } catch (error) {
        console.warn('Failed to populate late-join game labels:', error);
        if (lateJoinWarningRow) lateJoinWarningRow.hidden = true;
        renderLateJoinGameList(lateJoinRules, [], 'rule');
        renderLateJoinGameList(lateJoinPacks, [], 'pack');
      }
    }

    async function showActiveGameBriefing(partyData) {
      const gamemodeSettingsContainer = getGamemodeSettingsContainer();
      hideContainer(gamemodeSettingsContainer);
      setActiveContainers();
      window.partyJoinPreviewActive = true;

      const briefingMetadataPromise = populateActiveGameBriefing(partyData);
      await promptWaitingRoomUserForCustomOeIcon();
      await briefingMetadataPromise;

      hideContainer(gamemodeSettingsContainer);
      setActiveContainers(lateJoinBriefingContainer);
      document.title = `${formatPackName(getPartyGameMode())
        .replaceAll('-', ' ')
        .toUpperCase()} | JOIN GAME`;
    }

    lateJoinGameButton?.addEventListener('click', () => {
      const partyGameMode = getPartyGameMode();
      const partyCode = getPartyCode();
      if (!partyGameMode || !partyCode || lateJoinGameButton.disabled) return;

      lateJoinGameButton.disabled = true;
      lateJoinGameButton.textContent = 'JOINING...';
      sessionStorage.setItem(`oe-late-join:${partyCode}`, '1');
      loadingPage = true;
      transitionSplashScreen(
        `/${formatPackName(partyGameMode)}/${partyCode}`,
        `/images/splash-screens/${formatPackName(partyGameMode)}.png`
      );
    });

    return {
      briefingContainer: lateJoinBriefingContainer,
      isActiveRoundLateJoinGamemode(gameMode) {
        return ACTIVE_ROUND_LATE_JOIN_GAMEMODES.has(gameMode);
      },
      showActiveGameBriefing
    };
  }

  window.createWaitingRoomLateJoinBriefing =
    createWaitingRoomLateJoinBriefing;
})();
