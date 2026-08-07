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

