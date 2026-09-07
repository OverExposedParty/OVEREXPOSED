const { createHash, randomUUID } = require('node:crypto');

const {
  grantAccountRewards,
  normalizeAccountRewards
} = require('../../services/account-rewards');
const {
  createActiveOlingFilter,
  createStoredOlingError,
  isOlingActive
} = require('../../services/olings/residency');

function getAdventureRunId(active) {
  const storedRunId = String(active?.runId || '').trim();
  if (storedRunId) return storedRunId;

  const legacyIdentity = [
    active?.adventureKey,
    active?.olingId,
    active?.startedAt,
    active?.completesAt
  ]
    .map((value) => String(value || ''))
    .join(':');
  return `legacy-${createHash('sha256')
    .update(legacyIdentity)
    .digest('hex')
    .slice(0, 24)}`;
}

function serializeActiveAdventure(active) {
  if (!active) return null;
  return {
    ...(active?.toObject ? active.toObject() : active),
    runId: getAdventureRunId(active)
  };
}

function findAdventureCompletion(account, runId) {
  if (!runId) return null;
  return (account?.olings?.adventures?.history || []).find(
    (completion) => getAdventureRunId(completion) === runId
  );
}

function sendCompletedAdventure(
  res,
  completion,
  { alreadyClaimed = false } = {}
) {
  return res.apiSuccess({
    message: `${completion.olingName || 'Your Oling'} returned from ${completion.adventureName}.`,
    completion,
    rewards: normalizeAccountRewards(completion.rewards),
    olingId: String(completion.olingId || ''),
    alreadyClaimed
  });
}

