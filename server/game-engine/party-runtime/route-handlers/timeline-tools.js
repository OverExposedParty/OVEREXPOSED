const {
  createPartyTimelineNotificationTools
} = require('./timeline-notifications');

function createPartyTimelineTools(context) {
  const { Account, getPartyPlayerId, getPartyPlayerAccountId, crypto } =
    context;

  function formatPartyModeName(value, fallback = 'Party') {
    const raw = String(value || fallback || 'Party')
      .replace(/^party game\s*/i, '')
      .trim();
    if (!raw) return 'Party';
    return raw
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  function getPartyNotificationModeName(session, logLabel) {
    return formatPartyModeName(session?.config?.gamemode, logLabel);
  }

  function getPartyNotificationActor(player) {
    return {
      accountId: getPartyPlayerAccountId(player) || null,
      username: player?.identity?.username || player?.username || 'Player',
      oeIcon:
        player?.identity?.userIcon ||
        player?.userIcon ||
        player?.profile?.oeIcon ||
        null
    };
  }

  function getRoutePlayerName(player) {
    return (
      player?.identity?.username ||
      player?.username ||
      player?.profile?.username ||
      player?.name ||
      'Player'
    );
  }

  function getRouteTurnPlayer(players = [], state = {}) {
    const turnIndex = Number(state?.playerTurn) || 0;
    const order = Array.isArray(state?.playerTurnOrder)
      ? state.playerTurnOrder
      : [];
    const orderedPlayerId = order[turnIndex];

    if (orderedPlayerId) {
      return (
        players.find(
          (player) =>
            String(getPartyPlayerId(player)) === String(orderedPlayerId)
        ) || null
      );
    }

    return players[turnIndex] || null;
  }

  function createTruthOrDareTimelineSeed(party) {
    const state = party?.state || {};
    const config = party?.config || {};
    const deck = party?.deck || {};
    const players = Array.isArray(party?.players) ? party.players : [];
    const currentPlayer = getRouteTurnPlayer(players, state);
    const basePlayerFields = currentPlayer
      ? {
          playerId: getPartyPlayerId(currentPlayer),
          playerName: getRoutePlayerName(currentPlayer),
          playerIcon:
            currentPlayer.identity?.userIcon ||
            currentPlayer.userIcon ||
            currentPlayer.profile?.oeIcon ||
            null
        }
      : {};
    const now = Date.now();
    const events = [];
    const pushEvent = (event) => {
      events.push({
        at: now + events.length,
        ...event
      });
    };
    const instruction =
      config.userInstructions ||
      state.userInstructions ||
      party?.userInstructions ||
      '';
    const questionType =
      deck.questionType === 'truth' || deck.questionType === 'dare'
        ? deck.questionType
        : null;

    if (state.phase === 'truth-or-dare-prompt-heist') {
      const passedPlayer = players.find(
        (player) =>
          String(getPartyPlayerId(player)) ===
          String(state.phaseData?.passedPlayerId)
      );
      if (passedPlayer) {
        pushEvent({
          type: 'prompt-passed',
          playerId: getPartyPlayerId(passedPlayer),
          playerName: getRoutePlayerName(passedPlayer),
          playerIcon:
            passedPlayer.identity?.userIcon ||
            passedPlayer.userIcon ||
            passedPlayer.profile?.oeIcon ||
            null,
          questionType
        });
      }
      pushEvent({ type: 'prompt-heist-opened' });
      return events;
    }

    if (state.phase === 'truth-or-dare-choose-punishment') {
      pushEvent({
        type: 'prompt-passed',
        ...basePlayerFields,
        questionType
      });
      pushEvent({ type: 'choosing-punishment', ...basePlayerFields });
      return events;
    }

    if (state.phase === 'truth-or-dare-show-punishment') {
      pushEvent({
        type: 'prompt-passed',
        ...basePlayerFields,
        questionType
      });
      pushEvent({
        type: 'punishment-selected',
        ...basePlayerFields,
        punishmentType: state.phaseData?.punishmentType || null
      });
      return events;
    }

    if (
      questionType &&
      instruction &&
      !instruction.includes('DISPLAY_SELECT_QUESTION_TYPE')
    ) {
      pushEvent({
        type: 'question-type-selected',
        ...basePlayerFields,
        questionType
      });
      pushEvent({
        type: 'deciding-answer-or-pass',
        ...basePlayerFields,
        questionType
      });
      return events;
    }

    pushEvent({ type: 'choosing-question-type', ...basePlayerFields });
    return events;
  }

  function createNeverHaveIEverTimelineSeed(party) {
    const state = party?.state || {};
    const config = party?.config || {};
    const players = Array.isArray(party?.players) ? party.players : [];
    const instruction = config.userInstructions || state.userInstructions || '';
    const events = [
      { type: 'question-shown', at: Date.now() },
      { type: 'players-answering', at: Date.now() + 1 }
    ];
    const phase = state.phase || null;
    const targetIds = Array.isArray(state.phaseData?.targetIds)
      ? state.phaseData.targetIds.filter(Boolean)
      : [];
    const target = players.find(
      (player) =>
        targetIds[0] &&
        String(getPartyPlayerId(player)) === String(targetIds[0])
    );

    if (instruction.includes('DISPLAY_VOTE_RESULTS') || phase) {
      events.push({ type: 'answers-revealed', at: Date.now() + 2 });
    }
    if (phase === 'never-have-i-ever-spin-odd-man-out') {
      events.push({
        type: 'odd-man-out-spinning',
        at: Date.now() + 3,
        playerId: targetIds[0] || null,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    if (phase === 'never-have-i-ever-show-punishment') {
      events.push({
        type: 'punishment-in-progress',
        at: Date.now() + 3,
        playerId: targetIds[0] || null,
        targetIds,
        punishmentType: state.phaseData?.punishmentType || null,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    return events;
  }

  function createWouldYouRatherTimelineSeed(party) {
    const state = party?.state || {};
    const config = party?.config || {};
    const players = Array.isArray(party?.players) ? party.players : [];
    const instruction = config.userInstructions || state.userInstructions || '';
    const events = [
      { type: 'question-shown', at: Date.now() },
      { type: 'players-choosing', at: Date.now() + 1 }
    ];
    const phase = state.phase || null;
    const targetIds = Array.isArray(state.phaseData?.targetIds)
      ? state.phaseData.targetIds.filter(Boolean)
      : [];
    const target = players.find(
      (player) =>
        targetIds[0] &&
        String(getPartyPlayerId(player)) === String(targetIds[0])
    );

    if (instruction.includes('DISPLAY_VOTE_RESULTS') || phase) {
      events.push({ type: 'votes-revealed', at: Date.now() + 2 });
    }
    if (phase === 'would-you-rather-spin-odd-man-out') {
      events.push({
        type: 'odd-man-out-spinning',
        at: Date.now() + 3,
        playerId: targetIds[0] || null,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    if (phase === 'would-you-rather-show-punishment') {
      events.push({
        type: 'punishment-in-progress',
        at: Date.now() + 3,
        playerId: targetIds[0] || null,
        targetIds,
        punishmentType: state.phaseData?.punishmentType || null,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    return events;
  }

  function createMostLikelyToTimelineSeed(party) {
    const state = party?.state || {};
    const config = party?.config || {};
    const players = Array.isArray(party?.players) ? party.players : [];
    const instruction = config.userInstructions || state.userInstructions || '';
    const events = [
      { type: 'question-shown', at: Date.now() },
      { type: 'players-voting', at: Date.now() + 1 }
    ];
    const phase = state.phase || null;
    const targetId = state.phaseData?.targetId || null;
    const tiedIds = Array.isArray(state.phaseData?.tiedIds)
      ? state.phaseData.tiedIds.filter(Boolean)
      : [];
    const target = players.find(
      (player) =>
        targetId && String(getPartyPlayerId(player)) === String(targetId)
    );

    if (instruction.includes('DISPLAY_VOTE_RESULTS') || phase) {
      events.push({ type: 'votes-revealed', at: Date.now() + 2 });
    }
    if (phase === 'most-likely-to-tiebreaker') {
      events.push({
        type: 'tiebreaker-voting',
        at: Date.now() + 3,
        targetIds: tiedIds
      });
    }
    if (phase === 'most-likely-to-choose-punishment') {
      events.push({
        type: 'choosing-punishment',
        at: Date.now() + 3,
        playerId: targetId,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    if (phase === 'most-likely-to-show-punishment') {
      events.push({
        type: 'punishment-in-progress',
        at: Date.now() + 3,
        playerId: targetId,
        targetIds: targetId ? [targetId] : [],
        punishmentType: state.phaseData?.punishmentType || null,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    return events;
  }

  function createParanoiaTimelineSeed(party) {
    const state = party?.state || {};
    const players = Array.isArray(party?.players) ? party.players : [];
    const selector = getRouteTurnPlayer(players, state);
    const selectorId = selector ? getPartyPlayerId(selector) : null;
    const events = [
      {
        type: 'question-shown',
        at: Date.now(),
        ...(selectorId
          ? {
              playerId: selectorId,
              playerName: getRoutePlayerName(selector),
              playerIcon:
                selector.identity?.userIcon ||
                selector.userIcon ||
                selector.profile?.oeIcon ||
                null
            }
          : {})
      },
      {
        type: 'target-selection',
        at: Date.now() + 1,
        ...(selectorId
          ? {
              playerId: selectorId,
              playerName: getRoutePlayerName(selector),
              playerIcon:
                selector.identity?.userIcon ||
                selector.userIcon ||
                selector.profile?.oeIcon ||
                null
            }
          : {})
      }
    ];
    const phase = state.phase || null;
    const targetId =
      state.phaseData?.targetId || state.phaseData?.revealTargetId || null;
    const target = players.find(
      (player) =>
        targetId && String(getPartyPlayerId(player)) === String(targetId)
    );

    if (
      phase === 'paranoia-choose-punishment' ||
      phase === 'paranoia-show-punishment' ||
      phase === 'paranoia-confirm-punishment'
    ) {
      events.push({
        type: 'target-selected',
        at: Date.now() + 2,
        playerId: targetId,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    if (phase === 'paranoia-choose-punishment') {
      events.push({
        type: 'choosing-punishment',
        at: Date.now() + 3,
        playerId: targetId,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    if (
      phase === 'paranoia-show-punishment' ||
      phase === 'paranoia-confirm-punishment'
    ) {
      events.push({
        type: 'punishment-in-progress',
        at: Date.now() + 3,
        playerId: targetId,
        targetIds: targetId ? [targetId] : [],
        punishmentType: state.phaseData?.punishmentType || null,
        playerName: target ? getRoutePlayerName(target) : 'Player',
        playerIcon: target?.identity?.userIcon || target?.userIcon || null
      });
    }
    return events;
  }

  function createImposterTimelineSeed(party) {
    const state = party?.state || {};
    const config = party?.config || {};
    const instruction = String(
      state.userInstructions || config.userInstructions || ''
    );
    const events = [
      { type: 'roles-assigned', at: Date.now() },
      { type: 'viewing-prompts', at: Date.now() + 1 }
    ];
    const pushUnique = (event) => {
      if (!events.some((existing) => existing.type === event.type)) {
        events.push(event);
      }
    };

    if (
      instruction.includes('DISPLAY_ANSWER_CONTAINER') ||
      instruction.includes('DISPLAY_PRIVATE_CARD') ||
      instruction.includes('DISPLAY_VOTE_RESULTS') ||
      state.phase?.startsWith('imposter-')
    ) {
      pushUnique({ type: 'clues-in-progress', at: Date.now() + 2 });
    }
    if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
      pushUnique({ type: 'selecting-imposter', at: Date.now() + 3 });
    }
    if (instruction.includes('DISPLAY_VOTE_RESULTS')) {
      pushUnique({ type: 'selecting-imposter', at: Date.now() + 3 });
      pushUnique({ type: 'votes-revealed', at: Date.now() + 4 });
    }
    if (instruction.includes('DISPLAY_VOTE_RESULTS_PART_TWO')) {
      pushUnique({ type: 'imposter-revealed', at: Date.now() + 5 });
    }
    if (state.phase === 'imposter-choose-punishment') {
      pushUnique({ type: 'imposter-revealed', at: Date.now() + 3 });
      pushUnique({
        type: 'choosing-punishment',
        at: Date.now() + 4,
        playerId: state.phaseData?.targetId || null
      });
    }
    if (state.phase === 'imposter-show-punishment') {
      pushUnique({ type: 'imposter-revealed', at: Date.now() + 3 });
      pushUnique({
        type: 'punishment-in-progress',
        at: Date.now() + 4,
        playerId: state.phaseData?.targetId || null,
        punishmentType: state.phaseData?.punishmentType || null
      });
    }

    return events;
  }

  const timelineNotificationTools = createPartyTimelineNotificationTools({
    Account,
    crypto
  });

  return {
    formatPartyModeName,
    getPartyNotificationModeName,
    getPartyNotificationActor,
    getRoutePlayerName,
    getRouteTurnPlayer,
    createTruthOrDareTimelineSeed,
    createNeverHaveIEverTimelineSeed,
    createWouldYouRatherTimelineSeed,
    createMostLikelyToTimelineSeed,
    createParanoiaTimelineSeed,
    createImposterTimelineSeed,
    ...timelineNotificationTools
  };
}

module.exports = {
  createPartyTimelineTools
};
