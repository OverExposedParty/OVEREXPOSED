const {
  RequestValidationError,
  createValidationError,
  isPlainObject
} = require('./party-requests-shared');
const { validatePartyActionPayload } = require('./party-action-payloads');

const PARTY_ID_PATTERN = /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/;
const ACTION_NAME_PATTERN = /^[A-Za-z0-9_:-]{1,80}$/;

function assertPlainObject(value, fieldName, code = 'invalid_request_body') {
  if (!isPlainObject(value)) {
    throw createValidationError({
      message: `${fieldName} must be an object`,
      code,
      details: { field: fieldName }
    });
  }
}

function assertOptionalString(value, fieldName, { maxLength = 200 } = {}) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw createValidationError({
      message: `${fieldName} must be a non-empty string`,
      code: 'invalid_string_field',
      details: { field: fieldName }
    });
  }

  if (value.length > maxLength) {
    throw createValidationError({
      message: `${fieldName} is too long`,
      code: 'string_field_too_long',
      details: { field: fieldName, maxLength }
    });
  }
}

function assertOptionalBoolean(value, fieldName) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'boolean') {
    throw createValidationError({
      message: `${fieldName} must be a boolean`,
      code: 'invalid_boolean_field',
      details: { field: fieldName }
    });
  }
}

function assertOptionalFiniteNumber(value, fieldName) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw createValidationError({
      message: `${fieldName} must be a finite number`,
      code: 'invalid_number_field',
      details: { field: fieldName }
    });
  }
}

function assertPartyId(partyId, fieldName = 'partyId') {
  if (typeof partyId !== 'string' || !PARTY_ID_PATTERN.test(partyId.trim())) {
    throw createValidationError({
      message: `${fieldName} must match XXX-XXX`,
      code: 'invalid_party_id',
      details: { field: fieldName }
    });
  }
}

function assertActionName(action) {
  if (typeof action !== 'string' || !ACTION_NAME_PATTERN.test(action.trim())) {
    throw createValidationError({
      message: 'action must be a valid action name',
      code: 'invalid_party_action',
      details: { field: 'action' }
    });
  }
}

function assertPlayerArray(players, fieldName = 'players') {
  if (!Array.isArray(players)) {
    throw createValidationError({
      message: `${fieldName} must be an array`,
      code: 'invalid_players',
      details: { field: fieldName }
    });
  }

  players.forEach((player, index) => {
    if (!isPlainObject(player)) {
      throw createValidationError({
        message: `${fieldName}[${index}] must be an object`,
        code: 'invalid_player_entry',
        details: { field: `${fieldName}[${index}]` }
      });
    }
  });
}

function assertPartyUpdateBody(body, fields) {
  assertPlainObject(body, 'body');
  assertPartyId(body.partyId);

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      continue;
    }

    const value = body[field];

    if (field === 'players') {
      assertPlayerArray(value, field);
      continue;
    }

    if (!isPlainObject(value)) {
      throw createValidationError({
        message: `${field} must be an object`,
        code: 'invalid_party_update_field',
        details: { field }
      });
    }
  }

  if (body.bypassPlayerRestrictions !== undefined) {
    assertOptionalBoolean(
      body.bypassPlayerRestrictions,
      'bypassPlayerRestrictions'
    );
  }
}

function assertPartyActionBody(body) {
  assertPlainObject(body, 'body');
  assertPartyId(body.partyId);
  assertActionName(body.action);

  if (body.actorId !== undefined && body.actorId !== null) {
    assertOptionalString(body.actorId, 'actorId', { maxLength: 120 });
  }

  if (body.payload === undefined) {
    validatePartyActionPayload(body.action, {});
    return;
  }

  assertPlainObject(body.payload, 'payload', 'invalid_party_action_payload');
  validatePartyActionPayload(body.action, body.payload);
}

function assertJoinPlayerBody(body) {
  assertPlainObject(body, 'body');
  assertPartyId(body.partyId);

  const computerId =
    body.computerId ?? body.newComputerId ?? body.identity?.computerId;
  assertOptionalString(computerId, 'computerId', { maxLength: 120 });

  if (!computerId) {
    throw createValidationError({
      message: 'computerId is required',
      code: 'missing_computer_id',
      details: { field: 'computerId' }
    });
  }

  if (body.identity !== undefined) {
    assertPlainObject(body.identity, 'identity', 'invalid_player_identity');
  }

  if (body.connection !== undefined) {
    assertPlainObject(
      body.connection,
      'connection',
      'invalid_player_connection'
    );
  }

  if (body.state !== undefined) {
    assertPlainObject(body.state, 'state', 'invalid_player_state');
  }

  assertOptionalString(
    body.username ?? body.newUsername ?? body.identity?.username,
    'username',
    { maxLength: 80 }
  );
  assertOptionalString(
    body.userIcon ?? body.newUserIcon ?? body.identity?.userIcon,
    'userIcon',
    { maxLength: 200 }
  );
  assertOptionalString(
    body.socketId ?? body.newUserSocketId ?? body.connection?.socketId,
    'socketId',
    { maxLength: 200 }
  );
  assertOptionalBoolean(
    body.isReady ?? body.newUserReady ?? body.state?.isReady,
    'isReady'
  );
  assertOptionalBoolean(
    body.hasConfirmed ?? body.newUserConfirmation ?? body.state?.hasConfirmed,
    'hasConfirmed'
  );
  assertOptionalFiniteNumber(
    body.score ?? body.newScore ?? body.state?.score,
    'score'
  );
}

