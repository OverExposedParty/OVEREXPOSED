const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const accountModuleFiles = [
  'account-container/account-container-core.js',
  'account-container/account-container-profile.js',
  'account-container/account-container-security.js',
  'account-container/account-container-friends-rendering.js',
  'account-container/account-container-friends.js',
  'account-container/account-container-purchases.js',
  'account-container/account-container-achievements.js',
  'account-container/account-container-statistics.js',
  'account-container/account-container-notifications.js',
  'account-container/account-container-navigation.js',
  'account-container/account-container-customisation.js'
];
const accountEntryFile = 'account-container/account-container.js';

test('account container feature scripts share the ordered browser context', () => {
  const dom = new JSDOM('<!doctype html><body></body>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.app/'
  });
  const context = dom.getInternalVMContext();

  accountModuleFiles.forEach((file) => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../public/scripts/general', file),
      'utf8'
    );
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  const functionNames = [
    'renderAccountProfilePanel',
    'renderAccountSecurityPanel',
    'renderAccountFriendsPanel',
    'renderAccountPurchaseHistoryPanel',
    'renderAccountAchievementsPanel',
    'renderAccountStatisticsPanel',
    'renderAccountNotificationsPanel',
    'setAccountExpandedPanel',
    'renderAccountPreviewIcon'
  ];
  functionNames.forEach((functionName) => {
    assert.equal(
      vm.runInContext(`typeof ${functionName}`, context),
      'function',
      `${functionName} should be available to later account scripts`
    );
  });

  assert.deepEqual(
    vm.runInContext(
      `JSON.stringify(parseAccountCustomisationString('0001:0203:0405:0607'))`,
      context
    ),
    JSON.stringify({
      colourSlotId: '0001',
      headSlotId: '0203',
      eyesSlotId: '0405',
      mouthSlotId: '0607'
    })
  );
  assert.equal(typeof dom.window.renderAccountPreviewIcon, 'function');
  assert.equal(typeof dom.window.saveAccountOeCustomisation, 'function');

  dom.window.close();
});

test('closing the account container resets its view to the main menu', async () => {
  const dom = new JSDOM(
    `<!doctype html>
      <body>
        <div id="account-container" class="account-container is-visible">
          <p id="account-subtitle"></p>
          <section id="account-expanded-panel">
            <h2 id="account-expanded-title"></h2>
            <div id="account-expanded-content"></div>
          </section>
        </div>
      </body>`,
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/'
    }
  );
  const context = dom.getInternalVMContext();

  context.fetch = () => new Promise(() => {});
  context.setInterval = () => 0;
  context.SetScriptLoaded = () => {};
  context.accountContainer =
    dom.window.document.getElementById('account-container');
  context.settingsElementClassArray = [];
  context.isContainerVisible = (element) =>
    element?.classList.contains('is-visible');
  context.addElementIfNotExists = (array, element) => {
    if (!array.includes(element)) array.push(element);
  };
  context.showContainer = (element) => {
    element.classList.add('is-visible');
  };
  context.toggleOverlay = () => {};

  [...accountModuleFiles, accountEntryFile].forEach((file) => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../public/scripts/general', file),
      'utf8'
    );
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  vm.runInContext(
    `accountExpandedAction = 'profile';
     accountCustomisationEditMode = true;
     accountContainer.classList.add('has-expanded-action', 'is-editing');
     accountExpandedTitle.textContent = 'PROFILE';
     accountExpandedContent.textContent = 'Profile content';
     accountContainer.classList.remove('is-visible');`,
    context
  );

  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

  assert.equal(
    vm.runInContext('accountExpandedAction', context),
    '',
    'the expanded action should be cleared'
  );
  assert.equal(
    vm.runInContext('accountCustomisationEditMode', context),
    false,
    'customisation mode should be cleared'
  );
  assert.equal(
    dom.window.document
      .getElementById('account-container')
      .classList.contains('has-expanded-action'),
    false
  );
  assert.equal(
    dom.window.document
      .getElementById('account-container')
      .classList.contains('is-editing'),
    false
  );
  assert.equal(
    dom.window.document.getElementById('account-expanded-title').textContent,
    ''
  );
  assert.equal(
    dom.window.document.getElementById('account-expanded-content').children
      .length,
    0
  );

  dom.window.close();
});

