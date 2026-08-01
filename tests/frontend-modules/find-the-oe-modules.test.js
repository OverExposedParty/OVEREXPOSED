const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const applicationsDirectory = path.join(
  __dirname,
  '../../public/scripts/other/applications'
);
const facadePath = path.join(applicationsDirectory, 'find-the-oe.js');
const supportScripts = [
  'find-the-oe/shared.js',
  'find-the-oe/round-layout.js',
  'find-the-oe/game.js'
];

test('Find The OE facade loads support modules in dependency order', () => {
  const facade = fs.readFileSync(facadePath, 'utf8');
  let previousIndex = -1;

  supportScripts.forEach((scriptPath) => {
    const index = facade.indexOf(`/scripts/other/applications/${scriptPath}`);

    assert.ok(index > previousIndex, `${scriptPath} should follow its dependencies`);
    previousIndex = index;
  });
});

test('Find The OE support modules register their shared game factory', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    const source = fs.readFileSync(path.join(applicationsDirectory, scriptPath), 'utf8');
    vm.runInContext(source, context, { filename: scriptPath });
  });

  const modules = context.window.Error404FindTheOeModules;
  assert.equal(typeof modules.createFindTheOeGame, 'function');
  assert.equal(typeof modules.createPositionedPieces, 'function');
  assert.equal(typeof modules.loadCustomisationSlots, 'function');
});

test('Find The OE facade keeps the Error 404 registration contract', () => {
  const context = vm.createContext({ window: {} });

  vm.runInContext(fs.readFileSync(facadePath, 'utf8'), context, {
    filename: 'find-the-oe.js'
  });

  assert.equal(
    typeof context.window.Error404Applications['find-the-oe-game'].init,
    'function'
  );
});

test('Find The OE reaches its start screen after its modules load', async () => {
  const dom = new JSDOM('<div id="mount"></div>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/'
  });
  const { window } = dom;
  const slotItems = {
    colour: [{ id: 'colour-1', slot: 'colour', 'file-path': '/colour.svg' }],
    'head-slot': [{ id: 'head-1', slot: 'head-slot', 'file-path': '/head.svg' }],
    'eyes-slot': [{ id: 'eyes-1', slot: 'eyes-slot', 'file-path': '/eyes.svg' }],
    'mouth-slot': [{ id: 'mouth-1', slot: 'mouth-slot', 'file-path': '/mouth.svg' }]
  };

  window.fetch = async (url) => ({
    ok: true,
    json: async () => String(url).endsWith('oe-image-packs')
      ? [{ 'pack-path': '/pack.json' }]
      : slotItems
  });

  supportScripts.forEach((scriptPath) => {
    window.eval(fs.readFileSync(path.join(applicationsDirectory, scriptPath), 'utf8'));
  });
  window.eval(fs.readFileSync(facadePath, 'utf8'));

  const mount = window.document.getElementById('mount');
  const instance = await window.Error404Applications['find-the-oe-game'].init({ mount });

  assert.equal(instance.id, 'find-the-oe-game');
  assert.equal(mount.dataset.applicationReady, 'true');
  assert.ok(mount.querySelector('.find-the-oe-start'));
  instance.destroy();
  dom.window.close();
});
