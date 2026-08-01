(function () {
  function getPartyCode() {
    if (window.partyCode) return window.partyCode;
    if (typeof partyCode !== 'undefined') return partyCode;
    return null;
  }

  function getDeviceId() {
    if (window.deviceId) return window.deviceId;
    if (typeof deviceId !== 'undefined') return deviceId;
    return null;
  }

  function getHostDeviceId() {
    if (window.hostDeviceId) return window.hostDeviceId;
    if (typeof hostDeviceId !== 'undefined') return hostDeviceId;
    return null;
  }

  function getHostedParty() {
    if (window.hostedParty) return true;
    if (typeof hostedParty !== 'undefined') return Boolean(hostedParty);
    return false;
  }

  function getOnlineUsername() {
    if (window.onlineUsername) return window.onlineUsername;
    if (typeof onlineUsername !== 'undefined') return onlineUsername;
    return '';
  }

  function getIsPlaying() {
    if (window.isPlaying) return true;
    if (typeof isPlaying !== 'undefined') return Boolean(isPlaying);
    return false;
  }

  function getCurrentPartyData() {
    if (window.currentPartyData) return window.currentPartyData;
    if (typeof currentPartyData !== 'undefined') return currentPartyData;
    return null;
  }

  function getStartOnlineGame() {
    if (typeof window.startOnlineGame === 'function') return window.startOnlineGame;
    if (typeof startOnlineGame === 'function') return startOnlineGame;
    return null;
  }

  function isPartyHost() {
    const hostDeviceId = getHostDeviceId();
    const deviceId = getDeviceId();
    return Boolean(getHostedParty() || (hostDeviceId && hostDeviceId === deviceId));
  }

  async function sendConsolePartyMessage(message) {
    const partyChat = await window.PartyChatReady;
    if (!partyChat?.sendMessage) return;

    await partyChat.sendMessage({
      username: '[CONSOLE]',
      message,
      eventType: 'message'
    });
  }

  async function runSkipCommand({ nextPlayer, writeConsole }) {
    if (getIsPlaying()) {
      await window.PartySkip({ nextPlayer });
      await sendConsolePartyMessage(
        `${getOnlineUsername()} has skipped the round${nextPlayer ? ' and moved to the next player' : ''}.`
      );
      return;
    }

    writeConsole('UNABLE TO SKIP. YOU ARE NOT IN A GAME', 'error');
  }

  async function runRestartCommand({ writeConsole }) {
    const currentPartyData = getCurrentPartyData();
    const inOnlineGamemodePage =
      getIsPlaying() === true &&
      currentPartyData &&
      (currentPartyData.state?.isPlaying ?? currentPartyData.isPlaying) === true;

    if (!inOnlineGamemodePage) {
      writeConsole(
        'UNABLE TO RESTART. YOU MUST BE IN AN ONLINE GAMEMODE PAGE',
        'error'
      );
      return;
    }

    if (typeof window.PartyRestart !== 'function') {
      writeConsole('UNABLE TO RESTART THIS GAMEMODE.', 'error');
      return;
    }

    await window.PartyRestart();
    await sendConsolePartyMessage(`${getOnlineUsername()} has restarted the game.`);
  }

  async function runBypassStartCommand({ writeConsole }) {
    if (!getPartyCode()) {
      writeConsole('UNABLE TO START. NO PARTY EXISTS.', 'error');
      return;
    }

    const startOnlineGame = getStartOnlineGame();
    if (typeof startOnlineGame !== 'function') {
      writeConsole(
        'UNABLE TO START. YOU MUST BE IN GAMEMODE SETTINGS.',
        'error'
      );
      return;
    }

    await startOnlineGame({ bypassPlayerRestrictions: true });
    await sendConsolePartyMessage(
      `${getOnlineUsername()} bypassed player restrictions and started the game.`
    );
  }

  const partyGamesCommandPack = {
    canRun(context) {
      if (!isPartyHost()) {
        context.writeConsole('You are not the host of this party.', 'error');
        return false;
      }

      return true;
    },
    commands: {
      kick: {
        adminOnly: true,
        description: 'Kick a user from the party. Usage: /kick <userId>',
        run: ({ command, writeConsole }) => {
          const user = document.querySelector(
            `.user-icon[data-user-id="${command.action}"]`
          );

          if (user && command.action !== getDeviceId()) {
            window.RemoveUserFromParty(command.action);
            user.remove();
            return;
          }

          writeConsole('Cannot kick this user.', 'error');
        }
      },
      party: {
        adminOnly: true,
        description:
          'Party management. Subcommands: delete, create, bypass, forcestart, skip, skipround, restart',
        suggestions: [
          '/party delete',
          '/party create',
          '/party bypass',
          '/party forcestart',
          '/party skip',
          '/party skipround',
          '/party restart'
        ],
        run: async ({ command, writeConsole }) => {
          const action = command.action?.toLowerCase();

          if (action === 'delete') {
            window.DeleteParty();
            if (typeof window.ToggleOnlineMode === 'function') {
              await window.ToggleOnlineMode(false);
            }
          } else if (action === 'create') {
            const activePackCount = Array.from(window.packButtons || []).filter(
              (button) => button.classList.contains('active')
            ).length;

            if (activePackCount === 0) {
              writeConsole('UNABLE TO CREATE PARTY. NO PACKS SELECTED', 'error');
              return;
            }

            if (getHostedParty() === true) {
              await window.ToggleOnlineMode(true);
            } else {
              writeConsole(
                'UNABLE TO CREATE PARTY. YOU ARE NOT IN GAMEMODE SETTINGS ROOM',
                'error'
              );
            }
          } else if (action === 'skip') {
            await runSkipCommand({ nextPlayer: true, writeConsole });
          } else if (action === 'skipround') {
            await runSkipCommand({ nextPlayer: false, writeConsole });
          } else if (action === 'restart') {
            await runRestartCommand({ writeConsole });
          } else if (action === 'bypass' || action === 'forcestart') {
            await runBypassStartCommand({ writeConsole });
          } else {
            writeConsole('Invalid party command.', 'error');
          }
        }
      }
    }
  };

  window.OverexposedCommands?.registerCommandPack({
    id: 'party-games',
    ...partyGamesCommandPack
  });
  window.OverexposedCommands?.registerCommandPack({
    id: 'overexposure',
    ...partyGamesCommandPack
  });
})();
