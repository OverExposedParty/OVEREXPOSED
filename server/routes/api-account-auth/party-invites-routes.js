function registerAccountPartyInvitesRoutes(context) {
  const {
    app,
    getCurrentAccount,
    getAccountInviteSession,
    getGuestInviteSession,
    decorateInviteSession,
    defaultOeIcon,
    Account,
    findFriendRelationship,
    getAccountNotifications,
    queueAccountNotification,
    importLegacyNotifications,
    markNotificationsDelivered,
    serializePendingNotifications
  } = context;

  app.get('/api/accounts/friends/invite-session', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      const rawSession = account
        ? await getAccountInviteSession(account._id, {
            includeInProgress:
              req.query?.includeInProgress === 'true' ||
              req.query?.includeInProgress === '1'
          })
        : await getGuestInviteSession(req, {
            includeInProgress:
              req.query?.includeInProgress === 'true' ||
              req.query?.includeInProgress === '1'
          });
      const session = decorateInviteSession(rawSession);
      res.apiSuccess({ active: Boolean(session), session });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch invite session:`, err);
      res.apiError({
        status: 500,
        code: 'friend_invite_session_fetch_failed',
        message: 'Failed to check your online session'
      });
    }
  });

  app.get('/api/accounts/friends/active-party-lobby', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      const rawSession = account
        ? await getAccountInviteSession(account._id, {
            includeBattle: false,
            includeInProgress: true
          })
        : await getGuestInviteSession(req, {
            includeInProgress: true
          });
      const session = decorateInviteSession(rawSession);
      res.apiSuccess({ active: Boolean(session), session });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch active party lobby:`, err);
      res.apiError({
        status: 500,
        code: 'active_party_lobby_fetch_failed',
        message: 'Failed to check your active party lobby'
      });
    }
  });

  app.get('/api/accounts/party-notifications', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) return res.apiSuccess({ notifications: [] });

      const imported = importLegacyNotifications(account);
      if (imported) await account.save();
      const notifications = serializePendingNotifications(account, {
        categories: ['party'],
        deliveries: ['toast', 'both'],
        limit: 8
      }).map((notification) => ({
        ...notification,
        actorUsername: notification.actorUsername || 'Player',
        actorOeIcon: notification.actorOeIcon || defaultOeIcon
      }));

      res.apiSuccess({ notifications });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch party notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'party_notifications_fetch_failed',
        message: 'Failed to fetch party notifications'
      });
    }
  });

  app.patch('/api/accounts/party-notifications', async (req, res) => {
    const notificationIds = Array.isArray(req.body?.notificationIds)
      ? [
          ...new Set(
            req.body.notificationIds.map((value) => String(value || ''))
          )
        ]
          .filter((value) => /^[a-f0-9:-]{10,80}$/i.test(value))
          .slice(0, 20)
      : [];

    if (!notificationIds.length) {
      return res.apiError({
        status: 400,
        code: 'party_notifications_invalid',
        message: 'No party notifications were provided'
      });
    }

    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'party_notifications_auth_required',
          message: 'Sign in to update party notifications'
        });
      }

      importLegacyNotifications(account);
      const updated = markNotificationsDelivered(account, notificationIds);
      if (updated || account.isModified?.()) await account.save();

      res.apiSuccess({ updated });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to acknowledge party notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'party_notifications_update_failed',
        message: 'Failed to update party notifications'
      });
    }
  });

  app.post('/api/accounts/friends/:accountId/invite', async (req, res) => {
    const targetId = String(req.params.accountId || '').trim();
    if (!/^[a-f0-9]{24}$/i.test(targetId)) {
      return res.apiError({
        status: 400,
        code: 'friend_invite_target_invalid',
        message: 'That friend is invalid'
      });
    }

    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'friend_invite_auth_required',
          message: 'Sign in to invite a friend'
        });
      }

      const targetAccount = await Account.findById(targetId);
      const viewerRelationship = findFriendRelationship(account, targetId);
      const targetRelationship = targetAccount
        ? findFriendRelationship(targetAccount, account._id)
        : null;
      if (
        !targetAccount ||
        viewerRelationship?.status !== 'friends' ||
        targetRelationship?.status !== 'friends'
      ) {
        return res.apiError({
          status: 409,
          code: 'friend_invite_relationship_required',
          message: 'You can only invite a current friend'
        });
      }

      const session = decorateInviteSession(
        await getAccountInviteSession(account._id)
      );
      if (!session) {
        return res.apiError({
          status: 409,
          code: 'friend_invite_session_required',
          message: 'Join an online party or Oling battle first'
        });
      }

      targetRelationship.notificationType = 'session_invite';
      targetRelationship.notificationLobbyPath = session.lobbyPath;
      targetRelationship.notificationSessionType = session.type;
      targetRelationship.notificationSessionKey = session.key;
      targetRelationship.notificationSessionCode = session.code;
      targetRelationship.notificationDeliveredAt = new Date();
      const replacedAt = new Date();
      getAccountNotifications(targetAccount).forEach((notification) => {
        if (
          notification.type !== 'session_invite' ||
          notification.deliveredAt ||
          notification.dismissedAt ||
          String(notification.actorAccountId || '') !== String(account._id)
        ) {
          return;
        }
        notification.dismissedAt = replacedAt;
        notification.deliveredAt = replacedAt;
      });
      queueAccountNotification(targetAccount, {
        type: 'session_invite',
        actorAccountId: account._id,
        actorUsername: account.username,
        actorOeIcon: account.profile?.oeIcon || defaultOeIcon,
        action: {
          type: 'respond_session_invite',
          path: session.lobbyPath
        },
        metadata: {
          accountId: String(account._id),
          username: account.username || 'Player',
          oeIcon: account.profile?.oeIcon || defaultOeIcon,
          lobbyPath: session.lobbyPath,
          sessionType: session.type,
          sessionKey: session.key,
          sessionCode: session.code,
          primaryColour: session.primaryColour || null,
          secondaryColour: session.secondaryColour || null
        }
      });
      targetAccount.markModified('gameData.friendsAndBlockedUsers');
      await targetAccount.save();

      res.apiSuccess({ message: 'Invite sent', session });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to send friend invite:`, err);
      res.apiError({
        status: 500,
        code: 'friend_invite_failed',
        message: 'Failed to send the invite'
      });
    }
  });
}

module.exports = { registerAccountPartyInvitesRoutes };
