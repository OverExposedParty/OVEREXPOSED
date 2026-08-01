(function () {
  const state = window.__overexposedCommandState || {
    packs: new Map()
  };

  window.__overexposedCommandState = state;

  const consoleName = '[CONSOLE]';

  function normaliseCommandName(commandName) {
    return String(commandName || '').trim().toLowerCase();
  }

  function parseCommand(message) {
    const regex = /^\/([a-z0-9_-]+)(?:\s+(.+))?$/i;
    const match = String(message || '').trim().match(regex);

    if (!match) {
      return { error: 'Invalid format. Expected /[COMMAND] [ACTION]' };
    }

    return {
      command: match[1],
      action: match[2] || null,
      args: match[2] ? match[2].trim().split(/\s+/) : []
    };
  }

  function createConsoleWriter(writer) {
    return function writeConsoleMessage(message, eventType = 'info') {
      if (typeof writer === 'function') {
        writer(consoleName, message, eventType, Date.now());
      }
    };
  }

  function getStoredCommandAccount() {
    try {
      return JSON.parse(localStorage.getItem('oe-account')) || null;
    } catch {
      return null;
    }
  }

  function isCommandAdminAccount(account) {
    if (!account) return false;
    if (account.admin?.disabled) return false;
    if (typeof account.canAccessConsole === 'boolean') {
      return account.canAccessConsole;
    }

    const roles = [
      ...(Array.isArray(account.admin?.roles) ? account.admin.roles : []),
      account.admin?.role
    ]
      .filter(Boolean)
      .map((role) => String(role).toLowerCase());
    const permissions = Array.isArray(account.admin?.permissions)
      ? account.admin.permissions.map((permission) =>
          String(permission).toLowerCase()
        )
      : [];

    return (
      roles.some((role) => ['owner', 'admin'].includes(role)) ||
      permissions.includes('console.access')
    );
  }

  function registerCommandPack(pack) {
    if (!pack || !pack.id || !pack.commands) {
      return;
    }

    const existingPack = state.packs.get(pack.id) || {};
    state.packs.set(pack.id, {
      commands: {
        ...(existingPack.commands || {}),
        ...pack.commands
      },
      canRun:
        typeof pack.canRun === 'function'
          ? pack.canRun
          : existingPack.canRun || null,
      createContext:
        typeof pack.createContext === 'function'
          ? pack.createContext
          : existingPack.createContext || null
    });
  }

  function getCommandPacksForPage(pageType) {
    const packs = [];
    const globalPack = state.packs.get('global');
    const pagePack = state.packs.get(pageType);

    if (globalPack) packs.push(globalPack);
    if (pagePack && pageType !== 'global') packs.push(pagePack);

    return packs;
  }

  function getCommandsForPage(pageType) {
    return getCommandPacksForPage(pageType).reduce(
      (commands, pack) => ({
        ...commands,
        ...(pack.commands || {})
      }),
      {}
    );
  }

  function findCommandHandler(pageType, commandName) {
    const packs = getCommandPacksForPage(pageType);

    for (let i = packs.length - 1; i >= 0; i--) {
      const pack = packs[i];
      const handler = pack.commands?.[commandName];
      if (handler) {
        return { handler, pack };
      }
    }

    return { handler: null, pack: null };
  }

  function getCommandHelpText(pageType) {
    const commands = getCommandsForPage(pageType);
    const visibleCommands = Object.entries(commands).filter(
      ([, data]) => data?.hidden !== true
    );

    if (visibleCommands.length === 0) {
      return 'No commands are available for this page.';
    }

    let helpText = 'Available commands:\n';
    for (const [cmd, data] of visibleCommands) {
      const accessLabel = data.adminOnly ? ' [admin]' : '';
      helpText += `- ${cmd}${accessLabel}: ${data.description || 'No description'}\n`;
    }

    return helpText.trim();
  }

  function normaliseSuggestion(value) {
    const suggestion = String(value || '').trim();
    if (!suggestion) return '';
    return suggestion.startsWith('/') ? suggestion : `/${suggestion}`;
  }

  function getCommandSuggestions(pageType) {
    const commands = getCommandsForPage(pageType);
    return ['/help', ...Object.entries(commands)
      .filter(([, data]) => data?.hidden !== true)
      .flatMap(([cmd, data]) => {
        const baseCommand = `/${cmd}`;
        const suggestions = Array.isArray(data?.suggestions)
          ? data.suggestions.map(normaliseSuggestion).filter(Boolean)
          : [];

        return [baseCommand, ...suggestions];
      })]
      .filter((suggestion, index, suggestions) =>
        suggestions.indexOf(suggestion) === index
      )
      .sort((a, b) => a.localeCompare(b));
  }

  async function getCommandSuggestionsAsync(pageType) {
    const commands = getCommandsForPage(pageType);
    const suggestions = getCommandSuggestions(pageType);

    await Promise.all(
      Object.entries(commands)
        .filter(([, data]) => data?.hidden !== true)
        .map(async ([commandName, data]) => {
          if (typeof data?.getSuggestions !== 'function') return;

          let commandSuggestions = [];

          try {
            commandSuggestions = await data.getSuggestions({
              commandName,
              pageType
            });
          } catch {
            commandSuggestions = [];
          }

          if (!Array.isArray(commandSuggestions)) return;

          commandSuggestions
            .map(normaliseSuggestion)
            .filter(Boolean)
            .forEach((suggestion) => suggestions.push(suggestion));
        })
    );

    return suggestions
      .filter((suggestion, index) => suggestions.indexOf(suggestion) === index)
      .sort((a, b) => a.localeCompare(b));
  }

  async function runCommand(message, options = {}) {
    const pageType = options.pageType || 'default';
    const writeConsole = createConsoleWriter(options.writeConsoleMessage);
    const command = parseCommand(message);

    if (command.error) {
      writeConsole(command.error, 'error');
      return false;
    }

    const commandName = normaliseCommandName(command.command);

    if (commandName === 'help') {
      writeConsole(getCommandHelpText(pageType));
      return true;
    }

    const { handler, pack } = findCommandHandler(pageType, commandName);

    if (!handler) {
      writeConsole('Invalid command.', 'error');
      return false;
    }

    const context = {
      command,
      commandName,
      isAdmin: isCommandAdminAccount(getStoredCommandAccount()),
      pageType,
      writeConsole,
      ...(options.context || {})
    };

    if (typeof options.isAdmin === 'boolean') {
      context.isAdmin = options.isAdmin;
    }

    if (pack?.createContext) {
      Object.assign(context, pack.createContext(context) || {});
    }

    if (handler.adminOnly && !context.isAdmin) {
      writeConsole('You need admin power to use this command.', 'error');
      return false;
    }

    if (pack?.canRun) {
      const result = pack.canRun(context, handler);
      if (result === false) {
        return false;
      }
      if (typeof result === 'string') {
        writeConsole(result, 'error');
        return false;
      }
    }

    await handler.run(context);
    return true;
  }

  function formatDebugStatus(status) {
    if (!status) return 'Debug service is unavailable.';
    return `Debug filter: ${status.filter}; minimum level: ${status.minimumLevel}; history: ${status.historySize}/${status.historyLimit}.`;
  }

  function runDebugCommand({ command, writeConsole }) {
    const debugService = window.OEDebug;
    if (!debugService) {
      writeConsole('Debug service is unavailable.', 'error');
      return;
    }

    const action = normaliseCommandName(command.args[0] || 'status');
    if (action === 'status') {
      writeConsole(formatDebugStatus(debugService.getStatus()));
      return;
    }

    if (action === 'level') {
      const level = normaliseCommandName(command.args[1]);
      const status = debugService.setMinimumLevel(level);
      if (!status) {
        writeConsole(
          'Invalid debug level. Use debug, info, warn, or error.',
          'error'
        );
        return;
      }
      writeConsole(formatDebugStatus(status));
      return;
    }

    const status = debugService.setFilter(action);
    if (!status) {
      writeConsole(
        'Invalid debug category. Use all, off, or a dotted category such as audio.playback.',
        'error'
      );
      return;
    }
    writeConsole(formatDebugStatus(status));
  }

  window.OverexposedCommands = {
    getCommandSuggestions,
    getCommandSuggestionsAsync,
    parseCommand,
    registerCommandPack,
    runCommand
  };

  registerCommandPack({
    id: 'global',
    commands: {
      debug: {
        description: 'Inspect or change structured client-side debugging.',
        suggestions: [
          '/debug status',
          '/debug all',
          '/debug off',
          '/debug audio',
          '/debug audio.playback',
          '/debug audio.queue',
          '/debug audio.settings',
          '/debug audio.preload',
          '/debug audio.errors',
          '/debug level debug',
          '/debug level info',
          '/debug level warn',
          '/debug level error'
        ],
        run: runDebugCommand
      }
    }
  });
})();
