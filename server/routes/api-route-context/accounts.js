const {
  getPartyOwnerIdHashFromRequest
} = require('../../services/party-owner-identity');

const ACTIVE_PARTY_CONFLICT_CODE = 'party_owner_active_party_exists';
const PARTY_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
const PARTY_GAMEMODES = new Set([
  'truth-or-dare',
  'paranoia',
  'never-have-i-ever',
  'most-likely-to',
  'imposter',
  'would-you-rather',
  'mafia'
]);

function createActivePartyConflict(partyId, gamemode) {
  const partyCode = String(partyId || '')
    .trim()
    .toUpperCase();
  if (!PARTY_CODE_PATTERN.test(partyCode)) return null;
  const gamemodeKey = String(gamemode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  return {
    code: ACTIVE_PARTY_CONFLICT_CODE,
    partyCode,
    lobbyPath: `/${partyCode}`,
    ...(PARTY_GAMEMODES.has(gamemodeKey) ? { gamemode: gamemodeKey } : {})
  };
}

function createAccountContext(context) {
  const {
    crypto,
    getCookieValue,
    canAccessFeature,
    getPublicSiteUrl,
    serializeOpalTransactions,
    serializeOpalWallet,
    OE_PANEL_ROLES,
    formatReportLabel,
    Account,
    waitingRoomSchema,
    defaultOeIcon,
    normalizeCustomisationPreferences,
    hashSessionToken,
    getPartyGameRoomSources,
    partyOwnerLeases
  } = context;

  function getPartyGuestHashFromRequest(req) {
    return getPartyOwnerIdHashFromRequest(req, { crypto, getCookieValue });
  }

  async function upgradeGuestPartyIdentityForAccount(req, account) {
    const guestIdHash = getPartyGuestHashFromRequest(req);
    if (!guestIdHash || !account?._id) return;

    const accountId = account._id;
    const username = account.username;
    const userIcon = account.profile?.oeIcon || defaultOeIcon;
    const leaseLinkResult =
      await partyOwnerLeases?.attachAccountToPartyOwnerLease?.({
        partyOwnerIdHash: guestIdHash,
        accountId
      });

    if (leaseLinkResult?.conflict) {
      const activePartyConflict = createActivePartyConflict(
        leaseLinkResult.partyId,
        leaseLinkResult.gamemode
      );
      console.warn(
        `[REQ ${req.id}] Account ${accountId} already has a different active party owner lease.`
      );
      return {
        upgraded: false,
        conflict: true,
        partyId: activePartyConflict?.partyCode || null,
        activePartyConflict
      };
    }

    const roomSources = [
      ['waiting-room', waitingRoomSchema],
      ...getPartyGameRoomSources()
    ].filter(([, model]) => model?.updateMany);

    const set = {
      'players.$[player].identity.accountId': accountId,
      'players.$[player].identity.partyOwnerIdHash': guestIdHash
    };

    if (username) {
      set['players.$[player].identity.username'] = username;
    }

    if (userIcon) {
      set['players.$[player].identity.userIcon'] = userIcon;
    }

    const update = {
      $set: set,
      $unset: {
        'players.$[player].identity.guestIdHash': ''
      }
    };
    const options = {
      arrayFilters: [
        {
          'player.identity.accountId': null,
          'player.identity.guestIdHash': guestIdHash
        }
      ],
      runValidators: false
    };

    const results = await Promise.all(
      roomSources.map(async ([label, model]) => {
        const result = await model.updateMany(
          { 'players.identity.guestIdHash': guestIdHash },
          update,
          options
        );

        return {
          label,
          modifiedCount: result.modifiedCount || 0
        };
      })
    );

    const modifiedCount = results.reduce(
      (total, result) => total + result.modifiedCount,
      0
    );

    if (modifiedCount > 0) {
      console.log(
        `[REQ ${req.id}] Upgraded ${modifiedCount} party player binding(s) from guest to account ${accountId}.`
      );
    }

    return { upgraded: modifiedCount > 0, modifiedCount, conflict: false };
  }

  function validateAccountInput({
    username,
    email,
    password,
    confirmPassword,
    termsAccepted,
    privacyPolicyAccepted
  }) {
    const errors = {};

    if (!username) {
      errors.username = 'Username is required';
    } else if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      errors.username =
        'Username must be 3-30 characters and only use lowercase letters, numbers, dots, underscores, or hyphens';
    }

    if (!email) {
      errors.email = 'Email is required';
    } else if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errors.email = 'Email must be valid';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8 || password.length > 128) {
      errors.password = 'Password must be 8-128 characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm password is required';
    } else if (password && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (!termsAccepted || !privacyPolicyAccepted) {
      errors.legalConsent = 'Terms and privacy policy acceptance is required';
    }

    return errors;
  }

  function serializeAccount(account, { olingState = null } = {}) {
    const adminRoles = [
      ...(Array.isArray(account.admin?.roles) ? account.admin.roles : []),
      account.admin?.role
    ]
      .filter(Boolean)
      .map((role) => String(role).toLowerCase());
    const loginProviders = Array.isArray(account.profile?.loginProviders)
      ? account.profile.loginProviders
          .map((provider) => provider.name)
          .filter(Boolean)
      : [];
    const postsShared = Array.isArray(account.overexposure?.postsCreated)
      ? account.overexposure.postsCreated.filter(
          (postSummary) => !postSummary.status?.deletedAt
        ).length
      : 0;
    const canAccessOePanel =
      !account.admin?.disabled &&
      Boolean(account.profile?.emailVerified) &&
      adminRoles.some((role) => OE_PANEL_ROLES.has(role));
    const permissions = Array.isArray(account.admin?.permissionSet)
      ? account.admin.permissionSet.map((permission) =>
          String(permission || '').toLowerCase()
        )
      : [];
    const permissionsExpireAt = account.admin?.permissionsExpireAt
      ? new Date(account.admin.permissionsExpireAt).getTime()
      : null;
    const permissionsExpired =
      permissionsExpireAt !== null &&
      (!Number.isFinite(permissionsExpireAt) ||
        permissionsExpireAt <= Date.now());
    const canAccessConsole =
      canAccessOePanel &&
      (adminRoles.some((role) => ['owner', 'admin'].includes(role)) ||
        (!permissionsExpired && permissions.includes('console.access')));
    const isAdmin = canAccessOePanel;
    const friendRelationships = Array.isArray(
      account.gameData?.friendsAndBlockedUsers
    )
      ? account.gameData.friendsAndBlockedUsers
      : [];
    const orderHistory = Array.isArray(account.shop?.orderHistory)
      ? account.shop.orderHistory
      : [];
    const inGamePurchasesAndUnlocks = Array.isArray(
      account.gameData?.inGamePurchasesAndUnlocks
    )
      ? account.gameData.inGamePurchasesAndUnlocks
      : [];
    const customisationPreferences = normalizeCustomisationPreferences(
      account.customisationPreferences || {}
    );
    const accessRoles = Array.isArray(account.access?.roles)
      ? account.access.roles
          .map((role) => String(role || '').toLowerCase())
          .filter(Boolean)
      : [];
    const accessFeatures = Array.isArray(account.access?.features)
      ? account.access.features
          .map((feature) => String(feature || '').toLowerCase())
          .filter(Boolean)
      : [];
    const opalTransactions = serializeOpalTransactions(account);
    const opals = serializeOpalWallet(account);
    const accountOlings = account.olings || {};
    const olingInventory = olingState?.inventory || {
      eggs: Array.isArray(accountOlings.eggs) ? accountOlings.eggs : [],
      consumables: Array.isArray(accountOlings.consumables)
        ? accountOlings.consumables
        : [],
      furniture: Array.isArray(accountOlings.furniture)
        ? accountOlings.furniture
        : [],
      pets: Array.isArray(accountOlings.olings) ? accountOlings.olings : [],
      hatchHistory: Array.isArray(accountOlings.hatchHistory)
        ? accountOlings.hatchHistory
        : []
    };

    const serializeRelationship = (relationship) => {
      const relatedAccount = relationship.accountId;
      const isPopulated =
        relatedAccount &&
        typeof relatedAccount === 'object' &&
        !Array.isArray(relatedAccount);

      return {
        accountId: isPopulated
          ? relatedAccount._id?.toString()
          : relationship.accountId?.toString?.() ||
            String(relationship.accountId || ''),
        username: isPopulated ? relatedAccount.username : null,
        oeIcon: isPopulated
          ? relatedAccount.profile?.oeIcon || defaultOeIcon
          : defaultOeIcon,
        lastActiveAt: isPopulated
          ? relatedAccount.analytics?.lastSeenAt ||
            relatedAccount.profile?.lastLoginAt ||
            null
          : null,
        status: relationship.status,
        reason: relationship.reason || null,
        createdAt: relationship.createdAt
      };
    };

    return {
      id: account._id.toString(),
      username: account.username,
      email: account.email,
      emailVerified: Boolean(account.profile?.emailVerified),
      accountStatus: account.profile?.accountStatus || 'active',
      accountStatusLabel: formatReportLabel(
        account.profile?.accountStatus || 'active'
      ),
      privacySettings: {
        profileVisibility:
          account.profile?.privacySettings?.profileVisibility || 'public',
        showGameStats:
          account.profile?.privacySettings?.showGameStats !== false,
        showOnlineStatus:
          account.profile?.privacySettings?.showOnlineStatus !== false,
        allowFriendRequests:
          account.profile?.privacySettings?.allowFriendRequests !== false
      },
      legal: {
        termsAcceptedVersion:
          account.legalConsent?.termsAcceptedVersion || null,
        privacyPolicyAcceptedVersion:
          account.legalConsent?.privacyPolicyAcceptedVersion || null,
        latestDataExportRequest:
          account.legalConsent?.dataExportRequests?.at?.(-1) || null,
        latestAccountDeletionRequest:
          account.legalConsent?.accountDeletionRequests?.at?.(-1) || null
      },
      loginProviders: [
        ...new Set(loginProviders.length ? loginProviders : ['email'])
      ],
      oeIcon: account.profile?.oeIcon || defaultOeIcon,
      sitePreferences: {
        soundEnabled: account.profile?.sitePreferences?.soundEnabled !== false,
        nsfwEnabled: account.profile?.sitePreferences?.nsfwEnabled === true,
        consoleEnabled:
          account.profile?.sitePreferences?.consoleEnabled === true
      },
      customisationPreferences,
      canAccessOePanel,
      canAccessConsole,
      isAdmin,
      admin: {
        isAdmin,
        roles: isAdmin
          ? adminRoles.filter((role) => OE_PANEL_ROLES.has(role))
          : []
      },
      access: {
        disabled: Boolean(account.access?.disabled),
        roles: account.access?.disabled ? [] : accessRoles,
        features: account.access?.disabled ? [] : accessFeatures
      },
      stats: {
        postsShared,
        gamesPlayed: account.gameData?.gamesPlayed || 0
      },
      gameData: {
        gamesPlayed: account.gameData?.gamesPlayed || 0,
        roundsPlayed: account.gameData?.roundsPlayed || 0,
        totalPlaytimeSeconds: account.gameData?.totalPlaytimeSeconds || 0,
        level: account.gameData?.level || 1,
        xp: account.gameData?.xp || 0,
        rank: account.gameData?.rank || null,
        lastActiveGameMode: account.gameData?.lastActiveGameMode || null,
        lastPlayedAt: account.gameData?.lastPlayedAt || null,
        perGameStats: Array.isArray(account.gameData?.perGameStats)
          ? account.gameData.perGameStats
          : [],
        achievements: Array.isArray(account.gameData?.achievements)
          ? account.gameData.achievements
          : [],
        friendsAndBlockedUsers: friendRelationships.map(serializeRelationship),
        opals,
        opalTransactions,
        olingInventory: {
          eggs: Array.isArray(olingInventory.eggs) ? olingInventory.eggs : [],
          consumables: Array.isArray(olingInventory.consumables)
            ? olingInventory.consumables
            : [],
          furniture: Array.isArray(olingInventory.furniture)
            ? olingInventory.furniture
            : [],
          pets: Array.isArray(olingInventory.pets) ? olingInventory.pets : [],
          hatchHistory: Array.isArray(olingInventory.hatchHistory)
            ? olingInventory.hatchHistory
            : []
        },
        olingLab: olingState?.lab || accountOlings.lab || null,
        inGamePurchasesAndUnlocks
      },
      shop: {
        orderHistory
      },
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }

  function getEmailVerifiedRedirect(req, status) {
    const siteUrl = getPublicSiteUrl(req);
    return `${siteUrl}/sign-in?emailVerified=${encodeURIComponent(status)}`;
  }

  async function getCurrentAccount(req) {
    const sessionToken = getCookieValue(req.headers.cookie, 'oe_session');
    if (!sessionToken) return null;

    const tokenHash = hashSessionToken(sessionToken);

    return Account.findOne({
      'security.sessions': {
        $elemMatch: {
          tokenHash,
          expiresAt: { $gt: new Date() }
        }
      },
      'profile.accountStatus': { $nin: ['suspended', 'banned', 'deleted'] }
    }).select(
      '+security +security.sessions.tokenHash +legalConsent.dataExportRequests +legalConsent.accountDeletionRequests'
    );
  }

  async function requireOePanelAccount(req, res) {
    const account = await getCurrentAccount(req);

    if (!account || !serializeAccount(account).canAccessOePanel) {
      res.apiError({
        status: 403,
        code: 'oe_panel_forbidden',
        message: 'OE Panel access is required'
      });
      return null;
    }

    return account;
  }

  function hasOePanelPermission(account, permission) {
    if (account?.developmentBypass) return true;
    if (account?.admin?.disabled) return false;

    const roles = [
      ...(Array.isArray(account?.admin?.roles) ? account.admin.roles : []),
      account?.admin?.role
    ]
      .filter(Boolean)
      .map((role) => String(role).toLowerCase());
    if (roles.includes('owner') || roles.includes('admin')) return true;

    const permissions = Array.isArray(account?.admin?.permissionSet)
      ? account.admin.permissionSet
      : [];
    const expiresAt = account?.admin?.permissionsExpireAt;
    const isExpired = expiresAt && new Date(expiresAt).getTime() <= Date.now();

    return !isExpired && permissions.includes(permission);
  }

  function requireFeatureAccess(account, res, feature) {
    if (canAccessFeature(account, feature)) return true;

    res.apiError({
      status: 403,
      code: 'feature_access_required',
      message: 'This feature is currently available to beta testers.'
    });
    return false;
  }

  function requireOePanelPermission(account, res, permission) {
    if (hasOePanelPermission(account, permission)) return true;

    res.apiError({
      status: 403,
      code: 'oe_panel_permission_required',
      message: 'You do not have permission to perform this admin action.'
    });
    return false;
  }

  return {
    getPartyGuestHashFromRequest,
    upgradeGuestPartyIdentityForAccount,
    validateAccountInput,
    serializeAccount,
    getEmailVerifiedRedirect,
    getCurrentAccount,
    requireOePanelAccount,
    hasOePanelPermission,
    requireFeatureAccess,
    requireOePanelPermission
  };
}

module.exports = {
  createAccountContext
};
