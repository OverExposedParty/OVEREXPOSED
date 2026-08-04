const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const commandRegistrySource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/commands/command-registry.js'
  ),
  'utf8'
);
const achievementCommandsSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/commands/achievement-commands.js'
  ),
  'utf8'
);

function createCommandContext() {
  const context = {
    console,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Date,
    fetch: async () => ({
      ok: true,
      json: async () => ({ data: { achievements: [], eggs: [] } })
    }),
    localStorage: {
      getItem: () => null
    },
    setTimeout,
    window: null
  };
  context.window = context;
  vm.runInNewContext(commandRegistrySource, context, {
    filename: 'command-registry.js'
  });
  vm.runInNewContext(achievementCommandsSource, context, {
    filename: 'achievement-commands.js'
  });
  return context;
}

test('/notification test email-verified shows the verification success popup', async () => {
  const context = createCommandContext();
  const messages = [];
  let popupCount = 0;
  context.showEmailVerificationSuccessPopup = () => {
    popupCount += 1;
  };

  const handled = await context.OverexposedCommands.runCommand(
    '/notification test email-verified',
    {
      isAdmin: true,
      pageType: 'overexposure',
      writeConsoleMessage: (_name, message, eventType) => {
        messages.push({ message, eventType });
      }
    }
  );

  assert.equal(handled, true);
  assert.equal(popupCount, 1);
  assert.deepEqual(messages, [
    {
      message: 'Testing email verified notification.',
      eventType: 'info'
    }
  ]);
});

test('email-verified is included in notification command suggestions', async () => {
  const context = createCommandContext();
  const suggestions =
    await context.OverexposedCommands.getCommandSuggestionsAsync(
      'overexposure'
    );

  assert.ok(suggestions.includes('/notification test email-verified'));
});
