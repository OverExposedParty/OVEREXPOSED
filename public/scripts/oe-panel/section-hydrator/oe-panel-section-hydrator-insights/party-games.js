(function () {
  function createOePanelPartyGamesInsightsHydrator({ panelData }) {
    async function hydrateSection(sectionName, nextConfig) {
      if (sectionName === 'Party Games') {
        const partyRoomsData = await panelData.fetchPartyRoomsData();
        const dashboardActivity = await panelData.fetchDashboardActivityData();
        const roomRows = Array.isArray(partyRoomsData.rooms)
          ? partyRoomsData.rooms
          : [];
        const partyPacks = Array.isArray(partyRoomsData.packs)
          ? partyRoomsData.packs
          : [];
        const partyRules = Array.isArray(partyRoomsData.rules)
          ? partyRoomsData.rules
          : [];
        const packsByKey = new Map();
        partyPacks.forEach((pack) => {
          [pack.slug, pack.packKey, pack.key, pack.title].forEach((key) => {
            const normalizedKey = String(key || '')
              .trim()
              .toLowerCase();
            if (normalizedKey && normalizedKey !== '-') {
              packsByKey.set(normalizedKey, pack);
            }
          });
        });
        const rulesByKey = new Map();
        partyRules.forEach((rule) => {
          [rule.key, rule.ruleKey, rule.rule].forEach((key) => {
            const normalizedKey = String(key || '')
              .trim()
              .toLowerCase();
            if (normalizedKey && normalizedKey !== '-') {
              rulesByKey.set(normalizedKey, rule);
            }
          });
        });
        const rooms = roomRows.map((room) => {
          const selectedPacks = Array.isArray(room.roomVisual?.selectedPacks)
            ? room.roomVisual.selectedPacks
            : [];
          const gameRules = room.roomVisual?.gameRules || {};
          return {
            ...room,
            roomVisual: {
              ...(room.roomVisual || {}),
              selectedPackDetails: selectedPacks.map((packKey) => {
                const pack = packsByKey.get(
                  String(packKey || '')
                    .trim()
                    .toLowerCase()
                );
                return {
                  key: packKey,
                  title: pack?.title || packKey,
                  difficulty: pack?.difficulty || '',
                  restriction: pack?.restriction || '',
                  colour: pack?.details?.colour || '',
                  secondaryColour: pack?.details?.secondaryColour || ''
                };
              }),
              gameRuleDetails: Object.keys(gameRules).map((ruleKey) => {
                const normalizedRuleKey = String(ruleKey).toLowerCase();
                const compositeKey = `${String(room.gamemode || '').toLowerCase()}:${normalizedRuleKey}`;
                const rule =
                  rulesByKey.get(compositeKey) ||
                  rulesByKey.get(normalizedRuleKey);
                return {
                  key: ruleKey,
                  title: rule?.rule || ruleKey,
                  buttonType: rule?.buttonType || '',
                  colour: rule?.colour || '',
                  secondaryColour: rule?.secondaryColour || ''
                };
              })
            }
          };
        });
        const partyRoles = Array.isArray(partyRoomsData.roles)
          ? partyRoomsData.roles
          : [];
        const partyGamemodes = Array.isArray(partyRoomsData.gamemodes)
          ? partyRoomsData.gamemodes
          : [];
        const roomIssues = Array.isArray(partyRoomsData.roomIssues)
          ? partyRoomsData.roomIssues
          : [];
        const gamemodeSettingsAlerts = Array.isArray(
          partyRoomsData.gamemodeSettingsAlerts
        )
          ? partyRoomsData.gamemodeSettingsAlerts
          : [];
        const gamemodeExportAlerts = Array.isArray(
          partyRoomsData.gamemodeExportAlerts
        )
          ? partyRoomsData.gamemodeExportAlerts
          : [];
        const stats = partyRoomsData.stats || {};
        const partyGamesRowsBySource = {
          partyRooms: rooms,
          partyPacks,
          partyRules,
          partyRoles,
          partyGamemodes
        };
        window.OE_PANEL_PALETTES?.indexRows('pack', partyPacks, {
          keyField: 'title'
        });
        window.OE_PANEL_PALETTES?.indexRows('rule', partyRules, {
          keyField: 'rule'
        });
        window.OE_PANEL_PALETTES?.indexRows('role', partyRoles, {
          keyField: 'role'
        });

        nextConfig.forEach((gridConfig) => {
          if (Array.isArray(gridConfig.actions)) {
            gridConfig.actions = gridConfig.actions.map((actionConfig) => {
              if (actionConfig.widget?.dataSource !== 'partyRoomActivity') {
                return actionConfig;
              }

              return {
                ...actionConfig,
                widget: {
                  ...actionConfig.widget,
                  counts: dashboardActivity.partyRooms || {}
                }
              };
            });
          }

          if (Array.isArray(gridConfig.tableSeries)) {
            gridConfig.tableSeries = gridConfig.tableSeries.map(
              (seriesConfig) => {
                if (!seriesConfig.dataSource) return seriesConfig;

                return {
                  ...seriesConfig,
                  rows: partyGamesRowsBySource[seriesConfig.dataSource] || []
                };
              }
            );
            return;
          }

          if (gridConfig.dataSource === 'partyRooms') {
            gridConfig.rows = rooms;
            return;
          }

          if (gridConfig.id === 'party-games-grid-4') {
            gridConfig.alerts = roomIssues;
            gridConfig.gamemodeSettingsAlerts = gamemodeSettingsAlerts;
            gridConfig.gamemodeExportAlerts = gamemodeExportAlerts;
            gridConfig.alertCounts = {
              roomIssues: roomIssues.length,
              gamemodeSettingsAlerts: gamemodeSettingsAlerts.length,
              gamemodeExportAlerts: gamemodeExportAlerts.length
            };
            gridConfig.visibleAlerts = 8;
            return;
          }

          if (
            gridConfig.id === 'party-games-grid-2' &&
            Array.isArray(gridConfig.stats)
          ) {
            gridConfig.stats = gridConfig.stats.map((stat) => {
              if (stat.label === 'Active Rooms') {
                return { ...stat, value: String(stats.activeRoomCount ?? 0) };
              }
              if (stat.label === 'Players Online') {
                return { ...stat, value: String(stats.activePlayerCount ?? 0) };
              }
              if (stat.label === 'Most Popular') {
                return {
                  ...stat,
                  value: stats.mostPopularGamemode || '-',
                  detail: `${stats.mostPopularGamemodeRooms ?? 0} rooms in 30d`,
                  expanded: {
                    type: 'table',
                    title: 'Most Popular Gamemode',
                    columns: [
                      { key: 'label', label: 'Metric' },
                      { key: 'value', label: 'Value' }
                    ],
                    rows: [
                      {
                        label: 'Gamemode',
                        value: stats.mostPopularGamemode || '-'
                      },
                      {
                        label: 'Archived rooms in 30d',
                        value: String(stats.mostPopularGamemodeRooms ?? 0)
                      },
                      {
                        label: 'All archived rooms in 30d',
                        value: String(stats.archivedRoomsLast30Days ?? 0)
                      }
                    ]
                  }
                };
              }
              if (stat.label === 'Room Error Rate') {
                return {
                  ...stat,
                  value: `${stats.roomErrorRate ?? 0}%`,
                  detail: 'archived rooms, 30d',
                  expanded: {
                    type: 'table',
                    title: 'Room Data Quality',
                    columns: [
                      { key: 'label', label: 'Metric' },
                      { key: 'value', label: 'Value' }
                    ],
                    rows: [
                      {
                        label: 'Rooms with errors',
                        value: `${stats.roomErrorRate ?? 0}%`
                      },
                      {
                        label: 'Outcome data coverage',
                        value: `${stats.outcomeCoverage ?? 0}%`
                      },
                      {
                        label: 'Archived rooms in 30d',
                        value: String(stats.archivedRoomsLast30Days ?? 0)
                      }
                    ]
                  }
                };
              }
              return stat;
            });
          }
        });
        return true;
      }

      return false;
    }

    return { hydrateSection };
  }

  window.createOePanelPartyGamesInsightsHydrator =
    createOePanelPartyGamesInsightsHydrator;
})();