function assertPatchPlayerBody(body) {
  assertPlainObject(body, 'body');
  assertPartyId(body.partyId);

  const computerId =
    body.computerId ??
    body.newComputerId ??
    body.identity?.computerId ??
    body.identityPatch?.computerId;
  assertOptionalString(computerId, 'computerId', { maxLength: 120 });

  if (!computerId) {
    throw createValidationError({
      message: 'computerId is required',
      code: 'missing_computer_id',
      details: { field: 'computerId' }
    });
  }

  [
    ['identity', body.identity],
    ['identityPatch', body.identityPatch],
    ['connection', body.connection],
    ['connectionPatch', body.connectionPatch],
    ['state', body.state],
    ['statePatch', body.statePatch],
    ['player', body.player],
    ['playerPatch', body.playerPatch]
  ].forEach(([fieldName, value]) => {
    if (value !== undefined) {
      assertPlainObject(value, fieldName, 'invalid_player_patch');
    }
  });

  assertOptionalString(body.username ?? body.newUsername, 'username', {
    maxLength: 80
  });
  assertOptionalString(body.userIcon ?? body.newUserIcon, 'userIcon', {
    maxLength: 200
  });
  assertOptionalString(body.socketId ?? body.newUserSocketId, 'socketId', {
    maxLength: 200
  });
  assertOptionalBoolean(body.isReady ?? body.newUserReady, 'isReady');
  assertOptionalBoolean(
    body.hasConfirmed ?? body.newUserConfirmation,
    'hasConfirmed'
  );
  assertOptionalFiniteNumber(body.score ?? body.newScore, 'score');
}

function parseBeaconBody(body) {
  if (typeof body !== 'string') {
    assertPlainObject(body, 'body');
    return body;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw createValidationError({
      message: 'Invalid JSON from beacon',
      code: 'invalid_beacon_json'
    });
  }

  assertPlainObject(parsed, 'body');
  return parsed;
}

function assertRemovePlayerBody(body) {
  assertPlainObject(body, 'body');
  assertPartyId(body.partyId);
  assertOptionalString(body.computerIdToRemove, 'computerIdToRemove', {
    maxLength: 120
  });
  assertOptionalString(
    body.actorComputerId ?? body.actorId,
    'actorComputerId',
    {
      maxLength: 120
    }
  );
  assertOptionalString(body.actorSocketId ?? body.socketId, 'actorSocketId', {
    maxLength: 200
  });

  if (!body.computerIdToRemove) {
    throw createValidationError({
      message: 'computerIdToRemove is required',
      code: 'missing_computer_id_to_remove',
      details: { field: 'computerIdToRemove' }
    });
  }

  if (!(body.actorComputerId ?? body.actorId)) {
    throw createValidationError({
      message: 'actorComputerId is required to remove a player from the party',
      code: 'missing_actor_computer_id',
      status: 403,
      details: { field: 'actorComputerId' }
    });
  }
}

function assertDisconnectPlayerBody(body) {
  assertPlainObject(body, 'body');

  const actualPartyId = body.partyId ?? body.partyCode;
  assertPartyId(actualPartyId, body.partyId ? 'partyId' : 'partyCode');
  assertOptionalString(body.computerId, 'computerId', { maxLength: 120 });
  assertOptionalString(body.socketId ?? body.actorSocketId, 'socketId', {
    maxLength: 200
  });

  if (!body.computerId) {
    throw createValidationError({
      message: 'computerId is required',
      code: 'missing_computer_id',
      details: { field: 'computerId' }
    });
  }
}

module.exports = {
  ACTION_NAME_PATTERN,
  PARTY_ID_PATTERN,
  RequestValidationError,
  assertDisconnectPlayerBody,
  assertJoinPlayerBody,
  assertPartyActionBody,
  assertPartyId,
  assertPartyUpdateBody,
  assertPatchPlayerBody,
  assertRemovePlayerBody,
  createValidationError,
  isPlainObject,
  parseBeaconBody
};
