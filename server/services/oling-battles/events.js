const { serializeBattleMatch } = require('./match-view');

async function recordBattleEvent(
  models,
  match,
  type,
  accountId = null,
  payload = {}
) {
  const { OlingBattleEvent } = models;
  const previousEvent = await OlingBattleEvent.findOne({ matchId: match._id })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  const sequence = Number(previousEvent?.sequence || 0) + 1;

  return OlingBattleEvent.create({
    accountId,
    matchCode: match.matchCode,
    matchId: match._id,
    payload,
    sequence,
    type
  });
}

function emitBattleUpdate(runtime, match, eventType = 'oling-battle:state') {
  const serialized = serializeBattleMatch(match);
  runtime?.io?.to?.(match.matchCode)?.emit?.(eventType, serialized);
  return serialized;
}

module.exports = { emitBattleUpdate, recordBattleEvent };
