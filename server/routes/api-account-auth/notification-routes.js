const {
  runWithFreshDocumentRetry
} = require('../../services/mongoose-version-retry');

function parseNotificationIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || '').trim()))]
    .filter((value) => /^[a-z0-9_:-]{8,160}$/i.test(value))
    .slice(0, 50);
}

function parseNotificationAction(value) {
  return value === 'read' ? 'read' : 'delivered';
}

function registerAccountNotificationRoutes(context) {
  const {
    Account,
    app,
    clearSessionInvite,
    decorateInviteSession,
    defaultOeIcon,
    findFriendRelationship,
    getAccountInviteSession,
    getAccountNotifications,
    getCurrentAccount,
    countUnreadNotifications,
    populateFriendRelationships,
    importLegacyNotifications,
    persistNotificationsDeliveredAtomically,
    persistNotificationsReadAtomically,
    serializeInboxNotifications,
    serializePendingNotifications,
    syncFriendActivityNotifications,
    validateStoredInviteSession
  } = context;

  app.get('/api/accounts/notifications', async (req, res) => {
    try {
      const result = await runWithFreshDocumentRetry({
        loadDocument: () => getCurrentAccount(req),
        run: async (account) => {
          if (!account) {
            return {
              notifications: [],
              inboxNotifications: [],
              unreadCount: 0
            };
          }

          await populateFriendRelationships(account);
          const imported = importLegacyNotifications(account);
          const activity = await syncFriendActivityNotifications({
            account,
            getAccountInviteSession,
            decorateInviteSession,
            defaultOeIcon
          });
          const notifications = serializePendingNotifications(account, {
            deliveries: ['toast', 'both'],
            limit: 30
          });
          let changed = imported > 0 || activity.changed;
          for (let index = notifications.length - 1; index >= 0; index -= 1) {
            const notification = notifications[index];
            if (notification.type !== 'session_invite') continue;

            const actorId =
              notification.accountId || notification.actorAccountId || '';
            const relationship = findFriendRelationship(account, actorId);
            const session = relationship
              ? await validateStoredInviteSession(relationship)
              : null;
            if (!session) {
              const stored = getAccountNotifications(account).find(
                (entry) =>
                  String(entry.notificationId) === String(notification.id)
              );
              if (stored) {
                stored.dismissedAt = new Date();
                stored.deliveredAt ||= stored.dismissedAt;
                account.markModified('gameData.notifications');
              }
              if (relationship) clearSessionInvite(relationship);
              notifications.splice(index, 1);
              changed = true;
              continue;
            }
            Object.assign(notification, {
              accountId: String(actorId),
              username:
                notification.username || notification.actorUsername || 'Player',
              oeIcon: notification.oeIcon || notification.actorOeIcon || null,
              lobbyPath: session.lobbyPath,
              sessionType: session.type,
              sessionKey: session.key,
              primaryColour: session.primaryColour || null,
              secondaryColour: session.secondaryColour || null
            });
          }
          if (changed) await account.save();

          return {
            notifications,
            inboxNotifications: serializeInboxNotifications(account, {
              limit: 50
            }),
            unreadCount: countUnreadNotifications(account)
          };
        }
      });

      res.apiSuccess(result);
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch notifications:`, err);
      res.apiError({
        status: 500,
        code: 'notifications_fetch_failed',
        message: 'Failed to fetch notifications'
      });
    }
  });

  app.patch('/api/accounts/notifications', async (req, res) => {
    const notificationIds = parseNotificationIds(req.body?.notificationIds);
    const action = parseNotificationAction(req.body?.action);
    if (!notificationIds.length) {
      return res.apiError({
        status: 400,
        code: 'notifications_invalid',
        message: 'No notifications were provided'
      });
    }

    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'notifications_auth_required',
          message: 'Sign in to update notifications'
        });
      }
      const updated =
        action === 'read'
          ? await persistNotificationsReadAtomically({
              Account,
              account,
              notificationIds
            })
          : await persistNotificationsDeliveredAtomically({
              Account,
              account,
              notificationIds
            });
      const refreshedAccount = await getCurrentAccount(req);
      res.apiSuccess({
        updated,
        unreadCount: countUnreadNotifications(refreshedAccount || account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to update notifications:`, err);
      res.apiError({
        status: 500,
        code: 'notifications_update_failed',
        message: 'Failed to update notifications'
      });
    }
  });
}

module.exports = {
  parseNotificationAction,
  parseNotificationIds,
  registerAccountNotificationRoutes
};
