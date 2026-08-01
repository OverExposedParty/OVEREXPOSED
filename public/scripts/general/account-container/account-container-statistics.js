function formatAccountDuration(seconds) {
  const totalMinutes = Math.max(0, Math.round(Number(seconds) / 60) || 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function getAccountStatistics(account) {
  const stats = account?.gameData || {};
  return stats;
}

function createAccountStatisticSummary(stats) {
  const section = createAccountProfileSection('Overview');
  section.append(
    createAccountProfileRow(
      'Games played',
      formatAccountNumber(stats.gamesPlayed)
    ),
    createAccountProfileRow(
      'Rounds played',
      formatAccountNumber(stats.roundsPlayed)
    ),
    createAccountProfileRow(
      'Playtime',
      formatAccountDuration(stats.totalPlaytimeSeconds)
    ),
    createAccountProfileRow(
      'Level',
      `Level ${formatAccountNumber(stats.level || 1)} / ${formatAccountNumber(stats.xp)} XP`
    )
  );
  return section;
}

function getAccountGameModeLabel(gameMode) {
  return String(gameMode || 'Unknown game')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normaliseAccountGameModeKey(gameMode) {
  return String(gameMode || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getAccountActiveGameModes(stats) {
  if (!accountActiveGameModesPromise) {
    accountActiveGameModesPromise = fetch('/api/party-game-gamemodes', {
      credentials: 'same-origin'
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.success === false) return [];

        const gamemodes = payload?.data?.gamemodes || payload?.gamemodes || [];
        return gamemodes
          .map((gamemode) => ({
            gameMode:
              gamemode.gameMode || gamemode.gamemode || gamemode.id || gamemode,
            label: gamemode.label || gamemode.name || null
          }))
          .filter((gamemode) => gamemode.gameMode);
      })
      .catch((error) => {
        console.warn(error);
        return [];
      });
  }

  const activeGameModes = await accountActiveGameModesPromise;
  if (activeGameModes.length) return activeGameModes;

  const perGameStats = Array.isArray(stats?.perGameStats)
    ? stats.perGameStats
    : [];
  return perGameStats
    .map((gameStats) => ({
      gameMode: gameStats.gameMode,
      label: getAccountGameModeLabel(gameStats.gameMode)
    }))
    .filter((gamemode) => gamemode.gameMode);
}

async function getAccountStatsForActiveGameModes(stats) {
  const perGameStats = Array.isArray(stats.perGameStats)
    ? stats.perGameStats
    : [];
  const statsByGameMode = new Map(
    perGameStats.map((gameStats) => [
      normaliseAccountGameModeKey(gameStats.gameMode),
      gameStats
    ])
  );

  const activeGameModes = await getAccountActiveGameModes(stats);
  return activeGameModes.map((gamemode) => ({
    gameMode: gamemode.gameMode,
    label: gamemode.label,
    gamesPlayed: 0,
    roundsPlayed: 0,
    totalPlaytimeSeconds: 0,
    lastPlayedAt: null,
    favouritePack: '-',
    ...statsByGameMode.get(normaliseAccountGameModeKey(gamemode.gameMode))
  }));
}

function createAccountStatisticGameCard(gameStats) {
  const gameName =
    gameStats.label || getAccountGameModeLabel(gameStats.gameMode);
  const gameModeKey = normaliseAccountGameModeKey(gameStats.gameMode);
  const modeStats = gameStats.stats || {};
  const card = document.createElement('article');
  card.className = 'account-stat-card';

  const summary = document.createElement('button');
  summary.className = 'account-stat-summary';
  summary.type = 'button';
  summary.setAttribute('aria-expanded', 'false');
  summary.dataset.accountHint = `Show ${gameName} statistics`;

  const title = document.createElement('span');
  title.className = 'account-stat-title';
  title.textContent = gameName;

  const arrow = document.createElement('span');
  arrow.className = 'account-stat-dropdown-arrow';
  arrow.setAttribute('aria-hidden', 'true');

  summary.append(title, arrow);

  const details = document.createElement('div');
  details.className = 'account-stat-details';
  details.hidden = true;
  details.append(
    createAccountProfileRow(
      'Rounds',
      formatAccountNumber(gameStats.roundsPlayed)
    ),
    createAccountProfileRow(
      'Playtime',
      formatAccountDuration(gameStats.totalPlaytimeSeconds)
    ),
    createAccountProfileRow(
      'Last played',
      formatAccountDate(gameStats.lastPlayedAt)
    ),
    createAccountProfileRow('Favourite pack', gameStats.favouritePack || '-')
  );

  if (gameModeKey === 'most-likely-to') {
    const roundsPlayed = Number(gameStats.roundsPlayed) || 0;
    const roundsNominated = Number(modeStats.roundsNominated) || 0;
    const votesReceived = Number(modeStats.votesReceived) || 0;
    const totalEligibleVotes = Number(modeStats.totalEligibleVotes) || 0;
    const mainCharacterRate =
      roundsPlayed > 0 && totalEligibleVotes > 0
        ? ((roundsNominated / roundsPlayed) * 0.45 +
            (votesReceived / totalEligibleVotes) * 0.55) *
          100
        : 0;

    details.append(
      createAccountProfileRow(
        'Votes cast',
        formatAccountNumber(modeStats.votesCast)
      ),
      createAccountProfileRow(
        'Times voted for',
        formatAccountNumber(votesReceived)
      ),
      createAccountProfileRow(
        'Rounds nominated',
        formatAccountNumber(roundsNominated)
      ),
      createAccountProfileRow(
        'Unanimous picks',
        formatAccountNumber(modeStats.unanimousPicks)
      ),
      createAccountProfileRow(
        'Self votes',
        formatAccountNumber(modeStats.timesVotedForSelf)
      ),
      createAccountProfileRow(
        'Main character rate',
        formatAccountPercent(mainCharacterRate)
      )
    );
  }

  if (gameModeKey === 'truth-or-dare') {
    details.append(
      createAccountProfileRow(
        'Truths completed',
        formatAccountNumber(modeStats.truthsCompleted)
      ),
      createAccountProfileRow(
        'Dares completed',
        formatAccountNumber(modeStats.daresCompleted)
      ),
      createAccountProfileRow(
        'Truths skipped',
        formatAccountNumber(modeStats.truthsSkipped)
      ),
      createAccountProfileRow(
        'Dares skipped',
        formatAccountNumber(modeStats.daresSkipped)
      ),
      createAccountProfileRow(
        'Prompt heists',
        formatAccountNumber(modeStats.promptHeists)
      ),
      createAccountProfileRow(
        'Drink wheel spins',
        formatAccountNumber(modeStats.drinkWheelSpins)
      ),
      createAccountProfileRow(
        'Punishments completed',
        formatAccountNumber(modeStats.punishmentsCompleted)
      )
    );
  }

  if (gameModeKey === 'paranoia') {
    details.append(
      createAccountProfileRow(
        'Questions asked',
        formatAccountNumber(modeStats.questionsAsked)
      ),
      createAccountProfileRow(
        'Players selected',
        formatAccountNumber(modeStats.playersSelected)
      ),
      createAccountProfileRow(
        'Selected by others',
        formatAccountNumber(modeStats.timesSelectedByOthers)
      ),
      createAccountProfileRow(
        'Reveals triggered',
        formatAccountNumber(modeStats.revealsTriggered)
      ),
      createAccountProfileRow(
        'Reveals survived',
        formatAccountNumber(modeStats.revealsSurvived)
      ),
      createAccountProfileRow(
        'Reveals failed',
        formatAccountNumber(modeStats.revealsFailed)
      )
    );
  }

  if (gameModeKey === 'never-have-i-ever') {
    details.append(
      createAccountProfileRow(
        'Have votes',
        formatAccountNumber(modeStats.haveVotes)
      ),
      createAccountProfileRow(
        'Have not votes',
        formatAccountNumber(modeStats.haveNotVotes)
      ),
      createAccountProfileRow(
        'Majority votes',
        formatAccountNumber(modeStats.majorityVotes)
      ),
      createAccountProfileRow(
        'Odd man out',
        formatAccountNumber(modeStats.oddManOuts)
      ),
      createAccountProfileRow(
        'Drink punishments received',
        formatAccountNumber(modeStats.drinkPunishmentsReceived)
      ),
      createAccountProfileRow(
        'Drink punishments completed',
        formatAccountNumber(modeStats.drinkPunishmentsCompleted)
      ),
      createAccountProfileRow(
        'Longest have streak',
        formatAccountNumber(modeStats.longestHaveStreak)
      ),
      createAccountProfileRow(
        'Longest have not streak',
        formatAccountNumber(modeStats.longestHaveNotStreak)
      )
    );
  }

  if (gameModeKey === 'would-you-rather') {
    details.append(
      createAccountProfileRow(
        'Option A votes',
        formatAccountNumber(modeStats.optionAVotes)
      ),
      createAccountProfileRow(
        'Option B votes',
        formatAccountNumber(modeStats.optionBVotes)
      ),
      createAccountProfileRow(
        'Majority picks',
        formatAccountNumber(modeStats.majorityPicks)
      ),
      createAccountProfileRow(
        'Minority picks',
        formatAccountNumber(modeStats.minorityPicks)
      ),
      createAccountProfileRow(
        'Perfect split participation',
        formatAccountNumber(modeStats.perfectSplitParticipations)
      )
    );
  }

  if (gameModeKey === 'imposter') {
    const crewAccuracy = modeStats.crewVoteAccuracy || {};
    details.append(
      createAccountProfileRow(
        'Rounds as imposter',
        formatAccountNumber(modeStats.roundsAsImposter)
      ),
      createAccountProfileRow(
        'Rounds as crew',
        formatAccountNumber(modeStats.roundsAsCrew)
      ),
      createAccountProfileRow(
        'Imposter wins',
        formatAccountNumber(modeStats.imposterWins)
      ),
      createAccountProfileRow(
        'Crew wins',
        formatAccountNumber(modeStats.crewWins)
      ),
      createAccountProfileRow(
        'Correct imposter votes',
        formatAccountNumber(modeStats.correctImposterVotes)
      ),
      createAccountProfileRow(
        'False accusations',
        formatAccountNumber(modeStats.falseAccusations)
      ),
      createAccountProfileRow(
        'Survived as imposter',
        formatAccountNumber(modeStats.survivedAsImposter)
      ),
      createAccountProfileRow(
        'Voted out as imposter',
        formatAccountNumber(modeStats.votedOutAsImposter)
      ),
      createAccountProfileRow(
        'Votes submitted',
        formatAccountNumber(modeStats.votesSubmitted)
      ),
      createAccountProfileRow(
        'Vote accuracy',
        formatAccountRatioPercent(
          crewAccuracy.correctVotes,
          crewAccuracy.eligibleVotes
        )
      )
    );
  }

  if (gameModeKey === 'mafia') {
    details.append(
      createAccountProfileRow(
        'Mafia wins',
        formatAccountNumber(modeStats.mafiaWins)
      ),
      createAccountProfileRow(
        'Town wins',
        formatAccountNumber(modeStats.townWins)
      ),
      createAccountProfileRow(
        'Neutral wins',
        formatAccountNumber(modeStats.neutralWins)
      ),
      createAccountProfileRow(
        'Mafia losses',
        formatAccountNumber(modeStats.mafiaLosses)
      ),
      createAccountProfileRow(
        'Town losses',
        formatAccountNumber(modeStats.townLosses)
      ),
      createAccountProfileRow(
        'Neutral losses',
        formatAccountNumber(modeStats.neutralLosses)
      ),
      createAccountProfileRow(
        'Night kills joined',
        formatAccountNumber(modeStats.nightKillsParticipatedIn)
      ),
      createAccountProfileRow(
        'Day votes cast',
        formatAccountNumber(modeStats.dayVotesCast)
      ),
      createAccountProfileRow(
        'Correct eliminations',
        formatAccountNumber(modeStats.correctEliminations)
      ),
      createAccountProfileRow(
        'Wrong eliminations',
        formatAccountNumber(modeStats.wrongEliminations)
      ),
      createAccountProfileRow(
        'Killed at night',
        formatAccountNumber(modeStats.timesKilledAtNight)
      ),
      createAccountProfileRow(
        'Voted out during day',
        formatAccountNumber(modeStats.timesVotedOutDuringDay)
      )
    );
  }

  card.append(summary, details);
  return card;
}

async function renderAccountStatisticsPanel() {
  if (!accountExpandedContent) return;

  const stats = getAccountStatistics(getStoredAccount());
  accountExpandedContent.replaceChildren(
    createAccountProfileRow('Status', 'Loading statistics')
  );

  const gameStats = await getAccountStatsForActiveGameModes(stats);
  if (accountExpandedAction !== 'statistics') return;

  const gamesSection = createAccountProfileSection('Game breakdown');
  const gamesList = document.createElement('div');
  gamesList.className = 'account-stat-list';

  if (gameStats.length) {
    gamesList.append(...gameStats.map(createAccountStatisticGameCard));
  } else {
    gamesList.appendChild(createAccountFriendsEmptyState('statistics'));
  }

  gamesSection.appendChild(gamesList);

  accountExpandedContent.replaceChildren(
    createAccountStatisticSummary(stats),
    gamesSection
  );
}
