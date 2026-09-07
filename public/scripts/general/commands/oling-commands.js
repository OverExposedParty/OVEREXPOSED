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

  const clashSuggestions = [
    '/oling clash help',
    '/oling clash status',
    '/oling clash pause',
    '/oling clash resume',
    '/oling clash reset',
    '/oling clash select attack',
    '/oling clash select guard',
    '/oling clash select skill',
    '/oling clash confirm',
    '/oling clash result win',
    '/oling clash result loss',
    '/oling clash result draw',
    '/oling clash tag local bench-1',
    '/oling clash knockout local active',
    '/oling clash health local active 3',
    '/oling clash damage opponent active 1',
    '/oling clash shield local bench-1 1',
    '/oling clash overgrowth opponent active 1',
    '/oling clash effect add opponent active bloodbound',
    '/oling clash effect remove opponent active bloodbound',
    '/oling clash panel down',
    '/oling clash panel up',
    '/oling clash animate tag local bench-1',
    '/oling clash animate damage opponent active hearts 1',
    '/oling clash speed 0.5',
    '/oling clash speed 2',
    '/oling clash speed reset',
    '/oling clash tutorial step 12',
    '/oling clash tutorial next',
    '/oling clash tutorial previous',
    '/oling clash tutorial restart',
    '/oling clash tutorial list',
    '/oling clash snapshot save before-tag',
    '/oling clash snapshot restore before-tag',
    '/oling clash snapshot list',
    '/oling clash snapshot delete before-tag',
    '/oling clash state',
    '/oling clash state copy'
  ];

  function getClashHelpText() {
    return [
      'Olings Clash command usage:',
      '/oling clash status | pause | resume | reset',
      '/oling clash select <attack|guard|skill>',
      '/oling clash confirm',
      '/oling clash result <win|loss|draw>',
      '/oling clash tag <local|opponent> <bench-1|bench-2>',
      '/oling clash knockout <local|opponent> [slot]',
      '/oling clash health <side> <slot> <Hearts>',
      '/oling clash damage <side> <slot> <Hearts>',
      '/oling clash shield <side> <slot> <count>',
      '/oling clash overgrowth <side> <slot> <Hearts>',
      '/oling clash effect <add|remove> <side> <slot> <effect> [positive|negative]',
      '/oling clash panel <down|up>',
      '/oling clash animate tag <side> <bench-1|bench-2>',
      '/oling clash animate damage <side> active <hearts|overgrowth|shields> <amount>',
      '/oling clash speed <multiplier|reset>',
      '/oling clash tutorial <step N|next|previous|restart|list>',
      '/oling clash snapshot <save|restore|delete> <name>',
      '/oling clash snapshot list',
      '/oling clash state [copy]',
      'Sides: local, opponent. Slots: active, bench-1, bench-2.',
      'Heart amounts support half-Heart increments, such as 0.5 or 1.5.'
    ].join('\n');
  }

  function getClashDebug() {
    return window.OlingClashDebug || window.OlingClashGame?.debug || null;
  }

  function requireClashDebug() {
    const debug = getClashDebug();
    if (!debug) {
      throw new Error(
        'Open an Olings Clash game or the Clash tutorial before using this command.'
      );
    }
    return debug;
  }

  function getOlingLabel(debug, side, slot) {
    const state = debug.printState();
    const indexes = { active: 0, 'bench-1': 1, bench1: 1, 'bench-2': 2, bench2: 2 };
    const normalizedSlot = text(slot || 'active').toLowerCase();
    const index = Object.hasOwn(indexes, normalizedSlot)
      ? indexes[normalizedSlot]
      : Number(normalizedSlot);
    return state.teams?.[text(side).toLowerCase()]?.[index]?.name || 'Oling';
  }

  function formatClashStatus(status) {
    return [
      `Clash status: ${status.online ? 'online (read-only)' : 'local debug'}`,
      `Round: ${status.round}; phase: ${status.phase}; ${status.paused ? 'paused' : 'running'}.`,
      `Selected ability: ${status.selectedAction || 'none'}.`,
      `Speed: ${status.speed}x; winner: ${status.winner || 'none'}.`
    ].join('\n');
  }

  async function runClashCommand(args, writeConsole) {
    const action = text(args[0] || 'help').toLowerCase();
    if (action === 'help') {
      writeConsole(getClashHelpText());
      return;
    }

    const debug = requireClashDebug();

    if (action === 'status') {
      writeConsole(formatClashStatus(debug.getStatus()));
      return;
    }
    if (action === 'pause') {
      writeConsole(formatClashStatus(debug.pause()));
      return;
    }
    if (action === 'resume') {
      writeConsole(formatClashStatus(debug.resume()));
      return;
    }
    if (action === 'reset') {
      debug.reset();
      writeConsole('Olings Clash reset.');
      return;
    }
    if (action === 'select') {
      const selected = debug.select(args[1]);
      writeConsole(`Selected ${selected.toUpperCase()}.`);
      return;
    }
    if (action === 'confirm') {
      debug.confirm();
      writeConsole('Selected ability confirmed.');
      return;
    }
    if (action === 'result') {
      const forced = debug.forceResult(args[1]);
      writeConsole(
        `Next confirmed ${forced.selectedAction.toUpperCase()} will ${forced.outcome}; the opponent will use ${forced.opponentAction.toUpperCase()}.`
      );
      return;
    }
    if (action === 'tag') {
      const incoming = debug.tag(args[1], args[2]);
      writeConsole(`${incoming.name || 'Oling'} tagged in for ${args[1]}.`);
      return;
    }
    if (action === 'knockout') {
      const side = args[1];
      const slot = args[2] || 'active';
      const olingName = getOlingLabel(debug, side, slot);
      debug.knockout(side, slot);
      writeConsole(`${olingName} was knocked out.`);
      return;
    }
    if (action === 'health') {
      const [side, slot, hearts] = args.slice(1);
      const olingName = getOlingLabel(debug, side, slot);
      debug.setHealth(side, slot, hearts);
      writeConsole(`${olingName} now has ${hearts} Hearts.`);
      return;
    }
    if (action === 'damage') {
      const [side, slot, hearts] = args.slice(1);
      const olingName = getOlingLabel(debug, side, slot);
      debug.damage(side, slot, hearts);
      writeConsole(`${olingName} took ${hearts} Hearts of damage.`);
      return;
    }
    if (action === 'shield') {
      const [side, slot, count] = args.slice(1);
      const olingName = getOlingLabel(debug, side, slot);
      debug.setShield(side, slot, count);
      writeConsole(`${olingName} now has ${count} Shields.`);
      return;
    }
    if (action === 'overgrowth') {
      const [side, slot, hearts] = args.slice(1);
      const olingName = getOlingLabel(debug, side, slot);
      debug.setOvergrowth(side, slot, hearts);
      writeConsole(`${olingName} now has ${hearts} Overgrowth Hearts.`);
      return;
    }
    if (action === 'effect') {
      const operation = text(args[1]).toLowerCase();
      const [side, slot, effectKey, effectType] = args.slice(2);
      if (operation === 'add') {
        const effect = debug.addEffect(side, slot, effectKey, effectType);
        writeConsole(`Added ${effect.name} to ${getOlingLabel(debug, side, slot)}.`);
        return;
      }
      if (operation === 'remove') {
        const olingName = getOlingLabel(debug, side, slot);
        debug.removeEffect(side, slot, effectKey);
        writeConsole(`Removed ${effectKey} from ${olingName}.`);
        return;
      }
      throw new Error('Usage: /oling clash effect <add|remove> <side> <slot> <effect> [positive|negative]');
    }
    if (action === 'panel') {
      const direction = text(args[1]).toLowerCase();
      if (direction === 'down') debug.panel.down();
      else if (direction === 'up') debug.panel.up();
      else throw new Error('Usage: /oling clash panel <down|up>');
      writeConsole(`Action panel moved ${direction}.`);
      return;
    }
    if (action === 'animate') {
      const animation = text(args[1]).toLowerCase();
      if (animation === 'tag') {
        debug.animateTag(args[2], args[3]);
        writeConsole('Playing the Tag animation.');
        return;
      }
      if (animation === 'damage') {
        debug.animateDamage(args[2], args[3], args[4], args[5]);
        writeConsole('Playing the damage animation.');
        return;
      }
      throw new Error('Usage: /oling clash animate <tag|damage> ...');
    }
    if (action === 'speed') {
      const requestedSpeed = text(args[1]).toLowerCase();
      const speed = debug.setSpeed(requestedSpeed === 'reset' ? 1 : requestedSpeed);
      writeConsole(`Olings Clash speed set to ${speed}x.`);
      return;
    }
    if (action === 'tutorial') {
      const operation = text(args[1] || 'list').toLowerCase();
      if (operation === 'step') {
        const step = debug.tutorial.step(args[2]);
        writeConsole(`Opened tutorial step ${args[2]}: ${step?.title || step?.id}.`);
        return;
      }
      if (operation === 'next') {
        const step = debug.tutorial.next();
        writeConsole(`Opened next tutorial step: ${step?.title || step?.id || 'complete'}.`);
        return;
      }
      if (operation === 'previous') {
        const step = debug.tutorial.previous();
        writeConsole(`Opened previous tutorial step: ${step?.title || step?.id}.`);
        return;
      }
      if (operation === 'restart') {
        const step = debug.tutorial.restart();
        writeConsole(`Tutorial restarted at ${step?.title || step?.id}.`);
        return;
      }
      if (operation === 'list') {
        const steps = debug.tutorial.list();
        writeConsole(
          ['Clash tutorial steps:', ...steps.map((step) =>
            `${step.current ? '>' : '-'} ${step.number}. ${step.title || step.id}`
          )].join('\n')
        );
        return;
      }
      throw new Error('Usage: /oling clash tutorial <step N|next|previous|restart|list>');
    }
    if (action === 'snapshot') {
      const operation = text(args[1] || 'list').toLowerCase();
      const name = args[2];
      if (operation === 'save') {
        writeConsole(`Saved Clash snapshot ${debug.saveSnapshot(name)}.`);
        return;
      }
      if (operation === 'restore') {
        debug.restoreSnapshot(name);
        writeConsole(`Restored Clash snapshot ${name}. The game is paused.`);
        return;
      }
      if (operation === 'delete') {
        writeConsole(`Deleted Clash snapshot ${debug.deleteSnapshot(name)}.`);
        return;
      }
      if (operation === 'list') {
        const snapshots = debug.listSnapshots();
        writeConsole(`Clash snapshots: ${snapshots.join(', ') || 'none'}.`);
        return;
      }
      throw new Error('Usage: /oling clash snapshot <save|restore|delete|list> [name]');
    }
    if (action === 'state') {
      if (text(args[1]).toLowerCase() === 'copy') {
        await debug.copyState();
        writeConsole('Copied the Olings Clash state to the clipboard.');
      } else {
        writeConsole(JSON.stringify(debug.printState(), null, 2));
      }
      return;
    }

    throw new Error('Unknown Clash command. Use /oling clash help.');
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
        `Created: ${receipt.createdAt || 'unknown'}`
      ].join('\n')
    );
  }

  async function runOlingCommand({ command, writeConsole }) {
    const action = text(command.args[0]).toLowerCase();

    if (action === 'clash') {
      try {
        await runClashCommand(command.args.slice(1), writeConsole);
      } catch (error) {
        writeConsole(error?.message || 'Olings Clash command failed.', 'error');
      }
      return;
    }

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
        '/oling clash help',
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
          'Manage Oling rooms and debug an Olings Clash game.',
        suggestions: [
          ...clashSuggestions,
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
