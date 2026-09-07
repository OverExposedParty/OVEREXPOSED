const mongoose = require('mongoose');

const { serializeOlingTrait } = require('../olings');
const {
  getValidCleanseChoices,
  getValidHeartTransferChoices,
  getValidPartWardChoices
} = require('./ability-effects');
const { recordClashEvent } = require('./events');
const {
  createRequestError,
  getClashMatch,
  getClashPlayer,
  isClashReadyToStart
} = require('./match-lifecycle');
const { snapshotClashAbility } = require('./snapshots');
const { createInitialTagState, hasTagCharge } = require('./tag-economy');

const AI_ACTIONS = Object.freeze(['attack', 'guard', 'skill']);
const AI_LAYERS = Object.freeze(['body', 'eyes', 'mouth', 'flight']);
const AI_TEAM_SIZE = 3;
const DEFAULT_AI_DIFFICULTY = 0.45;
const ACTION_LAYERS = Object.freeze({
  attack: 'mouth',
  guard: 'body',
  skill: 'flight'
});
const AI_USERNAMES = Object.freeze([
  'ARC-LIGHT',
  'BELLWETHER',
  'CIRCUIT',
  'DAYDREAM',
  'ECHOPOINT',
  'FLIPSIDE',
  'GLIMMER',
  'HYPERNOVA',
  'INKWELL',
  'JUMPCUT',
  'KEYFRAME',
  'LOWLIGHT'
]);
const AI_OLING_NAMES = Object.freeze([
  'Bramble',
  'Cinder',
  'Drift',
  'Fable',
  'Glimpse',
  'Hush',
  'Jinx',
  'Knot',
  'Lumen',
  'Muddle',
  'Nudge',
  'Orbit',
  'Pip',
  'Riff',
  'Tangle',
  'Wisp'
]);
const AI_OE_SLOT_ORDER = Object.freeze([
  'colour',
  'head-slot',
  'eyes-slot',
  'mouth-slot'
]);
const AI_OE_BLANK_IDS = Object.freeze(['0000', '0100', '0200', '0300']);
const AI_OE_FALLBACK_IDS = Object.freeze({
  colour: Object.freeze([
    'A000',
    'A001',
    'A002',
    'A003',
    'A004',
    'A005',
    'A006',
    'B000',
    'B001',
    'B002',
    'B003',
    'B004',
    'B005',
    'B006'
  ]),
  'head-slot': Object.freeze([
    'A100',
    'A101',
    'A102',
    'A103',
    'A104',
    'A105',
    'A106',
    'B100',
    'B101',
    'B102',
    'B103',
    'B104',
    'B105',
    'B106'
  ]),
  'eyes-slot': Object.freeze([
    'A200',
    'A201',
    'A202',
    'A203',
    'A204',
    'A205',
    'A206',
    'B200',
    'B201',
    'B202',
    'B203',
    'B204',
    'B205',
    'B206'
  ]),
  'mouth-slot': Object.freeze([
    'A300',
    'A301',
    'A302',
    'A303',
    'A304',
    'A305',
    'A306',
    'B300',
    'B301',
    'B302',
    'B303',
    'B304',
    'B305',
    'B306'
  ])
});

function clampAiDifficulty(value) {
  const difficulty = Number(value);
  if (!Number.isFinite(difficulty)) return DEFAULT_AI_DIFFICULTY;
  return Math.max(0, Math.min(1, difficulty));
}

function pickRandom(values, random = Math.random) {
  return values[Math.floor(random() * values.length)] || values[0];
}

function shuffle(values, random = Math.random) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }
  return shuffled;
}

async function createRandomAiOeIcon(models, { random = Math.random } = {}) {
  let images = [];
  if (typeof models?.OeCustomisation?.find === 'function') {
    try {
      const query = models.OeCustomisation.find({
        recordType: 'image',
        slot: { $in: AI_OE_SLOT_ORDER },
        oeId: { $nin: AI_OE_BLANK_IDS },
        enabled: true,
        status: 'published',
        blacklist: { $ne: true }
      });
      images = await (typeof query?.lean === 'function' ? query.lean() : query);
    } catch {
      images = [];
    }
  }

  const idsBySlot = Object.fromEntries(
    AI_OE_SLOT_ORDER.map((slot) => {
      const ids = [
        ...new Set(
          (Array.isArray(images) ? images : [])
            .filter((image) => image?.slot === slot)
            .map((image) => String(image.oeId || '').trim())
            .filter(Boolean)
        )
      ];
      return [slot, ids.length ? ids : AI_OE_FALLBACK_IDS[slot]];
    })
  );

  return AI_OE_SLOT_ORDER.map((slot) =>
    pickRandom(idsBySlot[slot], random)
  ).join(':');
}

