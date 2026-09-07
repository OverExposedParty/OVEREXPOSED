const mongoose = require('mongoose');
const { chooseAiClashSelection, getAiClashOpponent } = require('./ai-opponent');
const { archiveAndResetClash } = require('./archives');
const { recordClashEvent } = require('./events');
const { toPlainObject } = require('./match-view');
const {
  createRequestError,
  getClashMatch,
  getClashPlayer
} = require('./match-lifecycle');
const { resolveCoreClashRound } = require('./round-resolution');
const {
  CLASH_FLOW_DURATIONS,
  getSelectionDeadline,
  parseClashTimestamp
} = require('./timing');
const { hasTagCharge } = require('./tag-economy');
const {
  getValidCleanseChoices,
  getValidHeartTransferChoices,
  getValidPartWardChoices
} = require('./ability-effects');

const VALID_ACTIONS = new Set(['attack', 'guard', 'skill']);
const ACTION_LAYERS = Object.freeze({
  attack: 'mouth',
  guard: 'body',
  skill: 'flight'
});
const ACTION_KEYS = Object.freeze([...VALID_ACTIONS]);

function cloneResolvedMatch(match) {
  const plain = toPlainObject(match);
  return JSON.parse(JSON.stringify(plain));
}

function createSelectionContext(match) {
  const deadline = parseClashTimestamp(match?.phaseEndsAt);
  return {
    gameId: String(match?.gameId || ''),
    phaseEndsAt: Number.isFinite(deadline) ? deadline : null,
    round: Number(match?.round || 0)
  };
}

function selectionContextMatches(context, match) {
  const current = createSelectionContext(match);
  return Boolean(
    context &&
    context.gameId === current.gameId &&
    context.phaseEndsAt === current.phaseEndsAt &&
    context.round === current.round
  );
}

function getActionAbility(player, action) {
  const active = player.team.find(
    (oling) => oling.teamSlot === player.activeTeamSlot
  );
  return active?.snapshot?.abilities?.find(
    (ability) => ability.layer === ACTION_LAYERS[action]
  );
}

function getStatusDefinition(match, status) {
  return (
    match?.statusDefinitions?.find(
      (definition) =>
        definition.key === status?.key &&
        Number(definition.revision || 1) === Number(status?.revision || 1)
    )?.snapshot || null
  );
}

function isActionBlocked(match, player, action) {
  const active = player?.team?.find(
    (oling) => oling.teamSlot === player.activeTeamSlot
  );
  const part = ACTION_LAYERS[action];
  return [...(active?.statuses || []), ...(player?.statuses || [])].some(
    (status) => {
      const definition = getStatusDefinition(match, status) || {};
      const data = status?.data || {};
      const parameters = {
        ...(definition.parameters || {}),
        ...(data.parameters || {})
      };
      const preventsAction =
        status?.preventsAction === true ||
        data.preventsAction === true ||
        parameters.preventsAction === true;
      if (!preventsAction) return false;

      const blockedActions = [
        ...(Array.isArray(status?.blockedActions) ? status.blockedActions : []),
        ...(Array.isArray(data.blockedActions) ? data.blockedActions : []),
        ...(Array.isArray(parameters.blockedActions)
          ? parameters.blockedActions
          : [])
      ].map((value) => String(value).trim().toLowerCase());
      const targetAction = String(
        status?.targetAction ||
          data.targetAction ||
          parameters.targetAction ||
          ''
      )
        .trim()
        .toLowerCase();
      const targetPart = String(
        status?.targetPart || data.targetPart || parameters.targetPart || ''
      )
        .trim()
        .toLowerCase();

      if (blockedActions.length && !blockedActions.includes(action)) {
        return false;
      }
      if (targetAction && targetAction !== 'all' && targetAction !== action) {
        return false;
      }
      return !targetPart || targetPart === 'all' || targetPart === part;
    }
  );
}

function getAvailableClashActions(match, player) {
  return ACTION_KEYS.filter(
    (action) => !isActionBlocked(match, player, action)
  );
}

function getEffectChoiceContext(player, action, match) {
  const ability = getActionAbility(player, action);
  const transferEffect = ability?.effects?.find(
    (effect) => effect.handler === 'transfer_hearts_between_self_and_bench'
  );
  const cleanseEffect = ability?.effects?.find(
    (effect) => effect.handler === 'cleanse_status'
  );
  const partWardEffect = ability?.effects?.find(
    (effect) => effect.handler === 'ward_chosen_part'
  );
  const effect = transferEffect || cleanseEffect || partWardEffect;
  if (!effect) return { ability, choices: [], effect: null };

  const choices = transferEffect
    ? getValidHeartTransferChoices(
        player,
        player.activeTeamSlot,
        transferEffect.parameters?.amountUnits,
        match.ruleset?.snapshot
      )
    : cleanseEffect
      ? getValidCleanseChoices(
          player,
          match,
          cleanseEffect.parameters?.polarity
        )
      : getValidPartWardChoices(player, player.activeTeamSlot);
  return { ability, choices, effect };
}

