(function (globalScope) {
  function createMatchNormalizer(options = {}) {
    const getAccountId = options.getAccountId || (() => '');
    const getMatch = options.getMatch || (() => null);

    function formatOnlineKey(value, fallback = 'OLING') {
      const formatted = String(value || '')
        .trim()
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      return formatted || fallback;
    }

    function getOnlinePartPath(snapshot, layer) {
      const trait = snapshot?.traits?.[layer] || {};
      const traitPath =
        trait.assets?.image || trait.assets?.imagePath || trait.imagePath;
      if (traitPath) return traitPath;
      const key = String(snapshot?.build?.[layer] || '').trim();
      if (!key) return '';
      if (key.startsWith('/')) return key;
      return `/images/olings/builds/${layer}/base/${key.replace(/\.svg$/i, '')}.svg`;
    }

    function normalizeOnlineEffect(status = {}) {
      const key = String(status.key || 'effect').toLowerCase();
      const negativeKeys = new Set([
        'blocked',
        'burn',
        'burn-primed',
        'junk',
        'marked',
        'suppressed',
        'wither'
      ]);
      const name = formatOnlineKey(key, 'Effect');
      return {
        abbreviation: name
          .replace(/[^A-Za-z]/g, '')
          .slice(0, 3)
          .toUpperCase(),
        key,
        name,
        type: negativeKeys.has(key) ? 'negative' : 'positive'
      };
    }

    function normalizeOnlineOling(teamOling = {}) {
      const snapshot = teamOling.snapshot || {};
      const abilities = Array.isArray(snapshot.abilities)
        ? snapshot.abilities
        : [];
      const abilityFor = (layer, fallback) =>
        abilities.find((ability) => ability.layer === layer)?.name || fallback;
      return {
        abilityProgress: teamOling.abilityProgress || [],
        effects: (teamOling.statuses || []).map(normalizeOnlineEffect),
        health: {
          bloodUnits: Number(teamOling.bloodUnits || 0),
          heartUnits: Number(teamOling.heartUnits || 0),
          maxHeartUnits: Math.max(1, Number(teamOling.maxHeartUnits || 1)),
          overgrowthUnits: Number(teamOling.overgrowthUnits || 0),
          shieldCount: Number(teamOling.shieldCount || 0)
        },
        id: String(teamOling.playerOlingId || teamOling.teamSlot || ''),
        moves: {
          attack: abilityFor('mouth', 'ATTACK'),
          draw: abilityFor('eyes', 'DRAW'),
          guard: abilityFor('body', 'GUARD'),
          skill: abilityFor('flight', 'SKILL')
        },
        name: String(
          snapshot.name || `OLING ${Number(teamOling.teamSlot) + 1}`
        ),
        parts: {
          body: getOnlinePartPath(snapshot, 'body'),
          eyes: getOnlinePartPath(snapshot, 'eyes'),
          flight: getOnlinePartPath(snapshot, 'flight'),
          mouth: getOnlinePartPath(snapshot, 'mouth')
        },
        pendingReclaimUnits: Number(teamOling.pendingReclaimUnits || 0),
        removedPositiveEffects: teamOling.removedPositiveStatuses || [],
        snapshot,
        teamSlot: Number(teamOling.teamSlot)
      };
    }

    function normalizeOnlineTeam(player = {}, previousTeam = []) {
      const normalizedTeam = [...(player.team || [])].map(normalizeOnlineOling);
      const byTeamSlot = new Map(
        normalizedTeam.map((oling) => [Number(oling.teamSlot), oling])
      );
      const previousSlots = (previousTeam || []).map((oling) =>
        Number(oling?.teamSlot)
      );
      const preservesRosterOrder =
        previousSlots.length === normalizedTeam.length &&
        previousSlots.every((teamSlot) => byTeamSlot.has(teamSlot));
      const orderedSlots = preservesRosterOrder
        ? [...previousSlots]
        : normalizedTeam
            .map((oling) => Number(oling.teamSlot))
            .sort((left, right) => left - right);
      const activeTeamSlot = Number(player.activeTeamSlot);
      const activeIndex = orderedSlots.indexOf(activeTeamSlot);
      if (activeIndex > 0) {
        [orderedSlots[0], orderedSlots[activeIndex]] = [
          orderedSlots[activeIndex],
          orderedSlots[0]
        ];
      }
      return orderedSlots
        .map((teamSlot) => byTeamSlot.get(teamSlot))
        .filter(Boolean);
    }

    function normalizeOnlineTagResource(player = {}, match = getMatch()) {
      const tagging = match?.ruleset?.snapshot?.tagging || {};
      const configuredMaximum = Number(tagging.maximumCharges);
      const configuredThreshold = Number(tagging.decisiveClashesPerCharge);
      const maximumCharges =
        Number.isInteger(configuredMaximum) && configuredMaximum >= 0
          ? configuredMaximum
          : 2;
      const decisiveClashesPerCharge =
        Number.isInteger(configuredThreshold) && configuredThreshold >= 1
          ? configuredThreshold
          : 3;
      const configuredCharges = Number(player.tagCharges);
      const charges = Math.min(
        maximumCharges,
        Number.isInteger(configuredCharges)
          ? Math.max(0, configuredCharges)
          : maximumCharges
      );
      const configuredProgress = Number(player.tagRechargeProgress);
      const rechargeProgress =
        charges >= maximumCharges
          ? 0
          : Number.isInteger(configuredProgress)
            ? Math.min(
                decisiveClashesPerCharge - 1,
                Math.max(0, configuredProgress)
              )
            : 0;
      return {
        charges,
        decisiveClashesPerCharge,
        maximumCharges,
        rechargeProgress
      };
    }

    function getOnlinePlayers(match = getMatch()) {
      const accountId = getAccountId();
      const local = match?.players?.find(
        (player) => String(player.accountId) === String(accountId)
      );
      const opponentPlayer = match?.players?.find(
        (player) => String(player.accountId) !== String(accountId)
      );
      return { local, opponent: opponentPlayer };
    }

    function onlinePlayerNeedsReplacement(player) {
      if (!player) return false;
      const active = player.team?.find(
        (oling) => Number(oling.teamSlot) === Number(player.activeTeamSlot)
      );
      return Boolean(
        active?.defeated && player.team?.some((oling) => !oling.defeated)
      );
    }

    function getOnlineMatchPhase(match, players) {
      if (match.status === 'completed') return 'complete';
      if (match.phase === 'starting') {
        return players.local.gameLoaded ? 'waiting' : 'starting';
      }
      if (match.phase === 'replacement') {
        return onlinePlayerNeedsReplacement(players.local)
          ? 'choose-tag'
          : 'opponent-tag';
      }
      return players.local.selectionCommitted ? 'waiting' : 'choose-action';
    }

    return {
      formatOnlineKey,
      getOnlineMatchPhase,
      getOnlinePlayers,
      normalizeOnlineEffect,
      normalizeOnlineOling,
      normalizeOnlineTagResource,
      normalizeOnlineTeam,
      onlinePlayerNeedsReplacement
    };
  }

  globalScope.createOlingClashOnlineMatchNormalizer = createMatchNormalizer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createMatchNormalizer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
