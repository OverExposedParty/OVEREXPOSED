const ROUND_LATE_JOIN_TIMELINE_CONFIGS = {
  'never-have-i-ever': {
    answeringEvent: 'players-answering',
    answeringLabelCurrent: ({ answeredCount, participantCount }) =>
      `${answeredCount}/${participantCount} players answered`,
    labels: {
      'question-shown': 'Question shown',
      'players-answering': 'Players answered',
      'answers-revealed': 'Answers revealed',
      'odd-man-out-spinning': ({ playerName }) =>
        `${playerName} spinning drink wheel`,
      'punishment-in-progress': ({ targetCount, playerName }) =>
        targetCount > 1
          ? `${targetCount} players completing punishment`
          : `${playerName} completing punishment`
    }
  },
  'would-you-rather': {
    answeringEvent: 'players-choosing',
    answeringLabelCurrent: ({ answeredCount, participantCount }) =>
      `${answeredCount}/${participantCount} players chose`,
    labels: {
      'question-shown': 'Question shown',
      'players-choosing': 'Players choosing',
      'votes-revealed': 'Votes revealed',
      'odd-man-out-spinning': ({ playerName }) =>
        `${playerName} spinning drink wheel`,
      'punishment-in-progress': ({ targetCount, playerName }) =>
        targetCount > 1
          ? `${targetCount} players completing punishment`
          : `${playerName} completing punishment`
    }
  },
  'most-likely-to': {
    answeringEvent: 'players-voting',
    answeringLabelCurrent: ({ answeredCount, participantCount }) =>
      `${answeredCount}/${participantCount} players voted`,
    labels: {
      'question-shown': 'Question shown',
      'players-voting': 'Players voting',
      'votes-revealed': 'Votes revealed',
      'tiebreaker-voting': ({ targetCount }) =>
        `${targetCount || 2} tied players breaking tie`,
      'choosing-punishment': ({ playerName }) =>
        `${playerName} choosing punishment`,
      'punishment-in-progress': ({ playerName }) =>
        `${playerName} completing punishment`
    }
  },
  paranoia: {
    answeringEvent: 'target-selection',
    answeringLabelCurrent: () => 'Current player choosing target',
    labels: {
      'question-shown': ({ playerName }) => `${playerName} shown question`,
      'target-selection': 'Target selection',
      'target-selected': ({ playerName }) => `${playerName} selected`,
      'choosing-punishment': ({ playerName }) =>
        `${playerName} choosing punishment`,
      'punishment-in-progress': ({ playerName }) =>
        `${playerName} handling punishment`
    }
  },
  imposter: {
    answeringEvent: 'clues-in-progress',
    answeringLabelCurrent: ({ partyData }) => {
      const state = getPartyState(partyData) || {};
      const currentIndex = Number(state.speakingPlayerTurn) || 0;
      const currentPlayer = (partyData.players || [])[currentIndex];
      const currentName = currentPlayer
        ? getPlayerUsername(currentPlayer)
        : 'Player';
      return `${currentName} giving a clue`;
    },
    labels: {
      'roles-assigned': 'Roles and prompts assigned',
      'viewing-prompts': 'Players viewing prompts',
      'clues-in-progress': 'Players giving clues',
      'selecting-imposter': 'Players selecting the Imposter',
      'votes-revealed': 'Votes revealed',
      'imposter-revealed': 'Imposter revealed',
      'choosing-punishment': ({ playerName }) =>
        `${playerName} choosing punishment`,
      'punishment-in-progress': ({ playerName }) =>
        `${playerName} completing punishment`
    }
  }
};

