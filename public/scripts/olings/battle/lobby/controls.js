(function () {
  function createOlingBattleLobbyControls(context) {
    with (context) {
      function setLobbyDetailMode(mode = 'default') {
        lobbyDetailMode = mode;
        const isChoosingOling = lobbyDetailMode === 'player';
        const isViewingEnemy = lobbyDetailMode === 'enemy';
        const hasDetailMode = isChoosingOling || isViewingEnemy;

        matchup?.classList.toggle('is-choosing-oling', isChoosingOling);
        matchup?.classList.toggle('is-viewing-enemy', isViewingEnemy);
        lobbyActions?.classList.toggle('is-choosing-oling', hasDetailMode);
        if (picker) {
          picker.hidden = !hasDetailMode;
          picker.setAttribute(
            'aria-label',
            isViewingEnemy ? 'Enemy Oling information' : 'Choose your Oling'
          );
        }
        if (enemyPicker) {
          enemyPicker.hidden = true;
        }
        if (playerDescriptionPanel) {
          playerDescriptionPanel.hidden = !hasDetailMode;
        }
        if (descriptionPanel) {
          descriptionPanel.hidden = true;
        }
        if (energyMeter) {
          energyMeter.hidden = !hasDetailMode;
        }
        if (readyButton) {
          const opponentPlayer = getOpponentMatchPlayer();
          const hasOpponent = Boolean(opponentPlayer);
          readyButton.disabled = hasDetailMode ? false : !hasOpponent;
          readyButton.textContent = isChoosingOling
            ? 'SAVE'
            : isViewingEnemy
              ? 'BACK'
              : !hasOpponent
                ? 'WAITING FOR PLAYER'
                : getCurrentMatchPlayer()?.ready
                  ? 'UNREADY'
                  : 'READY UP';
        }
        if (isChoosingOling) {
          renderOlingPicker();
        } else if (isViewingEnemy) {
          renderOlingArt(pickerPreview, opponentOling);
          renderOlingDescription(opponentOling, {
            panel: playerDescriptionPanel,
            stats: playerDescriptionStats,
            mode: 'enemy'
          });
          updateEnergyMeter(opponentOling);
        }
      }

      function cycleOling(direction) {
        selectedOlingIndex =
          (selectedOlingIndex + direction + playerOlings.length) %
          playerOlings.length;
        renderOlingPicker();
      }

      async function saveSelectedOling() {
        const selectedOling = getSelectedOling();
        localStorage.setItem('oling-battle-selected-oling', selectedOling.id);
        renderOlingArt(playerOlingButton, selectedOling);
        renderBattleSetup();
        playerOlingButton?.setAttribute(
          'aria-label',
          `Choose player Oling, current selection ${selectedOling.name}`
        );
        playerSelectTrigger?.setAttribute(
          'aria-label',
          `Choose player Oling, current selection ${selectedOling.name}`
        );
        if (battleMatch?.matchCode && selectedOling.source) {
          await updateBattleOling(selectedOling.id);
        }
        setLobbyDetailMode('default');
      }

      function setLobbyMode(isLobby) {
        if (!isLobby) setQrPanelVisible(false);
        battleShell.classList.toggle('is-lobby', isLobby);
        arena?.setAttribute('aria-hidden', String(isLobby));
        battleFooter?.setAttribute('aria-hidden', String(isLobby));
        lobbyScreen.setAttribute('aria-hidden', String(!isLobby));
        lobbyFooter.setAttribute('aria-hidden', String(!isLobby));
      }

      function getBattleUrl() {
        const code = lobbyCode?.value || battleMatch?.matchCode || 'RDW-5S8';
        return `${window.location.origin}/olings/battle/${encodeURIComponent(code)}`;
      }

      function setQrPanelVisible(show) {
        if (!qrPanel) return;
        const code = lobbyCode?.value || battleMatch?.matchCode;
        const shouldShow = Boolean(show && code);

        qrPanel.hidden = !shouldShow;
        qrPanel.setAttribute('aria-hidden', String(!shouldShow));
        lobbyScreen.classList.toggle('is-showing-qr', shouldShow);
        qrButton?.classList.toggle('is-active', shouldShow);
        if (!shouldShow) return;

        const path = `/olings/battle/${code}`;
        const colour =
          getComputedStyle(document.documentElement)
            .getPropertyValue('--primarypagecolour')
            .trim() || '#FFB5C8';
        if (qrPanelImage) {
          qrPanelImage.alt = `Join Oling battle ${code}`;
          qrPanelImage.src =
            `/api/party-qr/${encodeURIComponent(code)}` +
            `?color=${encodeURIComponent(colour)}` +
            `&path=${encodeURIComponent(path)}`;
        }
        if (qrPanelCode) qrPanelCode.textContent = code;
        if (qrPanelUrl) qrPanelUrl.textContent = getBattleUrl();
        qrPanelClose?.focus();
      }

      async function copyLobbyUrl() {
        const url = getBattleUrl();
        const copied =
          typeof window.copyTextToClipboard === 'function'
            ? await window.copyTextToClipboard(url)
            : await navigator.clipboard
                ?.writeText(url)
                .then(() => true)
                .catch(() => false);

        copyButton?.classList.toggle('is-active', Boolean(copied));
        playInteractionSound(copied ? 'select' : 'error');
        window.setTimeout(() => copyButton?.classList.remove('is-active'), 700);
      }

      function setLobbyCode(code) {
        if (!lobbyCode || !code) return;

        lobbyCode.value = code;
        battleShell.dataset.matchCode = code;
        lobbyCode.setAttribute('aria-label', `Lobby code ${code}`);
      }


      return {
        setLobbyDetailMode,
        cycleOling,
        saveSelectedOling,
        setLobbyMode,
        getBattleUrl,
        setQrPanelVisible,
        copyLobbyUrl,
        setLobbyCode
      };
    }
  }

  window.createOlingBattleLobbyControls = createOlingBattleLobbyControls;
})();
