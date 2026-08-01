(function () {
  const typeAliases = {
    consumable: 'oling_consumable',
    oling_consumable: 'oling_consumable',
    egg: 'oling_egg',
    oling_egg: 'oling_egg',
    headwear: 'oling_headwear',
    hat: 'oling_headwear',
    oling_headwear: 'oling_headwear',
    oe: 'oe',
    layer: 'oe',
    pack: 'pack',
    cosmetic: 'cosmetic',
    badge: 'badge'
  };

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function normalizeType(value) {
    const type = normalizeText(value).toLowerCase();
    return typeAliases[type] || type;
  }

  function splitReason(args) {
    const reasonIndex = args.findIndex(
      (arg) => normalizeText(arg).toLowerCase() === '--reason'
    );

    if (reasonIndex === -1) {
      return { commandArgs: args, reason: '' };
    }

    return {
      commandArgs: args.slice(0, reasonIndex),
      reason: args.slice(reasonIndex + 1).join(' ').trim()
    };
  }

  function formatGrantLabel(type, key, quantity) {
    return `${quantity}x ${type}:${key}`;
  }

  async function postShopGrant(payload) {
    const response = await fetch('/api/shop/admin/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.error?.message || data?.message || 'Failed to grant shop item.'
      );
    }

    return data?.data || data;
  }

  async function runShopCommand({ command, writeConsole }) {
    const action = normalizeText(command.args[0]).toLowerCase();

    if (action !== 'grant') {
      writeConsole(
        'Usage: /shop grant <user> <type> <key> [quantity] [--reason ...]',
        'error'
      );
      return;
    }

    const { commandArgs, reason } = splitReason(command.args.slice(1));
    const target = normalizeText(commandArgs[0]).replace(/^@+/, '');
    const type = normalizeType(commandArgs[1]);
    const key = normalizeText(commandArgs[2]).toLowerCase();
    const quantityValue = commandArgs[3] === undefined ? 1 : Number(commandArgs[3]);
    const quantity = Number.isFinite(quantityValue)
      ? Math.trunc(quantityValue)
      : 0;

    if (!target || !type || !key || quantity <= 0) {
      writeConsole(
        'Usage: /shop grant <user> <type> <key> [quantity] [--reason ...]',
        'error'
      );
      return;
    }

    const result = await postShopGrant({
      target,
      type,
      key,
      quantity,
      reason
    });
    const targetLabel =
      result?.target?.username || result?.target?.email || target;

    writeConsole(
      `Granted ${formatGrantLabel(type, key, quantity)} to ${targetLabel}.`
    );
  }

  window.OverexposedCommands?.registerCommandPack({
    id: 'global',
    commands: {
      shop: {
        adminOnly: true,
        description:
          'Grant shop items. Usage: /shop grant <user> <type> <key> [quantity] [--reason ...]',
        suggestions: [
          '/shop grant',
          '/shop grant username consumable treasure-map 1',
          '/shop grant username egg base-egg 1',
          '/shop grant username headwear trophy 1'
        ],
        run: runShopCommand
      }
    }
  });
})();
