const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const paletteScript = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/oe-panel/core/oe-panel-palettes.js'
  ),
  'utf8'
);

function createPaletteWindow() {
  const dom = new JSDOM('<!doctype html><main></main>', {
    runScripts: 'dangerously'
  });
  dom.window.eval(paletteScript);
  return dom;
}

test('OE panel palettes expose the established gamemode and rarity colours', () => {
  const dom = createPaletteWindow();
  try {
    const palettes = dom.window.OE_PANEL_PALETTES;
    assert.equal(palettes.get('gamemode', 'Truth or Dare').primary, '#66CCFF');
    assert.equal(palettes.get('gamemode', 'mafia').secondary, '#6D3C95');
    assert.equal(palettes.get('rarity', 'legendary').primary, '#FFB86B');
    assert.equal(palettes.get('rarity', 'secret').secondary, '#C14362');
  } finally {
    dom.window.close();
  }
});

test('OE panel palette values infer gamemodes, rarities, records, and maps', () => {
  const dom = createPaletteWindow();
  try {
    const { document, OE_PANEL_PALETTES: palettes } = dom.window;
    palettes.indexRows(
      'pack',
      [
        {
          title: 'After Dark',
          colour: '#123456',
          secondaryColour: '#654321'
        }
      ],
      { keyField: 'title' }
    );

    const gamemode = palettes.createValue({
      value: 'paranoia',
      fieldConfig: { key: 'gamemode' }
    });
    const rarity = palettes.createValue({
      value: 'rare, epic',
      fieldConfig: { key: 'rarities' }
    });
    const pack = palettes.createValue({
      value: 'After Dark',
      fieldConfig: { key: 'pack' }
    });
    const roles = palettes.createValue({
      value: '{"civilian":3}',
      row: { gamemode: 'mafia' },
      fieldConfig: {
        key: 'roleCounts',
        palette: {
          type: 'role',
          map: true,
          fallbackType: 'gamemode'
        }
      }
    });

    document.body.append(gamemode, rarity, pack, roles);
    assert.equal(
      gamemode.style.getPropertyValue('--oe-panel-palette-primary'),
      '#9D8AFF'
    );
    assert.equal(rarity.querySelectorAll('.oe-panel-palette-value').length, 2);
    assert.equal(
      pack.style.getPropertyValue('--oe-panel-palette-primary'),
      '#123456'
    );
    assert.match(roles.textContent, /civilian: 3/);
    assert.equal(
      roles
        .querySelector('.oe-panel-palette-value')
        .style.getPropertyValue('--oe-panel-palette-primary'),
      '#9B56D3'
    );
  } finally {
    dom.window.close();
  }
});

test('OE panel colour inputs keep the hex field and picker synchronized', () => {
  const dom = createPaletteWindow();
  try {
    const { document, OE_PANEL_PALETTES: palettes } = dom.window;
    const input = document.createElement('input');
    input.name = 'colour';
    input.value = '#123456';
    const wrapper = palettes.createColourInput(input);
    const picker = wrapper.querySelector('input[type="color"]');

    assert.equal(picker.value, '#123456');
    picker.value = '#abcdef';
    picker.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.equal(input.value, '#ABCDEF');
    assert.equal(wrapper.classList.contains('is-empty'), false);
  } finally {
    dom.window.close();
  }
});

test('OE panel tables render palette-backed values as colour badges', () => {
  const dom = createPaletteWindow();
  try {
    const scriptsDirectory = path.join(
      __dirname,
      '../../public/scripts/oe-panel'
    );
    dom.window.eval(
      fs.readFileSync(
        path.join(scriptsDirectory, 'widgets/oe-panel-widget-helpers.js'),
        'utf8'
      )
    );
    dom.window.OE_PANEL_WIDGET_HELPERS =
      dom.window.createOePanelWidgetHelpers();
    const scripts = [
      'oe-panel-table-widget/search-tools.js',
      'oe-panel-table-widget/expanded-row.js',
      'oe-panel-table-widget/series-renderer.js',
      'oe-panel-table-widget/oe-panel-table-widget.js'
    ];
    scripts.forEach((file) => {
      dom.window.eval(
        fs.readFileSync(path.join(scriptsDirectory, file), 'utf8')
      );
    });
    const container = dom.window.document.querySelector('main');
    dom.window.OE_PANEL_TABLE_WIDGET_RENDERER(container, {
      id: 'party-rooms',
      title: 'Rooms',
      dataSource: 'partyRooms',
      columns: [{ key: 'gamemode', label: 'Gamemode' }],
      expandedFields: [{ key: 'selectedPacks', label: 'Selected Packs' }],
      rows: [
        {
          gamemode: 'truth-or-dare',
          selectedPacks: 'classic, after-dark'
        }
      ]
    });

    const badge = container.querySelector('.oe-panel-palette-value');
    assert.equal(badge.textContent, 'truth-or-dare');
    assert.equal(
      badge.style.getPropertyValue('--oe-panel-palette-primary'),
      '#66CCFF'
    );
  } finally {
    dom.window.close();
  }
});
