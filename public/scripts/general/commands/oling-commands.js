(function () {
  function text(value) {
    return String(value || '').trim();
  }

  function cleanTarget(value) {
    return text(value).replace(/^@+/, '');
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.error?.message || data?.message || 'Oling command failed.'
      );
    }

    return data?.data || data;
  }

  function targetQuery(target) {
    return `target=${encodeURIComponent(target)}`;
  }

  function getTargetLabel(payload, fallback) {
    return payload?.target?.username || payload?.target?.email || fallback;
  }

  function formatInfluences(influenceSlots) {
    const slots = Array.isArray(influenceSlots) ? influenceSlots : [];
    if (!slots.length) return 'none';
    return slots
      .map((slot) => `${slot.slotKey}:${slot.itemKey}`)
      .filter(Boolean)
      .join(', ');
  }

  function writeRoom(room, writeConsole, fallbackTarget) {
    const target = getTargetLabel(room, fallbackTarget);
    const egg = room?.currentEgg;
    const eggs = Array.isArray(room?.inventory?.eggs)
      ? room.inventory.eggs
      : [];
    const consumables = Array.isArray(room?.inventory?.consumables)
      ? room.inventory.consumables
      : [];

    writeConsole(
      [
        `${target}'s Oling room:`,
        `Current egg: ${egg?.eggKey || 'none'}`,
        `Influences: ${formatInfluences(egg?.influenceSlots)}`,
        `Egg inventory: ${eggs.map((item) => `${item.key} x${item.quantity}`).join(', ') || 'empty'}`,
        `Consumables: ${consumables.map((item) => `${item.key} x${item.quantity}`).join(', ') || 'empty'}`
      ].join('\n')
    );
  }

  async function runRoomCommand(target, writeConsole) {
    const payload = await requestJson(`/api/olings/admin/room?${targetQuery(target)}`);
    writeRoom(payload.room, writeConsole, target);
  }

  async function runPreviewCommand(target, writeConsole) {
    const payload = await requestJson(
      `/api/olings/admin/hatch-preview?${targetQuery(target)}`
    );
    const preview = payload.preview;
    const targetLabel = getTargetLabel(payload.room, target);

    writeConsole(
      [
        `Previewing ${targetLabel}'s current Oling hatch:`,
        `Egg: ${preview.eggKey}`,
        `Influences: ${formatInfluences(preview.influenceSlots)}`,
        `Slot: ${preview.slot?.containerSlotId || preview.slot?.slotId || 'egg'}`
      ].join('\n')
    );
  }

  async function runHatchCommand(target, args, writeConsole) {
    const reasonIndex = args.findIndex((arg) => text(arg).toLowerCase() === '--reason');
    const reason = reasonIndex === -1 ? '' : args.slice(reasonIndex + 1).join(' ');
    const payload = await requestJson('/api/olings/admin/hatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, reason })
    });
    const oling = payload.oling || {};
    const receipt = payload.receipt || {};
    const targetLabel = getTargetLabel(payload, target);

    writeConsole(
      [
        `Hatched ${targetLabel}'s room egg.`,
        `Egg: ${receipt.eggKey || oling.eggKey || 'unknown'}`,
        `Oling: ${oling.id || 'created'}`,
        `Personality: ${oling.personality?.name || oling.personalityKey || 'unknown'}`,
        `Receipt: ${receipt.id || 'created'}`
      ].join('\n')
    );
  }

  async function runReceiptCommand(target, writeConsole) {
    const payload = await requestJson(
      `/api/olings/admin/hatch-receipt?${targetQuery(target)}&which=latest`
    );
    const receipt = payload.receipt || {};
    const targetLabel = getTargetLabel(payload, target);

    writeConsole(
      [
        `${targetLabel}'s latest hatch receipt:`,
        `Receipt: ${receipt.id || 'unknown'}`,
        `Egg: ${receipt.eggKey || 'unknown'}`,
        `Oling: ${receipt.olingId || 'unknown'}`,
        `Personality: ${receipt.rolls?.personality?.personalityKey || 'unknown'}`,
        `Created: ${receipt.createdAt || 'unknown'}`
      ].join('\n')
    );
  }

  async function runOlingCommand({ command, writeConsole }) {
    const action = text(command.args[0]).toLowerCase();

    if (action === 'room') {
      const target = cleanTarget(command.args[1]);
      if (!target) {
        writeConsole('Usage: /oling room <user>', 'error');
        return;
      }
      await runRoomCommand(target, writeConsole);
      return;
    }

    if (action === 'hatch') {
      const subaction = text(command.args[1]).toLowerCase();

      if (subaction === 'preview') {
        const target = cleanTarget(command.args[2]);
        if (!target) {
          writeConsole('Usage: /oling hatch preview <user>', 'error');
          return;
        }
        await runPreviewCommand(target, writeConsole);
        return;
      }

      if (subaction === 'receipt') {
        const target = cleanTarget(command.args[2]);
        const scope = text(command.args[3]).toLowerCase();
        if (!target || (scope && scope !== 'latest')) {
          writeConsole('Usage: /oling hatch receipt <user> latest', 'error');
          return;
        }
        await runReceiptCommand(target, writeConsole);
        return;
      }

      const target = cleanTarget(command.args[1]);
      if (!target) {
        writeConsole('Usage: /oling hatch <user> [--instant] [--reason ...]', 'error');
        return;
      }
      await runHatchCommand(target, command.args.slice(2), writeConsole);
      return;
    }

    writeConsole(
      [
        'Oling command usage:',
        '/oling room <user>',
        '/oling hatch <user> [--instant] [--reason ...]',
        '/oling hatch preview <user>',
        '/oling hatch receipt <user> latest'
      ].join('\n'),
      'error'
    );
  }

  window.OverexposedCommands?.registerCommandPack({
    id: 'global',
    commands: {
      oling: {
        adminOnly: true,
        description:
          'Inspect and hatch the egg currently in a user Oling room.',
        suggestions: [
          '/oling room username',
          '/oling hatch username',
          '/oling hatch username --instant',
          '/oling hatch preview username',
          '/oling hatch receipt username latest'
        ],
        run: runOlingCommand
      }
    }
  });
})();
