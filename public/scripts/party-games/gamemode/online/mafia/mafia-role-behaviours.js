(function exposeMafiaRoleBehaviours(root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.MafiaRoleBehaviours = api;
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  function createMafiaRoleBehaviours() {
    const MAFIA_ACTION_KEYS = Object.freeze({
      CIVILIAN_WATCH: 'civilian-watch',
      INSPECT_PLAYER: 'inspect-player',
      MAFIA_KILL_VOTE: 'mafia-kill-vote',
      TOWN_VOTE: 'town-vote'
    });

    const MAFIA_ACTION_DEFINITIONS = Object.freeze({
      [MAFIA_ACTION_KEYS.CIVILIAN_WATCH]: Object.freeze({
        key: MAFIA_ACTION_KEYS.CIVILIAN_WATCH,
        phase: 'night',
        scope: 'role',
        executorKey: MAFIA_ACTION_KEYS.CIVILIAN_WATCH
      }),
      [MAFIA_ACTION_KEYS.INSPECT_PLAYER]: Object.freeze({
        key: MAFIA_ACTION_KEYS.INSPECT_PLAYER,
        phase: 'night',
        scope: 'role',
        // Temporary: Inspector keeps its own stable action key while reusing
        // the Civilian Watch experience until inspection is implemented.
        executorKey: MAFIA_ACTION_KEYS.CIVILIAN_WATCH
      }),
      [MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE]: Object.freeze({
        key: MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE,
        phase: 'night',
        scope: 'role',
        executorKey: MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
      }),
      [MAFIA_ACTION_KEYS.TOWN_VOTE]: Object.freeze({
        key: MAFIA_ACTION_KEYS.TOWN_VOTE,
        phase: 'day',
        scope: 'phase',
        executorKey: MAFIA_ACTION_KEYS.TOWN_VOTE
      })
    });

    const MAFIA_PHASE_ACTIONS = Object.freeze({
      day: Object.freeze([MAFIA_ACTION_KEYS.TOWN_VOTE]),
      night: Object.freeze([])
    });

    const MAFIA_ROLE_BEHAVIOURS = Object.freeze({
      civilian: Object.freeze({
        teamKey: 'town',
        phaseActions: Object.freeze({
          night: Object.freeze([MAFIA_ACTION_KEYS.CIVILIAN_WATCH])
        }),
        passives: Object.freeze([]),
        winConditionKey: 'civilian-victory'
      }),
      mafioso: Object.freeze({
        teamKey: 'mafia',
        phaseActions: Object.freeze({
          night: Object.freeze([MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE])
        }),
        passives: Object.freeze([]),
        winConditionKey: 'mafioso-parity'
      }),
      inspector: Object.freeze({
        teamKey: 'town',
        phaseActions: Object.freeze({
          night: Object.freeze([MAFIA_ACTION_KEYS.INSPECT_PLAYER])
        }),
        passives: Object.freeze([]),
        winConditionKey: 'civilian-victory'
      }),
      godfather: Object.freeze({
        teamKey: 'mafia',
        phaseActions: Object.freeze({
          night: Object.freeze([MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE])
        }),
        passives: Object.freeze([]),
        winConditionKey: 'mafioso-parity'
      }),
      mayor: Object.freeze({
        teamKey: 'town',
        phaseActions: Object.freeze({
          night: Object.freeze([MAFIA_ACTION_KEYS.CIVILIAN_WATCH])
        }),
        passives: Object.freeze([]),
        winConditionKey: 'civilian-victory'
      }),
      'serial-killer': Object.freeze({
        teamKey: 'neutral',
        phaseActions: Object.freeze({}),
        passives: Object.freeze([]),
        winConditionKey: 'last-player-standing'
      }),
      lawyer: Object.freeze({
        teamKey: 'neutral',
        phaseActions: Object.freeze({}),
        passives: Object.freeze([]),
        winConditionKey: null
      })
    });

    function getMafiaRoleBehaviour(roleKey) {
      return typeof roleKey === 'string' &&
        Object.prototype.hasOwnProperty.call(MAFIA_ROLE_BEHAVIOURS, roleKey)
        ? MAFIA_ROLE_BEHAVIOURS[roleKey]
        : null;
    }

    function getMafiaRoleTeamKey(roleKey) {
      return getMafiaRoleBehaviour(roleKey)?.teamKey || null;
    }

    function getMafiaRoleActionKeys(roleKey, phase) {
      const behaviour = getMafiaRoleBehaviour(roleKey);
      const roleActions = behaviour?.phaseActions?.[phase] || [];
      return [...roleActions];
    }

    function getMafiaPhaseActionKeys(phase) {
      return [...(MAFIA_PHASE_ACTIONS[phase] || [])];
    }

    function getMafiaAvailableActionKeys(roleKey, phase) {
      return Array.from(
        new Set([
          ...getMafiaPhaseActionKeys(phase),
          ...getMafiaRoleActionKeys(roleKey, phase)
        ])
      );
    }

    function getMafiaActionExecutorKey(actionKey) {
      return MAFIA_ACTION_DEFINITIONS[actionKey]?.executorKey || null;
    }

    function mafiaRoleHasAction(roleKey, phase, actionKey) {
      return getMafiaAvailableActionKeys(roleKey, phase).includes(actionKey);
    }

    return Object.freeze({
      MAFIA_ACTION_DEFINITIONS,
      MAFIA_ACTION_KEYS,
      MAFIA_PHASE_ACTIONS,
      MAFIA_ROLE_BEHAVIOURS,
      getMafiaActionExecutorKey,
      getMafiaAvailableActionKeys,
      getMafiaPhaseActionKeys,
      getMafiaRoleActionKeys,
      getMafiaRoleBehaviour,
      getMafiaRoleTeamKey,
      mafiaRoleHasAction
    });
  }
);
