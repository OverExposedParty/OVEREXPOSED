const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('Mafia roles exist only in the dedicated role catalog', () => {
  const root = path.join(process.cwd(), 'public', 'json-files', 'party-games');
  const packs = JSON.parse(
    fs.readFileSync(path.join(root, 'packs', 'mafia.json'), 'utf8')
  );
  const rules = JSON.parse(
    fs.readFileSync(path.join(root, 'settings', 'mafia.json'), 'utf8')
  );
  const roles = JSON.parse(
    fs.readFileSync(path.join(root, 'roles', 'mafia.json'), 'utf8')
  );

  assert.deepEqual(packs['mafia-packs'], []);
  assert.equal(
    rules['mafia-settings'].some((rule) =>
      ['mafioso', 'inspector'].includes(rule['settings-name'])
    ),
    false
  );
  assert.deepEqual(
    roles['mafia-roles'].map((role) => role['role-name']),
    [
      'civilian',
      'mafioso',
      'inspector',
      'godfather',
      'mayor',
      'serial-killer',
      'lawyer'
    ]
  );
});
