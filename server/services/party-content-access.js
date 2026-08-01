const { getPublishedPacks, getPackAccess } = require('./game-packs');
const { getPublishedRules, getRuleAccess } = require('./game-rules');
const { getPublishedRoles, getRoleAccess } = require('./game-roles');
const { normalizeMafiaRoleCounts } = require('./mafia-role-counts');
const { canAccountAccessGameContent } = require('./game-content-access');
const { getCurrentAccount } = require('./page-protection');

function normalizePartyCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

async function resolveLeanQuery(query) {
  if (typeof query?.lean === 'function') return query.lean();
  return query;
}

async function findWaitingRoom(WaitingRoom, partyCode) {
  const normalizedPartyCode = normalizePartyCode(partyCode);
  if (!WaitingRoom?.findOne || !normalizedPartyCode) return null;

  return resolveLeanQuery(
    WaitingRoom.findOne({ partyId: normalizedPartyCode })
  );
}

async function findPartyByCode(WaitingRoom, PartyModels, partyCode) {
  const waitingRoom = await findWaitingRoom(WaitingRoom, partyCode);
  if (waitingRoom) return waitingRoom;

  for (const PartyModel of Array.isArray(PartyModels) ? PartyModels : []) {
    if (!PartyModel?.findOne) continue;
    const party = await resolveLeanQuery(
      PartyModel.findOne({ partyId: normalizePartyCode(partyCode) })
    );
    if (party) return party;
  }

  return null;
}

function getPartyHostAccountId(party) {
  const originalHostAccountId = party?.session?.access?.originalHostAccountId;
  if (originalHostAccountId) return originalHostAccountId;

  const hostComputerId = String(party?.state?.hostComputerId || '');
  const host = (Array.isArray(party?.players) ? party.players : []).find(
    (player) =>
      String(player?.identity?.computerId || player?.computerId || '') ===
      hostComputerId
  );

  return host?.identity?.accountId || host?.accountId || null;
}

async function findAccountById(Account, accountId) {
  if (!Account?.findById || !accountId) return null;
  return resolveLeanQuery(Account.findById(accountId));
}

async function getGameContentAccessAccount(
  req,
  { Account, WaitingRoom, PartyModels = [] }
) {
  const context = await getGameContentRequestContext(req, {
    Account,
    WaitingRoom,
    PartyModels
  });
  return context.account;
}

async function getGameContentRequestContext(
  req,
  { Account, WaitingRoom, PartyModels = [] }
) {
  const partyCode = normalizePartyCode(
    req?.query?.partyCode || req?.query?.partyId
  );

  if (!partyCode) {
    return {
      account: await getCurrentAccount(req, Account),
      party: null
    };
  }

  const party = await findPartyByCode(WaitingRoom, PartyModels, partyCode);
  return {
    account: await findAccountById(Account, getPartyHostAccountId(party)),
    party
  };
}

function isSelectedGameContentValue(value) {
  return !(
    value === false ||
    value === null ||
    value === undefined ||
    String(value).trim().toLowerCase() === 'false'
  );
}

function isPartyContentGrandfathered(party) {
  if (!party) return false;
  if (party.state?.isPlaying === true) return true;
  if (party.state?.phase === 'game-over') return true;
  return Boolean(
    Number(party.session?.playSequence) > 0 &&
    party.state?.phase &&
    party.state.phase !== 'lobby'
  );
}

function getGrandfatheredPartyContentKeys(party) {
  const empty = { packKeys: [], roleKeys: [], ruleKeys: [] };
  if (!isPartyContentGrandfathered(party)) return empty;
  const config = party.config || {};
  const rawRules =
    config.gameRules instanceof Map
      ? Object.fromEntries(config.gameRules)
      : config.gameRules || {};
  const roleCounts =
    config.roleCounts instanceof Map
      ? Object.fromEntries(config.roleCounts)
      : config.roleCounts || {};
  const roleKeys = new Set(
    Object.entries(roleCounts)
      .filter(([, count]) => Number(count) > 0)
      .map(([key]) => key)
  );

  for (const player of Array.isArray(party.players) ? party.players : []) {
    const roleKey = player?.state?.roleKey || player?.roleKey;
    if (roleKey) roleKeys.add(String(roleKey));
  }

  return {
    packKeys: Array.isArray(config.selectedPacks)
      ? config.selectedPacks.map(String)
      : [],
    ruleKeys: Object.entries(rawRules)
      .filter(([, value]) => isSelectedGameContentValue(value))
      .map(([key]) => key)
      .filter((key) => !key.endsWith('-game-rule-time-limit'))
      .map((key) =>
        key === 'truth-or-dare-prompt-heist' ? 'prompt-heist' : key
      ),
    roleKeys: Array.from(roleKeys)
  };
}

