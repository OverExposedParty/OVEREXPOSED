(function (globalScope) {
  const normalHeartAssetRoot = '/images/olings/clash/ui/health/hearts/normal';
  const standardRulesSummary = Object.freeze({
    decisiveUnits: 2,
    drawUnits: 1,
    lastStandEnabled: true,
    startingHeartUnits: 6,
    unitsPerHeart: 2
  });

  function getPositiveRuleValue(value, fallback) {
    const normalizedValue = Number(value);
    return normalizedValue > 0 ? normalizedValue : fallback;
  }

  function formatHeartLabel(units, unitsPerHeart) {
    const hearts = units / unitsPerHeart;
    if (hearts === 0.5) return 'Half a heart';
    const value = Number.isInteger(hearts)
      ? String(hearts)
      : String(Math.round(hearts * 10) / 10);
    return `${value} ${hearts === 1 ? 'heart' : 'hearts'}`;
  }

  function createRuleHeart(documentRef, kind) {
    const heart = documentRef.createElement('img');
    heart.src = `${normalHeartAssetRoot}/${kind}.svg`;
    heart.alt = '';
    heart.draggable = false;
    heart.setAttribute('aria-hidden', 'true');
    heart.dataset.clashRuleHeart = kind;
    return heart;
  }

  function renderRuleHearts(documentRef, target, units, unitsPerHeart) {
    if (!target) return;
    const fullHeartCount = Math.floor(units / unitsPerHeart);
    const hasPartialHeart = units % unitsPerHeart > 0;
    const hearts = Array.from({ length: fullHeartCount }, () =>
      createRuleHeart(documentRef, 'full')
    );
    if (hasPartialHeart) hearts.push(createRuleHeart(documentRef, 'half'));
    target.replaceChildren(...hearts);
    target.classList.add('olings-clash-rule-hearts');
    target.setAttribute('role', 'img');
    target.setAttribute('aria-label', formatHeartLabel(units, unitsPerHeart));
  }

  function createRenderer(options = {}) {
    const documentRef = options.document || globalScope.document;
    return function renderRulesSummary(match) {
      const ruleset = match?.ruleset || {};
      const unitsPerHeart = getPositiveRuleValue(
        ruleset.health?.unitsPerHeart,
        standardRulesSummary.unitsPerHeart
      );
      const startingHeartUnits = getPositiveRuleValue(
        ruleset.health?.startingHeartUnits,
        standardRulesSummary.startingHeartUnits
      );
      const decisiveUnits = getPositiveRuleValue(
        ruleset.damage?.decisiveUnits,
        standardRulesSummary.decisiveUnits
      );
      const drawUnits = getPositiveRuleValue(
        ruleset.damage?.drawUnits,
        standardRulesSummary.drawUnits
      );
      if (options.rulesetName) {
        options.rulesetName.textContent = String(
          ruleset.name || 'STANDARD'
        ).toUpperCase();
      }
      renderRuleHearts(
        documentRef,
        options.ruleHealth,
        startingHeartUnits,
        unitsPerHeart
      );
      renderRuleHearts(
        documentRef,
        options.ruleDecisive,
        decisiveUnits,
        unitsPerHeart
      );
      renderRuleHearts(documentRef, options.ruleDraw, drawUnits, unitsPerHeart);
      if (options.ruleLastStand) {
        const enabled =
          typeof ruleset.lastStand?.enabled === 'boolean'
            ? ruleset.lastStand.enabled
            : standardRulesSummary.lastStandEnabled;
        options.ruleLastStand.textContent = enabled ? 'ENABLED' : 'DISABLED';
      }
    };
  }

  globalScope.createOlingClashRulesSummaryRenderer = createRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
