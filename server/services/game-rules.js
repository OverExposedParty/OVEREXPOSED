const fs = require('fs').promises;
const path = require('path');
const {
  normalizeGameContentAccess,
  serializeGameContentAccess
} = require('./game-content-access');
const {
  filterAvailableContent,
  normalizeStoredAvailability,
  serializeAvailability
} = require('./game-content-availability');

const SETTINGS_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'party-games',
  'settings'
);
const RETIRED_RULE_IDS = new Set(['truth-or-dare:text-box']);
const PROMPT_HEIST_RULE_IDS = new Set([
  'truth-or-dare:prompt-heist',
  'truth-or-dare:truth-or-dare-prompt-heist'
]);
const PROMPT_HEIST_ACCESS = Object.freeze({
  type: 'feature',
  feature: 'party-games.prompt-heist'
});

function isRetiredRule(rule = {}) {
  return RETIRED_RULE_IDS.has(`${rule.gameType}:${rule.key}`);
}

function getRuleAccess(rule = {}) {
  const normalized = normalizeGameContentAccess(rule.access);
  if (
    normalized.type === 'public' &&
    PROMPT_HEIST_RULE_IDS.has(`${rule.gameType}:${rule.key}`)
  ) {
    return PROMPT_HEIST_ACCESS;
  }
  return normalized;
}