test('notifications panel renders the inbox and marks visible items as read', async () => {
  const dom = new JSDOM(
    '<!doctype html><body><div id="account-expanded-content"></div></body>',
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/'
    }
  );
  const context = dom.getInternalVMContext();
  const requests = [];
  const stateUpdates = [];
  context.window.OEAccountNotificationState = {
    setAccountNotifications(update) {
      stateUpdates.push(update);
    }
  };
  context.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (options.method === 'PATCH') {
      return {
        ok: true,
        async json() {
          return { data: { unreadCount: 0 } };
        }
      };
    }
    if (url === '/api/achievements') {
      return {
        ok: true,
        async json() {
          return {
            data: {
              achievements: [
                {
                  key: 'first-steps',
                  image: '/images/achievements/icons/first-steps.svg',
                  rarity: 'rare'
                }
              ]
            }
          };
        }
      };
    }
    if (url === '/api/oe-library') {
      return {
        ok: true,
        async json() {
          return {
            packs: [
              {
                items: [
                  ['0001', 'colour', '/images/oe/colour.svg'],
                  ['0203', 'head-slot', '/images/oe/head.svg'],
                  ['0405', 'eyes-slot', '/images/oe/eyes.svg'],
                  ['0607', 'mouth-slot', '/images/oe/mouth.svg']
                ].map(([id, slot, filePath]) => ({
                  id,
                  slot,
                  filePath,
                  access: { unlocked: true }
                }))
              }
            ]
          };
        }
      };
    }
    return {
      ok: true,
      async json() {
        return {
          data: {
            unreadCount: 2,
            inboxNotifications: [
              {
                id: 'notification-one',
                type: 'friend_request',
                category: 'social',
                username: 'A Friend',
                actorOeIcon: '0001:0203:0405:0607',
                createdAt: '2026-07-31T12:00:00.000Z',
                readAt: null
              },
              {
                id: 'achievement-notification',
                type: 'achievement_unlocked',
                category: 'progression',
                achievementKey: 'first-steps',
                createdAt: '2026-07-31T12:05:00.000Z',
                readAt: null
              }
            ]
          }
        };
      }
    };
  };

  [
    'account-container/account-container-core.js',
    'account-container/account-container-customisation.js',
    'account-container/account-container-achievements.js',
    'account-container/account-container-notifications.js'
  ].forEach((file) => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../public/scripts/general', file),
      'utf8'
    );
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  vm.runInContext("accountExpandedAction = 'notifications'", context);
  await vm.runInContext('renderAccountNotificationsPanel()', context);

  const content = dom.window.document.getElementById(
    'account-expanded-content'
  );
  assert.equal(
    content.querySelectorAll('.account-notification-card').length,
    2
  );
  assert.equal(
    content.querySelector('.account-notification-title').textContent,
    'New friend request'
  );
  assert.equal(
    content
      .querySelector('.account-notification-card')
      .classList.contains('is-unread'),
    false
  );
  const achievementAction = content.querySelector(
    '[data-notification-action="achievements"]'
  );
  assert.equal(achievementAction.dataset.achievementKey, 'first-steps');
  assert.equal(content.querySelector('.account-notification-marker'), null);
  assert.equal(
    content.querySelector('.account-notification-visual.is-oe .image-stack')
      .children.length,
    4
  );
  assert.equal(
    content.querySelector('.account-notification-achievement-icon').src,
    'https://overexposed.app/images/achievements/icons/first-steps.svg'
  );
  assert.equal(
    content.querySelector('.account-notification-achievement-border').src,
    'https://overexposed.app/images/achievements/borders/rare.svg'
  );
  const readRequest = requests.find(
    ({ options }) => options.method === 'PATCH'
  );
  assert.deepEqual(JSON.parse(readRequest.options.body), {
    action: 'read',
    notificationIds: ['notification-one', 'achievement-notification']
  });
  assert.equal(stateUpdates.at(-1).unreadCount, 0);

  dom.window.close();
});