function registerOlingAdventuresRoutes(context) {
  const {
    app,
    getCurrentAccount,
    getOrCreateOlingState,
    OlingState,
    PlayerOling,
    getOlingDefinitions,
    models,
    OLING_ADVENTURES,
    serializePlayerOling,
    OlingLabItems,
    spendOlingEnergy
  } = context;

  app.get('/api/olings/adventures', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to use the Explorer Gateway.'
        });
      await getOrCreateOlingState(OlingState, account);
      const olings = await PlayerOling.find(
        createActiveOlingFilter(account._id)
      ).sort({ favorite: -1, hatchedAt: -1 });
      const definitions = await getOlingDefinitions(models, olings);
      const adventures = account.olings?.adventures || {
        active: null,
        history: []
      };
      res.apiSuccess({
        gatewayLevel: 1,
        active: serializeActiveAdventure(adventures.active),
        history: Array.isArray(adventures.history)
          ? adventures.history.slice(0, 30)
          : [],
        adventures: OLING_ADVENTURES.map((adventure) => ({
          ...adventure,
          rewards: normalizeAccountRewards(adventure.rewards)
        })),
        olings: olings.map((oling) => serializePlayerOling(oling, definitions))
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling adventures:`, err);
      res.apiError({
        status: 500,
        code: 'oling_adventures_fetch_failed',
        message: 'Failed to load Explorer Gateway.'
      });
    }
  });

  app.post('/api/olings/adventures/start', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to start an adventure.'
        });
      await getOrCreateOlingState(OlingState, account);
      const adventure = OLING_ADVENTURES.find(
        (item) => item.key === String(req.body?.adventureKey || '').trim()
      );
      if (!adventure)
        return res.apiError({
          status: 400,
          code: 'oling_adventure_invalid',
          message: 'That adventure is unavailable.'
        });
      if (account.olings?.adventures?.active)
        return res.apiError({
          status: 409,
          code: 'oling_adventure_active',
          message: 'An Oling is already on an adventure.'
        });
      const oling = await PlayerOling.findOne({
        _id: req.body?.olingId,
        ownerId: account._id
      });
      if (!oling)
        return res.apiError({
          status: 404,
          code: 'player_oling_not_found',
          message: 'That Oling could not be found.'
        });
      if (!isOlingActive(oling)) {
        const error = createStoredOlingError('starting an adventure');
        return res.apiError({
          status: error.status,
          code: error.code,
          message: error.message
        });
      }
      if (oling.care?.isSleeping) {
        return res.apiError({
          status: 409,
          code: 'oling_adventure_oling_resting',
          message: 'Wake this Oling before sending it on an adventure.'
        });
      }
      const placedDoor = (account.olings?.lab?.placedItems || []).find(
        (placed) =>
          String(placed?.placedId || '') ===
          String(req.body?.doorPlacedId || '')
      );
      const doorDefinition = OlingLabItems[placedDoor?.itemId];
      if (
        !placedDoor ||
        doorDefinition?.type !== 'door' ||
        !doorDefinition.exitGridPlacement
      ) {
        return res.apiError({
          status: 400,
          code: 'oling_adventure_door_invalid',
          message: 'Choose a placed door with an exit area.'
        });
      }
      const energyCost = adventure.energyCost;
      const spent = await spendOlingEnergy({
        PlayerOling,
        accountId: account._id,
        olingId: oling._id,
        amount: energyCost
      });
      if (spent.error) return res.apiError(spent.error);
      const startedAt = new Date();
      const active = {
        runId: randomUUID(),
        adventureKey: adventure.key,
        adventureName: adventure.name,
        olingId: String(oling._id),
        olingName: oling.name || 'Oling',
        doorPlacedId: String(placedDoor.placedId),
        startedAt,
        completesAt: new Date(startedAt.getTime() + adventure.durationMs),
        durationMs: adventure.durationMs,
        energyCost,
        rewards: normalizeAccountRewards(adventure.rewards)
      };
      account.set('olings.adventures.active', active);
      account.markModified('olings');
      await account.save({ validateBeforeSave: false });
      res.apiSuccess({
        message: `${active.olingName} set off on ${adventure.name}.`,
        active
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to start Oling adventure:`, err);
      res.apiError({
        status: 500,
        code: 'oling_adventure_start_failed',
        message: 'Failed to start that adventure.'
      });
    }
  });

  app.post('/api/olings/adventures/return', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to return an Oling.'
        });
      const requestedRunId = String(req.body?.runId || '').trim();
      const active = account.olings?.adventures?.active;
      if (!active) {
        const completed = findAdventureCompletion(account, requestedRunId);
        if (completed) {
          return sendCompletedAdventure(res, completed, {
            alreadyClaimed: true
          });
        }
        return res.apiError({
          status: 409,
          code: 'oling_adventure_missing',
          message: 'No Oling is currently away.'
        });
      }
      const runId = getAdventureRunId(active);
      if (requestedRunId && requestedRunId !== runId) {
        return res.apiError({
          status: 409,
          code: 'oling_adventure_run_mismatch',
          message: 'That adventure is no longer the active adventure.'
        });
      }
      if (new Date(active.completesAt).getTime() > Date.now())
        return res.apiError({
          status: 409,
          code: 'oling_adventure_incomplete',
          message: 'This adventure is not complete yet.'
        });
      const adventure = OLING_ADVENTURES.find(
        (item) => item.key === active.adventureKey
      );
      const rewards = normalizeAccountRewards(
        active.rewards || adventure?.rewards
      );
      if (!adventure && rewards.accountXp === 0 && rewards.opals === 0)
        return res.apiError({
          status: 400,
          code: 'oling_adventure_invalid',
          message: 'This adventure is no longer available.'
        });
      const completedAt = new Date();
      const sourceId = `oling-adventure:${runId}`;
      const rewardResult = grantAccountRewards({
        account,
        rewards,
        sourceId,
        reason: `Completed Oling adventure: ${active.adventureName}`,
        metadata: {
          rewardType: 'oling_adventure',
          adventureRunId: runId,
          adventureKey: active.adventureKey,
          olingId: String(active.olingId || '')
        },
        now: completedAt
      });
      const completion = {
        ...serializeActiveAdventure(active),
        runId,
        completedAt,
        rewards: rewardResult.rewards,
        rewardSourceId: sourceId
      };
      account.set('olings.adventures.active', null);
      account.set(
        'olings.adventures.history',
        [
          completion,
          ...(account.olings?.adventures?.history || []).filter(
            (entry) => getAdventureRunId(entry) !== runId
          )
        ].slice(0, 30)
      );
      account.markModified('olings');
      await account.save({ validateBeforeSave: false });
      return sendCompletedAdventure(res, completion, {
        alreadyClaimed: rewardResult.duplicate
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to return Oling adventure:`, err);
      res.apiError({
        status: 500,
        code: 'oling_adventure_return_failed',
        message: 'Failed to complete that adventure.'
      });
    }
  });
}

module.exports = {
  getAdventureRunId,
  registerOlingAdventuresRoutes,
  serializeActiveAdventure
};