async function loadAiClashCatalog(models) {
  const abilities = await models.OlingClashAbility.find({
    isCurrent: true,
    enabled: true,
    status: 'published'
  })
    .sort({ layer: 1, traitKey: 1 })
    .lean();
  const abilitiesByLayer = Object.fromEntries(
    AI_LAYERS.map((layer) => [
      layer,
      abilities.filter((ability) => ability.layer === layer)
    ])
  );
  if (
    AI_LAYERS.some((layer) => abilitiesByLayer[layer].length < AI_TEAM_SIZE)
  ) {
    throw createRequestError(
      'The published Clash ability catalog cannot generate an AI team.',
      503,
      'oling_clash_ai_catalog_incomplete'
    );
  }

  const traitKeys = [...new Set(abilities.map((ability) => ability.traitKey))];
  const traits = await models.OlingTrait.find({
    key: { $in: traitKeys }
  }).lean();
  const traitsByKey = new Map(traits.map((trait) => [trait.key, trait]));
  if (traitKeys.some((key) => !traitsByKey.has(key))) {
    throw createRequestError(
      'The published Clash ability catalog references a missing Oling Part.',
      503,
      'oling_clash_ai_trait_missing'
    );
  }
  return { abilitiesByLayer, traitsByKey };
}

async function createAiClashTeam(
  models,
  ruleset,
  { random = Math.random } = {}
) {
  const { abilitiesByLayer, traitsByKey } = await loadAiClashCatalog(models);
  const shuffledAbilities = Object.fromEntries(
    AI_LAYERS.map((layer) => [layer, shuffle(abilitiesByLayer[layer], random)])
  );
  const names = shuffle(AI_OLING_NAMES, random);
  const startingHeartUnits = Number(
    ruleset?.snapshot?.health?.startingHeartUnits || 6
  );

  return Array.from({ length: AI_TEAM_SIZE }, (_, teamSlot) => {
    const selectedAbilities = AI_LAYERS.map(
      (layer) => shuffledAbilities[layer][teamSlot]
    );
    const build = Object.fromEntries(
      selectedAbilities.map((ability) => [ability.layer, ability.traitKey])
    );
    const playerOlingId = new mongoose.Types.ObjectId();
    return {
      teamSlot,
      playerOlingId,
      snapshot: {
        name: names[teamSlot],
        build,
        equipment: {},
        traits: Object.fromEntries(
          AI_LAYERS.map((layer) => [
            layer,
            serializeOlingTrait(traitsByKey.get(build[layer]))
          ])
        ),
        abilities: selectedAbilities.map(snapshotClashAbility)
      },
      maxHeartUnits: startingHeartUnits,
      heartUnits: startingHeartUnits,
      overgrowthUnits: 0,
      bloodUnits: 0,
      pendingReclaimUnits: 0,
      shieldCount: 0,
      defeated: false,
      abilityProgress: [],
      removedPositiveStatuses: [],
      statuses: []
    };
  });
}

async function createAiClashPlayer(
  models,
  slot,
  ruleset,
  difficulty = DEFAULT_AI_DIFFICULTY,
  { random = Math.random } = {}
) {
  const oeIcon = await createRandomAiOeIcon(models, { random });
  return {
    accountId: new mongoose.Types.ObjectId(),
    playerName: pickRandom(AI_USERNAMES, random),
    playerLevel: 5 + Math.floor(random() * 21),
    oeIcon,
    slot,
    connected: true,
    isAi: true,
    aiDifficulty: clampAiDifficulty(difficulty),
    ready: true,
    activeTeamSlot: 0,
    ...createInitialTagState(ruleset),
    statuses: [],
    selection: null,
    team: await createAiClashTeam(models, ruleset, { random })
  };
}

function getAiClashOpponent(match) {
  return match.players.find((player) => player.isAi) || null;
}

