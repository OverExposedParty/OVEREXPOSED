const crypto = require('crypto');

const { getCookieValue } = require('./page-assets');
const { isPartyRoomActive } = require('./party-room-activity');
const { OE_PANEL_ROLES } = require('../routes/shared/api-admin-helpers');
const {
  CONTENT_ACCESS_LEVELS,
  FEATURE_ACCESS_LEVELS,
  getFeatureAccessLevel
} = require('../../models/content/standard-account-content');

const BETA_TESTER_ROLE = 'beta_tester';
const BETA_TESTER_FEATURES = new Set(
  Object.entries(FEATURE_ACCESS_LEVELS)
    .filter(([, level]) => level === CONTENT_ACCESS_LEVELS.BETA)
    .map(([feature]) => feature)
);

function hashToken(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function getAdminRoles(account) {
  return [
    ...(Array.isArray(account?.admin?.roles) ? account.admin.roles : []),
    account?.admin?.role
  ]
    .filter(Boolean)
    .map((role) => String(role).toLowerCase());
}

function getAccessRoles(account) {
  return (Array.isArray(account?.access?.roles) ? account.access.roles : [])
    .filter(Boolean)
    .map((role) => String(role).toLowerCase());
}

function getAccessFeatures(account) {
  return (
    Array.isArray(account?.access?.features) ? account.access.features : []
  )
    .filter(Boolean)
    .map((feature) => String(feature).toLowerCase());
}

function canAccessAdminPages(account) {
  if (!account || account.admin?.disabled) return false;
  if (!account.profile?.emailVerified) return false;
  return getAdminRoles(account).some((role) => OE_PANEL_ROLES.has(role));
}

function canAccessOwnerPages(account) {
  if (!account || account.admin?.disabled) return false;
  if (!account.profile?.emailVerified) return false;
  return getAdminRoles(account).includes('owner');
}

function canAccessFeature(account, feature) {
  const normalizedFeature = String(feature || '')
    .trim()
    .toLowerCase();
  if (!account || !normalizedFeature) return false;
  const accessLevel = getFeatureAccessLevel(normalizedFeature);
  if (accessLevel === CONTENT_ACCESS_LEVELS.OWNER) {
    return canAccessOwnerPages(account);
  }
  if (canAccessAdminPages(account)) return true;
  if (account.access?.disabled) return false;

  if (accessLevel === CONTENT_ACCESS_LEVELS.STANDARD) return true;

  const accessRoles = getAccessRoles(account);
  if (
    accessRoles.includes(BETA_TESTER_ROLE) &&
    BETA_TESTER_FEATURES.has(normalizedFeature)
  ) {
    return true;
  }

  return getAccessFeatures(account).includes(normalizedFeature);
}

function getPartyCodeFromRequest(req) {
  return String(
    req?.params?.partyCode ||
      req?.query?.partyCode ||
      req?.query?.partyId ||
      req?.body?.partyCode ||
      req?.body?.partyId ||
      ''
  ).trim();
}

async function getCurrentAccount(req, Account) {
  const sessionToken = getCookieValue(req.headers.cookie, 'oe_session');
  if (!sessionToken || !Account) return null;

  return Account.findOne({
    'security.sessions': {
      $elemMatch: {
        tokenHash: hashToken(sessionToken),
        expiresAt: { $gt: new Date() }
      }
    },
    'profile.accountStatus': { $nin: ['suspended', 'banned', 'deleted'] }
  }).select('+security');
}

function parseProtectionDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPasswordCookieName(key) {
  return `oe_page_access_${hashToken(key).slice(0, 16)}`;
}

function getPasswordAccessToken(key, passwordHash, secret) {
  return hashToken(`${key}:${passwordHash}:${secret || 'oe-page-protection'}`);
}

function hasPasswordAccess(req, protection) {
  const key = protection.key || req.path;
  const cookieName = getPasswordCookieName(key);
  const token = getCookieValue(req.headers.cookie, cookieName);
  const passwordHash =
    protection.passwordHash || hashToken(protection.password);

  return (
    Boolean(passwordHash) &&
    token ===
      getPasswordAccessToken(key, passwordHash, process.env.COOKIE_SECRET)
  );
}

function getRequiredFeatureAccess(feature) {
  const accessLevel = getFeatureAccessLevel(feature);
  if (accessLevel === CONTENT_ACCESS_LEVELS.BETA) return 'beta';
  if (accessLevel === CONTENT_ACCESS_LEVELS.OWNER) return 'owner';
  if (accessLevel === CONTENT_ACCESS_LEVELS.STANDARD) return 'account';
  return 'restricted';
}

function getPartyCurrentHostAccountId(party) {
  const hostComputerId = party?.state?.hostComputerId;
  if (!hostComputerId || !Array.isArray(party?.players)) return null;

  const hostPlayer = party.players.find(
    (player) =>
      String(player?.identity?.computerId || player?.computerId || '') ===
      String(hostComputerId)
  );

  return hostPlayer?.identity?.accountId || hostPlayer?.accountId || null;
}

function getPartyOriginalHostAccountId(party) {
  return (
    party?.session?.access?.originalHostAccountId ||
    getPartyCurrentHostAccountId(party)
  );
}

async function findHostedPartyByCode(partyCode, PartyModels = []) {
  if (!partyCode) return null;

  for (const PartyModel of PartyModels) {
    if (!PartyModel?.findOne) continue;

    const party = await PartyModel.findOne({ partyId: partyCode }).lean();
    if (isPartyRoomActive(party)) return party;
  }

  return null;
}

async function canAccessHostedFeature(
  req,
  feature,
  { Account, PartyModels = [] } = {}
) {
  if (!Account?.findById) return false;

  const partyCode = getPartyCodeFromRequest(req);
  const party = await findHostedPartyByCode(partyCode, PartyModels);
  const originalHostAccountId = getPartyOriginalHostAccountId(party);
  if (!originalHostAccountId) return false;

  const originalHost = await Account.findById(originalHostAccountId);
  return canAccessFeature(originalHost, feature);
}

async function canAccessHostedOwnerPage(
  req,
  { Account, PartyModels = [] } = {}
) {
  if (!Account?.findById) return false;

  const partyCode = getPartyCodeFromRequest(req);
  const party = await findHostedPartyByCode(partyCode, PartyModels);
  const originalHostAccountId = getPartyOriginalHostAccountId(party);
  if (!originalHostAccountId) return false;

  const originalHost = await Account.findById(originalHostAccountId);
  return canAccessOwnerPages(originalHost);
}

async function canAccessProtectedPage(
  req,
  protection,
  { Account, PartyModels = [] } = {}
) {
  if (!protection) return { allowed: true };

  const rules = Array.isArray(protection) ? protection : [protection];
  const accountRules = rules.filter((rule) => rule?.type === 'admin');
  const ownerRules = rules.filter((rule) => rule?.type === 'owner');
  const featureRules = rules.filter((rule) => rule?.type === 'feature');
  const explicitAccountRules = rules.filter((rule) => rule?.type === 'account');
  const requiresAccount = rules.some(
    (rule) =>
      ['account', 'feature', 'owner'].includes(rule?.type) &&
      rule.enabled !== false
  );

  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;

    if (rule.type === 'unlockAt') {
      const unlockAt = parseProtectionDate(rule.unlockAt || rule.at);
      if (unlockAt && Date.now() < unlockAt.getTime()) {
        return { allowed: false, reason: 'locked_until', unlockAt };
      }
    }

    if (rule.type === 'window') {
      const startsAt = parseProtectionDate(rule.startsAt || rule.from);
      const endsAt = parseProtectionDate(rule.endsAt || rule.until);
      const now = Date.now();
      if (startsAt && now < startsAt.getTime()) {
        return {
          allowed: false,
          reason: 'window_not_started',
          unlockAt: startsAt
        };
      }
      if (endsAt && now > endsAt.getTime()) {
        return { allowed: false, reason: 'window_closed' };
      }
    }

    if (rule.type === 'password' && !hasPasswordAccess(req, rule)) {
      return { allowed: false, reason: 'password_required' };
    }
  }

  if (
    requiresAccount ||
    accountRules.length ||
    ownerRules.length ||
    featureRules.length
  ) {
    const account = await getCurrentAccount(req, Account);
    if (!account) {
      for (const rule of ownerRules) {
        if (
          rule.allowHostedParty &&
          (await canAccessHostedOwnerPage(req, { Account, PartyModels }))
        ) {
          continue;
        }

        return {
          allowed: false,
          reason: 'account_required',
          requiredAccess: 'owner'
        };
      }

      for (const rule of featureRules) {
        if (
          rule.allowHostedParty &&
          (await canAccessHostedFeature(req, rule.feature, {
            Account,
            PartyModels
          }))
        ) {
          continue;
        }

        return {
          allowed: false,
          reason: 'account_required',
          requiredAccess: getRequiredFeatureAccess(rule.feature)
        };
      }

      if (explicitAccountRules.length) {
        return {
          allowed: false,
          reason: 'account_required',
          requiredAccess: 'account'
        };
      }
      if (accountRules.length) {
        return {
          allowed: false,
          reason: 'account_required',
          requiredAccess: 'admin'
        };
      }
    }
    if (accountRules.length && !canAccessAdminPages(account)) {
      return { allowed: false, reason: 'admin_required' };
    }
    for (const rule of ownerRules) {
      if (canAccessOwnerPages(account)) continue;
      if (
        rule.allowHostedParty &&
        (await canAccessHostedOwnerPage(req, { Account, PartyModels }))
      ) {
        continue;
      }

      return { allowed: false, reason: 'owner_required' };
    }
    for (const rule of featureRules) {
      if (canAccessFeature(account, rule.feature)) continue;
      if (
        rule.allowHostedParty &&
        (await canAccessHostedFeature(req, rule.feature, {
          Account,
          PartyModels
        }))
      ) {
        continue;
      }

      return {
        allowed: false,
        reason:
          getFeatureAccessLevel(rule.feature) === CONTENT_ACCESS_LEVELS.OWNER
            ? 'owner_required'
            : 'feature_required',
        requiredAccess: getRequiredFeatureAccess(rule.feature),
        feature: rule.feature || null
      };
    }
  }

  return { allowed: true };
}

module.exports = {
  BETA_TESTER_FEATURES,
  BETA_TESTER_ROLE,
  canAccessAdminPages,
  canAccessFeature,
  canAccessHostedFeature,
  canAccessHostedOwnerPage,
  canAccessOwnerPages,
  canAccessProtectedPage,
  getCurrentAccount,
  getPasswordAccessToken,
  getPasswordCookieName,
  hashToken
};
