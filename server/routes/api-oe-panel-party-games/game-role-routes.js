const { assertValidRoleCatalog } = require('../../services/game-roles');
const {
  getMafiaRoleBehaviour
} = require('../../game-engine/party-runtime/mafia-role-behaviours');

function applyRoleUpdate(role, update) {
  const candidate = {
    ...role,
    selection: { ...(role.selection || {}) },
    assets: { ...(role.assets || {}) }
  };

  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith('selection.')) {
      candidate.selection[key.slice('selection.'.length)] = value;
    } else if (key.startsWith('assets.')) {
      candidate.assets[key.slice('assets.'.length)] = value;
    } else {
      candidate[key] = value;
    }
  }

  return candidate;
}

function validateRoleUpdateCatalog(roles, currentRole, update) {
  const updatedRole = applyRoleUpdate(currentRole, update);
  const candidates = roles.map((role) =>
    role.key === currentRole.key ? updatedRole : role
  );

  assertValidRoleCatalog(candidates, currentRole.gameType);

  if (
    updatedRole.enabled &&
    updatedRole.status === 'published' &&
    currentRole.gameType === 'mafia' &&
    !getMafiaRoleBehaviour(updatedRole.key)
  ) {
    throw new Error(
      `Role "${updatedRole.key}" needs a registered behavior before it can be published.`
    );
  }

  const hasFillRole = candidates.some(
    (role) =>
      role.enabled &&
      role.status === 'published' &&
      role.selection?.fillRemaining
  );
  if (currentRole.gameType === 'mafia' && !hasFillRole) {
    throw new Error('Mafia must retain one published fill-remaining role.');
  }
}

function registerOePanelGameRoleRoutes(context) {
  const { app } = context;

  with (context) {
    app.patch('/api/oe-panel/game-roles/:roleKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const parsedKey = parseCompositePartyContentKey(req.params.roleKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_role_key_required',
            message: 'Role key is required'
          });
        }

        const roles = await GameRole.find({
          gameType: parsedKey.gameType
        }).lean();
        const currentRole = roles.find(
          (role) => role.key === parsedKey.itemKey
        );
        if (!currentRole) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_role_not_found',
            message: 'Game role not found'
          });
        }
        const { update, error } = createGameRoleUpdatePayload(
          req.body || {},
          currentRole
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_role_update_invalid',
            message: error
          });
        }

        try {
          validateRoleUpdateCatalog(roles, currentRole, update);
        } catch (validationError) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_role_update_invalid',
            message: validationError.message
          });
        }

        const updatedRole = await GameRole.findOneAndUpdate(
          { gameType: parsedKey.gameType, key: parsedKey.itemKey },
          { $set: update },
          { new: true, runValidators: true }
        ).lean();

        await createGamemodeSettingsAlert(account, {
          action: getGamemodeSettingsAlertAction(req.body || {}),
          itemType: 'role',
          itemKey: `${updatedRole.gameType}:${updatedRole.key}`,
          title: updatedRole.title || formatPartyGameLabel(updatedRole.key),
          gamemode: updatedRole.gameType,
          changes: Object.keys(req.body || {})
        });
        await createAdminLog(AdminLog, account, {
          action: 'Edited game role',
          area: 'Party Games',
          target: {
            type: 'game_role',
            id: `${updatedRole.gameType}:${updatedRole.key}`,
            label: updatedRole.title || formatPartyGameLabel(updatedRole.key)
          },
          previousValue: {
            title: currentRole.title,
            description: currentRole.description,
            faction: currentRole.faction,
            status: currentRole.status,
            enabled: currentRole.enabled,
            selection: currentRole.selection
          },
          newValue: update,
          severity: 'medium',
          metadata: {
            collection: 'game-roles',
            gamemode: updatedRole.gameType,
            changedFields: Object.keys(update)
          }
        });

        res.apiSuccess({
          data: { row: serializePartyRoleForPanel(updatedRole) }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update game role:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_role_update_failed',
          message: 'Failed to update game role'
        });
      }
    });

    app.delete('/api/oe-panel/game-roles/:roleKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.delete')) {
          return;
        }

        const parsedKey = parseCompositePartyContentKey(req.params.roleKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_role_key_required',
            message: 'Role key is required'
          });
        }

        const currentRole = await GameRole.findOne({
          gameType: parsedKey.gameType,
          key: parsedKey.itemKey
        }).lean();
        if (!currentRole) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_role_not_found',
            message: 'Game role not found'
          });
        }

        if (
          currentRole.enabled &&
          currentRole.status === 'published' &&
          currentRole.selection?.fillRemaining
        ) {
          return res.apiError({
            status: 409,
            code: 'oe_panel_game_role_fill_required',
            message:
              'A published fill-remaining role cannot be deleted. Replace or archive it safely first.'
          });
        }

        const deletedRole = await GameRole.findOneAndDelete({
          gameType: parsedKey.gameType,
          key: parsedKey.itemKey
        });

        await createGamemodeSettingsAlert(account, {
          action: 'deleted',
          itemType: 'role',
          itemKey: `${deletedRole.gameType}:${deletedRole.key}`,
          title: deletedRole.title || formatPartyGameLabel(deletedRole.key),
          gamemode: deletedRole.gameType,
          severity: 'warning'
        });
        await createAdminLog(AdminLog, account, {
          action: 'Deleted game role',
          area: 'Party Games',
          target: {
            type: 'game_role',
            id: `${deletedRole.gameType}:${deletedRole.key}`,
            label: deletedRole.title || formatPartyGameLabel(deletedRole.key)
          },
          previousValue: {
            title: deletedRole.title,
            description: deletedRole.description,
            faction: deletedRole.faction,
            status: deletedRole.status,
            enabled: deletedRole.enabled,
            selection: deletedRole.selection
          },
          newValue: 'Deleted',
          severity: 'high',
          metadata: {
            collection: 'game-roles',
            gamemode: deletedRole.gameType
          }
        });

        res.apiSuccess({ message: 'Game role deleted' });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to delete game role:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_role_delete_failed',
          message: 'Failed to delete game role'
        });
      }
    });

    app.post('/api/oe-panel/game-roles/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.export')) {
          return;
        }

        const exported = await exportGameRolesToJson(GameRole);
        await GamemodeSettingsAlert.updateMany(
          getGamemodeSettingsAlertQuery('export-needed'),
          {
            $set: {
              exportNeeded: false,
              resolvedAt: new Date()
            }
          }
        )
          .where('itemType')
          .equals('role');
        await createAdminLog(AdminLog, account, {
          action: 'Exported game roles',
          area: 'Party Games',
          target: {
            type: 'game_role_export',
            id: 'game-roles',
            label: 'Game roles JSON export'
          },
          previousValue: 'Export needed alerts unresolved',
          newValue: `Exported ${exported.length} game roles`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} game roles to JSON.`
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to export game roles:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_role_export_failed',
          message: 'Failed to export game roles'
        });
      }
    });
  }
}

module.exports = {
  applyRoleUpdate,
  registerOePanelGameRoleRoutes,
  validateRoleUpdateCatalog
};
