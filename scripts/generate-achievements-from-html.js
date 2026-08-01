const fs = require('fs');
const path = require('path');
const {
  getAchievementIconDirectory,
  isAchievementAvailableToStandardAccounts,
  normalizeAchievementTaxonomy
} = require('../models/content/achievement-taxonomy');

const sourcePath =
  process.argv[2] ||
  'C:/Users/alvin/Downloads/OVEREXPOSED ACHIEVEMENTS/OVEREXPOSEDACHIEVEMENTS.html';
const outputPath = path.join(
  __dirname,
  '..',
  'public',
  'json-files',
  'achievements',
  'achievements.json'
);

const html = fs.readFileSync(sourcePath, 'utf8');

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCell(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '));
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/#1/g, 'number-one')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toCamel(value) {
  const slug = slugify(value);
  return slug.replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

function titleCase(value) {
  const smallWords = new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'by',
    'for',
    'in',
    'of',
    'on',
    'or',
    'the',
    'to',
    'with',
    'without'
  ]);

  return String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .map((word, index, words) => {
      if (!word) return word;
      if (/^#?\d/.test(word)) return word.toUpperCase();
      if (['oe', 'nsfw', 'mvp', 'xd', 'am'].includes(word)) {
        return word.toUpperCase();
      }
      if (word === "i'll") return "I'll";
      if (smallWords.has(word) && index > 0 && index < words.length - 1) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/\bConffession\b/g, 'Confession')
    .replace(/\bCompleitionist\b/g, 'Completionist')
    .replace(/\bAllegdly\b/gi, 'Allegedly')
    .replace(/\bIts April Fool\b/g, 'April Fool');
}

function sentenceCase(value) {
  const text = String(value || '')
    .toLowerCase()
    .replace(/\b(\d+)times\b/g, '$1 times')
    .replace(/\b(\d+)am\b/g, '$1 AM')
    .replace(/\bnsfw\b/g, 'NSFW')
    .replace(/\boe\b/g, 'OE')
    .replace(/\bam\b/g, 'AM')
    .replace(/\b404\b/g, '404')
    .replace(/\bapril 1st\b/g, 'April 1st')
    .replace(/\bminimum\b/g, 'minimum')
    .replace(/\bmin\b/g, 'minimum')
    .replace(/"have not"/g, '"Have not"')
    .replace(/"have"/g, '"Have"')
    .replace(/\bmafia\b/g, 'mafia')
    .replace(/\bcivilian\b/g, 'civilian')
    .replace(/\bimposter\b/g, 'imposter')
    .replace(/\boverexposure\b/g, 'Overexposure');

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

const missingDescriptions = {
  'Honest Soul': 'Complete 10 truths in a row without skipping',
  'Balls To The Wall': 'Complete 10 dares in a row without skipping'
};

const descriptionOverrides = {
  'Pack Explorer': 'Play with 20 different packs across different game modes',
  'Mass Confusion': 'Every player receives one vote',
  'Group Confession': 'Everyone votes "Have" in a round',
  'Not A Single Soul': 'Everyone votes "Have not" in a round',
  'Pure As Snow': 'Be the only "Have not" vote',
  Saint: 'Complete a session without voting "Have"',
  'Pack Hunter': 'Unlock or buy your first pack',
  Collector: 'Own 10 packs or cosmetic bundles',
  'Nothing To See Here, Allegedly': 'Visit the 404 page',
  'Fresh And Fitted': 'Customise your OE for the first time',
  'Matching Set': 'Equip a matching customisation set',
  Storyteller: 'Create 10 Overexposure posts',
  'The Rabbit Hole': 'Read 50 Overexposure posts',
  'Clean Slate': 'Delete one of your own posts'
};

const requirementOverrides = {
  'Main Character': 'Minimum 3 players',
  'Unanimous MVP': 'Minimum 3 players',
  'Are You Real?': 'Minimum 10 rounds',
  'Pure As Snow': 'Minimum 4 players',
  'Mass Confusion': 'Minimum 4 players',
  'Perfect Read': 'Minimum 4 players',
  'Hot Take': 'Minimum 4 players',
  'No Fear': 'NSFW enabled',
  "Pinocchio's Doppelganger": 'Drinking rules enabled',
  'Self Aware': 'Self-voting enabled',
  'Well This Is Awkward': 'Self-voting enabled'
};

const hiddenAchievementNames = new Set(['Is Anyone Home?']);

const categoryGamemodes = {
  'general-online': null,
  'truth-or-dare-online': 'truth-or-dare',
  'paranoia-online': 'paranoia',
  'most-likely-to-online': 'most-likely-to',
  'never-have-i-ever-online': 'never-have-i-ever',
  'would-you-rather-online': 'would-you-rather',
  'imposter-online': 'imposter',
  'mafia-online': 'mafia',
  account: null,
  customisation: null,
  'friends-social': null,
  overexposure: null,
  help: null,
  settings: null,
  shop: null,
  other: null,
  seasonal: null
};

function parseNumber(text, fallback = 1) {
  const match = String(text || '').match(/\b(\d{1,4}(?:,\d{3})?)\b/);
  if (!match) return fallback;
  return Number(match[1].replace(/,/g, ''));
}

function parseMinPlayers(requirements) {
  const match = String(requirements || '').match(/(?:minimum|min)\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function pickRequirementType(description) {
  const text = description.toLowerCase();
  if (
    /\b\d+\s+(online games|games|truths|dares|prompts|times|rounds|votes|friends|posts|packs|players|days|hours)\b/.test(
      text
    )
  ) {
    return 'stat_threshold';
  }
  if (
    /\b(create|verify|change|customise|equip|add|invite|open|read|delete|visit|toggle|unlock|buy)\b/.test(
      text
    ) &&
    !/\b\d+\s+(online games|games|truths|dares|prompts|times|rounds|votes|friends|posts|packs|players)\b/.test(
      text
    )
  ) {
    return 'event';
  }
  if (
    /\b(play|host|complete|create|read|add|receive|vote|win|own|unlock|buy|change|toggle|visit|open|invite|delete)\b/.test(
      text
    )
  ) {
    return /\b\d/.test(text) ? 'stat_threshold' : 'event';
  }
  return 'event';
}

function pickRarity(description, hidden) {
  if (hidden) return 'secret';
  const value = parseNumber(description, 1);
  if (value >= 1000) return 'legendary';
  if (value >= 100) return 'epic';
  if (value >= 25) return 'rare';
  if (value >= 10) return 'uncommon';
  return 'common';
}

function pickPoints(rarity) {
  return {
    common: 10,
    uncommon: 20,
    rare: 35,
    epic: 50,
    legendary: 100,
    secret: 50
  }[rarity];
}

function pickRewards(rarity) {
  const rewards = {
    common: { opals: 10, xp: 50 },
    uncommon: { opals: 20, xp: 100 },
    rare: { opals: 35, xp: 175 },
    epic: { opals: 60, xp: 300 },
    legendary: { opals: 120, xp: 600 },
    secret: { opals: 150, xp: 750 }
  }[rarity];

  return rewards
    ? [
        { type: 'opals', amount: rewards.opals },
        { type: 'xp', amount: rewards.xp }
      ]
    : [];
}

const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
  [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
    cleanCell(cell[1])
  )
);

let currentCategory = '';
const achievements = [];

for (const cells of rows) {
  if (!cells.length) continue;
  if (cells.length === 1) {
    currentCategory = titleCase(cells[0]);
    continue;
  }
  if (cells[0] === 'STATUS' || !cells[1]) continue;

  const name = titleCase(cells[1])
    .replace("Fine. I'll Do It Myself", "Fine, I'll Do It Myself")
    .replace(
      'Nothing To See Here (Allegedly)',
      'Nothing To See Here, Allegedly'
    )
    .replace('Story Teller', 'Storyteller');
  const key = slugify(name);
  const sourceCategory = slugify(currentCategory);
  const taxonomy = normalizeAchievementTaxonomy({
    category: sourceCategory,
    gamemode: categoryGamemodes[sourceCategory]
  });
  const hidden =
    /^true$/i.test(cells[4] || '') || hiddenAchievementNames.has(name);
  const descriptionSource =
    descriptionOverrides[name] || cells[2] || missingDescriptions[name] || '';
  const description = sentenceCase(descriptionSource);
  const requirementText = sentenceCase(
    requirementOverrides[name] || cells[3] || ''
  );
  const requirementType = pickRequirementType(description);
  const rarity = pickRarity(description, hidden);
  const statName = toCamel(key);
  const requirementValue =
    requirementType === 'event' ? 1 : parseNumber(description, 1);

  achievements.push({
    key,
    name,
    description,
    image: `/images/achievements/icons/${getAchievementIconDirectory(
      taxonomy
    )}/${key}.svg`,
    category: taxonomy.category,
    subcategory: taxonomy.subcategory,
    gamemode: taxonomy.gamemode,
    requirementType,
    eventType: requirementType === 'event' ? `achievement.${key}` : null,
    statPath:
      requirementType === 'event'
        ? null
        : `gameData.achievementStats.${statName}`,
    statKey: statName,
    requirementValue,
    minPlayers: parseMinPlayers(requirementText),
    points: pickPoints(rarity),
    rarity,
    hidden,
    enabled: isAchievementAvailableToStandardAccounts(taxonomy),
    status: 'published',
    sortOrder: (achievements.length + 1) * 10,
    tags: [
      taxonomy.category,
      taxonomy.subcategory,
      taxonomy.gamemode,
      hidden ? 'hidden' : null,
      requirementType
    ].filter(Boolean),
    rewards: pickRewards(rarity),
    metadata: {
      requirements: requirementText || '',
      source: 'overexposed-achievements-html'
    }
  });
}

fs.writeFileSync(outputPath, `${JSON.stringify({ achievements }, null, 2)}\n`);
console.log(`Wrote ${achievements.length} achievements to ${outputPath}`);
