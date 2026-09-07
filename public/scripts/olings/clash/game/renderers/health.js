(function (globalScope) {
  const healthAssetRoot = '/images/olings/clash/ui/health';
  const healthTypes = Object.freeze([
    Object.freeze({
      assets: Object.freeze({
        full: `${healthAssetRoot}/hearts/normal/full.svg`,
        half: `${healthAssetRoot}/hearts/normal/half.svg`
      }),
      key: 'hearts',
      unitsKey: 'heartUnits'
    }),
    Object.freeze({
      assets: Object.freeze({
        full: `${healthAssetRoot}/hearts/blood/full.svg`,
        half: `${healthAssetRoot}/hearts/blood/half.svg`
      }),
      key: 'blood',
      unitsKey: 'bloodUnits'
    }),
    Object.freeze({
      assets: Object.freeze({
        full: `${healthAssetRoot}/hearts/overgrowth/full.svg`,
        half: `${healthAssetRoot}/hearts/overgrowth/half.svg`
      }),
      key: 'overgrowth',
      unitsKey: 'overgrowthUnits'
    }),
    Object.freeze({
      assets: Object.freeze({ full: `${healthAssetRoot}/shields/default.svg` }),
      key: 'shields',
      countKey: 'shieldCount'
    })
  ]);
  const healthTypeByKey = Object.freeze(
    Object.fromEntries(healthTypes.map((type) => [type.key, type]))
  );

  function normalizeUnitCount(value) {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return 0;
    return Math.max(0, Math.floor(parsedValue));
  }

  function normalizeHealthState(health = {}) {
    const maxHeartUnits = Math.max(1, normalizeUnitCount(health.maxHeartUnits));

    return {
      maxHeartUnits,
      heartUnits: Math.min(
        normalizeUnitCount(health.heartUnits),
        maxHeartUnits
      ),
      bloodUnits: normalizeUnitCount(health.bloodUnits),
      overgrowthUnits: normalizeUnitCount(health.overgrowthUnits),
      shieldCount: normalizeUnitCount(health.shieldCount)
    };
  }

  function formatHeartAmount(units) {
    const amount = units / 2;
    return `${amount} ${amount === 1 ? 'Heart' : 'Hearts'}`;
  }

  function describeHealth(state) {
    const descriptions = [];

    if (state.shieldCount > 0) {
      descriptions.push(
        `${state.shieldCount} ${state.shieldCount === 1 ? 'Shield' : 'Shields'}`
      );
    }
    if (state.overgrowthUnits > 0) {
      descriptions.push(
        `${formatHeartAmount(state.overgrowthUnits)} of Overgrowth`
      );
    }

    descriptions.push(formatHeartAmount(state.heartUnits));
    if (state.bloodUnits > 0) {
      descriptions.push(`${formatHeartAmount(state.bloodUnits)} of Blood`);
    }
    descriptions.push(`maximum ${formatHeartAmount(state.maxHeartUnits)}`);
    return descriptions.join(', ');
  }

  function createHealthUnit(documentRef, type, units) {
    const typeDefinition = healthTypeByKey[type];
    const asset =
      units === 1 && typeDefinition?.assets.half
        ? typeDefinition.assets.half
        : typeDefinition?.assets.full;
    const unit = documentRef.createElement('img');
    unit.className = `olings-clash-health-unit is-${type}`;
    if (units === 1) unit.classList.add('is-half');
    unit.alt = '';
    unit.draggable = false;
    unit.src = asset;
    unit.dataset.heartType = type;
    unit.dataset.heartUnits = String(units);
    unit.setAttribute('aria-hidden', 'true');
    return unit;
  }

  function appendHealthType(fragment, documentRef, type, units) {
    const fullHearts = Math.floor(units / 2);
    for (let index = 0; index < fullHearts; index += 1) {
      fragment.append(createHealthUnit(documentRef, type, 2));
    }
    if (units % 2 === 1) {
      fragment.append(createHealthUnit(documentRef, type, 1));
    }
  }

  function appendShields(fragment, documentRef, shieldCount) {
    for (let index = 0; index < shieldCount; index += 1) {
      const shield = createHealthUnit(documentRef, 'shields', 2);
      shield.dataset.shieldCount = '1';
      fragment.append(shield);
    }
  }

  function createOlingClashHealthRenderer() {
    function renderHealth(container, health) {
      if (!container) return null;

      const state = normalizeHealthState(health);
      const renderSignature = [
        state.maxHeartUnits,
        state.heartUnits,
        state.bloodUnits,
        state.overgrowthUnits,
        state.shieldCount
      ].join(':');
      if (container.dataset.clashHealthSignature === renderSignature) {
        return state;
      }
      const documentRef = container.ownerDocument || globalScope.document;
      const fragment = documentRef.createDocumentFragment();

      healthTypes.forEach(({ countKey, key, unitsKey }) => {
        if (countKey) {
          appendShields(fragment, documentRef, state[countKey]);
          return;
        }
        appendHealthType(fragment, documentRef, key, state[unitsKey]);
      });

      container.replaceChildren(fragment);
      container.dataset.maxHeartUnits = String(state.maxHeartUnits);
      container.dataset.heartUnits = String(state.heartUnits);
      container.dataset.bloodUnits = String(state.bloodUnits);
      container.dataset.overgrowthUnits = String(state.overgrowthUnits);
      container.dataset.shieldCount = String(state.shieldCount);
      container.dataset.clashHealthSignature = renderSignature;
      container.setAttribute('role', 'img');
      container.setAttribute('aria-label', describeHealth(state));
      return state;
    }

    function initialize(root = globalScope.document) {
      if (!root?.querySelectorAll) return 0;

      const containers = [...root.querySelectorAll('[data-clash-health]')];
      containers.forEach((container) => {
        renderHealth(container, {
          maxHeartUnits: container.dataset.maxHeartUnits,
          heartUnits: container.dataset.heartUnits,
          bloodUnits: container.dataset.bloodUnits,
          overgrowthUnits: container.dataset.overgrowthUnits,
          shieldCount: container.dataset.shieldCount
        });
      });
      return containers.length;
    }

    return {
      describeHealth,
      healthTypes,
      initialize,
      normalizeHealthState,
      renderHealth
    };
  }

  globalScope.createOlingClashHealthRenderer = createOlingClashHealthRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashHealthRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);
