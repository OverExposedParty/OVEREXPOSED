(() => {
  const partyData = window.PartyApiPartyData;
  const actions = window.PartyApiActions;
  const players = window.PartyApiPlayers;
  const accountLink = window.PartyApiAccountLink;

  if (!partyData || !actions || !players || !accountLink) {
    throw new Error('Party API support modules must load before party-api.js');
  }

  Object.assign(window, {
    normaliseOnlinePartyId: partyData.normaliseOnlinePartyId,
    requireOnlinePartyId: partyData.requireOnlinePartyId,
    getExistingPartyData: partyData.getExistingPartyData,
    GetCurrentPartyData: partyData.GetCurrentPartyData,
    reserveUniquePartyCode: partyData.reserveUniquePartyCode,
    getPartyChatLog: partyData.getPartyChatLog,
    normaliseOnlinePartyActionPayload: actions.normaliseOnlinePartyActionPayload,
    syncOnlinePartyInstructionsAfterAction:
      actions.syncOnlinePartyInstructionsAfterAction,
    performOnlinePartyAction: actions.performOnlinePartyAction,
    EndOnlineGame: actions.EndOnlineGame,
    ReplayOnlinePartyGame: actions.ReplayOnlinePartyGame,
    ReturnOnlinePartyToLobby: actions.ReturnOnlinePartyToLobby,
    updateOnlineParty: players.updateOnlineParty,
    addUserToParty: players.addUserToParty,
    UpdateUserReady: players.UpdateUserReady,
    UpdateUserPartyData: players.UpdateUserPartyData,
    removeUserFromParty: players.removeUserFromParty,
    checkAndDeleteEmptyParty: players.checkAndDeleteEmptyParty,
    DeleteParty: players.DeleteParty,
    startOnlinePartyGame: players.startOnlinePartyGame,
    userPingToParty: players.userPingToParty,
    GetAllUsersReady: players.GetAllUsersReady,
    getAllDeviceIDs: players.getAllDeviceIDs,
    linkCurrentPartyPlayerToAccount:
      accountLink.linkCurrentPartyPlayerToAccount,
    continueCurrentPartyPlayerAsGuest:
      accountLink.continueCurrentPartyPlayerAsGuest
  });

  accountLink.bindPartyAccountLinkListener();
})();
