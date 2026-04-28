const {
  createValidationError,
  isPlainObject
} = require('./party-requests-shared');

function assertOptionalEnum(value, fieldName, allowedValues) {
  if (value === undefined || value === null) {
    return;
  }

  if (!allowedValues.includes(value)) {
    throw createValidationError({
      message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      code: 'invalid_enum_field',
      details: { field: fieldName, allowedValues }
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

function assertRequiredString(value, fieldName, options) {
  assertOptionalString(value, fieldName, options);
  if (!value) {
    throw createValidationError({
      message: `${fieldName} is required`,
      code: 'missing_required_field',
      details: { field: fieldName }
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

function assertOptionalVoteOption(value, fieldName, { maxLength = 200 } = {}) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'boolean') {
    return;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    if (value.length > maxLength) {
      throw createValidationError({
        message: `${fieldName} is too long`,
        code: 'vote_option_too_long',
        details: { field: fieldName, maxLength }
      });
    }

    return;
  }

  throw createValidationError({
    message: `${fieldName} must be a boolean, finite number, or non-empty string`,
    code: 'invalid_vote_option_field',
    details: { field: fieldName }
  });
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

function assertOptionalPlainObject(value, fieldName) {
  if (value === undefined || value === null) {
    return;
  }

  if (!isPlainObject(value)) {
    throw createValidationError({
      message: `${fieldName} must be an object`,
      code: 'invalid_object_field',
      details: { field: fieldName }
    });
  }
}

function assertOptionalStringArray(value, fieldName) {
  if (value === undefined || value === null) {
    return;
  }

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    throw createValidationError({
      message: `${fieldName} must be an array of strings`,
      code: 'invalid_string_array_field',
      details: { field: fieldName }
    });
  }
}

function assertOptionalObjectArray(value, fieldName) {
  if (value === undefined || value === null) {
    return;
  }

  if (!Array.isArray(value) || value.some((entry) => !isPlainObject(entry))) {
    throw createValidationError({
      message: `${fieldName} must be an array of objects`,
      code: 'invalid_object_array_field',
      details: { field: fieldName }
    });
  }
}

function validateSharedPayloadFields(payload = {}) {
  assertOptionalString(payload.socketId, 'payload.socketId', {
    maxLength: 200
  });
  assertOptionalBoolean(payload.byPassHost, 'payload.byPassHost');
  assertOptionalBoolean(
    payload.bypassPlayerRestrictions,
    'payload.bypassPlayerRestrictions'
  );
  assertOptionalFiniteNumber(payload.timer, 'payload.timer');
  assertOptionalFiniteNumber(payload.roundTimer, 'payload.roundTimer');
  assertOptionalFiniteNumber(payload.phaseTimer, 'payload.phaseTimer');
  assertOptionalFiniteNumber(
    payload.nextRoundTimerDurationMs,
    'payload.nextRoundTimerDurationMs'
  );
  assertOptionalFiniteNumber(payload.incrementScore, 'payload.incrementScore');
  assertOptionalFiniteNumber(payload.playerIndex, 'payload.playerIndex');
  assertOptionalFiniteNumber(payload.roundsLimit, 'payload.roundsLimit');
  assertOptionalFiniteNumber(payload.expectedRound, 'payload.expectedRound');
  assertOptionalFiniteNumber(
    payload.expectedRoundPlayerTurn,
    'payload.expectedRoundPlayerTurn'
  );
  assertOptionalFiniteNumber(
    payload.alternativeQuestionIndex,
    'payload.alternativeQuestionIndex'
  );
  assertOptionalBoolean(payload.nextPlayer, 'payload.nextPlayer');
  assertOptionalBoolean(payload.force, 'payload.force');
  assertOptionalBoolean(payload.hover, 'payload.hover');
  assertOptionalBoolean(payload.touchState, 'payload.touchState');
  assertOptionalBoolean(payload.updateUsersReady, 'payload.updateUsersReady');
  assertOptionalBoolean(
    payload.updateUsersConfirmation,
    'payload.updateUsersConfirmation'
  );
  assertOptionalVoteOption(payload.option, 'payload.option');
  assertOptionalBoolean(payload.bool, 'payload.bool');
  assertOptionalBoolean(payload.userConfirmation, 'payload.userConfirmation');
  assertOptionalBoolean(payload.userReady, 'payload.userReady');
  assertOptionalBoolean(payload.matchedFace, 'payload.matchedFace');
  assertOptionalString(payload.instruction, 'payload.instruction');
  assertOptionalString(payload.sendInstruction, 'payload.sendInstruction');
  assertOptionalString(payload.setInstruction, 'payload.setInstruction');
  assertOptionalString(payload.userInstruction, 'payload.userInstruction');
  assertOptionalString(payload.reason, 'payload.reason');
  assertOptionalString(payload.selectedDeviceId, 'payload.selectedDeviceId', {
    maxLength: 120
  });
  assertOptionalString(payload.targetId, 'payload.targetId', {
    maxLength: 120
  });
  assertOptionalString(payload.punishmentType, 'payload.punishmentType', {
    maxLength: 120
  });
  assertOptionalString(payload.questionType, 'payload.questionType', {
    maxLength: 20
  });
  assertOptionalString(payload.resetInstruction, 'payload.resetInstruction', {
    maxLength: 120
  });
  assertOptionalString(
    payload.resetGamemodeInstruction,
    'payload.resetGamemodeInstruction',
    {
      maxLength: 120
    }
  );
  assertOptionalString(payload.killedId, 'payload.killedId', {
    maxLength: 120
  });
  assertOptionalString(payload.votedOutId, 'payload.votedOutId', {
    maxLength: 120
  });
  assertOptionalString(payload.completionReason, 'payload.completionReason', {
    maxLength: 120
  });
  assertOptionalStringArray(payload.tiedIds, 'payload.tiedIds');
  assertOptionalStringArray(payload.shuffledRoles, 'payload.shuffledRoles');
  assertOptionalPlainObject(payload.configPatch, 'payload.configPatch');
  assertOptionalPlainObject(payload.statePatch, 'payload.statePatch');
  assertOptionalPlainObject(payload.deckPatch, 'payload.deckPatch');
  assertOptionalObjectArray(payload.playerUpdates, 'payload.playerUpdates');
}

const ACTION_VALIDATORS = {
  'start-game': (payload) => {
    validateSharedPayloadFields(payload);
  },
  'send-instruction': (payload) => {
    validateSharedPayloadFields(payload);
  },
  'end-game': validateSharedPayloadFields,
  'set-user-confirmation': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.selectedDeviceId, 'payload.selectedDeviceId', {
      maxLength: 120
    });
  },
  'set-user-bool': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.selectedDeviceId, 'payload.selectedDeviceId', {
      maxLength: 120
    });
  },
  'set-vote': validateSharedPayloadFields,
  'set-bool-vote': validateSharedPayloadFields,
  'reset-question': validateSharedPayloadFields,
  'party-restart': validateSharedPayloadFields,
  'sync-party-state': (payload) => {
    validateSharedPayloadFields(payload);
    if (
      payload.configPatch === undefined &&
      payload.statePatch === undefined &&
      payload.deckPatch === undefined &&
      payload.playerUpdates === undefined
    ) {
      throw createValidationError({
        message:
          'payload must include configPatch, statePatch, deckPatch, or playerUpdates',
        code: 'empty_sync_party_state_payload'
      });
    }
  },
  'most-likely-to-resolve-vote-results': validateSharedPayloadFields,
  'most-likely-to-resolve-tiebreaker': (payload) => {
    validateSharedPayloadFields(payload);
    assertOptionalStringArray(payload.tiedIds, 'payload.tiedIds');
  },
  'never-have-i-ever-resolve-vote-results': validateSharedPayloadFields,
  'never-have-i-ever-resolve-drink-wheel': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'never-have-i-ever-complete-punishment': validateSharedPayloadFields,
  'truth-or-dare-select-question-type': (payload) => {
    validateSharedPayloadFields(payload);
    assertOptionalEnum(payload.questionType, 'payload.questionType', [
      'truth',
      'dare'
    ]);
  },
  'truth-or-dare-pass-question': validateSharedPayloadFields,
  'truth-or-dare-select-punishment': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'truth-or-dare-resolve-drink-wheel': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'truth-or-dare-complete-punishment': validateSharedPayloadFields,
  'truth-or-dare-handle-card-timeout': validateSharedPayloadFields,
  'truth-or-dare-handle-punishment-timeout': validateSharedPayloadFields,
  'truth-or-dare-reset-round': validateSharedPayloadFields,
  'imposter-advance-answer-turn': validateSharedPayloadFields,
  'imposter-resolve-vote-outcome': validateSharedPayloadFields,
  'imposter-select-punishment': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'imposter-resolve-drink-wheel': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'imposter-complete-punishment': validateSharedPayloadFields,
  'imposter-reset-round': validateSharedPayloadFields,
  'mafia-start-game': (payload) => {
    validateSharedPayloadFields(payload);
    if (
      !Array.isArray(payload.shuffledRoles) ||
      payload.shuffledRoles.length === 0
    ) {
      throw createValidationError({
        message: 'payload.shuffledRoles must be a non-empty array of strings',
        code: 'missing_shuffled_roles',
        details: { field: 'payload.shuffledRoles' }
      });
    }
    assertOptionalStringArray(payload.shuffledRoles, 'payload.shuffledRoles');
  },
  'mafia-resolve-night': validateSharedPayloadFields,
  'mafia-finish-player-killed': validateSharedPayloadFields,
  'mafia-resolve-day-vote': validateSharedPayloadFields,
  'mafia-finish-town-vote': validateSharedPayloadFields,
  'would-you-rather-resolve-vote-results': validateSharedPayloadFields,
  'would-you-rather-resolve-drink-wheel': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'would-you-rather-complete-punishment': validateSharedPayloadFields,
  'would-you-rather-handle-phase-timeout': validateSharedPayloadFields,
  'paranoia-select-target': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.targetId, 'payload.targetId', {
      maxLength: 120
    });
  },
  'paranoia-handle-card-timeout': validateSharedPayloadFields,
  'paranoia-select-punishment': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'paranoia-resolve-drink-wheel': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'paranoia-resolve-coin-flip': validateSharedPayloadFields,
  'paranoia-handle-reveal-timeout': validateSharedPayloadFields,
  'paranoia-begin-punishment-confirmation': validateSharedPayloadFields,
  'paranoia-submit-punishment-vote': validateSharedPayloadFields,
  'paranoia-pass-punishment': validateSharedPayloadFields,
  'paranoia-handle-phase-timeout': validateSharedPayloadFields,
  'most-likely-to-advance-from-results': validateSharedPayloadFields,
  'most-likely-to-select-punishment': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'most-likely-to-resolve-drink-wheel': (payload) => {
    validateSharedPayloadFields(payload);
    assertRequiredString(payload.punishmentType, 'payload.punishmentType', {
      maxLength: 120
    });
  },
  'most-likely-to-complete-punishment': validateSharedPayloadFields,
  'most-likely-to-handle-phase-timeout': validateSharedPayloadFields
};

function validatePartyActionPayload(action, payload) {
  const validator = ACTION_VALIDATORS[action];

  if (!validator) {
    throw createValidationError({
      message: `Unknown party action: ${action}`,
      code: 'invalid_party_action',
      details: { field: 'action', action }
    });
  }

  validator(payload || {});
}

module.exports = {
  validatePartyActionPayload
};
