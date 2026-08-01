const fs = require('fs');
const path = require('path');
const {
  normalizeAchievementTaxonomy
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

document.achievements = document.achievements.map((achievement) => {
  const taxonomy = normalizeAchievementTaxonomy(achievement);
  const migrated = {};

  Object.entries(achievement).forEach(([key, value]) => {
    if (key === 'subcategory') return;
    if (key === 'category') {
      migrated.category = taxonomy.category;
      migrated.subcategory = taxonomy.subcategory;
      return;
    }
    migrated[key] = key === 'gamemode' ? taxonomy.gamemode : value;
  });

  return migrated;
});

fs.writeFileSync(achievementsPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Migrated ${document.achievements.length} achievement taxonomies.`);