function pickRandom(values, random = Math.random) {
  if (!values.length) return null;
  const randomValue = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return values[Math.floor(randomValue * values.length)] || values[0];
}

function createRandomEffectChoice(player, action, match, random = Math.random) {
  const { ability, choices, effect } = getEffectChoiceContext(
    player,
    action,
    match
  );
  if (!effect || choices.length === 0) return null;
  const choice = pickRandom(choices, random);
  return {
    abilityKey: ability.key,
    targetTeamSlot: choice.abilityTargetTeamSlot,
    optionKey: choice.optionKey
  };
}

function validateEffectChoice(player, action, effectChoice, match) {
  const {
    ability,
    choices: validChoices,
    effect
  } = getEffectChoiceContext(player, action, match);
  if (!effect) {
    if (effectChoice !== null && effectChoice !== undefined) {
      throw createRequestError(
        'That action does not accept an effect choice.',
        400,
        'oling_clash_effect_choice_invalid'
      );
    }
    return null;
  }

  if (validChoices.length === 0) return null;
  const normalizedChoice = {
    abilityKey: String(effectChoice?.abilityKey || '')
      .trim()
      .toLowerCase(),
    targetTeamSlot: Number(effectChoice?.targetTeamSlot),
    optionKey: String(effectChoice?.optionKey || '')
      .trim()
      .toLowerCase()
  };
  const isValid = validChoices.some(
    (choice) =>
      normalizedChoice.abilityKey === ability.key &&
      normalizedChoice.targetTeamSlot === choice.abilityTargetTeamSlot &&
      normalizedChoice.optionKey === choice.optionKey
  );
  if (!isValid) {
    throw createRequestError(
      effect.handler === 'transfer_hearts_between_self_and_bench'
        ? 'Choose a valid Transfusion target and direction.'
        : effect.handler === 'cleanse_status'
          ? 'Choose a teammate and Negative Status to Cleanse.'
          : 'Choose a Part to Reinforce.',
      400,
      effectChoice
        ? 'oling_clash_effect_choice_invalid'
        : 'oling_clash_effect_choice_required'
    );
  }
  return normalizedChoice;
}

function validateTagTeamSlot(player, tagTeamSlot, match) {
  if (tagTeamSlot === null || tagTeamSlot === undefined) return null;
  if (!hasTagCharge(player, match)) {
    throw createRequestError(
      'You do not have a Tag charge available.',
      409,
      'oling_clash_tag_charge_required'
    );
  }
  const normalizedTag = Number(tagTeamSlot);
  const taggedOling = player.team.find(
    (oling) =>
      oling.teamSlot === normalizedTag &&
      oling.teamSlot !== player.activeTeamSlot &&
      !oling.defeated
  );
  if (!Number.isInteger(normalizedTag) || !taggedOling) {
    throw createRequestError(
      'Choose a valid benched Oling to Tag.',
      400,
      'oling_clash_tag_invalid'
    );
  }
  return normalizedTag;
}

function validateSelection(player, action, tagTeamSlot, effectChoice, match) {
  const normalizedAction = String(action || '')
    .trim()
    .toLowerCase();
  if (!VALID_ACTIONS.has(normalizedAction)) {
    throw createRequestError(
      'Choose Attack, Guard, or Skill.',
      400,
      'oling_clash_action_invalid'
    );
  }
  if (!getAvailableClashActions(match, player).includes(normalizedAction)) {
    throw createRequestError(
      'That action is currently blocked by an active effect.',
      409,
      'oling_clash_action_blocked'
    );
  }
  return {
    action: normalizedAction,
    tagTeamSlot: validateTagTeamSlot(player, tagTeamSlot, match),
    effectChoice: validateEffectChoice(
      player,
      normalizedAction,
      effectChoice,
      match
    )
  };
}

