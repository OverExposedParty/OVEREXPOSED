function normalizeOlingName(value) {
  const name = String(value || '').trim();
  if (!name) return null;
  return name.slice(0, 40);
}

function normalizeOlingHeadwearKey(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase();
  return key || null;
}

function accountOwnsOlingHeadwear(account, headwearKey) {
  const unlocks = Array.isArray(account?.gameData?.inGamePurchasesAndUnlocks)
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];

  return unlocks.some(
    (unlock) =>
      unlock?.key === headwearKey &&
      (unlock?.type === 'oling_headwear' ||
        (unlock?.type === 'cosmetic' &&
          unlock?.metadata?.slot === 'oling_headwear'))
  );
}

module.exports = {
  normalizeOlingName,
  normalizeOlingHeadwearKey,
  accountOwnsOlingHeadwear
};
