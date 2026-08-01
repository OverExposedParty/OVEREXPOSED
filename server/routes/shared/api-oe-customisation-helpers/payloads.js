const { normalizeOeCustomisationStatus } = require('./status');

function createOeCustomisationPayloadHelpers({ parseBooleanLabel }) {
  function createOeCustomisationPackUpdatePayload(body) {
    const update = {};

    if (Object.prototype.hasOwnProperty.call(body, 'pack')) {
      const title = String(body.pack || '').trim();
      if (!title) return { error: 'OE pack title is required.' };
      update.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
      const slug = String(body.slug || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (!slug) return { error: 'OE pack slug is required.' };
      update.slug = slug;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'prefix')) {
      const prefix = String(body.prefix || '').trim();
      if (!prefix) return { error: 'OE pack prefix is required.' };
      update.prefix = prefix;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      update.description = String(body.description || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = normalizeOeCustomisationStatus(body.status);
      if (!status) {
        return {
          error: 'OE pack status must be draft, published, or archived.'
        };
      }
      update.status = status;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      const enabled = parseBooleanLabel(body.active);
      if (enabled === null)
        return { error: 'OE pack active must be yes or no.' };
      update.enabled = enabled;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'colour')) {
      update['assets.colour'] = String(body.colour || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'secondaryColour')) {
      update['assets.secondaryColour'] = String(
        body.secondaryColour || ''
      ).trim();
    }

    return { update };
  }

  function createOeCustomisationImageUpdatePayload(body) {
    const update = {};

    if (Object.prototype.hasOwnProperty.call(body, 'oeId')) {
      const oeId = String(body.oeId || '').trim();
      if (!oeId) return { error: 'OE ID is required.' };
      update.oeId = oeId;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      const name = String(body.name || '').trim();
      if (!name) return { error: 'OE image name is required.' };
      update.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'pack')) {
      const packSlug = String(body.pack || '').trim();
      if (!packSlug) return { error: 'OE image pack is required.' };
      update.packSlug = packSlug;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'slot')) {
      const slot = String(body.slot || '').trim();
      if (!['colour', 'head-slot', 'eyes-slot', 'mouth-slot'].includes(slot)) {
        return { error: 'OE image slot is invalid.' };
      }
      update.slot = slot;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const status = normalizeOeCustomisationStatus(body.status);
      if (!status) {
        return {
          error: 'OE image status must be draft, published, or archived.'
        };
      }
      update.status = status;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'active')) {
      const enabled = parseBooleanLabel(body.active);
      if (enabled === null) {
        return { error: 'OE image active must be yes or no.' };
      }
      update.enabled = enabled;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'blacklisted')) {
      const blacklist = parseBooleanLabel(body.blacklisted);
      if (blacklist === null) {
        return { error: 'OE image blacklisted must be yes or no.' };
      }
      update.blacklist = blacklist;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'filePath')) {
      update.filePath = String(body.filePath || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'findTheOeCategory')) {
      update['findTheOe.category'] = String(
        body.findTheOeCategory || ''
      ).trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'findTheOeTone')) {
      update['findTheOe.tone'] = String(body.findTheOeTone || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'findTheOeRgb')) {
      update['findTheOe.rgb'] = String(body.findTheOeRgb || '')
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value));
    }

    return { update };
  }

  function createOeCustomisationPackCreatePayload(body) {
    const slug = String(body.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const title = String(body.title || '').trim();
    const prefix = String(body.prefix || '').trim();
    const status = normalizeOeCustomisationStatus(body.status);
    const enabled = parseBooleanLabel(body.active || 'no');

    if (!slug) return { error: 'OE pack slug is required.' };
    if (!title) return { error: 'OE pack title is required.' };
    if (!prefix) return { error: 'OE pack prefix is required.' };
    if (!status) {
      return { error: 'OE pack status must be draft, published, or archived.' };
    }
    if (enabled === null) return { error: 'OE pack active must be yes or no.' };

    return {
      pack: {
        recordType: 'pack',
        slug,
        title,
        description: String(body.description || '').trim(),
        prefix,
        enabled,
        status,
        assets: {
          colour: String(body.colour || '').trim(),
          secondaryColour: String(body.secondaryColour || '').trim()
        }
      }
    };
  }

  function createOeCustomisationImageCreatePayload(body) {
    const oeId = String(body.oeId || '').trim();
    const packSlug = String(body.packSlug || '').trim();
    const name = String(body.name || '').trim();
    const slot = String(body.slot || '').trim();
    const filePath = String(body.filePath || '').trim();
    const status = normalizeOeCustomisationStatus(body.status);
    const enabled = parseBooleanLabel(body.active || 'no');
    const blacklist = parseBooleanLabel(body.blacklisted || 'no');
    const rgb = String(body.rgb || '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value));

    if (!oeId) return { error: 'OE ID is required.' };
    if (!packSlug) return { error: 'OE image pack is required.' };
    if (!name) return { error: 'OE image name is required.' };
    if (!['colour', 'head-slot', 'eyes-slot', 'mouth-slot'].includes(slot)) {
      return { error: 'OE image slot is invalid.' };
    }
    if (!filePath) return { error: 'OE image file path is required.' };
    if (!status) {
      return {
        error: 'OE image status must be draft, published, or archived.'
      };
    }
    if (enabled === null)
      return { error: 'OE image active must be yes or no.' };
    if (blacklist === null) {
      return { error: 'OE image blacklisted must be yes or no.' };
    }

    return {
      image: {
        recordType: 'image',
        oeId,
        packSlug,
        name,
        slot,
        filePath,
        enabled,
        status,
        blacklist,
        findTheOe: {
          rgb,
          category: String(body.findTheOeCategory || '').trim(),
          tone: String(body.findTheOeTone || '').trim()
        }
      }
    };
  }

  return {
    createOeCustomisationImageCreatePayload,
    createOeCustomisationImageUpdatePayload,
    createOeCustomisationPackCreatePayload,
    createOeCustomisationPackUpdatePayload
  };
}

module.exports = {
  createOeCustomisationPayloadHelpers
};
