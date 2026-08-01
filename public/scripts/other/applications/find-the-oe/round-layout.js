(() => {
  const modules = window.Error404FindTheOeModules = window.Error404FindTheOeModules || {};
  const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);

  function getRgbSimilarity(rgbA, rgbB) {
    if (!Array.isArray(rgbA) || !Array.isArray(rgbB)) return 0;

    const distance = Math.sqrt(
      (rgbA[0] - rgbB[0]) ** 2 +
        (rgbA[1] - rgbB[1]) ** 2 +
        (rgbA[2] - rgbB[2]) ** 2
    );

    return modules.clamp(1 - distance / MAX_RGB_DISTANCE, 0, 1);
  }

  function getMetadataSimilarity(targetMetadata, itemMetadata) {
    if (!targetMetadata || !itemMetadata) return 0;

    const colourSimilarity = getRgbSimilarity(targetMetadata.rgb, itemMetadata.rgb);
    const categorySimilarity = targetMetadata.category === itemMetadata.category ? 1 : 0;
    const toneSimilarity = targetMetadata.tone === itemMetadata.tone ? 1 : 0;

    return colourSimilarity * 0.68 + categorySimilarity * 0.24 + toneSimilarity * 0.08;
  }

  function getSlotSimilarity(target, customisation, slot) {
    const key = modules.SLOT_KEY_MAP[slot];
    if (target[`${key}Id`] === customisation[`${key}Id`]) return 1;

    return getMetadataSimilarity(
      target[`${key}FindTheOe`],
      customisation[`${key}FindTheOe`]
    );
  }

  function getCustomisationSimilarity(target, customisation) {
    let weightedSimilarity = 0;
    let totalWeight = 0;

    modules.SLOT_ORDER.forEach((slot) => {
      const weight = modules.SLOT_SIMILARITY_WEIGHTS[slot] || 1;
      weightedSimilarity += getSlotSimilarity(target, customisation, slot) * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? modules.clamp(weightedSimilarity / totalWeight, 0, 1) : 0;
  }

  function getSimilarityRange(score) {
    const max = modules.clamp(0.92 + score * 0.006, 0, 0.985);
    const min = modules.clamp(0.2 + score * 0.045, 0.2, max - 0.08);
    return { min, max };
  }

  function createWeightedCustomisation({ slots, target, desiredSimilarity }) {
    const customisation = {};

    modules.SLOT_ORDER.forEach((slot) => {
      const key = modules.SLOT_KEY_MAP[slot];
      const targetMetadata = target[`${key}FindTheOe`];
      const weightedItems = slots[slot].map((item) => {
        const similarity = item.id === target[`${key}Id`]
          ? 1
          : getMetadataSimilarity(targetMetadata, item.findTheOe);
        const distanceFromDesired = Math.abs(similarity - desiredSimilarity);

        return { item, weight: 1 / (0.04 + distanceFromDesired ** 2) };
      });

      modules.applySlotItem(
        customisation,
        slot,
        modules.weightedRandomItem(weightedItems) || modules.randomItem(slots[slot])
      );
    });

    customisation.id = modules.getCustomisationId(customisation);
    customisation.similarity = getCustomisationSimilarity(target, customisation);
    return customisation;
  }

  function createSimilarCustomisation({ target, slots, score, usedIds }) {
    const range = getSimilarityRange(score);
    let bestCustomisation = null;
    let bestDistance = Infinity;

    for (let attempts = 0; attempts < modules.SIMILAR_CUSTOMISATION_ATTEMPTS; attempts += 1) {
      const desiredSimilarity = range.min + Math.random() * (range.max - range.min);
      const customisation = createWeightedCustomisation({
        slots,
        target,
        desiredSimilarity
      });

      if (customisation.id === target.id || usedIds.has(customisation.id)) continue;
      if (customisation.similarity >= modules.PERFECT_SIMILARITY) continue;
      if (customisation.similarity >= range.min && customisation.similarity <= range.max) {
        return customisation;
      }

      const distanceFromRange = customisation.similarity < range.min
        ? range.min - customisation.similarity
        : customisation.similarity - range.max;

      if (distanceFromRange < bestDistance) {
        bestDistance = distanceFromRange;
        bestCustomisation = customisation;
      }
    }

    if (bestCustomisation) return bestCustomisation;

    let customisation = target;
    let attempts = 0;
    do {
      customisation = modules.createRandomCustomisation(slots);
      attempts += 1;
    } while (
      (customisation.id === target.id || usedIds.has(customisation.id))
      && attempts < modules.RANDOM_CUSTOMISATION_ATTEMPTS
    );

    customisation.similarity = getCustomisationSimilarity(target, customisation);
    return customisation;
  }

  async function loadCustomisationSlots() {
    const packs = await modules.fetchJson(modules.CUSTOMISATION_PACKS_PATH);
    const slots = {
      colour: [],
      'head-slot': [],
      'eyes-slot': [],
      'mouth-slot': []
    };

    await Promise.all(packs.map(async (pack) => {
      const packData = await modules.fetchJson(pack['pack-path']);
      Object.values(packData).forEach((items) => {
        if (!Array.isArray(items)) return;

        items.forEach((item) => {
          if (!slots[item.slot] || item.blacklist === true) return;

          slots[item.slot].push({
            id: item.id,
            name: item.name,
            filePath: item['file-path'],
            blacklist: item.blacklist === true,
            findTheOe: item['find-the-oe'] || null
          });
        });
      });
    }));

    const missingSlot = modules.SLOT_ORDER.find((slot) => slots[slot].length === 0);
    if (missingSlot) throw new Error(`Find The OE is missing ${missingSlot} options`);

    return slots;
  }

  function getRoundRowSize(score) {
    return modules.ROW_DIFFICULTY_STEPS.reduce(
      (rowSize, step) => (score >= step.minScore ? step.rowSize : rowSize),
      modules.ROW_DIFFICULTY_STEPS[0].rowSize
    );
  }

  function getRoundSize(score) {
    return getRoundRowSize(score);
  }

  function getPieceSize(score) {
    return Math.max(64, 92 - score * 2);
  }

  function createPositionedPieces({ count, target, slots, score }) {
    const targetIndex = Math.floor(Math.random() * count);
    const pieces = [];
    const usedIds = new Set([target.id]);

    for (let index = 0; index < count; index += 1) {
      let customisation = target;
      if (index !== targetIndex) {
        customisation = createSimilarCustomisation({ target, slots, score, usedIds });
        usedIds.add(customisation.id);
      }

      pieces.push({
        customisation,
        isTarget: index === targetIndex,
        size: getPieceSize(score)
      });
    }

    return {
      pieces: modules.shuffle(pieces),
      rowSize: getRoundRowSize(score)
    };
  }

  Object.assign(modules, {
    createPositionedPieces,
    getCustomisationSimilarity,
    getRoundRowSize,
    loadCustomisationSlots
  });
})();
