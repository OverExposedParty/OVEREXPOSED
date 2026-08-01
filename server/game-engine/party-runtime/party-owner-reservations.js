const { reserveUniquePartyCode } = require('../../services/page-assets');

function createPartyOwnerReservationTools(context) {
  const {
    waitingRoomSchema,
    getPartyRequestPrincipal,
    assertNoActiveParticipantParty,
    acquireActivePartyOwnerLease
  } = context;

  async function reservePartyCodeForRequest(req, res) {
    const principal = await getPartyRequestPrincipal(req, res);
    if (typeof assertNoActiveParticipantParty === 'function') {
      await assertNoActiveParticipantParty(principal);
    }
    const partyCode = await reserveUniquePartyCode(waitingRoomSchema);

    try {
      await acquireActivePartyOwnerLease({
        partyId: partyCode,
        principal
      });
      return partyCode;
    } catch (error) {
      try {
        await waitingRoomSchema.deleteOne({ partyId: partyCode });
      } catch (cleanupError) {
        console.error(
          `Failed to clean up reserved party shell ${partyCode}:`,
          cleanupError
        );
      }
      throw error;
    }
  }

  return {
    reservePartyCodeForRequest
  };
}

module.exports = {
  createPartyOwnerReservationTools
};
