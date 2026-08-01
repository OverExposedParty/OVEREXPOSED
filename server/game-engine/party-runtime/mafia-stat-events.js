const {
  getMafiaRoleBehaviour,
  getMafiaRoleTeamKey
} = require('./mafia-role-behaviours');

function createMafiaStatEventTools({
  createAccountStatEvent,
  getPartyPlayerState
}) {
  function requireMafiaRoleKey(player) {
    const roleKey = getPartyPlayerState(player).roleKey;
    if (!getMafiaRoleBehaviour(roleKey)) {
      const error = new Error(
        `Player has an invalid Mafia role key "${roleKey}".`
      );
      error.status = 400;
      error.code = 'invalid_mafia_role_key';
      throw error;
    }
    return roleKey;
  }

  function getMafiaTeamForRole(roleKey) {
    return getMafiaRoleTeamKey(roleKey);
  }

  function getMafiaWinningTeam(gameOverInstruction) {
    const reason = String(gameOverInstruction || '').split(':')[1] || '';
    if (reason === 'MAFIOSO') return 'mafia';
    if (reason === 'CIVILIAN') return 'town';
    if (reason === 'SERIAL_KILLER') return 'neutral';
    return null;
  }

  function createMafiaStartStatEvent(players = []) {
    return createAccountStatEvent(
      'mafia',
      players.map((player) => {
        const roleKey = requireMafiaRoleKey(player);
        return {
          player,
          paths: {
            gamesPlayed: 1,
            [`stats.roles.${roleKey}.gamesPlayed`]: 1,
            [`stats.gamesAs.${roleKey}`]: 1
          }
        };
      })
    );
  }

  function createMafiaGameOverStatEvent(
    players = [],
    gameOverInstruction = '',
    completedRounds = 0
  ) {
    const winningTeam = getMafiaWinningTeam(gameOverInstruction);
    if (!winningTeam) return null;

    const event = createAccountStatEvent(
      'mafia',
      players.map((player) => {
        const roleKey = requireMafiaRoleKey(player);
        const team = getMafiaTeamForRole(roleKey);
        const won = team === winningTeam;
        return {
          player,
          paths: {
            roundsPlayed: Math.max(0, Number(completedRounds) || 0),
            [`stats.${winningTeam}Wins`]: won ? 1 : 0,
            [`stats.${team}${won ? 'Wins' : 'Losses'}`]: 1,
            [`stats.roles.${roleKey}.${won ? 'wins' : 'losses'}`]: 1
          }
        };
      })
    );
    if (event) event.eventKey = 'mafia-game-over';
    return event;
  }

  return {
    getMafiaTeamForRole,
    getMafiaWinningTeam,
    createMafiaStartStatEvent,
    createMafiaGameOverStatEvent
  };
}

module.exports = { createMafiaStatEventTools };