function getImposterLateJoinTimelineEvents(partyData) {
  const state = getPartyState(partyData) || {};
  const config = partyData?.config || {};
  const instruction = String(
    state.userInstructions || config.userInstructions || ''
  );
  const events = [
    { type: 'roles-assigned' },
    { type: 'viewing-prompts' }
  ];
  const pushUnique = (type, extra = {}) => {
    if (!events.some((event) => event.type === type)) {
      events.push({ type, ...extra });
    }
  };

  if (
    instruction.includes('DISPLAY_ANSWER_CONTAINER') ||
    instruction.includes('DISPLAY_PRIVATE_CARD') ||
    instruction.includes('DISPLAY_VOTE_RESULTS') ||
    state.phase?.startsWith('imposter-')
  ) {
    pushUnique('clues-in-progress');
  }
  if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
    pushUnique('selecting-imposter');
  }
  if (instruction.includes('DISPLAY_VOTE_RESULTS')) {
    pushUnique('selecting-imposter');
    pushUnique('votes-revealed');
  }
  if (instruction.includes('DISPLAY_VOTE_RESULTS_PART_TWO')) {
    pushUnique('imposter-revealed');
  }
  if (state.phase === 'imposter-choose-punishment') {
    pushUnique('imposter-revealed');
    pushUnique('choosing-punishment', {
      playerId: state.phaseData?.targetId || null
    });
  }
  if (state.phase === 'imposter-show-punishment') {
    pushUnique('imposter-revealed');
    pushUnique('punishment-in-progress', {
      playerId: state.phaseData?.targetId || null,
      punishmentType: state.phaseData?.punishmentType || null
    });
  }

  return events;
}

function getRoundLateJoinPlayer(playerId, players = []) {
  return (
    players.find(
      (player) => String(getPlayerId(player)) === String(playerId)
    ) || null
  );
}

function getRoundLateJoinTurnPlayerId(state = {}, players = []) {
  const turnIndex = Number(state.playerTurn) || 0;
  const order = Array.isArray(state.playerTurnOrder) ? state.playerTurnOrder : [];
  const orderedPlayerId = order[turnIndex];
  if (orderedPlayerId) return orderedPlayerId;

  const fallbackPlayer = players[turnIndex] || null;
  return fallbackPlayer ? getPlayerId(fallbackPlayer) : null;
}

function createRoundLateJoinTimelineMarker(playerId, players = []) {
  const marker = document.createElement('span');
  marker.className = 'next-round-join-timeline-dot';

  const player = getRoundLateJoinPlayer(playerId, players);
  const playerIcon = player ? getPlayerIcon(player) : '';
  if (!playerIcon || typeof CreateImageStack !== 'function') {
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }

  const parsed = parseCustomisationString(playerIcon);
  const userCustomisation = {
    colour: getFilePathByCustomisationId(parsed.colour, 'colour'),
    headSlot: getFilePathByCustomisationId(parsed.head, 'headSlot'),
    eyesSlot: getFilePathByCustomisationId(parsed.eyes, 'eyesSlot'),
    mouthSlot: getFilePathByCustomisationId(parsed.mouth, 'mouthSlot')
  };
  marker.classList.add('has-oe');
  marker.appendChild(CreateImageStack(userCustomisation));
  return marker;
}

function getRoundLateJoinParticipants(partyData) {
  const state = getPartyState(partyData) || {};
  const players = partyData?.players || [];
  const participantIds = new Set((state.roundParticipantIds || []).map(String));

  return players.filter((player) => {
    const playerState = player.state || player;
    const socketId = player.connection?.socketId ?? player.socketId;
    return (
      playerState.participationStatus !== 'pending_next_round' &&
      socketId !== 'DISCONNECTED' &&
      (participantIds.size === 0 ||
        participantIds.has(String(getPlayerId(player))))
    );
  });
}

function getRoundLateJoinTimelineSteps({ partyData, gamemode }) {
  const config = ROUND_LATE_JOIN_TIMELINE_CONFIGS[gamemode];
  if (!config) return [];

  const state = getPartyState(partyData) || {};
  const players = partyData?.players || [];
  const participants = getRoundLateJoinParticipants(partyData);
  const answeredCount = participants.filter((player) => {
    const playerState = player.state || player;
    return playerState.hasConfirmed === true;
  }).length;
  const timelineEvents =
    gamemode === 'imposter'
      ? getImposterLateJoinTimelineEvents(partyData)
      : Array.isArray(state.roundTimeline)
        ? state.roundTimeline
        : [];

  return timelineEvents
    .map((event, index) => {
      const targetIds = Array.isArray(event.targetIds)
        ? event.targetIds.filter(Boolean)
        : [];
      const playerId =
        event.playerId ||
        (gamemode === 'paranoia' &&
        ['question-shown', 'target-selection'].includes(event.type)
          ? getRoundLateJoinTurnPlayerId(state, players)
          : null) ||
        (gamemode === 'imposter' && event.type === 'clues-in-progress'
          ? getPlayerId(players[Number(state.speakingPlayerTurn) || 0])
          : null) ||
        targetIds[0] ||
        null;
      const player = getRoundLateJoinPlayer(playerId, players);
      const playerName =
        event.playerName || (player ? getPlayerUsername(player) : 'Player');
      const targetCount = targetIds.length;
      const labelConfig = config.labels[event.type];
      if (!labelConfig) return null;

      const isCurrent = index === timelineEvents.length - 1;
      const label =
        event.type === config.answeringEvent && isCurrent
          ? config.answeringLabelCurrent({
              answeredCount,
              participantCount: participants.length,
              partyData
            })
          : typeof labelConfig === 'function'
            ? labelConfig({ playerName, targetCount, event })
            : labelConfig;

      return { label, playerId };
    })
    .filter(Boolean);
}

