(function () {
  function createOlingBattleLobbyApi(context) {
    with (context) {
      async function readJsonResponse(response) {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
          throw new Error(
            payload.error?.message || 'That Oling battle request failed.'
          );
        }
        return payload;
      }

      async function fetchPlayerOlings() {
        const response = await fetch('/api/olings/mine', {
          headers: { Accept: 'application/json' }
        });
        const payload = await readJsonResponse(response);
        currentAccount = payload.account || currentAccount;
        if (playerLobbyName && payload.account?.username) {
          playerLobbyName.textContent = payload.account.username;
        }
        await renderAccountOe(playerLobbyOe, payload.account?.oeIcon).catch(
          (error) => {
            console.error('Failed to render the player OE:', error);
          }
        );
        const ownedOlings = Array.isArray(payload.olings) ? payload.olings : [];
        const normalizedOlings = ownedOlings
          .map(normalizePlayerOling)
          .filter(Boolean);

        playerOlings = normalizedOlings;
        if (!playerOlings.length) return false;

        selectedOlingIndex = Math.max(
          0,
          playerOlings.findIndex((oling) => oling.id === savedOlingId)
        );
        return true;
      }

      async function createBattleMatch() {
        const selectedOling = getSelectedOling();
        if (!selectedOling?.source) return null;

        const response = await fetch('/api/olings/battles', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            matchLengthSeconds: Number(battleShell.dataset.matchLength) || 30,
            olingId: selectedOling.id
          })
        });
        const payload = await readJsonResponse(response);
        return payload.match || null;
      }

      async function fetchOrCreateBattleMatch() {
        if (matchCodeFromPath) {
          const response = await fetch(
            `/api/olings/battles/${encodeURIComponent(matchCodeFromPath)}`,
            { headers: { Accept: 'application/json' } }
          );
          const payload = await readJsonResponse(response);
          const match = payload.match || null;
          const isAlreadyPlayer = match?.players?.some(
            (player) => String(player.accountId) === String(currentAccount?.id)
          );
          if (isAlreadyPlayer) return match;

          const joinResponse = await fetch(
            `/api/olings/battles/${encodeURIComponent(matchCodeFromPath)}/join`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ olingId: getSelectedOling()?.id })
            }
          );
          const joinPayload = await readJsonResponse(joinResponse);
          return joinPayload.match || null;
        }

        return createBattleMatch();
      }

      async function updateBattleOling(olingId) {
        if (!battleMatch?.matchCode || !olingId) return;

        const response = await fetch(
          `/api/olings/battles/${encodeURIComponent(battleMatch.matchCode)}/oling`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ olingId })
          }
        );
        const payload = await readJsonResponse(response);
        battleMatch = payload.match || battleMatch;
      }

      async function readyBattleMatch(ready) {
        if (!battleMatch?.matchCode) return;

        const response = await fetch(
          `/api/olings/battles/${encodeURIComponent(battleMatch.matchCode)}/ready`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ready })
          }
        );
        const payload = await readJsonResponse(response);
        battleMatch = payload.match || battleMatch;
      }

      async function kickBattleOpponent() {
        if (!battleMatch?.matchCode) return;

        const response = await fetch(
          `/api/olings/battles/${encodeURIComponent(battleMatch.matchCode)}/kick`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
        const payload = await readJsonResponse(response);
        battleMatch = payload.match || battleMatch;
        await syncLobbyMatch(battleMatch);
      }


      return {
        readJsonResponse,
        fetchPlayerOlings,
        createBattleMatch,
        fetchOrCreateBattleMatch,
        updateBattleOling,
        readyBattleMatch,
        kickBattleOpponent
      };
    }
  }

  window.createOlingBattleLobbyApi = createOlingBattleLobbyApi;
})();
