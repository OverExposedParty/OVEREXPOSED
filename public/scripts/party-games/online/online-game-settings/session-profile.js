function getOnlineGameSessionPrefix(gamemode) {
  const aliases = {
    imposter: 'IMP',
    mafia: 'MAF',
    'most-likely-to': 'MLT',
    'never-have-i-ever': 'NHIE',
    paranoia: 'PAR',
    'truth-or-dare': 'TOD',
    'would-you-rather': 'WYR'
  };

  if (aliases[gamemode]) {
    return aliases[gamemode];
  }

  return (
    String(gamemode || 'GAME')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 6)
      .toUpperCase() || 'GAME'
  );
}

function createOnlineGameSessionId(gamemode) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const values = new Uint32Array(8);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
  } else {
    values.forEach((_, index) => {
      values[index] = Math.floor(Math.random() * 0xffffffff);
    });
  }
  const suffix = Array.from(
    values,
    (value) => alphabet[value % alphabet.length]
  ).join('');

  return `${getOnlineGameSessionPrefix(gamemode)}-${suffix}`;
}

function onlineUserHasDefaultOeIcon() {
  const currentIcon = getStoredUserIconString();
  return typeof window.isAccountDefaultOeIcon === 'function'
    ? window.isAccountDefaultOeIcon(currentIcon)
    : currentIcon === '0000:0100:0200:0300';
}

function promptOnlineHostForCustomOeIcon() {
  if (
    !onlineUserHasDefaultOeIcon() ||
    typeof window.requestAccountOeCustomisation !== 'function'
  ) {
    return;
  }

  window
    .requestAccountOeCustomisation({
      requireNonDefault: true,
      closeOnSave: true,
      preventClose: true
    })
    .catch((error) => {
      console.warn('Failed to request OE customisation:', error);
    });
}

