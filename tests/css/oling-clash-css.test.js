const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const clashStyles = fs.readFileSync(
  path.join(__dirname, '../../public/css/olings/clash/clash.css'),
  'utf8'
);
const clashPage = fs.readFileSync(
  path.join(__dirname, '../../public/pages/olings/clash.html'),
  'utf8'
);
const tagIcon = fs.readFileSync(
  path.join(__dirname, '../../public/images/olings/clash/ui/actions/tag.svg'),
  'utf8'
);

function getRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    clashStyles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ||
    ''
  );
}

test('Clash Tag and ability pip borders share the doubled proportional weight', () => {
  const tagRule = getRule('.olings-clash-tag-resource__pip');
  const abilityRule = getRule('.olings-clash-activation-pip::before');
  const tagBorder = Number(tagRule.match(/border:\s*([\d.]+)em solid/)?.[1]);
  const abilityBorder = Number(
    abilityRule.match(/border:\s*([\d.]+)em solid/)?.[1]
  );

  assert.equal(tagBorder, 0.34375);
  assert.equal(abilityBorder, 0.281875);
  assert.equal(tagBorder / 1, abilityBorder / 0.82);
});

test('Selected Clash Tag icons replace their button fill with arena SVG colours', () => {
  assert.match(tagIcon, /id="tag-primary"/);
  assert.match(tagIcon, /id="tag-secondary"/);
  assert.equal((clashPage.match(/tag\.svg#tag-primary/g) || []).length, 3);
  assert.equal((clashPage.match(/tag\.svg#tag-secondary/g) || []).length, 3);
  assert.match(
    getRule('button.olings-clash-tag.is-selected .olings-clash-tag__primary'),
    /fill:\s*var\(--clash-game-panel\)/
  );
  assert.match(
    getRule('button.olings-clash-tag.is-selected .olings-clash-tag__secondary'),
    /fill:\s*var\(--clash-game-panel-deep\)/
  );
  assert.match(
    getRule('button.olings-clash-tag.is-tag-spinning'),
    /background:\s*transparent/
  );
});

test('Previous Clash moves use labelled square ability cards', () => {
  const previousMoveRule = getRule('.olings-clash-round-ability');
  const hiddenMoveRule = getRule('.olings-clash-round-ability[hidden]');

  assert.match(previousMoveRule, /aspect-ratio:\s*1/);
  assert.match(
    previousMoveRule,
    /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/
  );
  assert.match(clashPage, /YOUR MOVE/);
  assert.match(clashPage, /THEIR MOVE/);
  assert.match(hiddenMoveRule, /display:\s*grid/);
  assert.match(hiddenMoveRule, /visibility:\s*hidden/);
  assert.match(hiddenMoveRule, /pointer-events:\s*none/);
  assert.match(
    getRule('.olings-clash-round-ability.is-winner'),
    /background:\s*var\(--clash-game-ink\)/
  );
  assert.match(
    getRule('.olings-clash-round-ability.is-draw'),
    /background:\s*var\(--clash-game-panel-deep\)/
  );
});

test('Clash inspector uses the CSS background with a visible status container', () => {
  assert.match(
    getRule('.olings-clash-inspector-content'),
    /background:\s*var\(--backgroundcolour, #202020\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-overview h3'),
    /color:\s*var\(--clash-game-ink\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-profile'),
    /grid-template-columns:\s*var\(--clash-inspector-profile-art-size\) minmax\(190px, 0\.8fr\)\s*minmax\(220px, 1fr\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-profile__art'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-health'),
    /justify-content:\s*flex-start/
  );
});

test('Clash inspector places Vitality and Current Status beside its art', () => {
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-vitality,\s*\.olings-clash-inspector-profile\s*>\s*\.olings-clash-inspector-active-effects\s*\{[^}]*height:\s*100%[^}]*background:\s*rgb\(255 255 255 \/ 10%\)/s
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-vitality,\s*\.olings-clash-inspector-profile\s*>\s*\.olings-clash-inspector-active-effects\s*\{[^}]*overflow:\s*hidden/s
  );
});

test('Clash profile panels share a height and place identity around the art', () => {
  assert.match(
    getRule('.olings-clash-inspector-profile'),
    /--clash-inspector-profile-art-size:\s*clamp\(104px, 15cqw, 126px\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-profile__art'),
    /position:\s*relative/
  );
  assert.match(
    getRule('.olings-clash-inspector-profile'),
    /grid-auto-rows:\s*var\(--clash-inspector-profile-art-size\)/
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile__art h2\s*\{\s*position:\s*absolute/
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile__art small\s*\{\s*position:\s*absolute/
  );
  assert.match(
    getRule('.olings-clash-inspector-header [data-clash-inspector-position]'),
    /color:\s*var\(--backgroundcolour, #202020\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-header [data-clash-inspector-position]'),
    /font-size:\s*1\.71rem/
  );
  assert.match(
    getRule('.olings-clash-inspector-header'),
    /padding:\s*18px 24px/
  );
});

test('Clash inspector fills its ability row and colour-codes move history', () => {
  assert.match(
    getRule('.olings-clash-inspector-abilities__grid'),
    /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-ability'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-ability-detail'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-active-effects__list article'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-last-move__card.is-win'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-last-move__card.is-loss'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-last-move__card.is-draw'),
    /background:\s*rgb\(255 255 255 \/ 10%\)/
  );
  assert.match(
    getRule(
      '.olings-clash-inspector-last-move__card.is-win > span:last-child > strong'
    ),
    /color:\s*var\(--clash-game-ink\)/
  );
  assert.match(
    getRule(
      '.olings-clash-inspector-last-move__card.is-loss > span:last-child > strong'
    ),
    /color:\s*color-mix\(in srgb, var\(--clash-game-secondary\) 68%, white\)/
  );
});

test('Clash inspector uses readable type and a stable description height', () => {
  assert.match(
    getRule('.olings-clash-inspector-overview h3'),
    /font-size:\s*0\.92rem/
  );
  assert.match(
    getRule('.olings-clash-inspector-ability > strong'),
    /font-size:\s*0\.94rem/
  );
  assert.match(
    getRule('.olings-clash-inspector-ability-detail'),
    /height:\s*120px/
  );
  assert.match(
    getRule('.olings-clash-inspector-ability-detail p'),
    /font-size:\s*0\.9rem/
  );
  assert.match(
    getRule('.olings-clash-inspector'),
    /width:\s*min\(820px, 100%\)/
  );
});

test('Clash inspector centres ability names and cadence pips as one line', () => {
  const nameRule = getRule('.olings-clash-inspector-ability > strong');
  assert.match(nameRule, /display:\s*inline-flex/);
  assert.match(nameRule, /align-items:\s*center/);
  assert.match(nameRule, /justify-content:\s*center/);
  assert.equal(
    getRule(
      '.olings-clash-inspector-ability > .olings-clash-activation-pips'
    ).trim(),
    ''
  );
});

test('Clash inspector compacts status and vitality icons without overflow', () => {
  assert.match(
    getRule('.olings-clash-inspector-health'),
    /flex-wrap:\s*nowrap/
  );
  assert.match(
    getRule('.olings-clash-inspector-health .olings-clash-health-unit'),
    /flex:\s*1 1 var\(--clash-health-unit-size\)/
  );
  assert.match(
    getRule('.olings-clash-inspector-ability__states em'),
    /background:\s*transparent/
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile\s*>\s*\.olings-clash-inspector-active-effects\s+\.olings-clash-inspector-active-effects__list\s*\{[^}]*display:\s*flex/s
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile\s*>\s*\.olings-clash-inspector-active-effects\s+\.olings-clash-inspector-active-effects__list\s*\{[^}]*flex-wrap:\s*nowrap/s
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile[\s\S]*?\.olings-clash-inspector-active-effects__list\s+article\s*\{[^}]*aspect-ratio:\s*1/s
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile[\s\S]*?\.olings-clash-inspector-active-effects__list\s+article\s*\{[^}]*flex:\s*0 1 var\(--clash-status-tile-size\)/s
  );
  assert.match(
    clashStyles,
    /\.olings-clash-inspector-profile[\s\S]*?\.olings-clash-inspector-active-effects__list\s+article\s*>\s*span\s*\{[^}]*display:\s*none/s
  );
  assert.doesNotMatch(
    clashStyles,
    /\.olings-clash-inspector-active-effects__list\s*\{[^}]*overflow-y:\s*auto/s
  );
});

test('Clash picker effects use one full-width half-height row', () => {
  const rowRule = getRule('.olings-clash-picker__choices.is-effect-row');
  assert.match(rowRule, /width:\s*100%/);
  assert.match(rowRule, /grid-template-rows:\s*1fr/);
  assert.match(
    rowRule,
    /grid-template-columns:\s*repeat\(\s*var\(--clash-picker-choice-count, 1\)/
  );
  assert.match(
    getRule('.olings-clash-picker-choice.is-effect-choice'),
    /height:\s*clamp\(72px, 10cqh, 100px\)/
  );
  assert.match(
    clashStyles,
    /\.olings-clash-picker__choices\.is-icon-only[\s\S]*?strong\s*\{[^}]*display:\s*none/s
  );
});
