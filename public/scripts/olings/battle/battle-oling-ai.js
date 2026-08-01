(function () {
  const aiBattleDifficulty = 0.4;

  let battleMatch = null;
  let currentAccountId = '';
  let aiBattleTimeout = null;
  let isAiAttackPending = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getRandomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function readJsonResponse(response) {
    return response.json().catch(() => ({})).then((payload) => {
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error?.message || 'That Oling battle request failed.');
      }
      return payload;
    });
  }

  function getAiOpponent(match = battleMatch) {
    return match?.players?.find(
      (player) =>
        player?.isAi &&
        String(player.accountId) !== String(currentAccountId) &&
        player.connected !== false
    ) || null;
  }

  function getAiDifficulty(player = getAiOpponent()) {
    return clamp(Number(player?.aiDifficulty ?? aiBattleDifficulty), 0, 1);
  }

  function chooseAiZone(difficulty = aiBattleDifficulty) {
    const mistakeChance = 0.42 + (0.06 - 0.42) * difficulty;
    if (Math.random() < mistakeChance) return 'disruption';

    const criticalChance = 0.1 + 0.45 * difficulty;
    const strikeChance = 0.52 - 0.12 * difficulty;
    const roll = Math.random();
    if (roll < criticalChance) return 'critical';
    if (roll < criticalChance + strikeChance) return 'strike';
    return 'disruption';
  }

  function emitMatchUpdate(match) {
    if (!match) return;
    document.dispatchEvent(
      new CustomEvent('oling-battle:ai-match-updated', {
        detail: { match }
      })
    );
  }

  function clearAiBattleLoop() {
    if (aiBattleTimeout) window.clearTimeout(aiBattleTimeout);
    aiBattleTimeout = null;
    isAiAttackPending = false;
  }

  async function requestAiBattleHit(zone) {
    const response = await fetch(
      `/api/olings/battles/${encodeURIComponent(battleMatch.matchCode)}/ai-hit`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zone })
      }
    );
    const payload = await readJsonResponse(response);
    battleMatch = payload.match || battleMatch;
    document.dispatchEvent(
      new CustomEvent('oling-battle:external-hit', {
        detail: { payload, zone }
      })
    );
    emitMatchUpdate(battleMatch);
    return payload;
  }

  function scheduleAiBattleHit() {
    clearAiBattleLoop();
    const aiOpponent = getAiOpponent();
    if (!aiOpponent || battleMatch?.status !== 'active') return;

    const difficulty = getAiDifficulty(aiOpponent);
    const reactionMs = 850 + (140 - 850) * difficulty;
    const maxTimingErrorMs = 260 + (35 - 260) * difficulty;
    const timingErrorMs = getRandomBetween(-maxTimingErrorMs, maxTimingErrorMs);
    const delay = clamp(reactionMs + timingErrorMs, 140, 1100);

    aiBattleTimeout = window.setTimeout(async () => {
      if (isAiAttackPending || battleMatch?.status !== 'active') {
        scheduleAiBattleHit();
        return;
      }
      isAiAttackPending = true;
      try {
        await requestAiBattleHit(chooseAiZone(difficulty));
      } catch (error) {
        console.error('Failed to resolve AI Oling battle hit:', error);
      } finally {
        isAiAttackPending = false;
        scheduleAiBattleHit();
      }
    }, delay);
  }

  async function addAiBattleOpponent(matchCode) {
    if (!matchCode) return;

    const response = await fetch(
      `/api/olings/battles/${encodeURIComponent(matchCode)}/ai-opponent`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ difficulty: aiBattleDifficulty })
      }
    );
    const payload = await readJsonResponse(response);
    battleMatch = payload.match || battleMatch;
    emitMatchUpdate(battleMatch);
  }

  document.addEventListener('oling-battle:ai-start', (event) => {
    battleMatch = event.detail?.match || battleMatch;
    currentAccountId = String(event.detail?.currentAccountId || currentAccountId || '');
    scheduleAiBattleHit();
  });

  document.addEventListener('oling-battle:ai-stop', () => {
    clearAiBattleLoop();
  });

  document.addEventListener('oling-battle:ai-add-opponent', (event) => {
    if (event.detail?.allowAdd === false) return;
    addAiBattleOpponent(event.detail?.matchCode).catch((error) => {
      console.error('Failed to add AI Oling battle opponent:', error);
    });
  });
})();
