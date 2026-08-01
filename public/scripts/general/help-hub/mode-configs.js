(function () {
  function createHelpHubModeConfigs() {
const HELP_HUB_MODE_CONFIGS = {
  'truth-or-dare': {
    title: 'Truth Or Dare',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Pick Truth/Dare' },
      { label: 'Answer Or Pass' },
      { label: 'Punishments' },
      { label: 'Waiting' }
    ]
  },
  'never-have-i-ever': {
    title: 'Never Have I Ever',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Answering' },
      { label: 'Results' },
      { label: 'Packs' },
      { label: 'Waiting' }
    ]
  },
  'would-you-rather': {
    title: 'Would You Rather',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Choosing' },
      { label: 'Results' },
      { label: 'Waiting' },
      { label: 'Round Flow' }
    ]
  },
  'most-likely-to': {
    title: 'Most Likely To',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Voting' },
      { label: 'Being Chosen' },
      { label: 'Punishments' },
      { label: 'Tie Breakers' }
    ]
  },
  paranoia: {
    title: 'Paranoia',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Secret Prompt' },
      { label: 'Choosing Someone' },
      { label: 'Reveal / Pass' },
      { label: 'Punishments' }
    ]
  },
  imposter: {
    title: 'Imposter',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Your Word' },
      { label: 'Explaining' },
      { label: 'Voting' },
      { label: 'Finding Imposter' }
    ]
  },
  mafia: {
    title: 'Mafia',
    topics: [
      { label: 'How To Play', size: 'primary' },
      { label: 'Roles' },
      { label: 'Day / Night' },
      { label: 'Voting' },
      { label: 'Winning' }
    ]
  }
};

    return { HELP_HUB_MODE_CONFIGS };
  }

  window.createHelpHubModeConfigs = createHelpHubModeConfigs;
})();