function createContentAccessError(type, key, access) {
  const labels = {
    rule: 'Game rule',
    pack: 'Game pack',
    role: 'Game role'
  };
  const error = new Error(
    `${labels[type] || 'Game content'} "${key}" requires additional access.`
  );
  error.status = 403;
  error.code = 'feature_access_required';
  error.details = {
    contentType: type,
    contentKey: key,
    feature: access?.feature || null
  };
  return error;
}

function createInvalidGameContentError(type, key) {
  const labels = {
    rule: 'Game rule',
    pack: 'Game pack'
  };
  const error = new Error(
    `${labels[type] || 'Game content'} "${key}" is not available for this game.`
  );
  error.status = 400;
  error.code = 'invalid_game_content';
  error.details = {
    contentType: type,
    contentKey: key
  };
  return error;
}

async function getPartyConfigAccessAccount({
  partyId,
  existingParty,
  principal,
  Account,
  WaitingRoom
}) {
  let hostAccountId = getPartyHostAccountId(existingParty);

  if (!hostAccountId) {
    const waitingRoom = await findWaitingRoom(WaitingRoom, partyId);
    hostAccountId = getPartyHostAccountId(waitingRoom);
  }

  if (!hostAccountId && principal?.type === 'account') {
    hostAccountId = principal.accountId;
  }

  return findAccountById(Account, hostAccountId);
}

async function assertPartyConfigContentAccess({
  config,
  partyId,
  existingParty,
  principal,
  Account,
  WaitingRoom,
  GameRule,
  GamePack,
  GameRole
}) {
  const gamemode = String(config?.gamemode || '')
    .trim()
    .toLowerCase();
  if (!gamemode) return;

  const rawRules =
    config.gameRules instanceof Map
      ? Object.fromEntries(config.gameRules)
      : config.gameRules || {};
  const selectedPacks = Array.isArray(config.selectedPacks)
    ? config.selectedPacks
    : [];
  const grandfathered = getGrandfatheredPartyContentKeys(existingParty);

  const [account, rules, packs, roles] = await Promise.all([
    getPartyConfigAccessAccount({
      partyId,
      existingParty,
      principal,
      Account,
      WaitingRoom
    }),
    getPublishedRules(GameRule, gamemode, {
      includeKeys: grandfathered.ruleKeys
    }),
    getPublishedPacks(GamePack, gamemode, {
      includeKeys: grandfathered.packKeys
    }),
    gamemode === 'mafia'
      ? getPublishedRoles(GameRole, gamemode, {
          includeKeys: grandfathered.roleKeys
        })
      : Promise.resolve([])
  ]);
  const rulesByKey = new Map(rules.map((rule) => [rule.key, rule]));
  const packsByKey = new Map();

  packs.forEach((pack) => {
    packsByKey.set(pack.slug, pack);
    packsByKey.set(pack.key, pack);
  });

  for (const [key, value] of Object.entries(rawRules)) {
    if (!isSelectedGameContentValue(value)) continue;

    const canonicalKey =
      gamemode === 'truth-or-dare' && key === 'truth-or-dare-prompt-heist'
        ? 'prompt-heist'
        : key;
    const rule = rulesByKey.get(canonicalKey);
    if (!rule) {
      const baseRuleKey = key.endsWith('-game-rule-time-limit')
        ? key.slice(0, -'-game-rule-time-limit'.length)
        : null;
      if (baseRuleKey && rulesByKey.has(baseRuleKey)) continue;
      throw createInvalidGameContentError('rule', key);
    }
    const access = getRuleAccess(rule);
    if (!canAccountAccessGameContent(account, access)) {
      throw createContentAccessError('rule', key, access);
    }
  }

  for (const key of selectedPacks) {
    const pack = packsByKey.get(key);
    if (!pack) {
      throw createInvalidGameContentError('pack', key);
    }

    const access = getPackAccess(pack);
    if (!canAccountAccessGameContent(account, access)) {
      throw createContentAccessError('pack', key, access);
    }
  }

  if (gamemode === 'mafia') {
    const roleCounts = normalizeMafiaRoleCounts(config, roles);
    const rolesByKey = new Map(roles.map((role) => [role.key, role]));

    for (const [key, count] of Object.entries(roleCounts)) {
      if (count <= 0) continue;
      const role = rolesByKey.get(key);
      if (!role) continue;

      const access = getRoleAccess(role);
      if (!canAccountAccessGameContent(account, access)) {
        throw createContentAccessError('role', key, access);
      }
    }
  }
}

module.exports = {
  assertPartyConfigContentAccess,
  findPartyByCode,
  findWaitingRoom,
  getGameContentAccessAccount,
  getGameContentRequestContext,
  getGrandfatheredPartyContentKeys,
  getPartyConfigAccessAccount,
  getPartyHostAccountId,
  isPartyContentGrandfathered,
  isSelectedGameContentValue
};
