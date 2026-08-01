const fs = require('fs');
const path = require('path');
const {
  isAchievementAvailableToStandardAccounts
} = require('../models/content/achievement-taxonomy');

const achievementsPath = path.join(
  __dirname,
  '..',
  'public',
  'json-files',
  'achievements',
  'achievements.json'
);
const document = JSON.parse(fs.readFileSync(achievementsPath, 'utf8'));
if (!Array.isArray(document.achievements)) {
  throw new Error(
    'Achievement catalogue does not contain an achievements array.'
  );
}

const disabledKeys = [];
document.achievements = document.achievements.map((achievement) => {
  if (isAchievementAvailableToStandardAccounts(achievement)) {
    return achievement;
  }
  disabledKeys.push(achievement.key);
  return { ...achievement, enabled: false };
});

fs.writeFileSync(achievementsPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `Disabled ${disabledKeys.length} achievements unavailable to standard accounts.`
);
