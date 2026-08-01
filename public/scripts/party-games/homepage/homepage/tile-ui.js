function navigateFromTile(tileData) {
  if (!tileData?.canAccess || !tileData?.link) return;
  if (typeof playSoundEffect === 'function') {
    playSoundEffect('cardFlip');
  }

  if (typeof transitionSplashScreen === 'function' && tileData.splashScreen) {
    transitionSplashScreen(tileData.link, tileData.splashScreen);
    return;
  }

  window.location.href = tileData.link;
}

function handleTileKeyboardNavigation(event, tileData) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.currentTarget.classList.contains('is-help-open')) return;

  event.preventDefault();
  navigateFromTile(tileData);
}

function closeHomepageTileHelp(tile) {
  tile.classList.remove('is-help-open');
  tile
    .querySelector('.homepage-tile-help-panel')
    ?.setAttribute('aria-hidden', 'true');
}

function openHomepageTileHelp(tile) {
  tile.classList.add('is-help-open');
  tile
    .querySelector('.homepage-tile-help-panel')
    ?.setAttribute('aria-hidden', 'false');
}

function createHomepageTileHelpPanel(tile, tileData) {
  const panel = document.createElement('section');
  const header = document.createElement('div');
  const backButton = document.createElement('button');
  const title = document.createElement('h3');
  const description = document.createElement('p');

  panel.className = 'homepage-tile-help-panel';
  panel.setAttribute('aria-hidden', 'true');

  header.className = 'homepage-tile-help-header';

  backButton.className = 'homepage-tile-help-back';
  backButton.type = 'button';
  backButton.dataset.soundIntent = 'previous';
  backButton.setAttribute('aria-label', `Back to ${tileData.label}`);
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeHomepageTileHelp(tile);
  });

  title.className = 'homepage-tile-help-title';
  title.textContent = tileData.label;

  description.className = 'homepage-tile-help-description';
  description.textContent = tileData.description;

  header.append(backButton, title);
  panel.append(header, description);

  panel.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  return panel;
}

function createHomepageTileHelpButton(tile, tileData) {
  const helpButton = document.createElement('button');
  const helpIcon = document.createElement('img');

  helpButton.className = 'homepage-tile-help-button';
  helpButton.type = 'button';
  helpButton.dataset.sound = 'containerOpen';
  helpButton.setAttribute('aria-label', `${tileData.label} help`);

  helpIcon.src = '/images/icons/help-icon.svg';
  helpIcon.alt = '';
  helpIcon.loading = 'eager';

  helpButton.appendChild(helpIcon);
  helpButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openHomepageTileHelp(tile);
  });

  return helpButton;
}

function createHomepageTileImage(tileData) {
  const picture = document.createElement('picture');
  const mobileSource = document.createElement('source');
  const image = document.createElement('img');
  const desktopImage = tileData.images?.desktop;
  const mobileImage = tileData.images?.mobile;

  if (!desktopImage?.src && !mobileImage?.src) return null;

  picture.className = 'homepage-tile-picture';

  if (mobileImage?.src) {
    mobileSource.media = '(orientation: portrait)';
    mobileSource.srcset = mobileImage.src;
    picture.appendChild(mobileSource);
  }

  image.className = 'homepage-tile-image';
  image.src = desktopImage?.src || mobileImage.src;
  image.alt = desktopImage?.alt || mobileImage?.alt || tileData.label;
  image.loading = 'eager';

  picture.appendChild(image);

  return picture;
}

function renderHomepageGrid() {
  const grid = document.getElementById('homepage-grid');
  if (!grid) return;

  grid.replaceChildren();
  const desktopRowMap = getCompactDesktopRowMap(loadedHomepageTiles);

  loadedHomepageTiles.forEach((config) => {
    const tileData = getTileData(config);
    if (!tileData) return;

    const tile = document.createElement('div');

    tile.className = 'homepage-tile';
    tile.role = 'button';
    tile.dataset.tileId = config.id;
    tile.dataset.size = config.size || 'default';
    tile.setAttribute('aria-label', tileData.label);
    tile.style.setProperty(
      '--tile-colour',
      tileData.colour || 'var(--primarypagecolour)'
    );
    tile.classList.toggle('is-coming-soon', tileData.canAccess === false);
    tile.setAttribute('aria-disabled', String(tileData.canAccess === false));
    if (tileData.canAccess !== false) {
      tile.tabIndex = 0;
    }
    applyTileLayout(tile, config, desktopRowMap);
    if (tileData.canAccess !== false) {
      tile.appendChild(createHomepageTileHelpButton(tile, tileData));
    }

    const tileImage = createHomepageTileImage(tileData);
    if (tileImage) {
      tile.classList.add('has-homepage-image');
      tile.appendChild(tileImage);
    } else {
      const label = document.createElement('span');
      label.textContent = tileData.label;
      tile.appendChild(label);
    }

    if (tileData.canAccess !== false) {
      tile.appendChild(createHomepageTileHelpPanel(tile, tileData));
    }

    tile.addEventListener('click', () => navigateFromTile(tileData));
    tile.addEventListener('keydown', (event) =>
      handleTileKeyboardNavigation(event, tileData)
    );
    grid.appendChild(tile);
  });
}
