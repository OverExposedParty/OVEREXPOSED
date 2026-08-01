const GUEST_FREE_PACKS = new Set(['base', 'blank']);
const ACCOUNT_FREE_PACKS = new Set(['engrave-danger', 'claus-and-co']);

function normalizeUnlocks(account) {
  return Array.isArray(account?.gameData?.inGamePurchasesAndUnlocks)
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];
}

function getOeAccessType(packSlug) {
  if (GUEST_FREE_PACKS.has(packSlug)) return 'guest_free';
  if (ACCOUNT_FREE_PACKS.has(packSlug)) return 'account_free';
  return 'entitlement';
}

function accountHasUnlock(account, type, key) {
  const normalizedType = String(type || '').trim();
  const normalizedKey = String(key || '').trim();
  if (!normalizedType || !normalizedKey) return false;

  return normalizeUnlocks(account).some(
    (unlock) => unlock.type === normalizedType && unlock.key === normalizedKey
  );
}

function canUseOeItem({ account = null, item = null, packSlug = '' } = {}) {
  const normalizedPackSlug = String(packSlug || item?.packSlug || '').trim();
  const itemId = String(item?.oeId || item?.id || '').trim();
  const accessType = getOeAccessType(normalizedPackSlug);

  if (accessType === 'guest_free') return true;
  if (!account) return false;
  if (accessType === 'account_free') return true;

  return (
    accountHasUnlock(account, 'pack', normalizedPackSlug) ||
    accountHasUnlock(account, 'oe', itemId)
  );
}

function getOeItemAccessState({
  account = null,
  item = null,
  packSlug = ''
} = {}) {
  const normalizedPackSlug = String(packSlug || item?.packSlug || '').trim();
  const itemId = String(item?.oeId || item?.id || '').trim();
  const accessType = getOeAccessType(normalizedPackSlug);
  const ownedByPack =
    account && accessType === 'entitlement'
      ? accountHasUnlock(account, 'pack', normalizedPackSlug)
      : false;
  const ownedByItem =
    account && accessType === 'entitlement'
      ? accountHasUnlock(account, 'oe', itemId)
      : false;
  const unlocked = canUseOeItem({
    account,
    item,
    packSlug: normalizedPackSlug
  });

  return {
    accessType,
    unlocked,
    ownedByPack,
    ownedByItem,
    requiresAccount: accessType === 'account_free',
    requiresEntitlement: accessType === 'entitlement'
  };
}

module.exports = {
  ACCOUNT_FREE_PACKS,
  GUEST_FREE_PACKS,
  accountHasUnlock,
  canUseOeItem,
  getOeAccessType,
  getOeItemAccessState
};
