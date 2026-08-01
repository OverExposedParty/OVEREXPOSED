const {
  getAvailabilityState,
  normalizeStoredAvailability,
  parseAvailabilityInput,
  serializeAvailability
} = require('../../services/game-content-availability');

function createPartyContentContext(context) {
  const {
    formatOePanelDateTime,
    formatPartyGameLabel,
    normalizePackHexColour,
    parseBooleanLabel,
    parseNullableNumber,
    parseRestrictionList
  } = context;

  function parseCompositePartyContentKey(value) {
    const keyParts = String(value || '').split(':');
    if (keyParts.length < 2) return null;

    const gameType = keyParts.shift().trim();
    const itemKey = keyParts.join(':').trim();
    if (!gameType || !itemKey) return null;

    return { gameType, itemKey };
  }

  function addAvailabilityUpdate(update, body, currentAvailability) {
    const parsed = parseAvailabilityInput(body, currentAvailability);
    if (parsed.error) return parsed.error;
    if (parsed.availability) update.availability = parsed.availability;
    return null;
  }

  function createGamePackUpdatePayload(body, currentPack = {}) {
    const update = {};

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(body.title || '').trim();
      if (!title) {
        return { error: 'Pack title is required.' };
      }
      update.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      const description = String(body.description || '').trim();
      if (description.length > 500) {
        return { error: 'Pack description must be 500 characters or fewer.' };
      }
      update.description = description;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
      if (!['draft', 'published', 'archived'].includes(status)) {
        return { error: 'Pack status must be draft, published, or archived.' };
      }
      update.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      const enabled = parseBooleanLabel(body.active);
      if (enabled === null) {
        return { error: 'Pack active must be yes or no.' };
      }
      update.enabled = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'difficulty')) {
      update.difficulty = String(body.difficulty || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'restriction')) {
      update.restriction = String(body.restriction || '').trim() || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'colour')) {
      const { colour, error } = normalizePackHexColour(
        body.colour,
        'var(--primarypagecolour)',
        'Pack colour'
      );
      if (error) return { error };
      update['assets.colour'] = colour;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'secondaryColour')) {
      const { colour, error } = normalizePackHexColour(
        body.secondaryColour,
        'var(--secondarypagecolour)',
        'Pack secondary colour'
      );
      if (error) return { error };
      update['assets.secondaryColour'] = colour;
    }

    const availabilityError = addAvailabilityUpdate(
      update,
      body,
      currentPack.availability
    );
    if (availabilityError) return { error: availabilityError };

    return { update };
  }

  function createGamePackCreatePayload(body) {
    const gameType = String(body.gameType || '').trim();
    const slug = String(body.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const title = String(body.title || '').trim();

    if (!gameType) return { error: 'Gamemode is required.' };
    if (!slug) return { error: 'Pack slug is required.' };
    if (!title) return { error: 'Pack title is required.' };

    const status = String(body.status || 'published')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (!['draft', 'published', 'archived'].includes(status)) {
      return { error: 'Pack status must be draft, published, or archived.' };
    }

    const enabled = parseBooleanLabel(body.active || 'no');
    if (enabled === null) return { error: 'Pack active must be yes or no.' };

    const primaryColour = normalizePackHexColour(
      body.colour,
      'var(--primarypagecolour)',
      'Pack colour'
    );
    if (primaryColour.error) return { error: primaryColour.error };

    const secondaryColour = normalizePackHexColour(
      body.secondaryColour,
      'var(--secondarypagecolour)',
      'Pack secondary colour'
    );
    if (secondaryColour.error) return { error: secondaryColour.error };

    const questions = Array.isArray(body.questions)
      ? body.questions
          .map((question) =>
            typeof question === 'string' ? { question } : question
          )
          .map((question) => ({
            question: String(question?.question || '').trim(),
            type: ['truth', 'dare'].includes(question?.type)
              ? question.type
              : null,
            alternatives: Array.isArray(question?.alternatives)
              ? question.alternatives
                  .map((alternative) => String(alternative || '').trim())
                  .filter(Boolean)
              : [],
            punishment: question?.punishment
              ? String(question.punishment).trim()
              : null
          }))
          .filter((question) => question.question)
      : [];
    const parsedAvailability = parseAvailabilityInput(body, {
      mode: 'always'
    });
    if (parsedAvailability.error) return { error: parsedAvailability.error };

    return {
      pack: {
        gameType,
        slug,
        key: `${gameType}-${slug}`,
        title,
        enabled,
        status,
        availability:
          parsedAvailability.availability ||
          normalizeStoredAvailability({ mode: 'always' }),
        difficulty: String(body.difficulty || '').trim(),
        restriction: String(body.restriction || '').trim() || null,
        assets: {
          colour: primaryColour.colour,
          secondaryColour: secondaryColour.colour
        },
        questions
      }
    };
  }

  function createGameRuleUpdatePayload(body, currentRule = {}) {
    const update = {};

    if (Object.prototype.hasOwnProperty.call(body, 'rule')) {
      const title = String(body.rule || '').trim();
      if (!title) {
        return { error: 'Rule title is required.' };
      }
      update.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      const description = String(body.description || '').trim();
      if (description.length > 500) {
        return { error: 'Rule description must be 500 characters or fewer.' };
      }
      update.description = description;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
      if (!['draft', 'published', 'archived'].includes(status)) {
        return { error: 'Rule status must be draft, published, or archived.' };
      }
      update.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      const enabled = parseBooleanLabel(body.active);
      if (enabled === null) {
        return { error: 'Rule active must be yes or no.' };
      }
      update.enabled = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'buttonType')) {
      const buttonType = String(body.buttonType || '').trim();
      if (!buttonType) {
        return { error: 'Button type is required.' };
      }
      update.buttonType = buttonType;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'restriction')) {
      update.restriction = parseRestrictionList(body.restriction);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'requiredSetting')) {
      update.requiredSetting =
        String(body.requiredSetting || '').trim() || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'designation')) {
      update.designation = String(body.designation || '').trim() || null;
    }

    [
      ['initialValue', 'initialValue'],
      ['incrementValue', 'incrementValue'],
      ['minimumValue', 'minimumValue'],
      ['maximumValue', 'maximumValue']
    ].forEach(([inputKey, updateKey]) => {
      if (!Object.prototype.hasOwnProperty.call(body, inputKey)) return;
      update[updateKey] = parseNullableNumber(body[inputKey]);
    });

    if (
      Object.values(update).some(
        (value) => typeof value === 'number' && Number.isNaN(value)
      )
    ) {
      return { error: 'Rule number fields must be valid numbers or blank.' };
    }

    if (Object.prototype.hasOwnProperty.call(body, 'colour')) {
      update.colour = String(body.colour || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'secondaryColour')) {
      update.secondaryColour = String(body.secondaryColour || '').trim();
    }

    const availabilityError = addAvailabilityUpdate(
      update,
      body,
      currentRule.availability
    );
    if (availabilityError) return { error: availabilityError };

    return { update };
  }

  function createGameRoleUpdatePayload(body, currentRole = {}) {
    const update = {};

    if (Object.prototype.hasOwnProperty.call(body, 'role')) {
      const title = String(body.role || '').trim();
      if (!title) return { error: 'Role title is required.' };
      update.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      const description = String(body.description || '').trim();
      if (description.length > 500) {
        return { error: 'Role description must be 500 characters or fewer.' };
      }
      update.description = description || null;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'faction')) {
      const faction = String(body.faction || '')
        .trim()
        .toLowerCase();
      if (!['civilian', 'mafioso', 'neutral'].includes(faction)) {
        return {
          error: 'Role faction must be civilian, mafioso, or neutral.'
        };
      }
      update.faction = faction;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = String(body.status || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
      if (!['draft', 'published', 'archived'].includes(status)) {
        return { error: 'Role status must be draft, published, or archived.' };
      }
      update.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      const enabled = parseBooleanLabel(body.active);
      if (enabled === null) {
        return { error: 'Role active must be yes or no.' };
      }
      update.enabled = enabled;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'fillRemaining')) {
      const fillRemaining = parseBooleanLabel(body.fillRemaining);
      if (fillRemaining === null) {
        return { error: 'Role fill remaining must be yes or no.' };
      }
      update['selection.fillRemaining'] = fillRemaining;
    }

    [
      ['defaultCount', 'selection.defaultCount', 0],
      ['increment', 'selection.increment', 1],
      ['minimum', 'selection.minimum', 0],
      ['maximum', 'selection.maximum', 0],
      ['sortOrder', 'sortOrder', null]
    ].forEach(([inputKey, updateKey, minimum]) => {
      if (!Object.prototype.hasOwnProperty.call(body, inputKey)) return;
      const number = Number(String(body[inputKey] ?? '').trim());
      if (!Number.isInteger(number) || (minimum !== null && number < minimum)) {
        update[updateKey] = NaN;
        return;
      }
      update[updateKey] = number;
    });

    if (
      Object.values(update).some(
        (value) => typeof value === 'number' && Number.isNaN(value)
      )
    ) {
      return {
        error:
          'Role count, increment, range, and sort fields must be valid integers.'
      };
    }

    if (Object.prototype.hasOwnProperty.call(body, 'colour')) {
      update['assets.colour'] = String(body.colour || '').trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'secondaryColour')) {
      update['assets.secondaryColour'] = String(
        body.secondaryColour || ''
      ).trim();
    }

    const availabilityError = addAvailabilityUpdate(
      update,
      body,
      currentRole.availability
    );
    if (availabilityError) return { error: availabilityError };

    return { update };
  }

  function serializeAvailabilityForPanel(content) {
    const availability = serializeAvailability(content.availability);
    return {
      availabilityMode: availability.mode,
      availabilityState: formatPartyGameLabel(getAvailabilityState(content)),
      availabilityTimeZone: availability.timeZone,
      availableFrom: availability.availableFrom || '-',
      availableUntil: availability.availableUntil || '-'
    };
  }

  function serializePartyPackForPanel(pack) {
    const questionCount = Array.isArray(pack.questions)
      ? pack.questions.length
      : 0;

    const availability = serializeAvailabilityForPanel(pack);
    return {
      key: `${pack.gameType}:${pack.slug}`,
      title: pack.title || formatPartyGameLabel(pack.slug),
      slug: pack.slug || '-',
      packKey: pack.key || '-',
      gamemode: formatPartyGameLabel(pack.gameType),
      status: formatPartyGameLabel(pack.status),
      active: pack.enabled ? 'Yes' : 'No',
      description: pack.description || '',
      difficulty: pack.difficulty || '-',
      restriction: pack.restriction || '-',
      questionCount: String(questionCount),
      ...availability,
      updatedAt: formatOePanelDateTime(pack.updatedAt),
      details: {
        title: pack.title || formatPartyGameLabel(pack.slug),
        slug: pack.slug || '-',
        packKey: pack.key || '-',
        gamemode: formatPartyGameLabel(pack.gameType),
        status: formatPartyGameLabel(pack.status),
        active: pack.enabled ? 'Yes' : 'No',
        description: pack.description || '',
        difficulty: pack.difficulty || '-',
        restriction: pack.restriction || '-',
        questionCount: String(questionCount),
        ...availability,
        updatedAt: formatOePanelDateTime(pack.updatedAt),
        colour: pack.assets?.colour || '-',
        secondaryColour: pack.assets?.secondaryColour || '-'
      }
    };
  }

  function serializePartyRuleForPanel(rule) {
    const restrictions = Array.isArray(rule.restriction)
      ? rule.restriction.join(', ')
      : rule.restriction || '-';

    const availability = serializeAvailabilityForPanel(rule);
    return {
      key: `${rule.gameType}:${rule.key}`,
      rule: rule.title || formatPartyGameLabel(rule.key),
      ruleKey: rule.key || '-',
      gamemode: formatPartyGameLabel(rule.gameType),
      status: formatPartyGameLabel(rule.status),
      active: rule.enabled ? 'Yes' : 'No',
      description: rule.description || '',
      buttonType: formatPartyGameLabel(rule.buttonType),
      restriction: restrictions || '-',
      requiredSetting: rule.requiredSetting || '-',
      colour: rule.colour || '-',
      secondaryColour: rule.secondaryColour || '-',
      designation: rule.designation || '-',
      initialValue:
        rule.initialValue === null || rule.initialValue === undefined
          ? '-'
          : String(rule.initialValue),
      incrementValue:
        rule.incrementValue === null || rule.incrementValue === undefined
          ? '-'
          : String(rule.incrementValue),
      minimumValue:
        rule.minimumValue === null || rule.minimumValue === undefined
          ? '-'
          : String(rule.minimumValue),
      maximumValue:
        rule.maximumValue === null || rule.maximumValue === undefined
          ? '-'
          : String(rule.maximumValue),
      ...availability,
      updatedAt: formatOePanelDateTime(rule.updatedAt),
      details: {
        rule: rule.title || formatPartyGameLabel(rule.key),
        ruleKey: rule.key || '-',
        gamemode: formatPartyGameLabel(rule.gameType),
        status: formatPartyGameLabel(rule.status),
        active: rule.enabled ? 'Yes' : 'No',
        description: rule.description || '',
        buttonType: formatPartyGameLabel(rule.buttonType),
        restriction: restrictions || '-',
        requiredSetting: rule.requiredSetting || '-',
        colour: rule.colour || '-',
        secondaryColour: rule.secondaryColour || '-',
        designation: rule.designation || '-',
        initialValue:
          rule.initialValue === null || rule.initialValue === undefined
            ? '-'
            : String(rule.initialValue),
        incrementValue:
          rule.incrementValue === null || rule.incrementValue === undefined
            ? '-'
            : String(rule.incrementValue),
        minimumValue:
          rule.minimumValue === null || rule.minimumValue === undefined
            ? '-'
            : String(rule.minimumValue),
        maximumValue:
          rule.maximumValue === null || rule.maximumValue === undefined
            ? '-'
            : String(rule.maximumValue),
        ...availability,
        updatedAt: formatOePanelDateTime(rule.updatedAt)
      }
    };
  }

  function serializePartyRoleForPanel(role) {
    const selection = role.selection || {};
    const assets = role.assets || {};
    const serializeNumber = (value) =>
      value === null || value === undefined ? '-' : String(value);

    const availability = serializeAvailabilityForPanel(role);
    return {
      key: `${role.gameType}:${role.key}`,
      role: role.title || formatPartyGameLabel(role.key),
      roleKey: role.key || '-',
      gamemode: formatPartyGameLabel(role.gameType),
      faction: formatPartyGameLabel(role.faction),
      status: formatPartyGameLabel(role.status),
      active: role.enabled ? 'Yes' : 'No',
      description: role.description || '',
      defaultCount: serializeNumber(selection.defaultCount),
      increment: serializeNumber(selection.increment),
      minimum: serializeNumber(selection.minimum),
      maximum: serializeNumber(selection.maximum),
      fillRemaining: selection.fillRemaining ? 'Yes' : 'No',
      sortOrder: serializeNumber(role.sortOrder),
      colour: assets.colour || '-',
      secondaryColour: assets.secondaryColour || '-',
      ...availability,
      updatedAt: formatOePanelDateTime(role.updatedAt),
      details: {
        role: role.title || formatPartyGameLabel(role.key),
        roleKey: role.key || '-',
        gamemode: formatPartyGameLabel(role.gameType),
        faction: formatPartyGameLabel(role.faction),
        status: formatPartyGameLabel(role.status),
        active: role.enabled ? 'Yes' : 'No',
        description: role.description || '',
        defaultCount: serializeNumber(selection.defaultCount),
        increment: serializeNumber(selection.increment),
        minimum: serializeNumber(selection.minimum),
        maximum: serializeNumber(selection.maximum),
        fillRemaining: selection.fillRemaining ? 'Yes' : 'No',
        sortOrder: serializeNumber(role.sortOrder),
        colour: assets.colour || '-',
        secondaryColour: assets.secondaryColour || '-',
        ...availability,
        updatedAt: formatOePanelDateTime(role.updatedAt)
      }
    };
  }

  return {
    parseCompositePartyContentKey,
    createGamePackUpdatePayload,
    createGamePackCreatePayload,
    createGameRuleUpdatePayload,
    createGameRoleUpdatePayload,
    serializePartyPackForPanel,
    serializePartyRuleForPanel,
    serializePartyRoleForPanel
  };
}

module.exports = {
  createPartyContentContext
};