async function resolveReadyRound(
  match,
  { random = Math.random, resolveRound = resolveCoreClashRound } = {}
) {
  let roundResult = null;
  let resolvedMatch = null;
  if (
    match.players.length === 2 &&
    match.players.every((item) => item.selection?.round === match.round)
  ) {
    match.phase = 'resolution';
    roundResult = await resolveRound(match);
    const aiPlayer = getAiClashOpponent(match);
    const opponentResponseDelay = aiPlayer
      ? 250 + Math.floor(random() * 1751)
      : 0;
    roundResult.responseDelayMs = Math.max(
      CLASH_FLOW_DURATIONS.actionSubmittedHold,
      opponentResponseDelay
    );
    match.phaseEndsAt =
      match.status === 'active' && match.phase === 'selection'
        ? getSelectionDeadline(roundResult)
        : null;
    recordClashEvent(match, 'round-resolved', {
      round: roundResult.round,
      damageSource: roundResult.damageSource,
      damageType: roundResult.damageType,
      payload: roundResult
    });
    resolvedMatch = cloneResolvedMatch(match);
  }
  return { resolvedMatch, roundResult };
}

async function updateClashSelectionDraft({
  models,
  account,
  matchCode,
  action = null,
  tagTeamSlot = null,
  effectChoice = null,
  now = Date.now,
  selectionContext = null,
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
  if (match.status !== 'active' || match.phase !== 'selection') {
    return { match };
  }
  if (selectionContext && !selectionContextMatches(selectionContext, match)) {
    return { match };
  }
  const requestSelectionContext =
    selectionContext || createSelectionContext(match);
  if (
    requestSelectionContext.phaseEndsAt !== null &&
    requestSelectionContext.phaseEndsAt <= Number(now())
  ) {
    return { match };
  }
  const player = getClashPlayer(match, account);
  if (!player) {
    throw createRequestError(
      'You are not part of that Oling Clash.',
      403,
      'oling_clash_player_required'
    );
  }
  if (player.selection?.round === match.round) return { match };

  const normalizedAction = String(action || '')
    .trim()
    .toLowerCase();
  if (
    normalizedAction &&
    !getAvailableClashActions(match, player).includes(normalizedAction)
  ) {
    throw createRequestError(
      'That action is currently unavailable.',
      409,
      'oling_clash_action_blocked'
    );
  }
  const normalizedTag = validateTagTeamSlot(player, tagTeamSlot, match);
  let normalizedEffectChoice = null;
  if (effectChoice !== null && effectChoice !== undefined) {
    if (!normalizedAction) {
      throw createRequestError(
        'Choose an action before its effect target.',
        400,
        'oling_clash_effect_choice_invalid'
      );
    }
    normalizedEffectChoice = validateEffectChoice(
      player,
      normalizedAction,
      effectChoice,
      match
    );
  }
  player.selectionDraft = {
    round: match.round,
    action: normalizedAction || null,
    tagTeamSlot: normalizedTag,
    effectChoice: normalizedEffectChoice,
    updatedAt: new Date()
  };

  if (typeof models?.OlingClashMatch?.findOneAndUpdate === 'function') {
    const playerFilter = {
      accountId: account._id,
      $or: [
        { selection: null },
        { 'selection.round': { $ne: Number(match.round) } }
      ]
    };
    let atomicUpdate = models.OlingClashMatch.findOneAndUpdate(
      {
        matchCode: match.matchCode,
        gameId: match.gameId,
        status: 'active',
        phase: 'selection',
        round: Number(match.round),
        phaseEndsAt: match.phaseEndsAt || null,
        players: { $elemMatch: playerFilter }
      },
      {
        $set: { 'players.$[player].selectionDraft': player.selectionDraft },
        $inc: { __v: 1 }
      },
      {
        arrayFilters: [{ 'player.accountId': account._id }],
        new: true,
        runValidators: true
      }
    );
    if (typeof atomicUpdate?.exec === 'function')
      atomicUpdate = atomicUpdate.exec();
    const updatedMatch = await atomicUpdate;
    if (updatedMatch) return { match: updatedMatch };
    return {
      match: (await getClashMatch({ models, matchCode })) || match
    };
  }

  try {
    await match.save();
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError && retryCount < 2) {
      return updateClashSelectionDraft({
        models,
        account,
        matchCode,
        action,
        tagTeamSlot,
        effectChoice,
        now,
        selectionContext: requestSelectionContext,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return { match };
}

async function commitClashSelection({
  models,
  account,
  matchCode,
  action,
  tagTeamSlot,
  effectChoice,
  timedOut = false,
  expectedGameId,
  expectedPhaseEndsAt,
  expectedRound,
  preferredAction = null,
  now = Date.now,
  random = Math.random,
  resolveRound = resolveCoreClashRound,
  selectionContext = null,
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
  if (match.status !== 'active' || match.phase !== 'selection') {
    throw createRequestError(
      'That Oling Clash is not accepting actions.',
      409,
      'oling_clash_selection_closed'
    );
  }
  if (selectionContext && !selectionContextMatches(selectionContext, match)) {
    throw createRequestError(
      'That action belongs to an earlier Clash round.',
      409,
      'oling_clash_selection_stale'
    );
  }
  const requestSelectionContext =
    selectionContext || createSelectionContext(match);
  if (
    !timedOut &&
    requestSelectionContext.phaseEndsAt !== null &&
    requestSelectionContext.phaseEndsAt <= Number(now())
  ) {
    throw createRequestError(
      'That Clash round is no longer accepting actions.',
      409,
      'oling_clash_selection_closed'
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
  if (player.selection?.round === match.round) {
    throw createRequestError(
      'Your action for this round is already committed.',
      409,
      'oling_clash_selection_committed'
    );
  }
  if (timedOut) {
    const expectedDeadline = Date.parse(expectedPhaseEndsAt);
    const deadline = parseClashTimestamp(match.phaseEndsAt);
    const normalizedExpectedRound = Number(expectedRound);
    const timeoutContextIsStale =
      String(expectedGameId || '') !== String(match.gameId || '') ||
      !Number.isInteger(normalizedExpectedRound) ||
      normalizedExpectedRound !== Number(match.round) ||
      !Number.isFinite(expectedDeadline) ||
      !Number.isFinite(deadline) ||
      expectedDeadline !== deadline;
    if (timeoutContextIsStale) {
      const error = createRequestError(
        'That timeout belongs to an earlier Clash round.',
        409,
        'oling_clash_timeout_stale'
      );
      error.details = {
        gameId: match.gameId || null,
        phaseEndsAt: match.phaseEndsAt || null,
        round: Number(match.round || 0)
      };
      throw error;
    }
    const currentTime = Number(now());
    if (deadline > currentTime) {
      const error = createRequestError(
        'This Clash round is still accepting player choices.',
        409,
        'oling_clash_timeout_not_reached'
      );
      error.details = { retryAfterMs: Math.ceil(deadline - currentTime) };
      throw error;
    }

    const availableActions = getAvailableClashActions(match, player);
    if (!availableActions.length) {
      throw createRequestError(
        'No Clash actions are currently available.',
        409,
        'oling_clash_no_available_actions'
      );
    }
    const normalizedPreferredAction = String(preferredAction || '')
      .trim()
      .toLowerCase();
    action = availableActions.includes(normalizedPreferredAction)
      ? normalizedPreferredAction
      : pickRandom(availableActions, random);
    effectChoice = createRandomEffectChoice(player, action, match, random);
  }
  const selection = validateSelection(
    player,
    action,
    tagTeamSlot,
    effectChoice,
    match
  );
  const aiPlayer = getAiClashOpponent(match);
  if (aiPlayer && aiPlayer.selection?.round !== match.round) {
    aiPlayer.selection = {
      round: match.round,
      ...chooseAiClashSelection(match, aiPlayer),
      committedAt: new Date()
    };
    aiPlayer.selectionDraft = null;
  }
  player.selection = {
    round: match.round,
    ...selection,
    committedAt: new Date()
  };
  player.selectionDraft = null;

  let archive = null;
  const { resolvedMatch, roundResult } = await resolveReadyRound(match, {
    random,
    resolveRound
  });

  try {
    if (match.status === 'completed') {
      archive = await archiveAndResetClash({
        models,
        match,
        completionStatus: 'completed'
      });
    } else {
      await match.save();
    }
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError && retryCount < 2) {
      return commitClashSelection({
        models,
        account,
        matchCode,
        action,
        tagTeamSlot,
        effectChoice,
        timedOut,
        expectedGameId,
        expectedPhaseEndsAt,
        expectedRound,
        preferredAction,
        now,
        random,
        resolveRound,
        selectionContext: requestSelectionContext,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return { archive, match, resolvedMatch, roundResult };
}

function createExpiredSelection(match, player, random = Math.random) {
  if (player.isAi) return chooseAiClashSelection(match, player, { random });
  const availableActions = getAvailableClashActions(match, player);
  if (!availableActions.length) {
    throw createRequestError(
      'No Clash actions are currently available.',
      409,
      'oling_clash_no_available_actions'
    );
  }
  const draft =
    player.selectionDraft?.round === match.round ? player.selectionDraft : null;
  const action = availableActions.includes(draft?.action)
    ? draft.action
    : pickRandom(availableActions, random);
  let effectChoice = null;
  if (draft?.action === action && draft.effectChoice) {
    try {
      effectChoice = validateEffectChoice(
        player,
        action,
        draft.effectChoice,
        match
      );
    } catch (_error) {
      effectChoice = null;
    }
  }
  if (!effectChoice) {
    effectChoice = createRandomEffectChoice(player, action, match, random);
  }
  let tagTeamSlot = null;
  try {
    tagTeamSlot = validateTagTeamSlot(player, draft?.tagTeamSlot, match);
  } catch (_error) {
    tagTeamSlot = null;
  }
  return validateSelection(player, action, tagTeamSlot, effectChoice, match);
}

async function finalizeExpiredClashSelections({
  models,
  matchCode,
  now = Date.now,
  random = Math.random,
  resolveRound = resolveCoreClashRound,
  retryCount = 0
}) {
  const match = await getClashMatch({ models, matchCode });
  const currentTime = Number(now());
  const deadline = parseClashTimestamp(match?.phaseEndsAt);
  if (
    !match ||
    match.status !== 'active' ||
    match.phase !== 'selection' ||
    !Number.isFinite(currentTime) ||
    !Number.isFinite(deadline) ||
    deadline > currentTime
  ) {
    return { finalized: false, match: match || null };
  }

  let finalized = false;
  match.players.forEach((player) => {
    if (player.selection?.round === match.round) return;
    player.selection = {
      round: match.round,
      ...createExpiredSelection(match, player, random),
      committedAt: new Date(currentTime)
    };
    player.selectionDraft = null;
    finalized = true;
  });
  if (!finalized) return { finalized: false, match };

  let archive = null;
  const { resolvedMatch, roundResult } = await resolveReadyRound(match, {
    random,
    resolveRound
  });
  try {
    if (match.status === 'completed') {
      archive = await archiveAndResetClash({
        models,
        match,
        completionStatus: 'completed'
      });
    } else {
      await match.save();
    }
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError && retryCount < 2) {
      return finalizeExpiredClashSelections({
        models,
        matchCode,
        now,
        random,
        resolveRound,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return {
    archive,
    finalized: true,
    match,
    resolvedMatch,
    roundResult
  };
}

async function chooseClashReplacement({
  models,
  account,
  matchCode,
  teamSlot,
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
  if (match.status !== 'active' || match.phase !== 'replacement') {
    throw createRequestError(
      'That Oling Clash is not waiting for a replacement.',
      409,
      'oling_clash_replacement_closed'
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
  const active = player.team.find(
    (oling) => oling.teamSlot === player.activeTeamSlot
  );
  if (!active?.defeated) {
    throw createRequestError(
      'Your active Oling does not need replacing.',
      409,
      'oling_clash_replacement_not_required'
    );
  }
  const normalizedTeamSlot = Number(teamSlot);
  const replacementOling = player.team.find(
    (oling) =>
      oling.teamSlot === normalizedTeamSlot &&
      oling.teamSlot !== player.activeTeamSlot &&
      !oling.defeated
  );
  if (!Number.isInteger(normalizedTeamSlot) || !replacementOling) {
    throw createRequestError(
      'Choose a living benched Oling to Tag in.',
      400,
      'oling_clash_replacement_invalid'
    );
  }

  const replacement = {
    playerSlot: player.slot,
    previousTeamSlot: player.activeTeamSlot,
    incomingTeamSlot: replacementOling.teamSlot,
    reason: 'defeat-replacement',
    tagEffectsActivate: false
  };
  const replacementRound = match.round;
  player.activeTeamSlot = replacementOling.teamSlot;
  const stillWaiting = match.players.some((candidate) => {
    const candidateActive = candidate.team.find(
      (oling) => oling.teamSlot === candidate.activeTeamSlot
    );
    return (
      candidateActive?.defeated &&
      candidate.team.some((oling) => !oling.defeated)
    );
  });
  if (!stillWaiting) {
    match.round += 1;
    match.phase = 'selection';
    match.phaseEndsAt = getSelectionDeadline();
  }
  recordClashEvent(match, 'replacement-selected', {
    accountId: account._id,
    actorSlot: player.slot,
    round: replacementRound,
    payload: replacement
  });

  try {
    await match.save();
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError && retryCount < 2) {
      return chooseClashReplacement({
        models,
        account,
        matchCode,
        teamSlot,
        retryCount: retryCount + 1
      });
    }
    throw error;
  }
  return { match, replacement };
}

module.exports = {
  chooseClashReplacement,
  commitClashSelection,
  createExpiredSelection,
  cloneResolvedMatch,
  createRandomEffectChoice,
  finalizeExpiredClashSelections,
  getAvailableClashActions,
  getActionAbility,
  isActionBlocked,
  updateClashSelectionDraft,
  validateEffectChoice,
  validateSelection,
  validateTagTeamSlot
};
