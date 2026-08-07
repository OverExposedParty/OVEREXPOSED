const SEMANTIC_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
const VERSION_BUMP_TYPES = new Set(['major', 'minor', 'patch']);

function bumpSemanticVersion(version, bumpType) {
  const match = SEMANTIC_VERSION_PATTERN.exec(String(version || '').trim());
  if (!match || !VERSION_BUMP_TYPES.has(bumpType)) return null;

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (bumpType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpType === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

function registerOePanelGameModeRoutes(context) {
  const { app } = context;

  with (context) {
    app.patch(
      '/api/oe-panel/game-modes/:gameType/version',
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;
          if (!requireOePanelPermission(account, res, 'party_games.release')) {
            return;
          }

          const gameType = String(req.params.gameType || '')
            .trim()
            .toLowerCase();
          const bumpType = String(req.body?.bump || '')
            .trim()
            .toLowerCase();
          const expectedVersion = String(
            req.body?.expectedVersion || ''
          ).trim();
          const releaseNote = String(req.body?.releaseNote || '').trim();

          if (!gameType || !VERSION_BUMP_TYPES.has(bumpType)) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_game_mode_version_bump_invalid',
              message: 'A valid game mode and version bump type are required.'
            });
          }
          if (releaseNote.length < 3 || releaseNote.length > 500) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_game_mode_release_note_invalid',
              message:
                'Release notes must contain between 3 and 500 characters.'
            });
          }

          const currentGameMode = await GameMode.findOne({ gameType }).lean();
          if (!currentGameMode) {
            return res.apiError({
              status: 404,
              code: 'oe_panel_game_mode_not_found',
              message: 'Game mode not found.'
            });
          }

          const currentVersion = currentGameMode.version || '1.0.0';
          if (expectedVersion && expectedVersion !== currentVersion) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_game_mode_version_conflict',
              message: `This game mode is already on version ${currentVersion}. Refresh and try again.`
            });
          }
          const nextVersion = bumpSemanticVersion(currentVersion, bumpType);
          if (!nextVersion) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_game_mode_version_invalid',
              message:
                'The current game-mode version is not valid semantic versioning.'
            });
          }

          const releasedAt = new Date();
          const releasedBy = {
            accountId: account._id || null,
            usernameSnapshot:
              account.profile?.displayName || account.username || '-'
          };
          const versionFilter = currentGameMode.version
            ? { version: currentVersion }
            : {
                $or: [{ version: { $exists: false } }, { version: null }]
              };
          const updatedGameMode = await GameMode.findOneAndUpdate(
            { gameType, ...versionFilter },
            {
              $set: { version: nextVersion },
              $push: {
                releaseHistory: {
                  version: nextVersion,
                  releasedAt,
                  releaseNote,
                  releasedBy
                }
              }
            },
            { new: true, runValidators: true }
          ).lean();
          if (!updatedGameMode) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_game_mode_version_conflict',
              message:
                'The game-mode version changed while this release was being saved.'
            });
          }

          await createAdminLog(AdminLog, account, {
            action: `Released game mode ${nextVersion}`,
            area: 'Party Games',
            target: {
              type: 'game_mode_release',
              id: gameType,
              label: updatedGameMode.name || formatPartyGameLabel(gameType)
            },
            previousValue: { version: currentVersion },
            newValue: { version: nextVersion, releaseNote },
            severity: bumpType === 'major' ? 'high' : 'medium',
            metadata: {
              gamemode: gameType,
              bumpType,
              releaseNote,
              exportNeeded: true
            }
          });

          res.apiSuccess({
            data: {
              message: `${updatedGameMode.name || formatPartyGameLabel(gameType)} released as v${nextVersion}.`,
              row: {
                gamemode:
                  updatedGameMode.name || formatPartyGameLabel(gameType),
                gamemodeKey: gameType,
                configuredVersion: `v${nextVersion}`,
                configuredVersionRaw: nextVersion,
                latestReleaseNote: releaseNote
              }
            }
          });
        } catch (err) {
          console.error(
            `[REQ ${req.id}] Failed to release game mode version:`,
            err
          );
          res.apiError({
            status: 500,
            code: 'oe_panel_game_mode_version_update_failed',
            message: 'Failed to update the game-mode version.'
          });
        }
      }
    );

    app.post('/api/oe-panel/game-modes/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.export')) {
          return;
        }

        const exported = await exportGameModesToJson(GameMode);
        await createAdminLog(AdminLog, account, {
          action: 'Exported game modes',
          area: 'Party Games',
          target: {
            type: 'game_mode_export',
            id: 'game-modes',
            label: 'Game modes JSON export'
          },
          previousValue: 'Database content',
          newValue: `Exported ${exported.length} game modes`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} game modes to JSON.`
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to export game modes:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_mode_export_failed',
          message: 'Failed to export game modes'
        });
      }
    });
  }
}

module.exports = { bumpSemanticVersion, registerOePanelGameModeRoutes };
