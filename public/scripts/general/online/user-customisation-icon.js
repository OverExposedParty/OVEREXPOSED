window.closeOnlineUserActionMenus = closeOnlineUserActionMenus;
window.syncOnlineUserActionMenu = syncOnlineUserActionMenu;
window.canOpenOnlineUserActionMenu = canOpenOnlineUserActionMenu;

syncExistingLobbyPlayerActionMenus();

document.addEventListener('click', (event) => {
  if (!event.target.closest('.user-icon')) {
    closeOnlineUserActionMenus();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeOnlineUserActionMenus();
    closeOnlinePublicProfilePanel();
  }
});

(async () => {
  try {
    await loadActivePacks('/api/oe-library');
    await loadPublishedOeDisplayIndex('/api/oe-image-display-index');
    SetScriptLoaded('/scripts/general/online/user-customisation-icon.js');
    Ready.set('user-customisation-icon', true);
  } catch (err) {
    console.error('❌ Error loading user-customisation-icon scripts:', err);
  }
})();
