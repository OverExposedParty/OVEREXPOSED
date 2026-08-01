const { getContentSyncHealth } = require('../../services/content-sync-health');
const { isRetiredRule } = require('../../services/game-rules');
const { createPartyGameSyncAlerts } = require('./sync-alerts');
const {
  registerGamemodeDistributionRoute
} = require('./gamemode-distribution');

function registerOePanelPartyRoomRoutes(context) {
  const { app, partyOwnerLeases = {} } = context;

  with (context) {
    registerGamemodeDistributionRoute(context);

    app.get('/api/oe-panel/party-rooms', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const activeRoomGroups = await Promise.all(
          getPartyGameRoomSources().map(async ([sourceCollection, model]) => {
            const rooms = await model
              .find({})
              .sort({ 'state.lastPinged': -1, 'session.createdAt': -1 })
              .limit(50)
              .lean();

            return rooms.map((room) => ({
              room,
              sourceCollection,
              row: serializeActiveRoom(room, sourceCollection)
            }));
          })
        );

        const activeRoomRecords = activeRoomGroups
          .flat()
          .sort((a, b) => {
            const left = a.row.details?.['Created At'] || '';
            const right = b.row.details?.['Created At'] || '';
            return String(right).localeCompare(String(left));
          })
          .slice(0, 100);
        const activeRooms = activeRoomRecords.map(({ row }) => row);

        const archivedRoomRecords = (
          await archivedRoomSchema
            .find({})
            .sort({ archivedAt: -1 })
            .limit(100)
            .lean()
        ).map((room) => ({
          room,
          sourceCollection: room.sourceCollection || 'archived-rooms',
          row: serializeArchivedRoom(room)
        }));
        const archivedRooms = archivedRoomRecords.map(({ row }) => row);
        const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const gamemodeAggregationRows = await archivedRoomSchema.aggregate([
          { $match: { archivedAt: { $gte: last30Days } } },
          {
            $group: {
              _id: { $ifNull: ['$gamemode', 'unknown'] },
              rooms: { $sum: 1 },
              averagePlayers: {
                $avg: { $size: { $ifNull: ['$players', []] } }
              },
              roomsWithErrors: {
                $sum: {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$errors', []] } }, 0] },
                    1,
                    0
                  ]
                }
              },
              outcomeRecorded: {
                $sum: {
                  $cond: [
                    {
                      $ne: [
                        { $ifNull: ['$state.outcome', '$state.result'] },
                        null
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              latestArchivedAt: { $max: '$archivedAt' }
            }
          },
          { $sort: { rooms: -1, _id: 1 } }
        ]);
        const archivedRoomsLast30Days = gamemodeAggregationRows.reduce(
          (total, row) => total + Number(row.rooms || 0),
          0
        );
        const activeRoomsByGamemode = activeRooms.reduce((counts, room) => {
          const key = String(room.gamemode || 'unknown');
          counts[key] = Number(counts[key] || 0) + 1;
          return counts;
        }, {});
        const gamemodes = gamemodeAggregationRows.map((row) => {
          const roomCount = Number(row.rooms || 0);
          return {
            gamemode: formatPartyGameLabel(row._id),
            gamemodeKey: row._id,
            rooms: String(roomCount),
            share: archivedRoomsLast30Days
              ? `${Math.round((roomCount / archivedRoomsLast30Days) * 100)}%`
              : '0%',
            activeRooms: String(activeRoomsByGamemode[row._id] || 0),
            averagePlayers: Number(row.averagePlayers || 0).toFixed(1),
            errorRate: roomCount
              ? `${Math.round((Number(row.roomsWithErrors || 0) / roomCount) * 100)}%`
              : '0%',
            outcomeCoverage: roomCount
              ? `${Math.round((Number(row.outcomeRecorded || 0) / roomCount) * 100)}%`
              : '0%',
            latestArchived: formatOePanelDateTime(row.latestArchivedAt)
          };
        });
        Object.entries(activeRoomsByGamemode).forEach(([gamemode, count]) => {
          if (gamemodes.some((row) => row.gamemodeKey === gamemode)) return;
          gamemodes.push({
            gamemode: formatPartyGameLabel(gamemode),
            gamemodeKey: gamemode,
            rooms: '0',
            share: '0%',
            activeRooms: String(count),
            averagePlayers: '-',
            errorRate: '-',
            outcomeCoverage: '-',
            latestArchived: '-'
          });
        });
        const archivedRoomsWithErrors = gamemodeAggregationRows.reduce(
          (total, row) => total + Number(row.roomsWithErrors || 0),
          0
        );
        const outcomesRecorded = gamemodeAggregationRows.reduce(
          (total, row) => total + Number(row.outcomeRecorded || 0),
          0
        );
        const partyPacks = (
          await GamePack.find({}).sort({ gameType: 1, slug: 1 }).lean()
        ).map(serializePartyPackForPanel);
        const partyRules = (
          await GameRule.find({}).sort({ gameType: 1, key: 1 }).lean()
        )
          .filter((rule) => !isRetiredRule(rule))
          .map(serializePartyRuleForPanel);
        const partyRoles = (
          await GameRole.find({})
            .sort({ gameType: 1, sortOrder: 1, key: 1 })
            .lean()
        ).map(serializePartyRoleForPanel);
        const gamemodeSettingsAlerts = (
          await GamemodeSettingsAlert.find(getGamemodeSettingsAlertQuery('all'))
            .sort({ 'system.createdAt': -1 })
            .limit(50)
            .lean()
        ).map(serializeGamemodeSettingsAlert);
        const gamemodeExportAlerts = (
          await GamemodeSettingsAlert.find(
            getGamemodeSettingsAlertQuery('export-needed')
          )
            .sort({ 'system.createdAt': -1 })
            .limit(50)
            .lean()
        ).map(serializeGamemodeSettingsAlert);
        const contentSync = await getContentSyncHealth(context.models || {});
        const partyGameSyncAlerts = createPartyGameSyncAlerts(contentSync);
        const roomIssues = [...activeRooms, ...archivedRooms]
          .flatMap((room) =>
            (Array.isArray(room.errors) ? room.errors : []).map((error) =>
              createRoomIssueAlert(room, error, room.roomStatus)
            )
          )
          .sort((a, b) => {
            const left = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
            const right = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
            return right - left;
          })
          .slice(0, 25);

        res.apiSuccess({
          data: {
            activeRooms,
            archivedRooms,
            rooms: [...activeRooms, ...archivedRooms],
            packs: partyPacks,
            rules: partyRules,
            roles: partyRoles,
            gamemodes,
            gamemodeSettingsAlerts: [
              ...partyGameSyncAlerts,
              ...gamemodeSettingsAlerts
            ],
            gamemodeExportAlerts: [
              ...partyGameSyncAlerts,
              ...gamemodeExportAlerts
            ],
            roomIssues,
            stats: {
              activeRoomCount: activeRooms.length,
              archivedRoomCount: archivedRooms.length,
              archivedRoomsLast30Days,
              mostPopularGamemode: gamemodes[0]?.gamemode || '-',
              mostPopularGamemodeRooms: gamemodes[0]?.rooms || '0',
              roomErrorRate: archivedRoomsLast30Days
                ? Math.round(
                    (archivedRoomsWithErrors / archivedRoomsLast30Days) * 100
                  )
                : 0,
              outcomeCoverage: archivedRoomsLast30Days
                ? Math.round((outcomesRecorded / archivedRoomsLast30Days) * 100)
                : 0,
              activePlayerCount: activeRooms.reduce((total, room) => {
                const count = Number.parseInt(room.playerCount, 10);
                return total + (Number.isFinite(count) ? count : 0);
              }, 0)
            }
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch OE Panel rooms:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_party_rooms_fetch_failed',
          message: 'Failed to fetch party rooms'
        });
      }
    });

    app.delete('/api/oe-panel/party-rooms/:partyCode', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_rooms.delete')) {
          return;
        }

        const partyCode = String(req.params.partyCode || '').trim();
        const sourceCollection = String(
          req.query.sourceCollection || ''
        ).trim();
        if (!partyCode || partyCode === '-') {
          return res.apiError({
            status: 400,
            code: 'oe_panel_party_room_code_required',
            message: 'Room code is required'
          });
        }

        let deletedRoom = null;
        let leaseReleaseToken = null;
        if (sourceCollection === 'archived-rooms') {
          deletedRoom = await archivedRoomSchema.findOneAndDelete({
            partyId: partyCode
          });
        } else {
          const roomSource = getPartyGameRoomSources().find(
            ([collectionName]) => collectionName === sourceCollection
          );

          if (!roomSource) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_party_room_source_invalid',
              message: 'Room source is invalid'
            });
          }

          const [, model] = roomSource;
          if (
            typeof partyOwnerLeases?.getActivePartyOwnerLeaseReleaseToken ===
            'function'
          ) {
            leaseReleaseToken =
              await partyOwnerLeases.getActivePartyOwnerLeaseReleaseToken(
                partyCode
              );
          }
          deletedRoom = await model.findOneAndDelete({ partyId: partyCode });
          await waitingRoomSchema.findOneAndDelete({ partyId: partyCode });
        }

        if (!deletedRoom) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_party_room_not_found',
            message: 'Party room not found'
          });
        }

        if (
          sourceCollection !== 'archived-rooms' &&
          leaseReleaseToken &&
          typeof partyOwnerLeases?.releaseActivePartyOwnerLeaseIfInactive ===
            'function'
        ) {
          try {
            await partyOwnerLeases.releaseActivePartyOwnerLeaseIfInactive({
              partyId: partyCode,
              releaseToken: leaseReleaseToken
            });
          } catch (error) {
            console.warn(
              `Failed to release the owner lease for deleted party ${partyCode}:`,
              error.message || error
            );
          }
        }

        await createAdminLog(AdminLog, account, {
          action: 'Deleted party room',
          area: 'Party Rooms',
          target: {
            type: 'party_room',
            id: partyCode,
            label: partyCode
          },
          previousValue: {
            partyId: deletedRoom.partyId,
            gamemode: deletedRoom.gameType || deletedRoom.gamemode,
            sourceCollection
          },
          newValue: 'Deleted',
          severity: 'high',
          metadata: {
            sourceCollection,
            waitingRoomDeleted: sourceCollection !== 'archived-rooms'
          }
        });

        res.apiSuccess({ message: 'Party room deleted' });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to delete OE Panel room:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_party_room_delete_failed',
          message: 'Failed to delete party room'
        });
      }
    });
  }
}

module.exports = { registerOePanelPartyRoomRoutes };
