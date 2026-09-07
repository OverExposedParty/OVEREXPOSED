const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const runIntegration = process.env.RUN_MONGO_INTEGRATION_TESTS === '1';
const integrationTest = runIntegration ? test : test.skip;

integrationTest(
  'party lifecycle binds signed-in and guest players securely',
  async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    const models = require('../../server/models');

    try {
      await Promise.all(
        [
          models.accountsConnection,
          models.partyGamesConnection,
          models.socialConnection
        ].map((connection) => connection.openUri(mongo.getUri()))
      );

      const account = await models.Account.create({
        username: 'lifecycle-host',
        email: 'lifecycle-host@example.test',
        passwordHash: 'test-password-hash',
        profile: { emailVerified: true, accountStatus: 'active' },
        admin: { roles: ['owner'] },
        access: { roles: ['beta_tester'] }
      });

      assert.ok(account._id);
      const sessionToken = 'lifecycle-session-token';
      account.security.sessions.push({
        tokenHash: crypto
          .createHash('sha256')
          .update(sessionToken)
          .digest('hex'),
        expiresAt: new Date(Date.now() + 60_000)
      });
      await account.save();

      const { createAppServer } = require('../../server/app');
      const { server } = createAppServer();
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const hostCookie = `oe_session=${sessionToken}`;
      const request = (path, body, cookie) =>
        fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(cookie ? { cookie } : {})
          },
          body: JSON.stringify(body)
        });
      const get = (path, cookie) =>
        fetch(`${baseUrl}${path}`, {
          headers: cookie ? { cookie } : {}
        });

      try {
        const partyId = 'ABC-123';
        const createResponse = await request(
          '/api/party-game-would-you-rather',
          {
            partyId,
            session: { gameId: 'lifecycle-game' },
            config: {
              gamemode: 'would-you-rather',
              gameRules: {},
              selectedPacks: [],
              shuffleSeed: 1
            },
            state: {
              isPlaying: false,
              playerTurn: 0,
              playerTurnOrder: ['host-device'],
              hostComputerId: 'host-device'
            },
            deck: {},
            players: [
              {
                identity: {
                  computerId: 'host-device',
                  accountId: '000000000000000000000000',
                  username: 'Host',
                  userIcon: 'host-icon'
                },
                connection: {},
                state: {}
              }
            ]
          },
          hostCookie
        );
        assert.equal(createResponse.status, 200, await createResponse.text());

        const guestJoin = await request(
          `/api/party-game-would-you-rather/join-user?partyCode=${partyId}`,
          {
            partyId,
            newComputerId: 'guest-device',
            newUsername: 'Guest',
            newUserIcon: 'guest-icon'
          }
        );
        assert.equal(guestJoin.status, 200);

        const spoofJoin = await request(
          `/api/party-game-would-you-rather/join-user?partyCode=${partyId}`,
          {
            partyId,
            newComputerId: 'spoof-device',
            newUserAccountId: String(account._id),
            newUsername: 'Spoof',
            newUserIcon: 'spoof-icon'
          }
        );
        assert.equal(spoofJoin.status, 200);

        const party = await models.partyGameWouldYouRatherSchema
          .findOne({ partyId })
          .lean();
        const host = party.players.find(
          (player) => player.identity.computerId === 'host-device'
        );
        const guest = party.players.find(
          (player) => player.identity.computerId === 'guest-device'
        );
        const spoof = party.players.find(
          (player) => player.identity.computerId === 'spoof-device'
        );
        assert.equal(String(host.identity.accountId), String(account._id));
        assert.equal(guest.identity.accountId, null);
        assert.equal(spoof.identity.accountId, null);

        const disbandResponse = await request(
          '/api/party-game-would-you-rather/delete',
          { partyCode: partyId },
          hostCookie
        );
        assert.equal(disbandResponse.status, 200);

        const panelResponse = await get(
          '/api/oe-panel/party-rooms',
          hostCookie
        );
        assert.equal(panelResponse.status, 200);
        const panelPayload = await panelResponse.json();
        assert.ok(panelPayload.data.stats.archivedRoomsLast24Hours >= 1);
        assert.ok(panelPayload.data.stats.currentBuildArchivedRooms >= 1);
        assert.equal(panelPayload.data.stats.roomErrorRateLast24Hours, 0);
        assert.equal(panelPayload.data.stats.currentBuildRoomErrorRate, 0);

        const truthPartyId = 'TOD-123';
        const truthCreate = await request(
          '/api/party-game-truth-or-dare',
          {
            partyId: truthPartyId,
            session: { gameId: 'truth-lifecycle-game' },
            config: {
              gamemode: 'truth-or-dare',
              gameRules: { 'prompt-heist': true },
              selectedPacks: [],
              shuffleSeed: 1
            },
            state: {
              isPlaying: false,
              playerTurn: 0,
              playerTurnOrder: ['host-device'],
              hostComputerId: 'host-device'
            },
            deck: { questionType: 'truth' },
            players: [
              {
                identity: {
                  computerId: 'host-device',
                  username: 'Host',
                  userIcon: 'host-icon'
                },
                connection: {},
                state: {}
              }
            ]
          },
          hostCookie
        );
        assert.equal(truthCreate.status, 200);

        const truthGuestJoin = await request(
          '/api/party-game-truth-or-dare/join-user',
          {
            partyId: truthPartyId,
            newComputerId: 'truth-guest',
            newUsername: 'Truth Guest',
            newUserIcon: 'guest-icon'
          }
        );
        assert.equal(truthGuestJoin.status, 200);
        const guestCookie = truthGuestJoin.headers
          .get('set-cookie')
          .split(';')[0];

        const guestSelectTruth = await request(
          '/api/party-game-truth-or-dare/action',
          {
            partyId: truthPartyId,
            actorId: 'truth-guest',
            action: 'truth-or-dare-select-question-type',
            payload: { questionType: 'truth', eventId: 'tod-guest-select-1' }
          },
          guestCookie
        );
        assert.equal(guestSelectTruth.status, 403);

        const selectTruth = await request(
          '/api/party-game-truth-or-dare/action',
          {
            partyId: truthPartyId,
            actorId: 'host-device',
            action: 'truth-or-dare-select-question-type',
            payload: { questionType: 'truth', eventId: 'tod-select-1' }
          },
          hostCookie
        );
        assert.equal(selectTruth.status, 200);

        const passTruth = await request(
          '/api/party-game-truth-or-dare/action',
          {
            partyId: truthPartyId,
            actorId: 'host-device',
            action: 'truth-or-dare-pass-question',
            payload: { eventId: 'tod-pass-1' }
          },
          hostCookie
        );
        assert.equal(passTruth.status, 200);

        const hostClaimHeist = await request(
          '/api/party-game-truth-or-dare/action',
          {
            partyId: truthPartyId,
            actorId: 'host-device',
            action: 'truth-or-dare-claim-prompt-heist',
            payload: { eventId: 'tod-host-heist-1' }
          },
          hostCookie
        );
        assert.equal(hostClaimHeist.status, 403);

        const claimHeist = await request(
          '/api/party-game-truth-or-dare/action',
          {
            partyId: truthPartyId,
            actorId: 'truth-guest',
            action: 'truth-or-dare-claim-prompt-heist',
            payload: { eventId: 'tod-heist-1' }
          },
          guestCookie
        );
        assert.equal(claimHeist.status, 200);

        const expectedErrorReport = await request(
          `/api/party-game-truth-or-dare/error?partyCode=${truthPartyId}`,
          {
            partyId: truthPartyId,
            actorId: 'truth-guest',
            error: {
              name: 'Error',
              message: 'Only the host can perform this action.',
              code: 'party_host_required',
              status: 403
            }
          },
          guestCookie
        );
        assert.equal(expectedErrorReport.status, 200);

        const duplicateCrashReports = await Promise.all(
          Array.from({ length: 20 }, () =>
            request(
              `/api/party-game-truth-or-dare/error?partyCode=${truthPartyId}`,
              {
                partyId: truthPartyId,
                actorId: 'truth-guest',
                error: {
                  name: 'TypeError',
                  message: 'Lifecycle render crashed',
                  code: 'party_render_failed',
                  status: 500
                }
              },
              guestCookie
            )
          )
        );
        duplicateCrashReports.forEach((response) => {
          assert.equal(response.status, 200);
        });

        const truthParty = await models.partyGameTruthOrDareSchema
          .findOne({ partyId: truthPartyId })
          .lean();
        assert.equal(truthParty.deck.currentCardIndex, 1);
        assert.equal(truthParty.state.phaseData.promptHeist, true);
        assert.equal(
          truthParty.state.phaseData.claimedByPlayerId,
          'truth-guest'
        );
        assert.equal(truthParty.errors.length, 1);
        assert.equal(truthParty.errors[0].source, 'client');
        assert.equal(truthParty.errors[0].message, 'Lifecycle render crashed');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    } finally {
      await Promise.all([
        models.accountsConnection.close(),
        models.partyGamesConnection.close(),
        models.socialConnection.close()
      ]);
      await mongo.stop();
    }
  }
);
