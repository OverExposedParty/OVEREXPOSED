const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function loadPublicScript(window, relativePath) {
  const scriptSource = fs.readFileSync(
    path.join(PUBLIC_DIR, relativePath),
    'utf8'
  );
  window.eval(scriptSource);
}

function createChatDom(url = 'https://example.com/imposter/settings/') {
  return new JSDOM(
    `<!DOCTYPE html>
    <html>
      <body>
        <div class="chat-box">
          <div class="chat-input">
            <input type="text" />
          </div>
          <div class="chat-messages"></div>
        </div>
      </body>
    </html>`,
    {
      url,
      runScripts: 'dangerously',
      pretendToBeVisual: true
    }
  );
}

function setupChatWindow(window, { partyCode = null, chatMessages = [] } = {}) {
  window.versionAssetUrl = (src) => src;
  window.debugLog = () => {};
  window.fetch = async () => ({
    json: async () => ({ chat: chatMessages })
  });

  if (partyCode) {
    window.eval(`var partyCode = ${JSON.stringify(partyCode)};`);
  }

  loadPublicScript(window, 'scripts/general/side-buttons/side-buttons.js');
  loadPublicScript(window, 'scripts/general/messages/message-panel.js');
  loadPublicScript(window, 'scripts/general/messages/message-input.js');
  loadPublicScript(window, 'scripts/party-games/chat/party-chat-api.js');
  loadPublicScript(window, 'scripts/party-games/chat/party-chat-panel.js');
}

function trackWindowIntervals(window, t) {
  const intervalIds = [];
  const originalSetInterval = window.setInterval.bind(window);

  window.setInterval = (...args) => {
    const intervalId = originalSetInterval(...args);
    intervalIds.push(intervalId);
    return intervalId;
  };

  t.after(() => {
    intervalIds.forEach((intervalId) => window.clearInterval(intervalId));
    window.setInterval = originalSetInterval;
    window.close();
  });
}

test('party chat panel initializes unavailable chat without a mutation loop', async (t) => {
  const dom = createChatDom();
  const { window } = dom;

  trackWindowIntervals(window, t);
  setupChatWindow(window);

  let mutationCount = 0;
  const observer = new window.MutationObserver((mutations) => {
    mutationCount += mutations.length;
  });
  observer.observe(window.document.querySelector('.chat-box'), {
    attributes: true,
    attributeFilter: ['class', 'hidden']
  });

  const partyChat = window.PartyChatPanel.initDefault();

  await new Promise((resolve) => window.setTimeout(resolve, 50));
  observer.disconnect();

  const chatButton = window.document.getElementById('party-chat-side-button');
  const chatButtonShell = chatButton.closest('.side-button-shell');
  assert.ok(partyChat, 'expected party chat API to be created');
  assert.equal(window.document.querySelector('.chat-box').hidden, true);
  assert.equal(chatButton.hidden, false);
  assert.equal(chatButton.disabled, true);
  assert.equal(chatButtonShell.hidden, false);
  assert.equal(chatButtonShell.getAttribute('aria-hidden'), 'true');
  assert.ok(chatButtonShell.classList.contains('party-chat-hidden'));
  assert.ok(
    mutationCount < 10,
    `expected bounded chat panel mutations, saw ${mutationCount}`
  );
});

test('party chat side button keeps an animatable shell when availability changes', (t) => {
  const dom = createChatDom();
  const { window } = dom;

  trackWindowIntervals(window, t);
  setupChatWindow(window);

  const partyChat = window.PartyChatPanel.initDefault();
  const chatButton = window.document.getElementById('party-chat-side-button');
  const chatButtonShell = chatButton.closest('.side-button-shell');

  assert.equal(chatButton.hidden, false);
  assert.equal(chatButton.disabled, true);
  assert.equal(chatButtonShell.hidden, false);
  assert.ok(chatButtonShell.classList.contains('party-chat-hidden'));

  partyChat.setAvailable(true);

  assert.equal(chatButton.hidden, false);
  assert.equal(chatButton.disabled, false);
  assert.equal(chatButtonShell.hidden, false);
  assert.equal(chatButtonShell.getAttribute('aria-hidden'), 'false');
  assert.equal(chatButtonShell.classList.contains('party-chat-hidden'), false);

  partyChat.setAvailable(false);

  assert.equal(chatButton.hidden, false);
  assert.equal(chatButton.disabled, true);
  assert.equal(chatButtonShell.hidden, false);
  assert.equal(chatButtonShell.getAttribute('aria-hidden'), 'true');
  assert.equal(chatButtonShell.classList.contains('party-chat-hidden'), true);
});

test('closed party chat plays a sound only for live messages from other players', async (t) => {
  const dom = createChatDom();
  const { window } = dom;
  const chatMessages = [
    {
      username: 'Other Player',
      message: 'Historical message',
      eventType: 'message',
      timestamp: 1
    }
  ];
  const playedSounds = [];

  trackWindowIntervals(window, t);
  window.onlineUsername = 'Current Player';
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  setupChatWindow(window, {
    partyCode: 'ABC-123',
    chatMessages
  });

  const partyChat = window.PartyChatPanel.initDefault();
  await partyChat.refreshChatLogBaseline();
  assert.deepEqual(playedSounds, []);

  chatMessages.push({
    username: 'Other Player',
    message: 'Live incoming message',
    eventType: 'message',
    timestamp: 2
  });
  await partyChat.displayLogs();

  assert.deepEqual(playedSounds, ['socialChatMessageReceived']);

  chatMessages.push({
    username: 'Current Player',
    message: 'Own message',
    eventType: 'message',
    timestamp: 3
  });
  chatMessages.push({
    username: '[CONSOLE]',
    message: 'A player connected',
    eventType: 'connect',
    timestamp: 4
  });
  await partyChat.displayLogs();

  assert.deepEqual(playedSounds, ['socialChatMessageReceived']);
});

test('visible party chat keeps live incoming messages silent', async (t) => {
  const dom = createChatDom();
  const { window } = dom;
  const chatMessages = [];
  const playedSounds = [];

  trackWindowIntervals(window, t);
  window.onlineUsername = 'Current Player';
  window.playSoundEffect = (soundKey) => playedSounds.push(soundKey);
  setupChatWindow(window, {
    partyCode: 'ABC-123',
    chatMessages
  });

  const partyChat = window.PartyChatPanel.initDefault();
  await partyChat.refreshChatLogBaseline();
  partyChat.toggle();
  assert.equal(window.document.querySelector('.chat-box').hidden, false);
  assert.equal(
    window.document.activeElement,
    window.document.querySelector('.chat-input input')
  );

  chatMessages.push({
    username: 'Other Player',
    message: 'Visible incoming message',
    eventType: 'message',
    timestamp: 5
  });
  await partyChat.displayLogs();

  assert.deepEqual(playedSounds, []);
});

test('touch devices open party chat without focusing the message input', (t) => {
  const dom = createChatDom();
  const { window } = dom;

  window.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {}
  });
  trackWindowIntervals(window, t);
  setupChatWindow(window, { partyCode: 'ABC-123' });

  const input = window.document.querySelector('.chat-input input');
  const originalFocus = input.focus.bind(input);
  let focusCount = 0;
  input.focus = () => {
    focusCount += 1;
    originalFocus();
  };

  const partyChat = window.PartyChatPanel.initDefault();
  partyChat.toggle();

  assert.equal(window.document.querySelector('.chat-box').hidden, false);
  assert.equal(focusCount, 0);
  assert.notEqual(window.document.activeElement, input);

  input.focus();

  assert.equal(focusCount, 1);
  assert.equal(window.document.activeElement, input);
});
