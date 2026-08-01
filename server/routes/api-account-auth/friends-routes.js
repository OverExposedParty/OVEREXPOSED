const {
  parseFriendNotificationAccountIds
} = require('./friend-notification-support');

function registerAccountFriendsRoutes(context) {
  const {
    app,
    getCurrentAccount,
    populateFriendRelationships,
    validateStoredInviteSession,
    clearSessionInvite,
    defaultOeIcon,
    findFriendRelationship,
    Account,
    setFriendRelationship,
    incrementAchievementStat,
    Achievement,
    getAcceptedFriendCount,
    unlockAchievementByKey,
    removeFriendRelationship,
    serializeAccount,
    queueAccountNotification,
    getAccountNotifications,
    importLegacyNotifications,
    markNotificationsDelivered,
    serializePendingNotifications
  } = context;

  app.get('/api/accounts/friends/notifications', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) return res.apiSuccess({ notifications: [] });

      await populateFriendRelationships(account);
      const imported = importLegacyNotifications(account);
      const notifications = serializePendingNotifications(account, {
        categories: ['social'],
        deliveries: ['toast', 'both'],
        limit: 5
      });
      let changed = imported > 0;
      for (let index = notifications.length - 1; index >= 0; index -= 1) {
        const notification = notifications[index];
        if (notification.type !== 'session_invite') continue;

        const relationship = findFriendRelationship(
          account,
          notification.accountId || notification.actorAccountId
        );
        const session = relationship
          ? await validateStoredInviteSession(relationship)
          : null;
        if (!session) {
          const stored = getAccountNotifications(account).find(
            (entry) => String(entry.notificationId) === String(notification.id)
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
          lobbyPath: session.lobbyPath,
          sessionType: session.type,
          sessionKey: session.key,
          primaryColour: session.primaryColour || null,
          secondaryColour: session.secondaryColour || null
        });
      }

      if (changed) {
        account.markModified('gameData.friendsAndBlockedUsers');
        await account.save();
      }

      res.apiSuccess({
        notifications: notifications.map((notification) => ({
          ...notification,
          accountId:
            notification.accountId || notification.actorAccountId || null,
          username:
            notification.username || notification.actorUsername || 'Player',
          oeIcon:
            notification.oeIcon || notification.actorOeIcon || defaultOeIcon
        }))
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch friend notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'friend_notifications_fetch_failed',
        message: 'Failed to fetch friend notifications'
      });
    }
  });

  app.patch('/api/accounts/friends/notifications', async (req, res) => {
    const accountIds = parseFriendNotificationAccountIds(req.body?.accountIds);

    if (!accountIds.length) {
      return res.apiError({
        status: 400,
        code: 'friend_notifications_invalid',
        message: 'No friend notifications were provided'
      });
    }

    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'friend_notifications_auth_required',
          message: 'Sign in to update friend notifications'
        });
      }

      await populateFriendRelationships(account);
      importLegacyNotifications(account);
      const notificationIds = serializePendingNotifications(account, {
        categories: ['social'],
        deliveries: ['toast', 'both'],
        limit: 50
      })
        .filter(
          (notification) =>
            notification.type !== 'session_invite' &&
            accountIds.includes(
              String(
                notification.accountId || notification.actorAccountId || ''
              )
            )
        )
        .map((notification) => notification.id);
      const updated = markNotificationsDelivered(account, notificationIds);
      if (updated || account.isModified?.()) await account.save();

      res.apiSuccess({ updated });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to acknowledge friend notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'friend_notifications_update_failed',
        message: 'Failed to update friend notifications'
      });
    }
  });

  app.patch(
    '/api/accounts/friends/notifications/:accountId',
    async (req, res) => {
      const inviterId = String(req.params.accountId || '').trim();
      const action = String(req.body?.action || '')
        .trim()
        .toLowerCase();
      if (
        !/^[a-f0-9]{24}$/i.test(inviterId) ||
        !['accept', 'decline'].includes(action)
      ) {
        return res.apiError({
          status: 400,
          code: 'friend_invite_action_invalid',
          message: 'That invite action is invalid'
        });
      }

      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'friend_invite_action_auth_required',
            message: 'Sign in to respond to the invite'
          });
        }

        const relationship = findFriendRelationship(account, inviterId);
        if (
          relationship?.status !== 'friends' ||
          relationship.notificationType !== 'session_invite'
        ) {
          return res.apiError({
            status: 404,
            code: 'friend_invite_missing',
            message: 'That invite is no longer available'
          });
        }

        const session =
          action === 'accept'
            ? await validateStoredInviteSession(relationship)
            : null;
        clearSessionInvite(relationship);
        const inviteNotificationIds = serializePendingNotifications(account, {
          deliveries: ['toast', 'both'],
          types: ['session_invite'],
          limit: 50
        })
          .filter(
            (notification) =>
              String(
                notification.accountId || notification.actorAccountId || ''
              ) === inviterId
          )
          .map((notification) => notification.id);
        markNotificationsDelivered(account, inviteNotificationIds);
        account.markModified('gameData.friendsAndBlockedUsers');
        await account.save();

        if (action === 'accept' && !session) {
          return res.apiError({
            status: 409,
            code: 'friend_invite_expired',
            message: 'That lobby is no longer available'
          });
        }

        const inviterAccount = await Account.findById(inviterId);
        const inviterRelationship = inviterAccount
          ? findFriendRelationship(inviterAccount, account._id)
          : null;
        if (inviterAccount && inviterRelationship?.status === 'friends') {
          queueAccountNotification(inviterAccount, {
            type:
              action === 'accept'
                ? 'session_invite_accepted'
                : 'session_invite_declined',
            actorAccountId: account._id,
            actorUsername: account.username,
            actorOeIcon: account.profile?.oeIcon || defaultOeIcon,
            metadata: {
              accountId: String(account._id),
              username: account.username || 'Player',
              oeIcon: account.profile?.oeIcon || defaultOeIcon,
              sessionType: session?.type || null,
              sessionKey: session?.key || null,
              sessionCode: session?.code || null,
              modeName: session?.modeName || null
            }
          });
          await inviterAccount.save();
        }

        res.apiSuccess({
          message: action === 'accept' ? 'Invite accepted' : 'Invite declined',
          lobbyPath: session?.lobbyPath || null
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to respond to friend invite:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'friend_invite_action_failed',
          message: 'Failed to respond to the invite'
        });
      }
    }
  );

  app.get('/api/accounts/friends/search', async (req, res) => {
    const username = String(req.query?.username || '').trim();
    if (!username) {
      return res.apiError({
        status: 400,
        code: 'friend_search_username_required',
        message: 'Enter a username'
      });
    }

    try {
      const viewerAccount = await getCurrentAccount(req);
      if (!viewerAccount) {
        return res.apiError({
          status: 401,
          code: 'friend_search_auth_required',
          message: 'Sign in to search for players'
        });
      }

      const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const targetAccount = await Account.findOne({
        _id: { $ne: viewerAccount._id },
        username: { $regex: `^${escapedUsername}$`, $options: 'i' },
        'profile.accountStatus': { $nin: ['suspended', 'banned', 'deleted'] }
      }).select(
        'username profile.displayName profile.oeIcon profile.privacySettings'
      );

      if (!targetAccount) {
        return res.apiError({
          status: 404,
          code: 'friend_search_not_found',
          message: 'No player found with that username'
        });
      }

      const relationship = findFriendRelationship(
        viewerAccount,
        targetAccount._id
      );
      res.apiSuccess({
        player: {
          accountId: targetAccount._id.toString(),
          username: targetAccount.username,
          displayName:
            targetAccount.profile?.displayName || targetAccount.username,
          oeIcon: targetAccount.profile?.oeIcon || defaultOeIcon,
          status: relationship?.status || 'not_friends',
          allowFriendRequests:
            targetAccount.profile?.privacySettings?.allowFriendRequests !==
            false
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to search for friend:`, err);
      res.apiError({
        status: 500,
        code: 'friend_search_failed',
        message: 'Failed to search for that player'
      });
    }
  });

  app.patch('/api/accounts/friends/:accountId', async (req, res) => {
    const targetId = String(req.params.accountId || '').trim();
    const action = String(req.body?.action || '')
      .trim()
      .toLowerCase();
    const allowedActions = new Set([
      'send',
      'accept',
      'decline',
      'cancel',
      'remove',
      'block',
      'unblock'
    ]);

    if (!/^[a-f0-9]{24}$/i.test(targetId) || !allowedActions.has(action)) {
      return res.apiError({
        status: 400,
        code: 'friend_action_invalid',
        message: 'That friend action is invalid'
      });
    }

    try {
      const viewerAccount = await getCurrentAccount(req);
      if (!viewerAccount) {
        return res.apiError({
          status: 401,
          code: 'friend_action_auth_required',
          message: 'Sign in to manage friends'
        });
      }
      if (String(viewerAccount._id) === targetId) {
        return res.apiError({
          status: 400,
          code: 'friend_action_self',
          message: 'You cannot add yourself'
        });
      }

      const targetAccount = await Account.findOne({
        _id: targetId,
        'profile.accountStatus': { $nin: ['suspended', 'banned', 'deleted'] }
      });
      if (!targetAccount) {
        return res.apiError({
          status: 404,
          code: 'friend_action_target_not_found',
          message: 'That player is unavailable'
        });
      }

      const viewerRelationship = findFriendRelationship(
        viewerAccount,
        targetAccount._id
      );
      const targetRelationship = findFriendRelationship(
        targetAccount,
        viewerAccount._id
      );

      if (action === 'send') {
        if (viewerRelationship || targetRelationship) {
          return res.apiError({
            status: 409,
            code: 'friend_request_conflict',
            message: 'A relationship with that player already exists'
          });
        }
        if (
          targetAccount.profile?.privacySettings?.allowFriendRequests === false
        ) {
          return res.apiError({
            status: 403,
            code: 'friend_requests_disabled',
            message: 'That player is not accepting friend requests'
          });
        }
        setFriendRelationship(viewerAccount, targetAccount._id, 'pending_sent');
        setFriendRelationship(
          targetAccount,
          viewerAccount._id,
          'pending_received',
          { notificationDeliveredAt: new Date() }
        );
        queueAccountNotification(targetAccount, {
          type: 'friend_request',
          actorAccountId: viewerAccount._id,
          actorUsername: viewerAccount.username,
          actorOeIcon: viewerAccount.profile?.oeIcon || defaultOeIcon,
          metadata: {
            accountId: String(viewerAccount._id),
            username: viewerAccount.username || 'Player',
            oeIcon: viewerAccount.profile?.oeIcon || defaultOeIcon
          }
        });
      } else if (action === 'accept') {
        if (
          viewerRelationship?.status !== 'pending_received' ||
          targetRelationship?.status !== 'pending_sent'
        ) {
          return res.apiError({
            status: 409,
            code: 'friend_request_missing',
            message: 'That friend request is no longer available'
          });
        }
        setFriendRelationship(viewerAccount, targetAccount._id, 'friends');
        setFriendRelationship(targetAccount, viewerAccount._id, 'friends');
        queueAccountNotification(targetAccount, {
          type: 'friend_accepted',
          actorAccountId: viewerAccount._id,
          actorUsername: viewerAccount.username,
          actorOeIcon: viewerAccount.profile?.oeIcon || defaultOeIcon,
          metadata: {
            accountId: String(viewerAccount._id),
            username: viewerAccount.username || 'Player',
            oeIcon: viewerAccount.profile?.oeIcon || defaultOeIcon
          }
        });
        await Promise.all([
          incrementAchievementStat({
            Achievement,
            account: viewerAccount,
            statKey: 'friendsAdded',
            amount: Math.max(
              1,
              getAcceptedFriendCount(viewerAccount) -
                (Number(
                  viewerAccount.gameData?.achievementStats?.friendsAdded
                ) || 0)
            ),
            source: 'friend-accepted',
            save: false
          }),
          incrementAchievementStat({
            Achievement,
            account: targetAccount,
            statKey: 'friendsAdded',
            amount: Math.max(
              1,
              getAcceptedFriendCount(targetAccount) -
                (Number(
                  targetAccount.gameData?.achievementStats?.friendsAdded
                ) || 0)
            ),
            source: 'friend-accepted',
            save: false
          }),
          unlockAchievementByKey({
            Achievement,
            account: viewerAccount,
            key: 'first-friend',
            source: 'friend-accepted',
            save: false
          }),
          unlockAchievementByKey({
            Achievement,
            account: targetAccount,
            key: 'first-friend',
            source: 'friend-accepted',
            save: false
          })
        ]);
      } else if (action === 'block') {
        setFriendRelationship(viewerAccount, targetAccount._id, 'blocked');
        removeFriendRelationship(targetAccount, viewerAccount._id);
      } else if (action === 'unblock') {
        if (viewerRelationship?.status !== 'blocked') {
          return res.apiError({
            status: 409,
            code: 'friend_block_missing',
            message: 'That player is not blocked'
          });
        }
        removeFriendRelationship(viewerAccount, targetAccount._id);
      } else {
        const requiredStatuses = {
          decline: ['pending_received', 'pending_sent'],
          cancel: ['pending_sent', 'pending_received'],
          remove: ['friends', 'friends']
        };
        const [viewerStatus, targetStatus] = requiredStatuses[action];
        if (
          viewerRelationship?.status !== viewerStatus ||
          targetRelationship?.status !== targetStatus
        ) {
          return res.apiError({
            status: 409,
            code: 'friend_relationship_changed',
            message: 'That relationship is no longer available'
          });
        }
        removeFriendRelationship(viewerAccount, targetAccount._id);
        removeFriendRelationship(targetAccount, viewerAccount._id);
      }

      await Promise.all([viewerAccount.save(), targetAccount.save()]);
      await populateFriendRelationships(viewerAccount);
      res.apiSuccess({
        message: 'Friends updated',
        account: serializeAccount(viewerAccount)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to update friends:`, err);
      res.apiError({
        status: 500,
        code: 'friend_action_failed',
        message: 'Failed to update friends'
      });
    }
  });
}

module.exports = { registerAccountFriendsRoutes };
