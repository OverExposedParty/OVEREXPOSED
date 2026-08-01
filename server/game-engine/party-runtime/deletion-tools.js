const {
  ensurePartyOwnerIdentity
} = require('../../services/party-owner-identity');

function createPartyDeletionTools(context) {
  const {
    getCurrentAccount,
    Account,
    getPartyPlayerId,
    app,
    assertPartyId,
    debugLog,
    crypto
  } = context;

  async function getPartyRequestPrincipal(req, res) {
    const partyOwnerIdentity = ensurePartyOwnerIdentity(req, res, { crypto });
    const account = await getCurrentAccount(req, Account);
    if (account) {
      return {
        type: 'account',
        accountId: String(account._id),
        partyOwnerIdHash: partyOwnerIdentity.tokenHash
      };
    }

    return {
      type: 'guest',
      guestIdHash: partyOwnerIdentity.tokenHash,
      partyOwnerIdHash: partyOwnerIdentity.tokenHash
    };
  }

  function assertPrincipalOwnsPartyHost(party, principal) {
    const hostComputerId = party?.state?.hostComputerId;
    const host = party?.players?.find(
      (player) => String(getPartyPlayerId(player)) === String(hostComputerId)
    );
    const authorised =
      principal.type === 'account'
        ? String(host?.identity?.accountId || '') === principal.accountId
        : !host?.identity?.accountId &&
          host?.identity?.guestIdHash === principal.guestIdHash;

    if (!authorised) {
      const error = new Error('Only the party host can delete this party.');
      error.status = 403;
      error.code = 'party_host_forbidden';
      throw error;
    }
  }

  function createDeleteHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const partyCode = req.body?.partyCode ?? req.body?.partyId;
        assertPartyId(partyCode, req.body?.partyCode ? 'partyCode' : 'partyId');
        const principal = await getPartyRequestPrincipal(req, res);
        const party = await mainModel
          .findOne({ partyId: partyCode })
          .select('+players.identity.guestIdHash')
          .lean();

        if (!party) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        assertPrincipalOwnsPartyHost(party, principal);

        const deletedMain = await mainModel.findOneAndDelete({
          partyId: partyCode
        });
        await waitingRoomModel.findOneAndDelete({
          partyId: partyCode
        });

        if (!deletedMain) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        debugLog(`✅ ${logLabel} ${partyCode} deleted via beacon`);
        res.apiSuccess({
          message: `${logLabel} deleted successfully`,
          deleted: deletedMain
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error deleting ${logLabel.toLowerCase()} on unload:`,
          err
        );
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_delete_on_unload_failed',
          message: err.message || `Failed to delete ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  function createDeleteQueryHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.delete(route, async (req, res) => {
      try {
        const { partyCode } = req.query;
        assertPartyId(partyCode, 'partyCode');
        const principal = await getPartyRequestPrincipal(req, res);
        const party = await mainModel
          .findOne({ partyId: partyCode })
          .select('+players.identity.guestIdHash')
          .lean();

        if (!party) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        assertPrincipalOwnsPartyHost(party, principal);

        const deletedMain = await mainModel.findOneAndDelete({
          partyId: partyCode
        });
        await waitingRoomModel.findOneAndDelete({
          partyId: partyCode
        });

        if (!deletedMain) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        debugLog(`✅ ${logLabel} ${partyCode} deleted`);
        res.apiSuccess({
          message: `${logLabel} deleted successfully`,
          deleted: deletedMain
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error deleting ${logLabel.toLowerCase()}:`,
          err
        );
        res.apiError({
          status,
          code: typeof err.code === 'string' ? err.code : 'party_delete_failed',
          message: err.message || `Failed to delete ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  return {
    getPartyRequestPrincipal,
    assertPrincipalOwnsPartyHost,
    createDeleteHandler,
    createDeleteQueryHandler
  };
}

module.exports = { createPartyDeletionTools };
