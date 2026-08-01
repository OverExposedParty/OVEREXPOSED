const fs = require('fs');
const path = require('path');
const {
  getAchievementIconDirectory
} = require('../models/content/achievement-taxonomy');

const iconsRoot = path.resolve(
  __dirname,
  '..',
  'public',
  'images',
  'achievements',
  'icons'
);
const achievementsPath = path.resolve(
  __dirname,
  '..',
  'public',
  'json-files',
  'achievements',
  'achievements.json'
);
const directoryMigrations = Object.freeze({
  account: 'account/profile',
  settings: 'account/settings',
  customisation: 'customisation/appearance',
  'friends-social': 'social/friends',
  'general-online': 'gameplay/online',
  'imposter-online': 'gameplay/online/imposter',
  'mafia-online': 'gameplay/online/mafia',
  'most-likely-to-online': 'gameplay/online/most-likely-to',
  'never-have-i-ever-online': 'gameplay/online/never-have-i-ever',
  'paranoia-online': 'gameplay/online/paranoia',
  'truth-or-dare-online': 'gameplay/online/truth-or-dare',
  'would-you-rather-online': 'gameplay/online/would-you-rather',
  help: 'community/help',
  overexposure: 'community/overexposure',
  seasonal: 'events/seasonal',
  shop: 'shop/collections',
  other: 'other/general'
});

function resolveWithinIcons(relativePath) {
  const resolvedPath = path.resolve(iconsRoot, relativePath);
  if (
    resolvedPath !== iconsRoot &&
    !resolvedPath.startsWith(`${iconsRoot}${path.sep}`)
  ) {
    throw new Error(
      `Icon path escapes the achievements directory: ${relativePath}`
    );
  }
  return resolvedPath;
}

const moves = [];
Object.entries(directoryMigrations).forEach(
  ([sourceDirectory, targetDirectory]) => {
    const sourcePath = resolveWithinIcons(sourceDirectory);
    const targetPath = resolveWithinIcons(targetDirectory);
    if (!fs.existsSync(sourcePath)) return;

    fs.readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .forEach((entry) => {
        const sourceFile = path.resolve(sourcePath, entry.name);
        const targetFile = path.resolve(targetPath, entry.name);
        if (fs.existsSync(targetFile)) {
          throw new Error(
            `Target achievement icon already exists: ${targetFile}`
          );
        }
        moves.push({ sourceFile, targetFile, targetPath });
      });
  }
);

moves.forEach(({ sourceFile, targetFile, targetPath }) => {
  fs.mkdirSync(targetPath, { recursive: true });
  fs.renameSync(sourceFile, targetFile);
});

Object.keys(directoryMigrations)
  .sort((left, right) => right.length - left.length)
  .forEach((sourceDirectory) => {
    const sourcePath = resolveWithinIcons(sourceDirectory);
    if (fs.existsSync(sourcePath) && fs.readdirSync(sourcePath).length === 0) {
      try {
        fs.rmdirSync(sourcePath);
      } catch (error) {
        if (!['EBUSY', 'EPERM'].includes(error.code)) throw error;
        console.warn(`Could not remove locked empty directory: ${sourcePath}`);
      }
    }
  });

const document = JSON.parse(fs.readFileSync(achievementsPath, 'utf8'));
if (!Array.isArray(document.achievements)) {
  throw new Error(
    'Achievement catalogue does not contain an achievements array.'
  );
}

document.achievements = document.achievements.map((achievement) => {
  const fileName = path.posix.basename(
    achievement.image || `${achievement.key}.svg`
  );
  return {
    ...achievement,
    image: `/images/achievements/icons/${getAchievementIconDirectory(
      achievement
    )}/${fileName}`
  };
});

fs.writeFileSync(achievementsPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `Moved ${moves.length} icons and updated ${document.achievements.length} achievements.`
);
