const { serializeBattleMatch } = require('./match-view');
const {
  MAX_EMBEDDED_EVENTS
} = require('../../../models/olings/oling-battle-match-schema');

async function recordBattleEvent(
  models,
  match,
  type,
  accountId = null,
  payload = {}
) {
  void models;
  if (!match) throw new TypeError('An Oling Battle match is required.');
  if (!Array.isArray(match.events)) match.events = [];
  if (match.events.length >= MAX_EMBEDDED_EVENTS) {
    const error = new Error('That Oling Battle event log is full.');
    error.status = 409;
    error.code = 'oling_battle_event_limit_reached';
    throw error;
  }

  const actor = accountId
    ? match.players?.find(
        (player) => String(player.accountId) === String(accountId)
      )
    : null;
  const event = {
    actorAccountId: accountId || null,
    actorSlot: actor?.slot || null,
    payload,
    sequence: Number(match.events.at(-1)?.sequence || 0) + 1,
    type
  };
  match.events.push(event);
  return match.events.at(-1);
}

function emitBattleUpdate(runtime, match, eventType = 'oling-battle:state') {
  const serialized = serializeBattleMatch(match);
  runtime?.io?.to?.(match.matchCode)?.emit?.(eventType, serialized);
  return serialized;
}

module.exports = { emitBattleUpdate, recordBattleEvent };
