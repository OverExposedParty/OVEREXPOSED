const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const projectRoot = path.join(__dirname, '..', '..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function loadTemplate(relativePath) {
  return new JSDOM(readProjectFile(relativePath)).window.document;
}

test('dynamic party-game choices opt into option-selection audio', () => {
  const onlineButtonFactory = readProjectFile(
    'public/scripts/party-games/gamemode/online/general/' +
      'party-games-online-instructions/actions.js'
  );
  const offlineImposter = readProjectFile(
    'public/scripts/party-games/gamemode/offline/imposter/imposter-gamemode.js'
  );

  assert.match(onlineButtonFactory, /button\.classList\.add\('sound-option'\)/);
  assert.match(
    offlineImposter,
    /classList\.add\('player-button', 'sound-option'\)/
  );
});

test('static game choices and their action buttons use semantic audio roles', () => {
  const templateExpectations = [
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/would-you-rather-template.html',
      options: ['button#a', 'button#b']
    },
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/never-have-i-ever-template.html',
      options: ['#yes', '#no']
    },
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/paranoia-template.html',
      options: ['#heads', '#tails']
    },
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/mafia-template.html',
      options: [
        '#select-civilian-watch-container .button-container [id="0"]',
        '#select-civilian-watch-container .button-container [id="1"]',
        '#select-civilian-watch-container .button-container [id="2"]'
      ],
      confirmations: [
        '#select-user-day-phase-container .sound-confirm',
        '#select-user-night-phase-container .sound-confirm',
        '#select-civilian-watch-container .sound-confirm'
      ]
    },
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/general/player-selection-template.html',
      confirmations: ['.sound-confirm']
    },
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/most-likely-to-template.html',
      confirmations: ['.sound-confirm']
    },
    {
      path:
        'public/html-templates/online/party-games/' +
        'selected-user-containers/party-games-template.html',
      confirmations: [
        '#complete-punishment-container .sound-confirm',
        '#select-punishment-container .sound-confirm'
      ]
    },
    {
      path:
        'public/html-templates/party-games/offline/imposter/' +
        'imposter-template.html',
      confirmations: [
        '#select-player-container .sound-confirm',
        '#display-prompt-container .sound-confirm',
        '#start-timer-container .sound-confirm'
      ]
    }
  ];

  templateExpectations.forEach((expectation) => {
    const document = loadTemplate(expectation.path);

    (expectation.options || []).forEach((selector) => {
      assert.ok(
        document.querySelector(selector)?.classList.contains('sound-option'),
        `${expectation.path} ${selector} should use option audio`
      );
    });

    (expectation.confirmations || []).forEach((selector) => {
      assert.ok(
        document.querySelector(selector)?.classList.contains('sound-confirm'),
        `${expectation.path} ${selector} should use confirmation audio`
      );
    });
  });
});