function renderRoundLateJoinTimeline({
  partyData = currentPartyData,
  gamemode,
  container = nextRoundJoinContainer
} = {}) {
  const timeline = container?.querySelector('#next-round-join-timeline');
  if (!timeline || !partyData || !gamemode) return;

  const players = partyData.players || [];
  const steps = getRoundLateJoinTimelineSteps({ partyData, gamemode });
  timeline.replaceChildren(
    ...steps.map((item, index) => {
      const step = document.createElement('div');
      step.className = 'next-round-join-timeline-step';
      step.classList.toggle('is-current', index === steps.length - 1);

      const marker = createRoundLateJoinTimelineMarker(item.playerId, players);
      const label = document.createElement('span');
      label.className = 'next-round-join-timeline-label';
      label.textContent = item.label;
      step.append(marker, label);
      return step;
    })
  );

  const timelineShell = timeline.parentElement;
  if (!timelineShell) return;

  const currentStep = timeline.querySelector(
    '.next-round-join-timeline-step.is-current'
  );
  const centredScrollLeft = currentStep
    ? currentStep.offsetLeft -
      (timelineShell.clientWidth - currentStep.offsetWidth) / 2
    : 0;
  const maximumScrollLeft = Math.max(
    0,
    timelineShell.scrollWidth - timelineShell.clientWidth
  );
  timelineShell.scrollLeft = Math.min(
    Math.max(0, centredScrollLeft),
    maximumScrollLeft
  );
}

function getCurrentOnlineRoundPlayer(partyData = currentPartyData) {
  return (partyData?.players || []).find(
    (player) => String(getPlayerId(player)) === String(deviceId)
  );
}

function showRoundLateJoinContainerIfNeeded({
  partyData = currentPartyData,
  gamemode
} = {}) {
  const currentPlayer = getCurrentOnlineRoundPlayer(partyData);
  if (currentPlayer?.state?.participationStatus !== 'pending_next_round') {
    return false;
  }

  renderRoundLateJoinTimeline({ partyData, gamemode });
  setActiveContainers(nextRoundJoinContainer);
  return true;
}

async function registerRoundLateJoinIfRequested() {
  const url = new URL(window.location.href);
  const lateJoinStorageKey = `oe-late-join:${partyCode}`;
  const lateJoinRequested =
    url.searchParams.get('lateJoin') === '1' ||
    sessionStorage.getItem(lateJoinStorageKey) === '1';
  if (!lateJoinRequested) return true;

  const response = await fetch(
    `/api/waiting-room?partyCode=${encodeURIComponent(partyCode)}`
  );
  const waitingRoomData = response.ok ? await response.json() : [];
  const party = Array.isArray(waitingRoomData) ? waitingRoomData[0] : null;
  if (!party) return false;

  const players = party.players || [];
  const existingPlayer = players.find(
    (player) => getPlayerId(player) === deviceId
  );

  if (!existingPlayer) {
    const resolvedUsername = await resolveOnlineUsername(players);
    await addUserToParty({
      partyId: partyCode,
      newComputerId: deviceId,
      newUsername: resolvedUsername,
      newUserIcon: getStoredUserIconString(),
      newUserSocketId: socket.id
    });
  }

  url.searchParams.delete('lateJoin');
  sessionStorage.removeItem(lateJoinStorageKey);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}
