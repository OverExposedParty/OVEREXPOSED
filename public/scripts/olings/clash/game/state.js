(function (globalScope) {
  const actionKeys = Object.freeze(['attack', 'guard', 'skill']);

  function toUnitCount(value, fallback = 0) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue)
      ? Math.max(0, Math.floor(parsedValue))
      : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeTeamSlots(teams = {}) {
    ['local', 'opponent'].forEach((side) => {
      const team = Array.isArray(teams[side]) ? teams[side] : [];
      team.forEach((oling, index) => {
        const teamSlot = Number(oling?.teamSlot);
        oling.teamSlot =
          Number.isInteger(teamSlot) && teamSlot >= 0 ? teamSlot : index;
      });
    });
    return teams;
  }

  function readParts(slot) {
    const parts = {};
    ['flight', 'body', 'eyes', 'mouth'].forEach((partKey) => {
      const image = slot.querySelector(
        `.olings-clash-oling-layer.is-${partKey}`
      );
      parts[partKey] = image?.getAttribute('src') || '';
    });
    return parts;
  }

  function readEffects(slot) {
    return [...slot.querySelectorAll('[data-effect-key]')].map((effect) => ({
      abbreviation: String(
        effect.dataset.effectAbbreviation || effect.textContent || ''
      ).trim(),
      key: effect.dataset.effectKey || '',
      name: effect.getAttribute('title') || effect.dataset.effectKey || '',
      type: effect.classList.contains('is-negative') ? 'negative' : 'positive'
    }));
  }

  function readOling(slot, index) {
    const name = String(
      slot.querySelector('.olings-clash-roster-slot__status > strong')
        ?.textContent || `OLING ${index + 1}`
    ).trim();
    const healthElement = slot.querySelector('[data-clash-health]');
    const moves = {};
    actionKeys.forEach((action) => {
      moves[action] =
        slot.dataset[`move${action[0].toUpperCase()}${action.slice(1)}`] ||
        action.toUpperCase();
    });
    moves.draw = slot.dataset.moveDraw || 'DRAW';

    return {
      abilityProgress: [],
      effects: readEffects(slot),
      flightMotion: slot.dataset.flightMotion || '',
      flightSpeed: Number(slot.dataset.flightSpeed) || 1,
      flightType: slot.dataset.flightType || '',
      removedPositiveEffects: [],
      pendingReclaimUnits: toUnitCount(slot.dataset.pendingReclaimUnits),
      health: {
        bloodUnits: toUnitCount(healthElement?.dataset.bloodUnits),
        shieldCount: toUnitCount(healthElement?.dataset.shieldCount),
        heartUnits: toUnitCount(healthElement?.dataset.heartUnits, 6),
        maxHeartUnits: Math.max(
          1,
          toUnitCount(healthElement?.dataset.maxHeartUnits, 6)
        ),
        overgrowthUnits: toUnitCount(healthElement?.dataset.overgrowthUnits)
      },
      id: slot.dataset.olingId || `${name.toLowerCase()}-${index}`,
      moves,
      name,
      parts: readParts(slot),
      teamSlot: index
    };
  }

  function readTeam(root, side) {
    const roster = root?.querySelector?.(`[data-clash-roster="${side}"]`);
    if (!roster) return [];
    return [...roster.querySelectorAll('[data-clash-roster-slot]')].map(
      readOling
    );
  }

  function createOlingClashState(options = {}) {
    const initialTeams = normalizeTeamSlots(
      clone(
        options.teams || {
          local: readTeam(options.root, 'local'),
          opponent: readTeam(options.root, 'opponent')
        }
      )
    );
    const state = {};

    function reset() {
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, {
        lastOutcome: 'NO RESULT',
        lastResult: null,
        lastUsedParts: {
          local: null,
          opponent: null
        },
        phase: 'waiting',
        playerEffects: {
          local: [],
          opponent: []
        },
        pendingRoundStartEffects: [],
        round: 0,
        selections: {
          localAction: null,
          localEffectChoice: null,
          localTagSlot: null,
          opponentAction: null,
          opponentEffectChoice: null
        },
        tagResources: {
          local: null,
          opponent: null
        },
        teams: clone(initialTeams),
        winner: null
      });
      return state;
    }

    function getAvailableBenchSlots(side) {
      const team = state.teams[side] || [];
      return team
        .map((oling, index) => ({ index, oling }))
        .filter(({ index, oling }) => index > 0 && oling.health.heartUnits > 0)
        .map(({ oling }) => Number(oling.teamSlot));
    }

    function swapActive(side, benchSlot) {
      const team = state.teams[side];
      const normalizedSlot = Number(benchSlot);
      const benchIndex = Array.isArray(team)
        ? team.findIndex(
            (oling, index) =>
              index > 0 && Number(oling?.teamSlot) === normalizedSlot
          )
        : -1;
      if (
        !Array.isArray(team) ||
        !Number.isInteger(normalizedSlot) ||
        benchIndex < 1 ||
        Number(team[benchIndex]?.health?.heartUnits || 0) <= 0
      ) {
        return null;
      }

      [team[0], team[benchIndex]] = [team[benchIndex], team[0]];
      return team[0];
    }

    reset();
    return {
      actionKeys,
      getAvailableBenchSlots,
      initialTeams,
      reset,
      state,
      swapActive
    };
  }

  globalScope.createOlingClashState = createOlingClashState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashState;
  }
})(typeof window !== 'undefined' ? window : globalThis);