function titleFromKey(key) {
  return key
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeDescription(description) {
  return String(description || '').trim();
}

function normalizeRestrictions(restrictions) {
  if (!Array.isArray(restrictions)) return [];
  return restrictions
    .map((restriction) => String(restriction || '').trim())
    .filter(Boolean);
}

function normalizeAppliesTo(appliesTo) {
  if (!Array.isArray(appliesTo)) return [];
  return appliesTo.map((target) => String(target || '').trim()).filter(Boolean);
}

function normalizeScope(scope) {
  return scope === 'global' ? 'global' : 'gamemode';
}

function serializeRuleForJson(rule) {
  const output = {
    'settings-name': rule.key,
    'settings-description': normalizeDescription(rule.description),
    'settings-colour': rule.colour || '',
    'settings-secondary-colour': rule.secondaryColour || '',
    'settings-restriction': normalizeRestrictions(rule.restriction),
    'settings-active': Boolean(rule.enabled && rule.status === 'published'),
    'button-type': rule.buttonType,
    availability: serializeAvailability(rule.availability)
  };
  const access = serializeGameContentAccess(getRuleAccess(rule));

  if (access) {
    output.access = access;
  }

  if (rule.scope && rule.scope !== 'gamemode') {
    output.scope = rule.scope;
  }

  if (Array.isArray(rule.appliesTo) && rule.appliesTo.length) {
    output['applies-to'] = normalizeAppliesTo(rule.appliesTo);
  }

  if (rule.requiredSetting) {
    output['settings-required'] = rule.requiredSetting;
  }

  if (rule.designation) {
    output['button-designation'] = rule.designation;
  }

  if (rule.initialValue !== null && rule.initialValue !== undefined) {
    output['button-initial-value'] = rule.initialValue;
  }

  if (rule.incrementValue !== null && rule.incrementValue !== undefined) {
    output['button-increment-value'] = rule.incrementValue;
  }

  if (rule.minimumValue !== null && rule.minimumValue !== undefined) {
    output['button-minimum-value'] = rule.minimumValue;
  }

  if (rule.maximumValue !== null && rule.maximumValue !== undefined) {
    output['button-maximum-value'] = rule.maximumValue;
  }

  if (rule.gameRuleTimeLimit !== null && rule.gameRuleTimeLimit !== undefined) {
    output['game-rule-time-limit'] = rule.gameRuleTimeLimit;
  }

  return output;
}

function serializeRuleForApi(rule) {
  return serializeRuleForJson(rule);
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getSettingsFromJson(settingsData, gameType) {
  if (Array.isArray(settingsData.settings)) return settingsData.settings;
  if (Array.isArray(settingsData[`${gameType}-settings`])) {
    return settingsData[`${gameType}-settings`];
  }
  return [];
}

function settingsApplyToGameType(settingsData, gameType) {
  const appliesTo = normalizeAppliesTo(
    settingsData['applies-to'] || settingsData.appliesTo
  );
  if (!appliesTo.length) return true;
  return appliesTo.includes(gameType) || appliesTo.includes('online');
}

function getRuleScopeData(setting, settingsData, gameType) {
  const scope = normalizeScope(setting.scope || settingsData.scope);
  const appliesTo = normalizeAppliesTo(
    setting['applies-to'] ||
      setting.appliesTo ||
      settingsData['applies-to'] ||
      settingsData.appliesTo
  );

  if (appliesTo.length) {
    return { scope, appliesTo };
  }

  if (scope === 'global') {
    return { scope, appliesTo: [] };
  }

  return { scope, appliesTo: [gameType] };
}

async function importGameRulesFromJson(GameRule) {
  const settingFiles = await fs.readdir(SETTINGS_ROOT);
  const imported = [];
  const globalRules = [];
  const importedRuleIds = new Set();

  for (const fileName of settingFiles.filter((file) =>
    file.endsWith('.json')
  )) {
    const gameType = path.basename(fileName, '.json');
    const settingsData = await readJsonFile(path.join(SETTINGS_ROOT, fileName));
    const settings = getSettingsFromJson(settingsData, gameType);

    for (const setting of settings) {
      const key = String(setting['settings-name'] || '').trim();
      if (!key) continue;
      const { scope, appliesTo } = getRuleScopeData(
        setting,
        settingsData,
        gameType
      );

      const rule = await GameRule.findOneAndUpdate(
        { gameType, key },
        {
          $set: {
            gameType,
            scope,
            appliesTo,
            key,
            title: titleFromKey(key),
            description: normalizeDescription(
              setting['settings-description'] ?? setting.description
            ),
            enabled: setting['settings-active'] !== false,
            status:
              setting['settings-active'] === false ? 'draft' : 'published',
            availability: normalizeStoredAvailability(setting.availability),
            buttonType: setting['button-type'] || 'toggle',
            access: normalizeGameContentAccess(setting.access),
            restriction: normalizeRestrictions(setting['settings-restriction']),
            requiredSetting: setting['settings-required'] || null,
            colour: setting['settings-colour'] || '',
            secondaryColour: setting['settings-secondary-colour'] || '',
            designation: setting['button-designation'] || null,
            initialValue: normalizeNumber(setting['button-initial-value']),
            incrementValue: normalizeNumber(setting['button-increment-value']),
            minimumValue: normalizeNumber(setting['button-minimum-value']),
            maximumValue: normalizeNumber(setting['button-maximum-value']),
            gameRuleTimeLimit: normalizeNumber(setting['game-rule-time-limit'])
          }
        },
        { new: true, upsert: true, runValidators: true }
      );

      imported.push(rule);
      importedRuleIds.add(`${gameType}:${key}`);
      if (scope === 'global') {
        globalRules.push({ gameType, key });
      }
    }
  }

  for (const { gameType, key } of globalRules) {
    const importedGameTypesForKey = Array.from(importedRuleIds)
      .filter((ruleId) => ruleId.endsWith(`:${key}`))
      .map((ruleId) => ruleId.slice(0, -key.length - 1));

    await GameRule.deleteMany({
      gameType: { $nin: importedGameTypesForKey },
      key
    });
  }

  for (const ruleId of RETIRED_RULE_IDS) {
    const separatorIndex = ruleId.indexOf(':');
    await GameRule.deleteMany({
      gameType: ruleId.slice(0, separatorIndex),
      key: ruleId.slice(separatorIndex + 1)
    });
  }

  return imported;
}

async function exportGameRulesToJson(GameRule) {
  const rules = (
    await GameRule.find({}).sort({ gameType: 1, key: 1 }).lean()
  ).filter((rule) => !isRetiredRule(rule));
  const rulesByGameType = new Map();

  for (const rule of rules) {
    if (!rulesByGameType.has(rule.gameType)) {
      rulesByGameType.set(rule.gameType, []);
    }

    rulesByGameType.get(rule.gameType).push(serializeRuleForJson(rule));
  }

  await fs.mkdir(SETTINGS_ROOT, { recursive: true });

  for (const [gameType, gameRules] of rulesByGameType) {
    const firstRule = gameRules[0] || {};
    const scope = firstRule.scope || 'gamemode';
    const appliesTo = normalizeAppliesTo(
      firstRule.appliesTo || firstRule['applies-to']
    );
    const output =
      scope === 'global'
        ? {
            scope,
            'applies-to': appliesTo,
            settings: gameRules
          }
        : { [`${gameType}-settings`]: gameRules };

    await fs.writeFile(
      path.join(SETTINGS_ROOT, `${gameType}.json`),
      `${JSON.stringify(output, null, 2)}\n`
    );
  }

  return rules;
}

async function getPublishedRules(GameRule, gameType, options = {}) {
  let rules = [];

  try {
    rules = await GameRule.find({
      enabled: true,
      status: 'published',
      $or: [
        { gameType },
        { scope: 'gamemode', appliesTo: gameType },
        { scope: 'global', appliesTo: gameType },
        { scope: 'global', appliesTo: 'online' }
      ]
    })
      .sort({ key: 1 })
      .lean();
  } catch (error) {
    console.warn(
      `Falling back to JSON game rules for "${gameType}":`,
      error.message || error
    );
  }

  const databaseRules = rules.filter((rule) => !isRetiredRule(rule));

  if (!databaseRules.length) {
    const settingsFiles = [
      `${gameType}.json`,
      'online-global.json',
      'shared-addons.json'
    ];
    const jsonRules = [];

    for (const fileName of settingsFiles) {
      try {
        const settingsData = await readJsonFile(
          path.join(SETTINGS_ROOT, fileName)
        );
        if (!settingsApplyToGameType(settingsData, gameType)) continue;
        jsonRules.push(
          ...getSettingsFromJson(settingsData, gameType).map((setting) => {
            const key = String(setting['settings-name'] || '').trim();
            const { scope, appliesTo } = getRuleScopeData(
              setting,
              settingsData,
              gameType
            );

            return {
              gameType,
              scope,
              appliesTo,
              key,
              title: titleFromKey(key),
              description: normalizeDescription(
                setting['settings-description'] ?? setting.description
              ),
              enabled: setting['settings-active'] !== false,
              status:
                setting['settings-active'] === false ? 'draft' : 'published',
              availability: normalizeStoredAvailability(setting.availability),
              buttonType: setting['button-type'] || 'toggle',
              access: normalizeGameContentAccess(setting.access),
              restriction: normalizeRestrictions(
                setting['settings-restriction']
              ),
              requiredSetting: setting['settings-required'] || null,
              colour: setting['settings-colour'] || '',
              secondaryColour: setting['settings-secondary-colour'] || '',
              designation: setting['button-designation'] || null,
              initialValue: normalizeNumber(setting['button-initial-value']),
              incrementValue: normalizeNumber(
                setting['button-increment-value']
              ),
              minimumValue: normalizeNumber(setting['button-minimum-value']),
              maximumValue: normalizeNumber(setting['button-maximum-value']),
              gameRuleTimeLimit: normalizeNumber(
                setting['game-rule-time-limit']
              )
            };
          })
        );
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(
            `Unable to read JSON game rules file "${fileName}":`,
            error.message || error
          );
        }
      }
    }

    rules = jsonRules.filter((rule) => rule.key && rule.enabled);
  } else {
    rules = databaseRules;
  }

  rules = filterAvailableContent(rules, options);

  const priorityForRule = (rule) => {
    if (rule.scope === 'gamemode' && rule.appliesTo?.includes(gameType))
      return 4;
    if (rule.scope === 'global' && rule.appliesTo?.includes(gameType)) return 3;
    if (rule.scope === 'global' && rule.appliesTo?.includes('online')) return 2;
    if (rule.gameType === gameType) return 1;
    return 0;
  };

  return Array.from(
    rules
      .filter((rule) => !isRetiredRule(rule))
      .sort((left, right) => priorityForRule(right) - priorityForRule(left))
      .reduce((byKey, rule) => {
        if (!byKey.has(rule.key)) byKey.set(rule.key, rule);
        return byKey;
      }, new Map())
      .values()
  ).sort((left, right) => left.key.localeCompare(right.key));
}

module.exports = {
  exportGameRulesToJson,
  getPublishedRules,
  getRuleAccess,
  importGameRulesFromJson,
  isRetiredRule,
  serializeRuleForApi
};
