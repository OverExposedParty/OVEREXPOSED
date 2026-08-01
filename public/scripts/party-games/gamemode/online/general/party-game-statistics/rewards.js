function getCurrentPlayerPartyGameRewardSummary() {
    const resolvedPartyData = typeof currentPartyData !== 'undefined' ? currentPartyData : null;
    const summaries = resolvedPartyData?.state?.phaseData?.rewardSummaries;
    if (!summaries || typeof summaries !== 'object') return null;

    const currentDeviceId = typeof deviceId !== 'undefined' ? deviceId : null;
    const currentPlayer = Array.isArray(resolvedPartyData?.players)
        ? resolvedPartyData.players.find(player => String(getPlayerId(player)) === String(currentDeviceId))
        : null;
    const accountId = currentPlayer?.identity?.accountId ?? currentPlayer?.accountId ?? null;

    if (summaries.byPlayerId && currentDeviceId && summaries.byPlayerId[String(currentDeviceId)]) {
        return summaries.byPlayerId[String(currentDeviceId)];
    }
    if (summaries.byAccountId && accountId && summaries.byAccountId[String(accountId)]) {
        return summaries.byAccountId[String(accountId)];
    }
    return null;
}

function getCurrentPartyGamePlayer() {
    const resolvedPartyData = typeof currentPartyData !== 'undefined' ? currentPartyData : null;
    const currentDeviceId = typeof deviceId !== 'undefined' ? deviceId : null;
    const currentPlayer = Array.isArray(resolvedPartyData?.players)
        ? resolvedPartyData.players.find(player => String(getPlayerId(player)) === String(currentDeviceId))
        : null;
    return currentPlayer || null;
}

function isCurrentPartyGamePlayerGuest() {
    const currentPlayer = getCurrentPartyGamePlayer();
    if (!currentPlayer) return false;
    const accountId = currentPlayer?.identity?.accountId ?? currentPlayer?.accountId ?? null;
    return !accountId;
}

function getPartyGameRewardNotEarnedReason(rewards = {}) {
    if (isCurrentPartyGamePlayerGuest()) {
        return 'Sign in to earn Opal rewards.';
    }
    if (!rewards || Object.keys(rewards).length === 0) {
        return 'Statistics will update when game data is ready.';
    }
    return 'This game was not eligible for Opal rewards.';
}

function setPartyGameRewardAmount(element, value = 0) {
    if (!element) return;
    element.textContent = String(Math.max(0, Number(value) || 0));
}

function setPartyGameRewardElementVisible(element, isVisible) {
    if (!element) return;
    element.hidden = !isVisible;
    element.style.display = isVisible ? 'flex' : 'none';
}

function renderPartyGameRewards(rewards = {}) {
    const hasRewardSummary = rewards && typeof rewards === 'object' && (
        Object.prototype.hasOwnProperty.call(rewards, 'eligible') ||
        Object.prototype.hasOwnProperty.call(rewards, 'rows')
    );
    rewards = hasRewardSummary ? rewards : {};
    const rows = rewards.rows || {};
    const earned = hasRewardSummary && rewards.eligible === true;
    const rewardRows = partyGameStatisticsOpalsPanel
        ? Array.from(partyGameStatisticsOpalsPanel.querySelectorAll('.game-over-reward-row, .game-over-reward-total'))
        : [];
    rewardRows.forEach(row => {
        setPartyGameRewardElementVisible(row, earned);
    });
    if (partyGameRewardEmpty) {
        setPartyGameRewardElementVisible(partyGameRewardEmpty, !earned);
    }
    if (partyGameRewardEmptyReason) {
        partyGameRewardEmptyReason.textContent = getPartyGameRewardNotEarnedReason(rewards);
    }

    if (!earned) {
        setPartyGameRewardAmount(partyGameRewardCompleted);
        setPartyGameRewardAmount(partyGameRewardParticipation);
        setPartyGameRewardAmount(partyGameRewardObjective);
        setPartyGameRewardAmount(partyGameCapReductionAmount);
        setPartyGameRewardAmount(partyGameRewardTotal);
        if (partyGameCapReductionRow) {
            setPartyGameRewardElementVisible(partyGameCapReductionRow, false);
        }
        return;
    }

    setPartyGameRewardAmount(partyGameRewardCompleted, rows.gameCompleted);
    setPartyGameRewardAmount(partyGameRewardParticipation, rows.activeParticipation);
    setPartyGameRewardAmount(partyGameRewardObjective, rows.objectiveBonus);

    const earnedBeforeCap = Math.max(0, Number(rewards.earnedBeforeCap) || 0);
    const earnedTotal = Math.max(0, Number(rewards.earnedTotal) || 0);
    const reduction = rewards.capReduction || {};
    const reductionAmount = Math.max(0, Number(reduction.amount) || 0);
    const reductionPercentage = Math.max(0, Number(reduction.percentage) || 0);
    const reductionApplied =
        reduction.applied === true &&
        reductionAmount > 0 &&
        earnedBeforeCap > earnedTotal;

    if (partyGameCapReductionRow) {
        setPartyGameRewardElementVisible(partyGameCapReductionRow, reductionApplied);
    }
    if (partyGameCapReductionLabel) {
        partyGameCapReductionLabel.textContent = reductionApplied
            ? `Daily cap reduction (${reductionPercentage}%)`
            : 'Daily cap reduction';
    }
    setPartyGameRewardAmount(partyGameCapReductionAmount, reductionAmount);
    setPartyGameRewardAmount(partyGameRewardTotal, earnedTotal);
}

