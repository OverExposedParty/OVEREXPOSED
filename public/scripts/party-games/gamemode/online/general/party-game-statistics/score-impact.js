function ShowPartyGameScoreImpact(scoreDeltas = []) {
    if (!scoreImpactFeed || !Array.isArray(scoreDeltas)) return;

    const batch = getPartyGameScoreImpactBatch(scoreDeltas);
    [...batch].reverse().forEach(change => {
        const row = createPartyGameScoreImpactRow(change);
        if (typeof window.showOePopup === 'function') {
            window.showOePopup(row, { duration: 4200, sound: false });
        } else {
            scoreImpactFeed.prepend(row);
        }
    });
}

function hidePartyGameScoreImpact() {
    partyGameScoreImpactTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    partyGameScoreImpactTimeouts.clear();

    if (scoreImpactFeed) {
        scoreImpactFeed.innerHTML = '';
    }
}

function dismissPartyGameScoreImpactFeed() {
    if (!scoreImpactFeed) return;

    const rows = scoreImpactFeed.querySelectorAll('.score-impact-row');
    if (rows.length === 0) return;

    partyGameScoreImpactTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    partyGameScoreImpactTimeouts.clear();

    rows.forEach(row => {
        row.classList.add('is-exiting');
        setTimeout(() => row.remove(), 260);
    });
}

function getPartyGameScoreImpactBatch(scoreDeltas = []) {
    const sortedChanges = [...scoreDeltas].sort((a, b) => {
        if (b.delta !== a.delta) return b.delta - a.delta;
        return b.score - a.score;
    });

    if (sortedChanges.length <= 6) {
        return sortedChanges;
    }

    const gains = sortedChanges.filter(change => change.delta > 0).slice(0, 3);
    const losses = sortedChanges
        .filter(change => change.delta < 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(-2);
    const selectedIds = new Set([...gains, ...losses].map(change => change.id));
    const hiddenCount = sortedChanges.filter(change => !selectedIds.has(change.id)).length;
    const batch = [...gains, ...losses].sort((a, b) => {
        if (b.delta !== a.delta) return b.delta - a.delta;
        return b.score - a.score;
    });

    if (hiddenCount > 0) {
        batch.push({
            id: `summary-${Date.now()}`,
            isSummary: true,
            hiddenCount
        });
    }

    return batch;
}

function createPartyGameScoreImpactRow(change) {
    const row = document.createElement('div');
    row.className = 'score-impact-row';
    row.dataset.popupType = 'score';

    if (change.isSummary) {
        row.classList.add('summary');
        const summary = document.createElement('span');
        summary.className = 'score-impact-summary-text';
        summary.textContent = `${change.hiddenCount} more players changed`;
        row.appendChild(summary);
    } else {
        row.classList.add(change.delta > 0 ? 'positive' : 'negative');

        const rank = document.createElement('span');
        rank.className = 'score-impact-rank';

        const rankNumber = document.createElement('span');
        rankNumber.className = 'score-impact-rank-number';
        rankNumber.textContent = change.currentRank ?? '-';

        const rankDelta = document.createElement('span');
        rankDelta.className = 'score-impact-rank-delta';
        rankDelta.textContent = `[${change.rankDelta > 0 ? '+' : ''}${change.rankDelta}]`;

        rank.appendChild(rankNumber);
        rank.appendChild(rankDelta);

        const avatar = createPartyGameScoreImpactAvatar(change);

        const name = document.createElement('span');
        name.className = 'score-impact-name';
        name.textContent = change.username;

        const score = document.createElement('span');
        score.className = 'score-impact-score';
        score.textContent = `${change.score} pts [${change.delta > 0 ? '+' : ''}${change.delta}]`;

        row.appendChild(rank);
        row.appendChild(avatar);
        row.appendChild(name);
        row.appendChild(score);
    }

    if (typeof window.showOePopup !== 'function') {
        requestAnimationFrame(() => {
            row.classList.add('is-visible');
        });

        const timeoutId = setTimeout(() => {
            row.classList.add('is-exiting');
            setTimeout(() => row.remove(), 260);
            partyGameScoreImpactTimeouts.delete(timeoutId);
        }, 4200);

        partyGameScoreImpactTimeouts.add(timeoutId);
    }
    return row;
}

function createPartyGameScoreImpactAvatar(change) {
    const avatar = document.createElement('div');
    avatar.className = 'score-impact-avatar';

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.dataset.userId = change.id;

    const imageStack = document.createElement('div');
    imageStack.className = 'image-stack';

    ['colour', 'head-slot', 'eyes-slot', 'mouth-slot'].forEach(slot => {
        const img = document.createElement('img');
        img.id = slot;
        img.alt = '';
        img.src = getBlankPartyGameStatisticIconPath(slot);
        imageStack.appendChild(img);
    });

    icon.appendChild(imageStack);
    avatar.appendChild(icon);

    if (typeof EditUserIconPartyGames === 'function') {
        EditUserIconPartyGames({
            container: avatar,
            userId: change.id,
            userCustomisationString: getPlayerIcon(change.player)
        });
    }

    return avatar;
}

/* ──────────────────────────────────────────────
   HELPERS FOR NESTED/LEGACY PLAYER SHAPES
────────────────────────────────────────────── */

function getPlayerScore(player) {
    if (player?.state && typeof player.state.score === 'number') {
        return player.state.score;
    }
    if (typeof player?.score === 'number') {
        return player.score;
    }
    return 0;
}
