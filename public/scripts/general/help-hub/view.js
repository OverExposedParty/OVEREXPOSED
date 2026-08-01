(function () {
  function createHelpHubView(context) {
    const {
      HELP_HUB_TILE_LIMIT,
      HELP_HUB_CONFIGS,
      HELP_HUB_MODE_CONFIGS,
      normaliseHelpHubSectionGuides,
      getCurrentAccount,
      canAccessFeature
    } = context;
    const helpHub = document.querySelector('#help-hub');
    const helpHubBackButton = document.querySelector('#help-hub-back-button');
    const helpHubTitle = document.querySelector('#help-hub-title');
    const helpHubGrid = document.querySelector('#help-hub-grid');

    let currentHelpHubConfig = null;
    let currentHelpHubSection = null;
    let currentHelpHubDetail = null;

    function getHelpHubTemplateKey() {
      return document.querySelector('[data-template]')?.dataset?.template || '';
    }

    function getHelpHubGamemodeFromPath() {
      const path = window.location.pathname.toLowerCase();
      return (
        Object.keys(HELP_HUB_MODE_CONFIGS).find((mode) =>
          path.includes(`/${mode}`)
        ) || ''
      );
    }

    function getHelpHubConfig() {
      const path = window.location.pathname.toLowerCase();
      const template = getHelpHubTemplateKey();
      const gamemode = getHelpHubGamemodeFromPath();

      if (path === '/' || template === 'homepage')
        return HELP_HUB_CONFIGS.homepage;
      if (path.includes('/waiting-room')) return HELP_HUB_CONFIGS.waitingRoom;
      if (path.includes('/settings')) {
        return gamemode === 'mafia'
          ? HELP_HUB_CONFIGS.mafiaGameSettings
          : HELP_HUB_CONFIGS.partyGameSettings;
      }
      if (gamemode && !path.includes('/settings')) {
        return path.split('/').filter(Boolean).length > 1
          ? HELP_HUB_MODE_CONFIGS[gamemode]
          : HELP_HUB_CONFIGS.offlineGame;
      }
      if (template === 'overexposure' || path.includes('/overexposure'))
        return HELP_HUB_CONFIGS.overexposure;
      if (template === 'oes-customisation' || path.includes('/oe-library'))
        return HELP_HUB_CONFIGS.oeLibrary;
      if (template === 'oling-lab' || path.includes('/olings/lab'))
        return HELP_HUB_CONFIGS.olingLab;
      if (template === 'battle-olings' || path.includes('/olings/battle'))
        return HELP_HUB_CONFIGS.battleOlings;
      if (template === 'shop-product' || path.includes('/shop/product'))
        return HELP_HUB_CONFIGS.shopProduct;
      if (path.includes('/shop')) return HELP_HUB_CONFIGS.shop;
      if (
        template === 'auth' ||
        path.includes('/login') ||
        path.includes('/reset-password') ||
        path.includes('/change-email')
      )
        return HELP_HUB_CONFIGS.auth;
      if (template === 'page-not-found' || path.includes('/404'))
        return HELP_HUB_CONFIGS.notFound;
      if (
        template === 'terms-and-privacy' ||
        path.includes('/terms-and-privacy')
      )
        return HELP_HUB_CONFIGS.terms;
      if (template === 'frequently-asked-questions' || path.includes('/faqs'))
        return HELP_HUB_CONFIGS.faqs;
      if (
        template === 'protected' ||
        template === 'protected-page' ||
        path.includes('/protected')
      )
        return HELP_HUB_CONFIGS.protectedPage;
      if (path.includes('/oe-panel')) return HELP_HUB_CONFIGS.oePanel;

      return HELP_HUB_CONFIGS.default;
    }

    function normaliseHelpHubTopics(topics) {
      const sourceTopics = Array.isArray(topics) ? topics : [];
      const firstTopicIsPrimary = sourceTopics[0]?.size === 'primary';
      const tileLimit = firstTopicIsPrimary
        ? HELP_HUB_TILE_LIMIT - 1
        : HELP_HUB_TILE_LIMIT;
      const nextTopics = sourceTopics.slice(0, tileLimit);

      while (nextTopics.length < tileLimit) {
        nextTopics.push({ label: 'Coming Soon', placeholder: true });
      }
      return nextTopics;
    }

    function canAccessHelpHubTopic(topic) {
      const access = topic?.access;
      if (!access) return true;

      if (access.type === 'feature') {
        return canAccessFeature(getCurrentAccount(), access.feature);
      }

      return false;
    }

    function getHelpHubTopicImage(topic) {
      if (!topic?.image) return null;

      if (typeof topic.image === 'string') {
        return {
          src: topic.image,
          alt: topic.imageAlt || topic.label || ''
        };
      }

      if (typeof topic.image === 'object' && topic.image.src) {
        return {
          src: topic.image.src,
          alt: topic.image.alt || topic.imageAlt || topic.label || ''
        };
      }

      return null;
    }

    function getHelpHubTopicColour(value, fallback) {
      return typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback;
    }

    function createHelpHubTile(topic, index) {
      const tile = document.createElement('button');
      const isPrimary = topic.size === 'primary' && index === 0;
      const image = getHelpHubTopicImage(topic);
      const primaryColour = getHelpHubTopicColour(
        topic.primaryColour,
        'var(--primarypagecolour)'
      );
      const secondaryColour = getHelpHubTopicColour(
        topic.secondaryColour,
        'var(--secondarypagecolour)'
      );

      tile.type = 'button';
      tile.className = [
        'help-hub-tile',
        isPrimary ? 'primary' : 'secondary',
        image ? 'has-image' : '',
        topic.placeholder ? 'placeholder' : ''
      ]
        .filter(Boolean)
        .join(' ');
      tile.dataset.helpTopic = topic.label;
      tile.setAttribute('aria-label', topic.label);
      tile.style.setProperty('--help-hub-tile-primary', primaryColour);
      tile.style.setProperty('--help-hub-tile-secondary', secondaryColour);
      if (topic.section && !topic.placeholder) {
        tile.addEventListener('click', () =>
          renderHelpHubSection(topic.section)
        );
      }

      if (image) {
        const imageElement = document.createElement('img');
        imageElement.className = 'help-hub-tile-image';
        imageElement.src = image.src;
        imageElement.alt = image.alt;
        imageElement.loading = 'eager';
        imageElement.decoding = 'async';
        tile.appendChild(imageElement);
      } else {
        const label = document.createElement('span');
        label.className = 'help-hub-tile-label';
        label.textContent = topic.label;
        tile.appendChild(label);
      }

      return tile;
    }

    function setHelpHubBackVisible(isVisible) {
      if (!helpHubBackButton) return;

      helpHubBackButton.hidden = !isVisible;
      helpHubBackButton.disabled = !isVisible;
    }

    function renderHelpHubDetail(detail, section) {
      if (!helpHub || !helpHubTitle || !helpHubGrid || !detail) return;

      currentHelpHubSection = section || currentHelpHubSection;
      currentHelpHubDetail = detail;
      helpHubTitle.textContent = detail.title || 'Help';
      helpHub.classList.add('section-open', 'detail-open');
      setHelpHubBackVisible(true);

      const panel = document.createElement('section');
      const body = document.createElement('p');

      panel.className = 'help-hub-detail';
      body.className = 'help-hub-detail-body';
      body.textContent = detail.body || '';
      panel.appendChild(body);

      if (Array.isArray(detail.points) && detail.points.length) {
        const list = document.createElement('ul');
        list.className = 'help-hub-detail-list';
        detail.points.forEach((point) => {
          const item = document.createElement('li');
          item.textContent = point;
          list.appendChild(item);
        });
        panel.appendChild(list);
      }

      helpHubGrid.replaceChildren(panel);
    }

    function renderHelpHubSection(section) {
      if (!helpHub || !helpHubTitle || !helpHubGrid || !section) return;

      currentHelpHubSection = section;
      currentHelpHubDetail = null;
      helpHubTitle.textContent = section.title || 'Help';
      helpHub.classList.add('section-open');
      helpHub.classList.remove('detail-open');
      setHelpHubBackVisible(true);

      const panel = document.createElement('section');
      const body = document.createElement('p');

      panel.className = 'help-hub-section';

      body.className = 'help-hub-section-body';
      body.textContent = section.body || '';
      panel.appendChild(body);

      const guides = normaliseHelpHubSectionGuides(section);

      if (guides.length) {
        const list = document.createElement('ul');
        list.className = 'help-hub-section-list';
        guides.forEach((guide) => {
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'help-hub-section-button';
          button.textContent = guide.label;
          if (guide.detail) {
            button.addEventListener('click', () =>
              renderHelpHubDetail(guide.detail, section)
            );
          }
          item.appendChild(button);
          list.appendChild(item);
        });
        panel.appendChild(list);
      }

      helpHubGrid.replaceChildren(panel);
    }

    function renderHelpHub() {
      if (!helpHub || !helpHubTitle || !helpHubGrid) return;

      const config = getHelpHubConfig();
      currentHelpHubConfig = config;
      currentHelpHubSection = null;
      currentHelpHubDetail = null;
      helpHub.classList.remove('section-open', 'detail-open');
      setHelpHubBackVisible(false);
      helpHubTitle.textContent = config.title || 'Page';
      helpHubGrid.replaceChildren(
        ...normaliseHelpHubTopics(
          config.topics.filter(canAccessHelpHubTopic)
        ).map(createHelpHubTile)
      );
    }

    function handleHelpHubBack() {
      if (currentHelpHubDetail && currentHelpHubSection) {
        renderHelpHubSection(currentHelpHubSection);
        return;
      }

      renderHelpHub();
    }

    function initializeHelpHub() {
      if (helpHubBackButton) {
        helpHubBackButton.addEventListener('click', handleHelpHubBack);
      }
      window.addEventListener('oe-account-state-changed', renderHelpHub);

      renderHelpHub();
    }

    return { initializeHelpHub, renderHelpHub };
  }

  window.createHelpHubView = createHelpHubView;
})();
