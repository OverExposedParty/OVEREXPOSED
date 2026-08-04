function loadOverexposureConsoleScript(src) {
  if (typeof LoadScript === 'function') {
    return LoadScript(src);
  }

  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = versionAssetUrl(src);
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

let overexposureConsoleCommandsReady = null;
let overexposureConsoleCommandSuggestions = [];
let overexposureConsoleAchievementKeysReady = null;

const overexposureConsoleBaseSuggestions = [
  '/achievement',
  '/achievement list',
  '/clear',
  '/debug',
  '/debug all',
  '/debug audio',
  '/debug audio.errors',
  '/debug audio.playback',
  '/debug audio.preload',
  '/debug audio.queue',
  '/debug audio.settings',
  '/debug level debug',
  '/debug level error',
  '/debug level info',
  '/debug level warn',
  '/debug off',
  '/debug status',
  '/help',
  '/notification',
  '/notification test achievement',
  '/notification test achievement all',
  '/notification test account-prompt',
  '/notification test email-verified',
  '/notification test friend-accepted',
  '/notification test friend-request',
  '/notification test incubator-ready base-egg',
  '/notification test opals',
  '/notification test opals 100',
  '/notification test party-disbanded',
  '/oling',
  '/oling hatch',
  '/oling room',
  '/page',
  '/shop',
  '/shop grant'
];

function ensureOverexposureConsoleCommands() {
  if (!overexposureConsoleCommandsReady) {
    overexposureConsoleCommandsReady = loadOverexposureConsoleScript(
      '/scripts/general/commands/command-registry.js'
    )
      .then(() =>
        Promise.all([
          loadOverexposureConsoleScript(
            '/scripts/general/commands/achievement-commands.js'
          ),
          loadOverexposureConsoleScript(
            '/scripts/general/commands/oling-commands.js'
          ),
          loadOverexposureConsoleScript(
            '/scripts/general/commands/shop-commands.js'
          ),
          loadOverexposureConsoleScript(
            '/scripts/party-games/general/party-games-commands.js'
          ),
          loadOverexposureConsoleScript(
            '/scripts/overexposure/commands/overexposure-commands.js'
          )
        ])
      )
      .then(async () => {
        overexposureConsoleCommandSuggestions =
          await getOverexposureConsoleCommandSuggestions();
        return overexposureConsoleCommandSuggestions;
      });
  }

  return overexposureConsoleCommandsReady;
}

function normaliseConsoleSuggestion(value) {
  const suggestion = String(value || '').trim();
  if (!suggestion) return '';
  return suggestion.startsWith('/') ? suggestion : `/${suggestion}`;
}

function uniqueSortedConsoleSuggestions(suggestions) {
  return suggestions
    .map(normaliseConsoleSuggestion)
    .filter(Boolean)
    .filter(
      (suggestion, index, allSuggestions) =>
        allSuggestions.indexOf(suggestion) === index
    )
    .sort((a, b) => a.localeCompare(b));
}

function mergeConsoleSuggestions(...suggestionGroups) {
  return uniqueSortedConsoleSuggestions(suggestionGroups.flat());
}

function loadOverexposureConsoleAchievementKeys() {
  if (!overexposureConsoleAchievementKeysReady) {
    overexposureConsoleAchievementKeysReady = fetch('/api/achievements')
      .then((response) => {
        if (!response.ok) return [];
        return response.json();
      })
      .then((data) =>
        Array.isArray(data?.data?.achievements)
          ? data.data.achievements
              .map((achievement) => achievement.key)
              .filter(Boolean)
          : Array.isArray(data?.achievements)
            ? data.achievements
                .map((achievement) => achievement.key)
                .filter(Boolean)
            : []
      )
      .catch(() => []);
  }

  return overexposureConsoleAchievementKeysReady;
}

function getSuggestionsFromCommandState(pageType) {
  const state = window.__overexposedCommandState;
  if (!state?.packs || typeof state.packs.get !== 'function') return [];

  const suggestions = ['/help'];
  ['global', pageType]
    .filter(
      (packId, index, packIds) => packId && packIds.indexOf(packId) === index
    )
    .forEach((packId) => {
      const pack = state.packs.get(packId);
      Object.entries(pack?.commands || {}).forEach(([commandName, data]) => {
        if (data?.hidden === true) return;

        suggestions.push(`/${commandName}`);

        if (Array.isArray(data?.suggestions)) {
          data.suggestions
            .map(normaliseConsoleSuggestion)
            .filter(Boolean)
            .forEach((suggestion) => suggestions.push(suggestion));
        }
      });
    });

  return uniqueSortedConsoleSuggestions(suggestions);
}

async function getOverexposureConsoleCommandSuggestions() {
  const asyncRegistrySuggestions =
    await window.OverexposedCommands?.getCommandSuggestionsAsync?.(
      'overexposure'
    );
  const registrySuggestions =
    window.OverexposedCommands?.getCommandSuggestions?.('overexposure');
  const stateSuggestions = getSuggestionsFromCommandState('overexposure');
  const achievementKeys = await loadOverexposureConsoleAchievementKeys();
  const achievementSuggestions = achievementKeys.map(
    (key) => `/notification test achievement ${key}`
  );

  return mergeConsoleSuggestions(
    overexposureConsoleBaseSuggestions,
    Array.isArray(asyncRegistrySuggestions) ? asyncRegistrySuggestions : [],
    Array.isArray(registrySuggestions) ? registrySuggestions : [],
    stateSuggestions,
    achievementSuggestions
  );
}
