function renderOESOptions(packName, packColour, packSecondaryColour) {
  const packPath = `/api/oe-image-packs/${packName}/images`;
  const storageKey = `customisation-${packName}`;

  if (oesButtons[packName]) {
    oesButtons[packName].forEach((btn) => btn.remove());
    delete oesButtons[packName];
  }
  oesButtons[packName] = [];

  const savedState = JSON.parse(localStorage.getItem(storageKey)) || {};
  const userCustomisation = loadCustomisation();
  const selectedIds = Object.values(userCustomisation);

  fetch(packPath)
    .then((response) => response.json())
    .then((payload) => {
      const data = payload?.data || payload;
      data[storageKey].forEach((item) => {
        const button = document.createElement('button');
        button.dataset.id = item.id;
        button.dataset.slot = item.slot;
        button.dataset.packColour = packColour;
        button.dataset.packSecondaryColour = packSecondaryColour;
        button.className = `oes-option ${item.slot}`;

        const oesImageContainer = document.createElement('div');
        oesImageContainer.className = 'oes-image-container';

        const isActive =
          savedState[item.id] !== undefined ? savedState[item.id] : true;
        button.classList.toggle('active', isActive);

        const isSelected = selectedIds.includes(item.id);
        if (isSelected) {
          button.classList.add('selected');
        }

        oesImageContainer.style.backgroundColor = isActive
          ? packColour
          : '#666666';
        if (isSelected) {
          oesImageContainer.style.borderColor = 'var(--primarypagecolour)';
        } else {
          oesImageContainer.style.borderColor = isActive
            ? packColour
            : '#666666';
        }

        const img = document.createElement('img');
        img.src = item['file-path'];
        img.alt = item.name;

        const oesName = document.createElement('h3');
        oesName.textContent = item.name;
        oesName.className = 'oes-name';

        const oesID = document.createElement('p');
        oesID.textContent = item.id;
        oesID.className = 'oes-id';

        oesImageContainer.appendChild(oesName);
        oesImageContainer.appendChild(oesID);
        oesImageContainer.appendChild(img);
        button.appendChild(oesImageContainer);

        savedState[item.id] = isActive;

        button.addEventListener('click', () => {
          if (button.classList.contains('selected')) {
            return;
          }

          const newState = button.classList.toggle('active');
          oesImageContainer.style.backgroundColor = newState
            ? packColour
            : '#666666';
          oesImageContainer.style.borderColor = newState
            ? packColour
            : '#666666';

          savedState[item.id] = newState;
          localStorage.setItem(storageKey, JSON.stringify(savedState));
        });

        button.addEventListener('mouseenter', () => {
          oesImageContainer.style.backgroundColor = packSecondaryColour;
          if (!button.classList.contains('selected')) {
            oesImageContainer.style.borderColor = packSecondaryColour;
          }
        });

        button.addEventListener('mouseleave', () => {
          const state = button.classList.contains('active');
          oesImageContainer.style.backgroundColor = state
            ? packColour
            : '#666666';
          if (!button.classList.contains('selected')) {
            oesImageContainer.style.borderColor = state
              ? packColour
              : '#666666';
          }
        });

        oesContainer.querySelector('.button-container').appendChild(button);
        oesButtons[packName].push(button);
      });

      localStorage.setItem(storageKey, JSON.stringify(savedState));
    })
    .catch((error) =>
      console.error(`Error loading OES options for ${packName}:`, error)
    );
}

function rerenderSelectedButtons() {
  const userCustomisation = loadCustomisation();
  const selectedIds = Object.values(userCustomisation);

  Object.keys(oesButtons).forEach((packName) => {
    oesButtons[packName].forEach((button) => {
      const oesImageContainer = button.querySelector('.oes-image-container');
      const itemId = button.dataset.id;
      const isActive = button.classList.contains('active');
      const isSelected = selectedIds.includes(itemId);

      oesImageContainer.style.backgroundColor = isActive
        ? button.dataset.packColour
        : '#666666';

      if (isSelected) {
        oesImageContainer.style.borderColor = 'var(--primarypagecolour)';
        button.classList.add('selected');
      } else {
        oesImageContainer.style.borderColor = isActive
          ? button.dataset.packColour
          : '#666666';
        button.classList.remove('selected');
      }
    });
  });
}
