(function () {
  function createOlingBattleLobbyMatchSync(context) {
    with (context) {
      function getCurrentMatchPlayer(match = battleMatch) {
        return (
          match?.players?.find(
            (player) => String(player.accountId) === String(currentAccount?.id)
          ) || null
        );
      }

      function getOpponentMatchPlayer(match = battleMatch) {
        return (
          match?.players?.find(
            (player) =>
              String(player.accountId) !== String(currentAccount?.id) &&
              player.connected !== false
          ) || null
        );
      }

      function getOpponentRenderKey(player) {
        if (!player) return '';
        return [
          player.isAi ? 'ai' : 'player',
          player.accountId,
          player.olingId
        ].join(':');
      }

      function playOpponentEnterAnimation(opponentKey) {
        if (
          !enemyLobbyParty ||
          !opponentKey ||
          opponentKey === lastRenderedOpponentKey
        ) {
          return;
        }

        lastRenderedOpponentKey = opponentKey;
        if (opponentEnterTimeout) window.clearTimeout(opponentEnterTimeout);
        enemyLobbyParty.classList.remove('is-opponent-entering');
        void enemyLobbyParty.offsetWidth;
        enemyLobbyParty.classList.add('is-opponent-entering');
        opponentEnterTimeout = window.setTimeout(() => {
          enemyLobbyParty.classList.remove('is-opponent-entering');
          opponentEnterTimeout = null;
        }, 420);
      }

      function startAiBattleLoop() {
        document.dispatchEvent(
          new CustomEvent('oling-battle:ai-start', {
            detail: {
              currentAccountId: currentAccount?.id,
              match: battleMatch
            }
          })
        );
      }

      function stopAiBattleLoop() {
        document.dispatchEvent(new CustomEvent('oling-battle:ai-stop'));
      }

      function updateMatchHealth(meter, player) {
        if (!meter || !player) return;
        const maximum = Math.max(1, Number(player.maxHealth) || 1);
        const current = Math.max(
          0,
          Math.min(maximum, Number(player.currentHealth) || 0)
        );
        meter.dataset.currentHealth = String(current);
        meter.dataset.maxHealth = String(maximum);
        meter.setAttribute('aria-valuemax', String(maximum));
        meter.setAttribute('aria-valuenow', String(current));
        meter
          .querySelector('span')
          ?.style.setProperty(
            '--health-level',
            `${(current / maximum) * 100}%`
          );
        const value = meter.querySelector('strong');
        if (value) value.textContent = `${current}/${maximum}`;
      }

      async function syncLobbyMatch(match) {
        if (!match) return;
        battleMatch = match;
        const currentPlayer = getCurrentMatchPlayer(match);
        if (!currentPlayer) {
          showKickedFromBattleState();
          return;
        }
        const opponentPlayer = getOpponentMatchPlayer(match);
        const hasOpponent = Boolean(opponentPlayer);
        const isAiOpponent = Boolean(opponentPlayer?.isAi);
        const opponentKey = getOpponentRenderKey(opponentPlayer);
        const canKickOpponent =
          currentPlayer?.slot === 'player-one' &&
          hasOpponent &&
          ['waiting', 'ready'].includes(match.status);
        if (currentPlayer?.slot)
          battleShell.dataset.currentPlayerSlot = currentPlayer.slot;

        enemyLobbyParty?.classList.toggle(
          'is-waiting-for-player',
          !hasOpponent
        );
        enemyLobbyParty?.classList.toggle('is-ai-opponent', isAiOpponent);
        if (!hasOpponent) {
          lastRenderedOpponentKey = null;
          enemyLobbyParty?.classList.remove('is-opponent-entering');
        }
        if (enemySelectTrigger) enemySelectTrigger.disabled = !hasOpponent;
        if (lobbyKickButton) {
          lobbyKickButton.hidden = !canKickOpponent;
          lobbyKickButton.disabled = !canKickOpponent;
          lobbyKickButton.setAttribute(
            'aria-label',
            canKickOpponent
              ? `Kick ${opponentPlayer?.playerName || 'opponent'}`
              : 'Kick opponent'
          );
        }
        playerReadyCheckmark?.classList.toggle(
          'checked',
          Boolean(currentPlayer?.ready)
        );
        enemyReadyCheckmark?.classList.toggle(
          'checked',
          Boolean(opponentPlayer?.ready)
        );
        readyButton?.classList.toggle(
          'is-ready',
          Boolean(currentPlayer?.ready)
        );
        if (readyButton && lobbyDetailMode === 'default') {
          readyButton.disabled = !hasOpponent;
          readyButton.textContent = !hasOpponent
            ? 'WAITING FOR PLAYER'
            : currentPlayer?.ready
              ? 'UNREADY'
              : 'READY UP';
        }

        if (opponentPlayer) {
          opponentOling = normalizePlayerOling(opponentPlayer.olingSnapshot);
          opponentOling.maxHealth =
            Number(opponentPlayer.maxHealth) || opponentOling.maxHealth;
          renderOlingArt(enemyOlingButton, opponentOling);
          enemyOlingButton?.setAttribute(
            'aria-label',
            `View opponent Oling, ${opponentOling.name}`
          );
          enemySelectTrigger?.setAttribute(
            'aria-label',
            `View opponent Oling, ${opponentOling.name}`
          );
          if (enemyLobbyName)
            enemyLobbyName.textContent =
              opponentPlayer.playerName || 'OPPONENT';
          if (isAiOpponent) {
            enemyLobbyOe?.replaceChildren();
          } else {
            await renderAccountOe(enemyLobbyOe, opponentPlayer.oeIcon).catch(
              (error) => {
                console.error('Failed to render the opponent OE:', error);
              }
            );
          }
          playOpponentEnterAnimation(opponentKey);
          renderBattleSetup();
        }

        if (match.status === 'active') {
          updateMatchHealth(playerBattleHealth, currentPlayer);
          updateMatchHealth(enemyBattleHealth, opponentPlayer);
          if (battleShell.classList.contains('is-lobby')) {
            setLobbyMode(false);
            document.dispatchEvent(new CustomEvent('oling-battle:start'));
          }
          startAiBattleLoop();
        } else if (match.state?.phase === 'countdown') {
          stopAiBattleLoop();
          startLobbyCountdown();
        } else {
          stopAiBattleLoop();
          cancelLobbyCountdown();
        }
      }

      async function fetchBattleMatch() {
        if (!battleMatch?.matchCode) return null;
        const response = await fetch(
          `/api/olings/battles/${encodeURIComponent(battleMatch.matchCode)}`,
          { headers: { Accept: 'application/json' } }
        );
        const payload = await readJsonResponse(response);
        return payload.match || null;
      }

      function initializeBattleSocket() {
        if (
          battleSocket ||
          typeof window.io !== 'function' ||
          !battleMatch?.matchCode
        ) {
          return;
        }

        battleSocket = window.io();
        const joinRoom = () => {
          battleSocket.emit('oling-battle:join-room', battleMatch.matchCode);
        };
        const syncSocketMatch = (match) => {
          if (match?.matchCode === battleMatch?.matchCode) {
            syncLobbyMatch(match).catch((error) => {
              console.error('Failed to apply Oling battle update:', error);
            });
          }
        };

        battleSocket.on('connect', () => {
          joinRoom();
          fetchBattleMatch()
            .then(syncLobbyMatch)
            .catch((error) =>
              console.error('Failed to reconnect Oling battle:', error)
            );
        });
        battleSocket.on('oling-battle:state', syncSocketMatch);
        battleSocket.on('oling-battle:started', syncSocketMatch);
        battleSocket.on('oling-battle:left', syncSocketMatch);
        battleSocket.on('oling-battle:kicked', syncSocketMatch);
        battleSocket.on('oling-battle:user-joined', () => {
          fetchBattleMatch()
            .then(syncLobbyMatch)
            .catch((error) =>
              console.error('Failed to sync joined battle player:', error)
            );
        });
      }

      async function requestBattleStart() {
        const response = await fetch(
          `/api/olings/battles/${encodeURIComponent(battleMatch.matchCode)}/start`,
          { method: 'POST', headers: { Accept: 'application/json' } }
        );
        const payload = await readJsonResponse(response);
        await syncLobbyMatch(payload.match);
      }

      async function loadLobbyMatch() {
        setLobbyMode(true);
        if (battleTimer) {
          battleTimer.textContent = '';
          battleTimer.setAttribute('aria-label', 'Oling battle lobby');
        }
        renderOlingArt(playerOlingButton, getSelectedOling());
        renderBattleSetup();

        try {
          const hasPlayerOling = await fetchPlayerOlings();
          if (!hasPlayerOling) {
            showNoOlingState();
            return;
          }
          showBattleState();
          renderOlingArt(playerOlingButton, getSelectedOling());
          renderBattleSetup();
          battleMatch = await fetchOrCreateBattleMatch();
          setLobbyCode(battleMatch?.matchCode || matchCodeFromPath);
          await syncLobbyMatch(battleMatch);
          initializeBattleSocket();
        } catch (error) {
          console.error('Failed to prepare Oling battle lobby:', error);
          if (matchCodeFromPath) setLobbyCode(matchCodeFromPath);
        }
      }

      function startLobbyCountdown() {
        if (isStartingBattle) return;

        isStartingBattle = true;
        const updateCountdown = () => {
          const startedAt = new Date(
            battleMatch?.state?.countdownStartedAt || 0
          ).getTime();
          const count = Math.max(
            0,
            Math.ceil(5 - (Date.now() - startedAt) / 1000)
          );
          if (battleTimer) {
            battleTimer.textContent = String(count);
            battleTimer.setAttribute(
              'aria-label',
              count > 0
                ? `Battle starting in ${count} seconds`
                : 'Battle starting'
            );
          }
          if (count > 0) return;

          window.clearInterval(countdownInterval);
          countdownInterval = null;
          requestBattleStart().catch((error) => {
            console.error('Failed to start Oling battle:', error);
            isStartingBattle = false;
          });
        };
        updateCountdown();
        if (isStartingBattle && !countdownInterval) {
          countdownInterval = window.setInterval(updateCountdown, 200);
        }
      }

      function cancelLobbyCountdown() {
        if (countdownInterval) window.clearInterval(countdownInterval);
        countdownInterval = null;
        isStartingBattle = false;
        if (battleTimer && battleShell.classList.contains('is-lobby')) {
          battleTimer.textContent = '';
          battleTimer.setAttribute('aria-label', 'Oling battle lobby');
        }
      }


      return {
        getCurrentMatchPlayer,
        getOpponentMatchPlayer,
        getOpponentRenderKey,
        playOpponentEnterAnimation,
        startAiBattleLoop,
        stopAiBattleLoop,
        updateMatchHealth,
        syncLobbyMatch,
        fetchBattleMatch,
        initializeBattleSocket,
        requestBattleStart,
        loadLobbyMatch,
        startLobbyCountdown,
        cancelLobbyCountdown
      };
    }
  }

  window.createOlingBattleLobbyMatchSync = createOlingBattleLobbyMatchSync;
})();
