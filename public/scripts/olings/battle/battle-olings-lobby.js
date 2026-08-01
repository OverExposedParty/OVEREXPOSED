(function () {
  function createOlingBattleLobby(dependencies) {
    function initializeLobbyTestMode() {
      const context = window.createOlingBattleLobbyContext(dependencies);
      if (!context) return;

      Object.assign(context, window.createOlingBattleLobbyVisuals(context));
      Object.assign(context, window.createOlingBattleLobbyControls(context));
      Object.assign(context, window.createOlingBattleLobbyApi(context));
      Object.assign(context, window.createOlingBattleLobbyMatchSync(context));

      with (context) {
      document.addEventListener('oling-battle:ended', (event) => {
        battleMatch = event.detail?.match || battleMatch;
        isStartingBattle = false;
        stopAiBattleLoop();
        setLobbyMode(true);
        renderBattleSetup();
        playerReadyCheckmark?.classList.remove('checked');
        if (readyButton) {
          readyButton.disabled = false;
          readyButton.classList.remove('is-ready');
          readyButton.textContent = 'READY UP';
        }
        if (battleTimer) {
          battleTimer.textContent = '';
          battleTimer.classList.remove('is-overtime');
          battleTimer.setAttribute('aria-label', 'Oling battle lobby');
        }
      });

      document.addEventListener('oling-battle:ai-match-updated', (event) => {
        const match = event.detail?.match;
        if (!match || match.matchCode !== battleMatch?.matchCode) return;
        syncLobbyMatch(match).catch((error) => {
          console.error('Failed to apply AI Oling battle update:', error);
        });
      });

      copyButton?.addEventListener('click', copyLobbyUrl);
      qrButton?.addEventListener('click', () => {
        setQrPanelVisible(qrPanel?.hidden !== false);
      });
      qrPanelClose?.addEventListener('click', () => setQrPanelVisible(false));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && qrPanel?.hidden === false) {
          setQrPanelVisible(false);
          qrButton?.focus();
        }
        if (
          event.key.toLowerCase() === 'o' &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA'
        ) {
          event.preventDefault();
          document.dispatchEvent(
            new CustomEvent('oling-battle:ai-add-opponent', {
              detail: {
                allowAdd: !matchCodeFromPath,
                matchCode: battleMatch?.matchCode
              }
            })
          );
        }
      });
      readyButton?.addEventListener('click', async () => {
        if (lobbyDetailMode === 'player') {
          await saveSelectedOling().catch((error) => {
            console.error('Failed to save Oling battle selection:', error);
          });
          return;
        }
        if (lobbyDetailMode === 'enemy') {
          setLobbyDetailMode('default');
          return;
        }

        const shouldReady = !getCurrentMatchPlayer()?.ready;
        await readyBattleMatch(shouldReady).catch((error) => {
          console.error('Failed to ready Oling battle:', error);
        });
        await syncLobbyMatch(battleMatch);
      });
      playerSelectTrigger?.addEventListener('click', () => {
        setLobbyDetailMode('player');
      });
      enemySelectTrigger?.addEventListener('click', () => {
        if (opponentOling) setLobbyDetailMode('enemy');
      });
      lobbyKickButton?.addEventListener('click', async (event) => {
        event.stopPropagation();
        await kickBattleOpponent().catch((error) => {
          console.error('Failed to kick Oling battle opponent:', error);
        });
      });
      previousOlingButton?.addEventListener('click', () => {
        cycleOling(-1);
      });
      nextOlingButton?.addEventListener('click', () => {
        cycleOling(1);
      });

      renderOlingArt(playerOlingButton, getSelectedOling());
      renderBattleSetup();
      playerOlingButton?.setAttribute(
        'aria-label',
        `Choose player Oling, current selection ${getSelectedOling().name}`
      );
      playerSelectTrigger?.setAttribute(
        'aria-label',
        `Choose player Oling, current selection ${getSelectedOling().name}`
      );
      loadLobbyMatch();
      }
    }

    return { initializeLobbyTestMode };
  }

  window.createOlingBattleLobby = createOlingBattleLobby;
})();
