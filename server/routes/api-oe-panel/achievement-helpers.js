const {
  AchievementRewardValidationError,
  normalizeAchievementRewards
} = require('../../../models/content/achievement-reward-contract');
const {
  getAchievementIconDirectory,
  isAchievementTaxonomyValid,
  normalizeAchievementTaxonomy,
  normalizeTaxonomySegment
} = require('../../../models/content/achievement-taxonomy');

function createOePanelAchievementHelpers(context) {
  const {
    fs,
    path,
    PUBLIC_DIRECTORY,
    formatOePanelDateTime,
    parseBooleanLabel
  } = context;

  function formatAchievementPanelValue(value, fallback = '-') {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
  }

  function formatAchievementReward(reward = {}) {
    const quantity = Number(reward.quantity || 1);
    const amount = Number(reward.amount || 0);
    const parts = [
      reward.type,
      reward.key,
      amount ? `x${amount}` : '',
      quantity > 1 ? `qty ${quantity}` : ''
    ].filter(Boolean);

    return parts.length ? parts.join(' ') : null;
  }

  function formatAchievementRewards(rewards = []) {
    if (!Array.isArray(rewards) || !rewards.length) return '-';
    return (
      rewards.map(formatAchievementReward).filter(Boolean).join(', ') || '-'
    );
  }

  function normalizeAchievementKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeAchievementCategory(value) {
    return normalizeTaxonomySegment(value, 'general-online');
  }

  function getAchievementImagePath(achievement = {}) {
    const { key } = achievement;
    const safeKey = normalizeAchievementKey(key);
    const iconDirectory = getAchievementIconDirectory(achievement);
    return `/images/achievements/icons/${iconDirectory}/${safeKey}.svg`;
  }

  function getAchievementBorderPath({ rarity } = {}) {
    const borderKey =
      String(rarity || 'common')
        .trim()
        .toLowerCase() === 'secret'
        ? 'exposed'
        : normalizeAchievementKey(rarity || 'common');

    return `/images/achievements/borders/${borderKey || 'common'}.svg`;
  }

  function serializeAchievementForPanel(achievement, unlockCount = 0) {
    const taxonomy = normalizeAchievementTaxonomy(achievement);
    const requirementType = achievement.requirementType || 'event';
    const usesStatSource = [
      'stat',
      'stat_threshold',
      'per_game_stat_threshold',
      'streak',
      'collection'
    ].includes(requirementType);
    const trigger = usesStatSource
      ? achievement.statPath || achievement.statKey || '-'
      : achievement.eventType || '-';

    return {
      key: achievement.key || '-',
      name: achievement.name || achievement.key || '-',
      description: achievement.description || '-',
      image: achievement.image || getAchievementImagePath(achievement),
      border: getAchievementBorderPath(achievement),
      category: taxonomy.category,
      subcategory: taxonomy.subcategory,
      gamemode: taxonomy.gamemode || 'global',
      trigger,
      requirementType,
      requirementValue: String(achievement.requirementValue ?? 1),
      minPlayers: String(achievement.minPlayers ?? 0),
      points: String(achievement.points ?? 0),
      rarity: achievement.rarity || '-',
      rewards: formatAchievementRewards(achievement.rewards),
      status: achievement.status || '-',
      enabled: achievement.enabled === false ? 'No' : 'Yes',
      hidden: achievement.hidden ? 'Yes' : 'No',
      unlocks: String(unlockCount || 0),
      tags: Array.isArray(achievement.tags) ? achievement.tags.join(', ') : '-',
      createdAt: formatOePanelDateTime(achievement.createdAt),
      updatedAt: formatOePanelDateTime(achievement.updatedAt)
    };
  }

  function normalizeAchievementStatus(value) {
    const status = String(value || 'draft')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    return ['draft', 'published', 'archived'].includes(status) ? status : null;
  }

  function normalizeAchievementNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function parseAchievementRewards(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return { rewards: [] };

    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch (_error) {
      return { error: 'Achievement rewards must be valid JSON.' };
    }

    if (!Array.isArray(parsed)) {
      return { error: 'Achievement rewards must be a JSON array.' };
    }

    try {
      return { rewards: normalizeAchievementRewards(parsed) };
    } catch (error) {
      return {
        error:
          error instanceof AchievementRewardValidationError
            ? error.message
            : 'Achievement rewards are invalid.'
      };
    }
  }

  function createAchievementCreatePayload(body = {}) {
    const key = normalizeAchievementKey(body.key);
    const name = String(body.name || '').trim();
    const taxonomy = normalizeAchievementTaxonomy({
      category: normalizeAchievementCategory(body.category),
      subcategory: body.subcategory,
      gamemode: body.gamemode
    });
    const status = normalizeAchievementStatus(body.status);
    const enabled = parseBooleanLabel(body.active || 'no');
    const hidden = parseBooleanLabel(body.hidden || 'no');
    const requirementType = String(body.requirementType || 'event')
      .trim()
      .toLowerCase();
    const rarity = String(body.rarity || 'common')
      .trim()
      .toLowerCase();
    const rewardsResult = parseAchievementRewards(body.rewardsJson);

    if (!key) return { error: 'Achievement key is required.' };
    if (!name) return { error: 'Achievement name is required.' };
    if (!taxonomy.category) {
      return { error: 'Achievement category is required.' };
    }
    if (
      !isAchievementTaxonomyValid({
        category: body.category,
        subcategory: body.subcategory,
        gamemode: body.gamemode
      })
    ) {
      return {
        error:
          'Achievement subcategory must belong to its category, and gamemodes require gameplay/online.'
      };
    }
    if (!status) {
      return {
        error: 'Achievement status must be draft, published, or archived.'
      };
    }
    if (enabled === null) {
      return { error: 'Achievement active must be yes or no.' };
    }
    if (hidden === null) {
      return { error: 'Achievement hidden must be yes or no.' };
    }
    if (
      ![
        'stat_threshold',
        'per_game_stat_threshold',
        'event',
        'streak',
        'collection',
        'manual'
      ].includes(requirementType)
    ) {
      return { error: 'Achievement requirement type is invalid.' };
    }
    if (
      !['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'].includes(
        rarity
      )
    ) {
      return { error: 'Achievement rarity is invalid.' };
    }
    if (rewardsResult.error) return { error: rewardsResult.error };

    return {
      achievement: {
        key,
        name,
        description: String(body.description || '').trim(),
        image:
          String(body.image || '').trim() ||
          getAchievementImagePath({
            key,
            ...taxonomy
          }),
        category: taxonomy.category,
        subcategory: taxonomy.subcategory,
        gamemode: taxonomy.gamemode,
        requirementType,
        eventType: String(body.eventType || '').trim() || null,
        statPath: String(body.statPath || '').trim() || null,
        statKey: String(body.statKey || '').trim() || null,
        requirementValue: normalizeAchievementNumber(body.requirementValue, 1),
        minPlayers: normalizeAchievementNumber(body.minPlayers, 0),
        points: normalizeAchievementNumber(body.points, 0),
        rarity,
        hidden,
        enabled,
        status,
        sortOrder: normalizeAchievementNumber(body.sortOrder, 0),
        tags: String(body.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        rewards: rewardsResult.rewards,
        metadata: {}
      }
    };
  }

  function saveAchievementSvgUpload({
    file,
    key,
    category,
    subcategory,
    gamemode
  }) {
    if (!file?.buffer?.length) {
      return { error: 'An achievement SVG upload is required.' };
    }

    const safeKey = normalizeAchievementKey(key);
    if (!safeKey) {
      return { error: 'Achievement key is required for SVG upload.' };
    }

    const svgText = file.buffer.toString('utf8').trimStart();
    if (
      !/^<svg[\s>]/i.test(svgText) &&
      !/^<\?xml[\s\S]*?<svg[\s>]/i.test(svgText)
    ) {
      return { error: 'Uploaded file does not look like an SVG.' };
    }

    const iconDirectory = getAchievementIconDirectory({
      category,
      subcategory,
      gamemode
    });
    const folderPath = `/images/achievements/icons/${iconDirectory}`;
    const resolvedFolder = path.resolve(
      PUBLIC_DIRECTORY,
      folderPath.replace(/^\//, '')
    );
    const fileName = `${safeKey}.svg`;
    const resolvedFilePath = path.resolve(resolvedFolder, fileName);

    if (
      !resolvedFolder.startsWith(PUBLIC_DIRECTORY) ||
      !resolvedFilePath.startsWith(resolvedFolder)
    ) {
      return { error: 'Achievement SVG file path is invalid.' };
    }

    fs.mkdirSync(resolvedFolder, { recursive: true });
    fs.writeFileSync(resolvedFilePath, file.buffer);

    return {
      filePath: `${folderPath}/${fileName}`,
      resolvedFilePath
    };
  }

  function createAchievementReviewAlerts(achievements, unlockCountsByKey) {
    const alerts = [];

    achievements.forEach((achievement) => {
      const title = achievement.name || achievement.key || 'Achievement';
      const key = achievement.key || '-';
      const status = achievement.status || 'published';
      const enabled = achievement.enabled !== false;
      const requirementType = achievement.requirementType || 'event';
      const usesStatSource = [
        'stat',
        'stat_threshold',
        'per_game_stat_threshold',
        'streak',
        'collection'
      ].includes(requirementType);
      const hasTrigger = usesStatSource
        ? Boolean(achievement.statPath || achievement.statKey)
        : Boolean(achievement.eventType);

      if (status === 'draft') {
        alerts.push({
          title: `${title} is still draft`,
          roomCode: key,
          detail: 'Needs approval before players can earn it.',
          severity: 'medium',
          containerType: 'achievement',
          'container-type': 'achievement'
        });
      }

      if (status === 'published' && !enabled) {
        alerts.push({
          title: `${title} is published but disabled`,
          roomCode: key,
          detail: 'Published achievements should usually be earnable.',
          severity: 'high',
          containerType: 'achievement',
          'container-type': 'achievement'
        });
      }

      if (!hasTrigger) {
        alerts.push({
          title: `${title} has no trigger`,
          roomCode: key,
          detail: `${formatAchievementPanelValue(requirementType)} achievement is missing its event/stat source.`,
          severity: 'high',
          containerType: 'achievement',
          'container-type': 'achievement'
        });
      }

      if (
        status === 'published' &&
        enabled &&
        Number(unlockCountsByKey[key] || 0) === 0
      ) {
        alerts.push({
          title: `${title} has no unlocks`,
          roomCode: key,
          detail:
            'Check if the requirement is too hard or the trigger is not firing.',
          severity: 'low',
          containerType: 'achievement',
          'container-type': 'achievement'
        });
      }
    });

    return alerts.slice(0, 12);
  }

  function getContentSyncAlertsForArea(contentSync, area) {
    return Array.isArray(contentSync?.alerts)
      ? contentSync.alerts.filter((alert) => alert.area === area)
      : [];
  }

  return {
    formatAchievementPanelValue,
    serializeAchievementForPanel,
    createAchievementCreatePayload,
    saveAchievementSvgUpload,
    createAchievementReviewAlerts,
    getContentSyncAlertsForArea
  };
}

module.exports = { createOePanelAchievementHelpers };
