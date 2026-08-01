const fs = require('fs/promises');
const path = require('path');
const {
  normalizeGameContentAccess,
  serializeGameContentAccess
} = require('./game-content-access');
const {
  filterAvailableContent,
  isGameContentAvailable,
  normalizeStoredAvailability,
  serializeAvailability
} = require('./game-content-availability');

const QUESTIONS_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'party-games',
  'questions'
);
const PACKS_ROOT = path.join(
  process.cwd(),
  'public',
  'json-files',
  'party-games',
  'packs'
);

function titleFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeDescription(description) {
  return String(description || '').trim();
}

function normalizeQuestion(rawQuestion = {}) {
  const alternatives = rawQuestion['question-alternatives'];

  return {
    question: String(rawQuestion.question || '').trim(),
    type: rawQuestion['question-type'] || rawQuestion.type || null,
    alternatives: Array.isArray(alternatives)
      ? alternatives
      : alternatives
        ? [alternatives]
        : [],
    punishment: rawQuestion.punishment || null
  };
}

function serializeQuestionForJson(question = {}, gameType) {
  const output = {
    question: question.question
  };

  if (gameType === 'truth-or-dare' && question.type) {
    output['question-type'] = question.type;
  }

  if (gameType === 'imposter') {
    output['question-alternatives'] = Array.isArray(question.alternatives)
      ? question.alternatives
      : [];
  }

  if (question.punishment) {
    output.punishment = question.punishment;
  }

  return output;
}

function serializePackQuestionsForJson(pack) {
  return {
    [pack.key]: (pack.questions || []).map((question) =>
      serializeQuestionForJson(question, pack.gameType)
    )
  };
}

function serializePackMetadataForJson(pack) {
  const output = {
    'pack-name': pack.slug,
    'pack-description': normalizeDescription(pack.description),
    'pack-path': `/json-files/party-games/questions/${pack.gameType}/${pack.slug}.json`,
    'pack-colour': pack.assets?.colour || '',
    'pack-secondary-colour': pack.assets?.secondaryColour || '',
    'pack-difficulty': pack.difficulty || '',
    'pack-restriction': pack.restriction || null,
    'pack-active': Boolean(pack.enabled && pack.status === 'published'),
    availability: serializeAvailability(pack.availability)
  };
  const access = serializeGameContentAccess(getPackAccess(pack));

  if (access) {
    output.access = access;
  }

  if (pack.legacyMetadata?.packType) {
    output['pack-type'] = pack.legacyMetadata.packType;
  }

  if (pack.legacyMetadata?.settingsDependency) {
    output['settings-dependency'] = pack.legacyMetadata.settingsDependency;
  }

  return output;
}

function serializePackMetadataForApi(pack) {
  return {
    ...serializePackMetadataForJson(pack),
    'pack-path': `/api/party-game-packs/${pack.gameType}/${pack.slug}/questions`
  };
}

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readPackMetadataFromJson(gameType) {
  const packData = await readJsonFile(
    path.join(PACKS_ROOT, `${gameType}.json`)
  );
  return Array.isArray(packData[`${gameType}-packs`])
    ? packData[`${gameType}-packs`]
    : [];
}

async function readPackQuestionsFromJson(gameType, slug) {
  return readJsonFile(path.join(QUESTIONS_ROOT, gameType, `${slug}.json`));
}

function normalizePackFromJson(packMeta, gameType) {
  const slug = String(packMeta['pack-name'] || '').trim();
  return {
    gameType,
    slug,
    key: `${gameType}-${slug}`,
    title: titleFromSlug(slug),
    description: normalizeDescription(
      packMeta['pack-description'] ?? packMeta.description
    ),
    enabled: packMeta['pack-active'] !== false,
    status: packMeta['pack-active'] === false ? 'draft' : 'published',
    availability: normalizeStoredAvailability(packMeta.availability),
    access: normalizeGameContentAccess(packMeta.access),
    difficulty: packMeta['pack-difficulty'] || '',
    restriction: packMeta['pack-restriction'] || null,
    assets: {
      colour: packMeta['pack-colour'] || '',
      secondaryColour: packMeta['pack-secondary-colour'] || ''
    },
    legacyMetadata: {
      packType: packMeta['pack-type'] || null,
      settingsDependency: packMeta['settings-dependency'] || null
    },
    questions: []
  };
}

function getPackAccess(pack = {}) {
  return normalizeGameContentAccess(pack.access);
}

async function getPublishedPacksFromJson(gameType, options = {}) {
  const packs = await readPackMetadataFromJson(gameType);
  const publishedPacks = packs
    .filter((pack) => pack['pack-active'] !== false)
    .map((pack) => normalizePackFromJson(pack, gameType))
    .filter((pack) => pack.slug);
  return filterAvailableContent(publishedPacks, {
    ...options,
    getKey: (pack) => pack.slug
  });
}

