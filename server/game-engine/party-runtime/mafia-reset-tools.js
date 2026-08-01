const {
  getMafiaRoleTeamKey,
  mafiaRoleHasAction,
  MAFIA_ACTION_KEYS
} = require('./mafia-role-behaviours');

function createMafiaResetTools({ getPartyPlayerState }) {
  function getMostFrequentNonTiedVote(votes = []) {
    const counts = new Map();
    votes.filter(Boolean).forEach((vote) => {
      counts.set(vote, (counts.get(vote) ?? 0) + 1);
    });

    let maxCount = 0;
    let maxVote = '';
    let isTie = false;

    counts.forEach((count, vote) => {
      if (count > maxCount) {
        maxCount = count;
        maxVote = vote;
        isTie = false;
      } else if (count === maxCount) {
        isTie = true;
      }
    });

    return isTie ? '' : maxVote;
  }

  function getMafiaNightVote(players = []) {
    const votes = players
      .filter((player) =>
        mafiaRoleHasAction(
          getPartyPlayerState(player).roleKey,
          'night',
          MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
        )
      )
      .map((player) => getPartyPlayerState(player).vote ?? player.vote)
      .filter(Boolean);

    return getMostFrequentNonTiedVote(votes);
  }

  function getMafiaTownVote(players = []) {
    const votes = players
      .filter(
        (player) =>
          (getPartyPlayerState(player).status ?? player.status) === 'alive'
      )
      .map((player) => getPartyPlayerState(player).vote ?? player.vote)
      .filter(Boolean);

    return getMostFrequentNonTiedVote(votes);
  }

  function evaluateMafiaGameOver(players = []) {
    const alive = players.filter(
      (player) =>
        (getPartyPlayerState(player).status ?? player.status) === 'alive'
    );
    const civilians = alive.filter(
      (player) =>
        getMafiaRoleTeamKey(getPartyPlayerState(player).roleKey) === 'town'
    );
    const mafia = alive.filter(
      (player) =>
        getMafiaRoleTeamKey(getPartyPlayerState(player).roleKey) === 'mafia'
    );
    const neutrals = alive.filter(
      (player) =>
        getMafiaRoleTeamKey(getPartyPlayerState(player).roleKey) === 'neutral'
    );
    const serialKillers = alive.filter(
      (player) => getPartyPlayerState(player).roleKey === 'serial-killer'
    );

    if (
      mafia.length > 0 &&
      mafia.length >= civilians.length + neutrals.length
    ) {
      return 'DISPLAY_GAMEOVER:MAFIOSO';
    }

    if (mafia.length === 0 && civilians.length > 0) {
      return 'DISPLAY_GAMEOVER:CIVILIAN';
    }

    if (serialKillers.length === 1 && alive.length === 1) {
      return 'DISPLAY_GAMEOVER:SERIAL_KILLER';
    }

    if (alive.length === 0) {
      return 'DISPLAY_GAMEOVER:DRAW';
    }

    return null;
  }

  function resetMafiaVotes(players = []) {
    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      const status = playerState.status ?? player.status;
      if (status === 'alive') {
        playerState.vote = null;
        player.vote = null;
      }
      playerState.hasConfirmed = false;
      playerState.isReady = false;
      player.hasConfirmed = false;
      player.isReady = false;
    });
  }

  return {
    getMostFrequentNonTiedVote,
    getMafiaNightVote,
    getMafiaTownVote,
    evaluateMafiaGameOver,
    resetMafiaVotes
  };
}

module.exports = { createMafiaResetTools };