function getPartyGameXpNotEarnedReason(rewards = {}) {
    if (isCurrentPartyGamePlayerGuest()) {
        return 'Sign in to earn XP.';
    }
    if (!rewards || Object.keys(rewards).length === 0) {
        return 'Statistics will update when game data is ready.';
    }
    if (rewards?.xp?.grantSkippedReason === 'legacy_reward') {
        return 'XP was not awarded for this game.';
    }
    if (rewards.eligible !== true) {
        return 'This game was not eligible for XP.';
    }
    return 'XP information is unavailable for this game.';
}

function renderPartyGameXp(rewards = {}) {
    const xp = rewards?.xp && typeof rewards.xp === 'object' ? rewards.xp : null;
    const progression = xp?.progression && typeof xp.progression === 'object'
        ? xp.progression
        : null;
    const earned = rewards?.eligible === true && progression !== null;

    setPartyGameRewardElementVisible(partyGameXpEmpty, !earned);
    setPartyGameRewardElementVisible(partyGameXpLevelRow, earned);
    setPartyGameRewardElementVisible(partyGameXpProgress, earned);
    setPartyGameRewardElementVisible(partyGameXpTotalRow, earned);

    if (partyGameXpEmptyReason) {
        partyGameXpEmptyReason.textContent = getPartyGameXpNotEarnedReason(rewards);
    }

    if (!earned) {
        setPartyGameRewardElementVisible(partyGameXpLevelUp, false);
        setPartyGameRewardAmount(partyGameXpCurrentLevel, 1);
        setPartyGameRewardAmount(partyGameXpLevelBefore, 1);
        setPartyGameRewardAmount(partyGameXpLevelAfter, 1);
        if (partyGameXpTotal) {
            partyGameXpTotal.textContent = '0xp';
        }
        if (partyGameXpProgressText) {
            partyGameXpProgressText.textContent = '0 / 500 XP';
        }
        if (partyGameXpProgressFill) {
            partyGameXpProgressFill.style.width = '0%';
        }
        if (partyGameXpProgressTrack) {
            partyGameXpProgressTrack.setAttribute('aria-valuemax', '500');
            partyGameXpProgressTrack.setAttribute('aria-valuenow', '0');
        }
        return;
    }

    const levelBefore = Math.max(1, Math.floor(Number(progression.levelBefore) || 1));
    const levelAfter = Math.max(1, Math.floor(Number(progression.levelAfter) || levelBefore));
    const currentLevelXp = Math.max(0, Math.floor(Number(progression.currentLevelXp) || 0));
    const xpRequiredForNextLevel = Math.max(
        1,
        Math.floor(Number(progression.xpRequiredForNextLevel) || 1)
    );
    const grantedTotal = Math.max(0, Math.floor(Number(xp.grantedTotal) || 0));
    const levelledUp = progression.levelledUp === true || levelAfter > levelBefore;
    const progressPercentage = Math.round(
        Math.min(100, Math.max(0, (currentLevelXp / xpRequiredForNextLevel) * 100)) * 100
    ) / 100;

    setPartyGameRewardAmount(partyGameXpCurrentLevel, levelAfter);
    setPartyGameRewardAmount(partyGameXpLevelBefore, levelBefore);
    setPartyGameRewardAmount(partyGameXpLevelAfter, levelAfter);
    if (partyGameXpTotal) {
        partyGameXpTotal.textContent = `${grantedTotal}xp`;
    }
    setPartyGameRewardElementVisible(partyGameXpLevelUp, levelledUp);

    if (partyGameXpProgressText) {
        partyGameXpProgressText.textContent = `${currentLevelXp} / ${xpRequiredForNextLevel} XP`;
    }
    if (partyGameXpProgressFill) {
        partyGameXpProgressFill.style.width = `${progressPercentage}%`;
    }
    if (partyGameXpProgressTrack) {
        partyGameXpProgressTrack.setAttribute('aria-valuemax', String(xpRequiredForNextLevel));
        partyGameXpProgressTrack.setAttribute('aria-valuenow', String(currentLevelXp));
    }
}
