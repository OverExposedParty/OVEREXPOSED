function isPackEnabledByDefault(packName) {
  const savedState = localStorage.getItem(`customisation-${packName}-active`);
  return savedState === null ? true : savedState === 'true';
}

function renderPacks(packs) {
  packs.forEach((pack) => {
    const packName = pack['pack-name'];

    if (packName === 'blank') return;

    if (pack['pack-status'] === 'active') {
      const button = document.createElement('button');
      button.classList.add('button-toggle');
      button.textContent = packName
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      packsContainer.querySelector('.button-container').appendChild(button);

      packButtons.push(button);

      if (isPackEnabledByDefault(packName)) {
        button.classList.add('active');
        button.style.backgroundColor = pack['pack-colour'];
        button.style.borderColor = pack['pack-colour'];
        renderOESOptions(
          packName,
          pack['pack-colour'],
          pack['pack-secondary-colour']
        );
        if (localStorage.getItem(`customisation-${packName}-active`) === null) {
          localStorage.setItem(`customisation-${packName}-active`, 'true');
        }
      }

      button.addEventListener('click', () => {
        const activeButtons = packButtons.filter((btn) =>
          btn.classList.contains('active')
        );
        if (button.classList.contains('active') && activeButtons.length === 1) {
          return;
        }

        button.classList.toggle('active');

        if (button.classList.contains('active')) {
          renderOESOptions(
            packName,
            pack['pack-colour'],
            pack['pack-secondary-colour']
          );
          localStorage.setItem(`customisation-${packName}-active`, 'true');

          button.style.backgroundColor = pack['pack-colour'];
          button.style.borderColor = pack['pack-colour'];
        } else {
          if (oesButtons[packName]) {
            oesButtons[packName].forEach((btn) => btn.remove());
            delete oesButtons[packName];
          }

          button.style.backgroundColor = '';
          button.style.borderColor = '';

          localStorage.setItem(`customisation-${packName}-active`, 'false');
        }
      });

      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = pack['pack-secondary-colour'];
        button.style.borderColor = pack['pack-secondary-colour'];
      });

      button.addEventListener('mouseleave', () => {
        if (!button.classList.contains('active')) {
          button.style.backgroundColor = '';
          button.style.borderColor = '';
        } else {
          button.style.backgroundColor = pack['pack-colour'];
          button.style.borderColor = pack['pack-colour'];
        }
      });
    }
  });
}