function getHistoricalHumanActions(match, humanPlayer) {
  return (match.events || [])
    .filter((event) => event.type === 'round-resolved')
    .map((event) => event.payload?.actions?.[humanPlayer.slot])
    .filter((action) => AI_ACTIONS.includes(action));
}

function getCounterAction(match, predictedAction, random = Math.random) {
  const actions = match.ruleset?.snapshot?.actions || {};
  return (
    AI_ACTIONS.find(
      (action) => actions[`${action}Beats`] === predictedAction
    ) || pickRandom(AI_ACTIONS, random)
  );
}

function chooseAiTag(match, aiPlayer, random = Math.random) {
  if (!hasTagCharge(aiPlayer, match)) return null;
  const active = aiPlayer.team.find(
    (oling) => oling.teamSlot === aiPlayer.activeTeamSlot
  );
  const bench = aiPlayer.team.filter(
    (oling) => oling.teamSlot !== aiPlayer.activeTeamSlot && !oling.defeated
  );
  if (!active || !bench.length) return null;
  const protection =
    Number(active.heartUnits || 0) +
    Number(active.shieldCount || 0) *
      Number(match.ruleset?.snapshot?.health?.shieldCapacityUnits || 2) +
    Number(active.overgrowthUnits || 0);
  const decisiveUnits = Number(
    match.ruleset?.snapshot?.damage?.decisiveUnits || 2
  );
  const shouldTag =
    protection <= decisiveUnits ||
    random() < 0.08 + clampAiDifficulty(aiPlayer.aiDifficulty) * 0.12;
  if (!shouldTag) return null;
  return [...bench].sort((left, right) => {
    const leftHealth =
      Number(left.heartUnits || 0) +
      Number(left.shieldCount || 0) *
        Number(match.ruleset?.snapshot?.health?.shieldCapacityUnits || 2) +
      Number(left.overgrowthUnits || 0);
    const rightHealth =
      Number(right.heartUnits || 0) +
      Number(right.shieldCount || 0) *
        Number(match.ruleset?.snapshot?.health?.shieldCapacityUnits || 2) +
      Number(right.overgrowthUnits || 0);
    return rightHealth - leftHealth;
  })[0].teamSlot;
}

function chooseAiEffectChoice(match, aiPlayer, action, random = Math.random) {
  const active = aiPlayer.team.find(
    (oling) => oling.teamSlot === aiPlayer.activeTeamSlot
  );
  const ability = active?.snapshot?.abilities?.find(
    (candidate) => candidate.layer === ACTION_LAYERS[action]
  );
  const transferEffect = ability?.effects?.find(
    (effect) => effect.handler === 'transfer_hearts_between_self_and_bench'
  );
  const cleanseEffect = ability?.effects?.find(
    (effect) => effect.handler === 'cleanse_status'
  );
  const partWardEffect = ability?.effects?.find(
    (effect) => effect.handler === 'ward_chosen_part'
  );
  if (!transferEffect && !cleanseEffect && !partWardEffect) return null;
  const choices = transferEffect
    ? getValidHeartTransferChoices(
        aiPlayer,
        aiPlayer.activeTeamSlot,
        transferEffect.parameters?.amountUnits,
        match.ruleset?.snapshot
      )
    : cleanseEffect
      ? getValidCleanseChoices(
          aiPlayer,
          match,
          cleanseEffect.parameters?.polarity
        )
      : getValidPartWardChoices(aiPlayer, aiPlayer.activeTeamSlot);
  const choice = pickRandom(choices, random);
  return choice
    ? {
        abilityKey: ability.key,
        targetTeamSlot: choice.abilityTargetTeamSlot,
        optionKey: choice.optionKey
      }
    : null;
}

function chooseAiClashSelection(
  match,
  aiPlayer,
  { random = Math.random } = {}
) {
  const humanPlayer = match.players.find((player) => !player.isAi);
  const history = humanPlayer
    ? getHistoricalHumanActions(match, humanPlayer)
    : [];
  const difficulty = clampAiDifficulty(aiPlayer.aiDifficulty);
  let action = pickRandom(AI_ACTIONS, random);
  if (history.length && random() < difficulty) {
    const recentActions = history.slice(-3);
    const actionCounts = new Map(
      AI_ACTIONS.map((candidate) => [
        candidate,
        recentActions.filter((action) => action === candidate).length
      ])
    );
    const predictedAction = [...AI_ACTIONS].sort(
      (left, right) => actionCounts.get(right) - actionCounts.get(left)
    )[0];
    action = getCounterAction(match, predictedAction, random);
  }
  return {
    action,
    tagTeamSlot: chooseAiTag(match, aiPlayer, random),
    effectChoice: chooseAiEffectChoice(match, aiPlayer, action, random)
  };
}