async function importGamePacksFromJson(GamePack) {
  const packFiles = await fs.readdir(PACKS_ROOT);
  const imported = [];

  for (const fileName of packFiles.filter((file) => file.endsWith('.json'))) {
    const gameType = path.basename(fileName, '.json');

    const packData = await readJsonFile(path.join(PACKS_ROOT, fileName));
    const packs = packData[`${gameType}-packs`] || [];

    for (const packMeta of packs) {
      const slug = packMeta['pack-name'];
      const questionPath = path.join(
        process.cwd(),
        'public',
        packMeta['pack-path'].replace(/^\//, '')
      );
      const questionData = await readJsonFile(questionPath);
      const key = Object.keys(questionData)[0] || `${gameType}-${slug}`;
      const questions = (questionData[key] || [])
        .map(normalizeQuestion)
        .filter((question) => question.question);

      const pack = await GamePack.findOneAndUpdate(
        { gameType, slug },
        {
          $set: {
            gameType,
            slug,
            key,
            title: titleFromSlug(slug),
            description: normalizeDescription(
              packMeta['pack-description'] ?? packMeta.description
            ),
            enabled: packMeta['pack-active'] !== false,
            status: packMeta['pack-active'] === false ? 'draft' : 'published',
            availability: normalizeStoredAvailability(packMeta.availability),
            access: normalizeGameContentAccess(packMeta.access),
            difficulty: packMeta['pack-difficulty'] || '',
            restriction: packMeta['pack-restriction'] || null,
            assets: {
              colour: packMeta['pack-colour'] || '',
              secondaryColour: packMeta['pack-secondary-colour'] || ''
            },
            questions
          }
        },
        { new: true, upsert: true, runValidators: true }
      );

      imported.push(pack);
    }
  }

  return imported;
}

async function exportGamePacksToJson(GamePack) {
  const packs = await GamePack.find({}).sort({ gameType: 1, slug: 1 }).lean();
  const packsByGameType = new Map();

  for (const pack of packs) {
    const questionDirectory = path.join(QUESTIONS_ROOT, pack.gameType);
    await fs.mkdir(questionDirectory, { recursive: true });
    await fs.writeFile(
      path.join(questionDirectory, `${pack.slug}.json`),
      `${JSON.stringify(serializePackQuestionsForJson(pack), null, 2)}\n`
    );

    if (!packsByGameType.has(pack.gameType)) {
      packsByGameType.set(pack.gameType, []);
    }

    packsByGameType.get(pack.gameType).push(serializePackMetadataForJson(pack));
  }

  await fs.mkdir(PACKS_ROOT, { recursive: true });

  for (const [gameType, gamePacks] of packsByGameType) {
    await fs.writeFile(
      path.join(PACKS_ROOT, `${gameType}.json`),
      `${JSON.stringify({ [`${gameType}-packs`]: gamePacks }, null, 2)}\n`
    );
  }

  return packs;
}

async function getPublishedPacks(GamePack, gameType, options = {}) {
  try {
    const packs = await GamePack.find({
      gameType,
      enabled: true,
      status: 'published'
    })
      .sort({ slug: 1 })
      .lean();

    if (packs.length) {
      return filterAvailableContent(packs, {
        ...options,
        getKey: (pack) => pack.slug
      });
    }
  } catch (error) {
    console.warn(
      `Falling back to JSON game packs for "${gameType}":`,
      error.message || error
    );
  }

  return getPublishedPacksFromJson(gameType, options);
}

async function getPublishedPack(GamePack, gameType, slug, options = {}) {
  try {
    const pack = await GamePack.findOne({
      gameType,
      slug,
      enabled: true,
      status: 'published'
    }).lean();

    if (pack) {
      const includeKeys = new Set((options.includeKeys || []).map(String));
      return includeKeys.has(String(slug)) ||
        isGameContentAvailable(pack, options.at)
        ? pack
        : null;
    }
  } catch (error) {
    console.warn(
      `Falling back to JSON game pack "${gameType}/${slug}":`,
      error.message || error
    );
  }

  try {
    const questionData = await readPackQuestionsFromJson(gameType, slug);
    const key = Object.keys(questionData)[0] || `${gameType}-${slug}`;
    const questions = (questionData[key] || [])
      .map(normalizeQuestion)
      .filter((question) => question.question);
    const packs = await getPublishedPacksFromJson(gameType, options);
    const metadata = packs.find((pack) => pack.slug === slug);

    if (!metadata) return null;

    return {
      ...metadata,
      key,
      questions
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        `Unable to read JSON game pack "${gameType}/${slug}":`,
        error.message || error
      );
    }
    return null;
  }
}

module.exports = {
  exportGamePacksToJson,
  getPackAccess,
  getPublishedPack,
  getPublishedPacks,
  importGamePacksFromJson,
  serializePackMetadataForJson,
  serializePackMetadataForApi,
  serializePackQuestionsForJson
};