test('achievements render for regular signed-in accounts', async () => {
  const dom = new JSDOM(
    '<!doctype html><body><div id="account-expanded-content"></div></body>',
    {
      runScripts: 'outside-only',
      url: 'https://overexposed.app/'
    }
  );
  const context = dom.getInternalVMContext();
  context.fetch = async (url) => ({
    ok: true,
    async json() {
      if (url === '/api/achievements') {
        return {
          data: {
            rewardCatalog: [
              {
                type: 'oling_consumable',
                key: 'opal-dust',
                name: 'Refined Opal Dust',
                image: '/images/olings/consumables/refined-opal-dust.svg'
              }
            ],
            achievements: [
              {
                key: 'first-steps',
                name: 'First Steps',
                description: 'Play your first online game',
                image:
                  '/images/achievements/icons/gameplay/online/first-steps.svg',
                rarity: 'common',
                requirementValue: 1,
                sortOrder: 2
              },
              {
                key: 'getting-serious',
                name: 'Getting Serious',
                description: 'Play ten online games',
                image:
                  '/images/achievements/icons/gameplay/online/getting-serious.svg',
                rarity: 'common',
                requirementValue: 10,
                sortOrder: 1,
                rewards: [
                  { type: 'opals', amount: 20 },
                  { type: 'xp', amount: 100 }
                ]
              }
            ]
          }
        };
      }

      return {
        common: {
          label: 'Common',
          primaryColour: '#d7d4e8',
          secondaryColour: '#87839d'
        }
      };
    }
  });

  accountModuleFiles.forEach((file) => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../public/scripts/general', file),
      'utf8'
    );
    new vm.Script(source, { filename: file }).runInContext(context);
  });

  dom.window.localStorage.setItem(
    'oe-account',
    JSON.stringify({
      username: 'regular-player',
      canAccessOePanel: false,
      isAdmin: false,
      gameData: {
        achievements: [
          {
            key: 'first-steps',
            unlockedAt: '2026-07-01T12:00:00.000Z',
            rewardStatus: 'granted',
            rewardResults: [
              { type: 'opals', amount: 10, granted: true },
              { type: 'xp', amount: 50, granted: true },
              {
                type: 'oling_consumable',
                key: 'opal-dust',
                quantity: 2,
                granted: true
              }
            ]
          }
        ]
      }
    })
  );

  vm.runInContext("accountExpandedAction = 'achievements'", context);
  await vm.runInContext('renderAccountAchievementsPanel()', context);

  const content = dom.window.document.getElementById(
    'account-expanded-content'
  );
  assert.equal(content.textContent.includes('Coming soon'), false);
  assert.equal(content.querySelectorAll('.account-achievement-card').length, 2);
  assert.deepEqual(
    [...content.querySelectorAll('.account-achievement-title')].map(
      (title) => title.textContent
    ),
    ['First Steps', 'Getting Serious']
  );
  assert.equal(
    content.querySelector('.account-achievement-title').textContent,
    'First Steps'
  );
  assert.equal(
    content.querySelector('.account-achievement-status').textContent,
    'UNLOCKED'
  );
  assert.equal(
    content.querySelector('.account-achievement-meta').textContent,
    'Common'
  );

  const filterButtons = [
    ...content.querySelectorAll('.account-achievement-filter')
  ];
  const [allFilter, unlockedFilter, lockedFilter] = filterButtons;
  const unlockedCard = content.querySelector(
    '.account-achievement-card:not(.is-locked)'
  );
  const lockedCard = content.querySelector(
    '.account-achievement-card.is-locked'
  );
  assert.deepEqual(
    filterButtons.map((button) => button.textContent),
    ['All', 'Unlocked', 'Locked']
  );
  assert.equal(allFilter.getAttribute('aria-pressed'), 'true');

  lockedFilter.click();
  assert.equal(unlockedCard.hidden, true);
  assert.equal(lockedCard.hidden, false);
  assert.equal(lockedFilter.getAttribute('aria-pressed'), 'true');

  unlockedFilter.click();
  assert.equal(unlockedCard.hidden, false);
  assert.equal(lockedCard.hidden, true);
  assert.equal(unlockedFilter.getAttribute('aria-pressed'), 'true');

  allFilter.click();
  assert.equal(unlockedCard.hidden, false);
  assert.equal(lockedCard.hidden, false);
  assert.equal(allFilter.getAttribute('aria-pressed'), 'true');

  const toggle = content.querySelector('.account-achievement-details-toggle');
  const details = content.querySelector('.account-achievement-details');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(details.hidden, true);

  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(details.hidden, false);
  assert.match(
    details.querySelector('.account-achievement-unlock-date').textContent,
    /2026/
  );
  assert.deepEqual(
    [...details.querySelectorAll('.account-achievement-reward-value')].map(
      (reward) => reward.textContent
    ),
    ['10 Opals', '50 XP', 'Refined Opal Dust x2']
  );
  assert.equal(
    details.querySelector('img.account-achievement-reward-icon.is-item').src,
    'https://overexposed.app/images/olings/consumables/refined-opal-dust.svg'
  );
  assert.equal(
    details.querySelector('.account-achievement-reward-list').children.length,
    3
  );

  assert.equal(
    lockedCard.style.getPropertyValue('--achievement-rarity-primary-colour'),
    '#d7d4e8'
  );
  assert.equal(
    lockedCard.style.getPropertyValue('--achievement-primary-colour'),
    ''
  );
  const lockedToggle = lockedCard.querySelector(
    '.account-achievement-details-toggle'
  );
  lockedToggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(lockedToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(
    lockedCard.querySelector('.account-achievement-detail-label').textContent,
    'Rewards for unlocking'
  );
  assert.deepEqual(
    [...lockedCard.querySelectorAll('.account-achievement-reward-value')].map(
      (reward) => reward.textContent
    ),
    ['20 Opals', '100 XP']
  );

  let scrolledCard = null;
  dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrolledCard = this;
  };
  vm.runInContext("pendingAccountAchievementKey = 'first-steps'", context);
  await vm.runInContext('renderAccountAchievementsPanel()', context);

  const targetedCard = content.querySelector(
    '[data-achievement-key="first-steps"]'
  );
  assert.equal(targetedCard.classList.contains('is-notification-target'), true);
  assert.equal(targetedCard.classList.contains('is-expanded'), true);
  assert.equal(
    targetedCard
      .querySelector('.account-achievement-details-toggle')
      .getAttribute('aria-expanded'),
    'true'
  );
  assert.equal(
    targetedCard.querySelector('.account-achievement-details').hidden,
    false
  );
  assert.equal(scrolledCard, targetedCard);
  assert.equal(dom.window.document.activeElement, targetedCard);

  dom.window.close();
});