async function addAiClashOpponent({
  models,
  account,
  matchCode,
  difficulty = DEFAULT_AI_DIFFICULTY,
  retryCount = 0,
  random = Math.random
}) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    throw createRequestError(
      'That Oling Clash has already started.',
      409,
      'oling_clash_already_started'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  if (player.slot !== 'player-one' || player.isAi) {
    throw createRequestError(
      'Only the Clash creator can add an AI opponent.',
      403,
      'oling_clash_creator_required'
    );
  }
  if (getAiClashOpponent(match)) {
    throw createRequestError(
      'This Clash already has an AI opponent.',
      409,
      'oling_clash_ai_opponent_exists'
    );
  }
  if (
    match.players.some((candidate) => !candidate.isAi && candidate !== player)
  ) {
    throw createRequestError(
      'This Clash already has a human opponent.',
      409,
      'oling_clash_human_opponent_exists'
    );
  }
  if (match.players.length >= 2) {
    throw createRequestError(
      'That Oling Clash is full.',
      409,
      'oling_clash_full'
    );
  }

  const aiPlayer = await createAiClashPlayer(
    models,
    'player-two',
    match.ruleset,
    difficulty,
    { random }
  );
  match.players.push(aiPlayer);
  match.status = isClashReadyToStart(match) ? 'ready' : 'waiting';
  match.phase = 'waiting';
  recordClashEvent(match, 'ai-joined', {
    accountId: account._id,
    payload: {
      aiAccountId: String(aiPlayer.accountId),
      difficulty: aiPlayer.aiDifficulty,
      playerName: aiPlayer.playerName
    }
  });
  try {
    await match.save();
  } catch (error) {
    if (error?.name === 'VersionError' && retryCount < 2) {
      return addAiClashOpponent({
        models,
        account,
        matchCode,
        difficulty,
        retryCount: retryCount + 1,
        random
      });
    }
    throw error;
  }
  return match;
}

async function updateAiClashOpponentDifficulty({
  models,
  account,
  matchCode,
  difficulty = DEFAULT_AI_DIFFICULTY,
  retryCount = 0
}) {
  const match = await getClashMatch({ models, matchCode });
  if (!match) {
    throw createRequestError(
      'That Oling Clash could not be found.',
      404,
      'oling_clash_not_found'
    );
  }
  if (!['waiting', 'ready'].includes(match.status)) {
    throw createRequestError(
      'That Oling Clash has already started.',
      409,
      'oling_clash_already_started'
    );
  }
  const player = getClashPlayer(match, account);
  if (!player || player.slot !== 'player-one' || player.isAi) {
    throw createRequestError(
      'Only the Clash creator can change AI difficulty.',
      403,
      'oling_clash_creator_required'
    );
  }
  const aiPlayer = getAiClashOpponent(match);
  if (!aiPlayer) {
    throw createRequestError(
      'This Clash does not have an AI opponent.',
      409,
      'oling_clash_ai_opponent_required'
    );
  }

  aiPlayer.aiDifficulty = clampAiDifficulty(difficulty);
  recordClashEvent(match, 'ai-difficulty-changed', {
    accountId: account._id,
    payload: { difficulty: aiPlayer.aiDifficulty }
  });
  try {
    await match.save();
  } catch (error) {
    if (error?.name === 'VersionError' && retryCount < 2) {
      return updateAiClashOpponentDifficulty({
        models,
        account,
        matchCode,
        difficulty,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return match;
}

module.exports = {
  AI_ACTIONS,
  AI_TEAM_SIZE,
  DEFAULT_AI_DIFFICULTY,
  addAiClashOpponent,
  chooseAiClashSelection,
  chooseAiEffectChoice,
  clampAiDifficulty,
  createAiClashPlayer,
  createAiClashTeam,
  createRandomAiOeIcon,
  getAiClashOpponent,
  getHistoricalHumanActions,
  loadAiClashCatalog,
  updateAiClashOpponentDifficulty
};
