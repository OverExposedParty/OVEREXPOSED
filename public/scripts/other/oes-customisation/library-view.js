(() => {
  function createOeLibraryView({ state, elements, data, purchase }) {
    const {
      grid,
      statusNode,
      showLockedButton,
      searchInput,
      collectionFilter,
      collectionButton,
      collectionMenu,
      slotFilter,
      ownershipFilter
    } = elements;

    function toggleListValue(listName, value) {
      const list = new Set(state.preferences[listName]);
      if (list.has(value)) list.delete(value);
      else list.add(value);
      state.preferences[listName] = [...list];
    }

    function getLockToggleIcon() {
      if (state.preferences.showLockedOes) {
        return '<svg viewBox="0 0 500 500" aria-hidden="true" focusable="false"><path d="M348.71,207.53h-197.43c-14.52,0-26.29,11.77-26.29,26.29v155.76c0,14.52,11.77,26.29,26.29,26.29h197.43c14.52,0,26.29-11.77,26.29-26.29v-155.76c0-14.52-11.77-26.29-26.29-26.29ZM266.67,313.63v23.07c0,9.2-7.46,16.67-16.67,16.67s-16.67-7.46-16.67-16.67v-23.07c-5.1-4.58-8.33-11.2-8.33-18.6,0-13.81,11.19-25,25-25s25,11.19,25,25c0,7.4-3.23,14.02-8.33,18.6Z"/><path d="M341.67,165.8c0-50.63-41.04-91.67-91.67-91.67h0c-50.63,0-91.67,41.04-91.67,91.67v43.79h34v-42.79c0-36.45,21.22-57.67,57.67-57.67h0c36.45,0,57.67,21.22,57.67,57.67v6.93h34v-7.93Z"/></svg>';
      }

      return '<svg viewBox="0 0 500 500" aria-hidden="true" focusable="false"><path d="M192.33,176.8c0-36.45,21.22-57.67,57.67-57.67h0c36.45,0,57.67,21.22,57.67,57.67v42.79h34v-43.79c0-50.63-41.04-91.67-91.67-91.67h0c-50.63,0-91.67,41.04-91.67,91.67v43.79h34v-42.79Z"/><path d="M348.71,207.53h-197.43c-14.52,0-26.29,11.77-26.29,26.29v155.76c0,14.52,11.77,26.29,26.29,26.29h197.43c14.52,0,26.29-11.77,26.29-26.29v-155.76c0-14.52-11.77-26.29-26.29-26.29ZM266.67,313.63v23.07c0,9.2-7.46,16.67-16.67,16.67s-16.67-7.46-16.67-16.67v-23.07c-5.1-4.58-8.33-11.2-8.33-18.6,0-13.81,11.19-25,25-25s25,11.19,25,25c0,7.4-3.23,14.02-8.33,18.6Z"/></svg>';
    }

    function getCollectionLabel() {
      if (state.selectedPacks.has('all')) return 'All collections';
      if (state.selectedPacks.size === 0) return 'No collections';
      if (state.selectedPacks.size === 1) {
        const slug = [...state.selectedPacks][0];
        const pack = state.packs.find((item) => item.slug === slug);
        return data.formatTitle(pack?.name || slug);
      }
      return `${state.selectedPacks.size} collections`;
    }

    function setCollectionSelection(slug, checked) {
      if (slug === 'all') {
        state.selectedPacks = checked ? new Set(['all']) : new Set();
        return;
      }
      state.selectedPacks.delete('all');
      if (checked) state.selectedPacks.add(slug);
      else state.selectedPacks.delete(slug);
      if (!state.selectedPacks.size) state.selectedPacks.add('all');
    }

    function createCollectionOption({ slug, label, count }) {
      const option = document.createElement('label');
      option.className = 'oe-library-collection-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = slug;
      checkbox.checked = state.selectedPacks.has(slug);
      checkbox.addEventListener('change', () => {
        setCollectionSelection(slug, checkbox.checked);
        renderCollectionMenu();
        renderGrid();
      });
      const text = document.createElement('span');
      text.textContent = `${label} (${count})`;
      option.append(checkbox, text);
      return option;
    }

    function renderCollectionMenu() {
      if (!collectionMenu || !collectionButton) return;
      collectionButton.textContent = getCollectionLabel();
      collectionMenu.innerHTML = '';
      collectionMenu.appendChild(
        createCollectionOption({
          slug: 'all',
          label: 'All collections',
          count: data.getAllItems().length
        })
      );
      state.packs
        .filter((pack) => pack.slug !== 'blank')
        .forEach((pack) => {
          collectionMenu.appendChild(
            createCollectionOption({
              slug: pack.slug,
              label: data.formatTitle(pack.name || pack.slug),
              count: pack.items?.length || 0
            })
          );
        });
    }

    function createItemCard(item) {
      const disabled = data.isItemDisabled(item);
      const card = document.createElement('article');
      card.className = 'oe-library-card';
      card.classList.toggle('is-locked', !item.access?.unlocked);
      card.classList.toggle('is-disabled', disabled);
      card.style.setProperty(
        '--pack-colour',
        item.pack.colour || 'var(--primarypagecolour)'
      );
      const media = document.createElement('div');
      media.className = 'oe-library-media';
      const key = document.createElement('span');
      key.className = 'oe-library-key';
      key.textContent = item.id;
      const image = document.createElement('img');
      image.src = item.filePath;
      image.alt = item.name;
      media.append(key, image);
      const body = document.createElement('div');
      body.className = 'oe-library-card-body';
      const title = document.createElement('h2');
      title.textContent = item.name;
      const meta = document.createElement('p');
      meta.textContent = `${data.formatTitle(item.slot)} · ${data.formatTitle(item.packSlug)}`;
      const footer = document.createElement('div');
      footer.className = 'oe-library-card-footer';

      if (item.access?.unlocked) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'oe-library-disable';
        toggle.dataset.disableOe = item.id;
        toggle.textContent = disabled ? 'Enable' : 'Disable';
        const equip = document.createElement('button');
        equip.type = 'button';
        equip.className = 'oe-library-equip';
        equip.dataset.equipOe = item.id;
        equip.textContent = 'Equip';
        equip.disabled = disabled;
        footer.append(toggle, equip);
      } else if (item.access?.accessType === 'entitlement') {
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'oe-library-buy';
        buy.dataset.buyOe = item.id;
        const icon = document.createElement('img');
        icon.src = '/images/icons/currency/opal.svg';
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        const price = document.createElement('span');
        price.textContent = String(item.shop?.opalPrice || 200);
        buy.append(icon, price);
        footer.appendChild(buy);
      } else {
        const accountHint = document.createElement('a');
        accountHint.className = 'oe-library-shop-link';
        accountHint.href = '/sign-in?returnTo=/oe-library';
        accountHint.textContent = data.getAccessLabel(item);
        footer.appendChild(accountHint);
      }

      body.append(title, meta, footer);
      card.append(media, body);
      return card;
    }

    function renderGrid() {
      if (!grid) return;
      const items = data.getVisibleItems();
      grid.innerHTML = '';
      if (statusNode) {
        statusNode.textContent = `${items.length} of ${data.getAllItems().length} OEs`;
      }
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'oe-library-empty';
        empty.textContent = 'No OEs match these filters.';
        grid.appendChild(empty);
        return;
      }
      items.forEach((item) => grid.appendChild(createItemCard(item)));
    }

    function syncControls() {
      if (showLockedButton) {
        showLockedButton.dataset.showLocked = String(state.preferences.showLockedOes);
        showLockedButton.setAttribute('aria-pressed', String(state.preferences.showLockedOes));
        showLockedButton.setAttribute(
          'aria-label',
          state.preferences.showLockedOes ? 'Hide locked OEs' : 'Show locked OEs'
        );
        showLockedButton.innerHTML = getLockToggleIcon();
      }
      if (searchInput) searchInput.value = state.search;
      if (slotFilter) slotFilter.value = state.activeSlot;
      if (ownershipFilter) ownershipFilter.value = state.activeOwnership;
    }

    function render() {
      syncControls();
      renderCollectionMenu();
      renderGrid();
    }

    function bindEvents() {
      collectionButton?.addEventListener('click', () => {
        const isOpen = collectionButton.getAttribute('aria-expanded') === 'true';
        collectionButton.setAttribute('aria-expanded', String(!isOpen));
        if (collectionMenu) collectionMenu.hidden = isOpen;
      });
      document.addEventListener('click', (event) => {
        if (!collectionFilter || collectionFilter.contains(event.target)) return;
        collectionButton?.setAttribute('aria-expanded', 'false');
        if (collectionMenu) collectionMenu.hidden = true;
      });
      showLockedButton?.addEventListener('click', () => {
        state.preferences.showLockedOes = !state.preferences.showLockedOes;
        data.savePreferences().then(render);
      });
      searchInput?.addEventListener('input', () => {
        state.search = searchInput.value;
        renderGrid();
      });
      slotFilter?.addEventListener('change', () => {
        state.activeSlot = slotFilter.value;
        renderGrid();
      });
      ownershipFilter?.addEventListener('change', () => {
        state.activeOwnership = ownershipFilter.value;
        renderGrid();
      });
      document.addEventListener('click', (event) => {
        const oeToggle = event.target.closest('[data-disable-oe]');
        if (oeToggle) {
          toggleListValue('disabledOes', oeToggle.dataset.disableOe);
          data.savePreferences().then(render);
          return;
        }
        const equipButton = event.target.closest('[data-equip-oe]');
        if (equipButton) {
          const item = data.getAllItems().find(
            (candidate) => candidate.id === equipButton.dataset.equipOe
          );
          if (item) data.equipItem(item, renderGrid);
          return;
        }
        const buyButton = event.target.closest('[data-buy-oe]');
        if (buyButton) {
          const item = data.getAllItems().find(
            (candidate) => candidate.id === buyButton.dataset.buyOe
          );
          if (item) purchase.createPurchaseDialog(item);
        }
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') purchase.closePurchaseDialog();
      });
    }

    return { bindEvents, render, renderGrid };
  }

  window.createOeLibraryView = createOeLibraryView;
})();
