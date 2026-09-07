(function () {
  function createOlingLabStorageTools({
    state,
    elements = {},
    helpers,
    previewTools = {}
  }) {
    const {
      closeMenu,
      openMenu,
      closeShelfStoragePanel = () => {},
      closeGatewayPanel = () => {},
      createEmptyMessage,
      createInlineAction,
      storeOling,
      transferStoredOling,
      releaseOling,
      getRoaming = () => null,
      renderLab = () => {},
      openSharedPopup,
      closeSharedPopup,
      setStatus = () => {}
    } = helpers;
    const { getOlingId, createPreview } = previewTools;
    const panelTransitions = window.OlingLabPanelTransitions;
    let podDrag = null;
    let highlightedOlingId = null;
    let highlightedPodCard = null;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

    const getPodDefinition = (key) =>
      state.podDefinitions?.get?.(String(key || '')) || null;
    const getStoredPod = (oling) => oling?.residency?.pod || null;
    const isOneUsePod = (pod) =>
      String(pod?.releaseOutcome || '') === 'destroy';
    const getPodUsesLabel = (definition, pod = {}) => {
      const configuredUses = Number(definition?.lifecycle?.uses);
      const uses =
        Number.isInteger(configuredUses) && configuredUses > 0
          ? configuredUses
          : isOneUsePod({
                releaseOutcome:
                  pod.releaseOutcome || definition?.lifecycle?.onRelease
              })
            ? 1
            : null;
      return uses === null ? '∞ USES' : `${uses} USE${uses === 1 ? '' : 'S'}`;
    };
    const getPodStorageInstances = () =>
      (state.lab?.placedItems || []).flatMap((placed) => {
        const definition = state.catalog?.get?.(placed?.itemId);
        const capacity = Number(definition?.podStorage?.capacity);
        return placed?.placedId && Number.isInteger(capacity) && capacity > 0
          ? [{ placed, definition, capacity }]
          : [];
      });
    const getStoredOlings = (
      containerPlacedId = state.activePodStoragePlacedId
    ) =>
      (state.olings || []).filter(
        (oling) =>
          oling?.residency?.state === 'stored' &&
          String(oling?.residency?.pod?.containerPlacedId || '') ===
            String(containerPlacedId || '')
      );
    const getOwnedPods = () =>
      (state.ownedPods || []).filter((pod) => Number(pod?.quantity || 0) > 0);

    function getPodLayerAssets(definition) {
      const layers = definition?.assets?.layers || {};
      return layers.back && layers.front && layers.base ? layers : null;
    }

    function createPodImage(source, className) {
      const image = document.createElement('img');
      image.className = className;
      image.src = source;
      image.alt = '';
      image.draggable = false;
      return image;
    }

    function createPodArtwork(definition, oling = null) {
      const artwork = document.createElement('span');
      artwork.className = 'oling-lab-pod-artwork';
      artwork.draggable = false;
      artwork.classList.toggle('is-occupied', Boolean(oling));
      const layers = oling ? getPodLayerAssets(definition) : null;
      if (layers) {
        const preview = createPreview(oling);
        preview.classList.add('is-stored', 'is-pod-overlay');
        artwork.append(
          createPodImage(layers.back, 'oling-lab-pod-artwork-layer is-back'),
          preview,
          createPodImage(layers.front, 'oling-lab-pod-artwork-layer is-front'),
          createPodImage(layers.base, 'oling-lab-pod-artwork-layer is-base')
        );
        return artwork;
      }
      const asset = definition?.assets?.empty;
      const icon = document.createElement(asset ? 'img' : 'span');
      icon.className = 'oling-lab-pod-artwork-base';
      if (asset) {
        icon.src = asset;
        icon.alt = '';
        icon.loading = 'lazy';
        icon.draggable = false;
      } else {
        icon.textContent = '◉';
        icon.setAttribute('aria-hidden', 'true');
      }
      artwork.appendChild(icon);
      if (oling) {
        const preview = createPreview(oling);
        preview.classList.add('is-stored', 'is-pod-overlay');
        artwork.appendChild(preview);
      }
      return artwork;
    }

    function createPodIdentity(definition, pod = {}, oling = null) {
      const identity = document.createElement('div');
      identity.className = 'oling-lab-pod-identity';
      const copy = document.createElement('span');
      copy.append(
        Object.assign(document.createElement('strong'), {
          textContent: definition?.name || 'Oling Pod'
        }),
        Object.assign(document.createElement('small'), {
          textContent:
            definition?.description || 'Stores one Oling outside the lab.'
        })
      );
      const lifecycle = document.createElement('span');
      lifecycle.className = 'oling-lab-pod-lifecycle';
      lifecycle.textContent = isOneUsePod({
        releaseOutcome: pod.releaseOutcome || definition?.lifecycle?.onRelease
      })
        ? 'One use · breaks on release'
        : 'Reusable · returned on release';
      copy.appendChild(lifecycle);
      identity.append(createPodArtwork(definition, oling), copy);
      return identity;
    }

    function getStoreBlockReason(oling) {
      if (oling?.residency?.state === 'stored') {
        return 'This Oling is already stored.';
      }
      if (oling?.care?.isSleeping) return 'Wake this Oling before storing it.';
      if (String(state.activeAdventure?.olingId || '') === getOlingId(oling)) {
        return 'This Oling must return from its adventure first.';
      }
      const activeStorage = getPodStorageInstances().find(
        ({ placed }) =>
          String(placed.placedId) ===
          String(state.activePodStoragePlacedId || '')
      );
      if (!activeStorage) return 'Open a placed Pod Rack first.';
      if (
        getStoredOlings(activeStorage.placed.placedId).length >=
        activeStorage.capacity
      ) {
        return `This Pod Rack is full (${activeStorage.capacity}/${activeStorage.capacity}).`;
      }
      return '';
    }

    function getReleaseBlockReason() {
      const activeCount = Number.isFinite(
        Number(state.olingRoster?.activeCount)
      )
        ? Number(state.olingRoster.activeCount)
        : (state.olings || []).filter(
            (oling) => oling?.residency?.state !== 'stored'
          ).length;
      const limit = Number(state.olingRoster?.limit) || 6;
      return activeCount >= limit
        ? `Your lab is full (${activeCount}/${limit}). Store an active Oling before releasing another.`
        : '';
    }

    function setPanelMessage(message) {
      setStatus(message);
    }

    function createStoreOlingTab(oling) {
      const section = document.createElement('section');
      section.className =
        'oling-lab-menu-section oling-lab-oling-storage-section';
      const intro = document.createElement('p');
      intro.className = 'oling-lab-storage-intro';
      intro.textContent =
        'Choose an empty pod. Stored Olings leave the active lab roster and remain available from Oling Storage.';
      section.appendChild(intro);

      const ownedPods = getOwnedPods();
      if (!ownedPods.length) {
        section.appendChild(
          createEmptyMessage('You do not have any empty Oling Pods.')
        );
        return [section];
      }

      const blockReason = getStoreBlockReason(oling);
      const list = document.createElement('div');
      list.className = 'oling-lab-pod-list';
      ownedPods.forEach((ownedPod) => {
        const definition = getPodDefinition(ownedPod.key);
        const card = document.createElement('article');
        card.className = 'oling-lab-pod-card';
        card.appendChild(
          createPodIdentity(definition, {
            releaseOutcome: definition?.lifecycle?.onRelease
          })
        );
        const footer = document.createElement('div');
        footer.className = 'oling-lab-pod-card-actions';
        footer.appendChild(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-pod-quantity',
            textContent: `${Number(ownedPod.quantity || 0)} available`
          })
        );
        const button = createInlineAction(
          'Store in this pod',
          async () => {
            button.disabled = true;
            try {
              await storeOling(
                getOlingId(oling),
                ownedPod.key,
                state.activePodStoragePlacedId
              );
              closeMenu();
              renderStoragePanel();
              playSound('uiDragStore');
            } catch {
              button.disabled = Boolean(blockReason);
              playSound('uiError');
            }
          },
          { disabled: Boolean(blockReason), soundIntent: 'confirm' }
        );
        if (blockReason) button.title = blockReason;
        footer.appendChild(button);
        card.appendChild(footer);
        if (blockReason) {
          card.appendChild(
            Object.assign(document.createElement('p'), {
              className: 'oling-lab-storage-note is-warning',
              textContent: blockReason
            })
          );
        }
        list.appendChild(card);
      });
      section.appendChild(list);
      return [section];
    }

    function createStoredOlingCard(oling, refreshList) {
      const pod = getStoredPod(oling);
      const definition = getPodDefinition(pod?.key);
      const card = document.createElement('article');
      card.className = 'oling-lab-stored-oling-card';
      const hero = document.createElement('div');
      hero.className = 'oling-lab-stored-oling-hero';
      const artwork = createPodArtwork(definition, oling);
      const title = document.createElement('div');
      title.append(
        Object.assign(document.createElement('strong'), {
          textContent: oling?.name || 'Oling'
        }),
        Object.assign(document.createElement('small'), {
          textContent: `Stored in ${definition?.name || 'an Oling Pod'}`
        })
      );
      hero.append(artwork, title);
      card.append(hero);

      const actions = document.createElement('div');
      actions.className = 'oling-lab-stored-oling-actions';
      const releaseButton = createInlineAction(
        'Release Oling',
        async () => {
          if (isOneUsePod(pod) && !card.classList.contains('is-confirming')) {
            card.classList.add('is-confirming');
            warning.hidden = false;
            releaseButton.querySelector('span').textContent =
              'Release & break pod';
            cancelButton.hidden = false;
            return;
          }
          releaseButton.disabled = true;
          cancelButton.disabled = true;
          try {
            await releaseOling(getOlingId(oling));
            refreshList();
            playSound('uiDragPlace');
          } catch {
            releaseButton.disabled = false;
            cancelButton.disabled = false;
            playSound('uiError');
          }
        },
        { className: isOneUsePod(pod) ? 'is-destructive' : '' }
      );
      const cancelButton = createInlineAction('Cancel', () => {
        card.classList.remove('is-confirming');
        warning.hidden = true;
        cancelButton.hidden = true;
        releaseButton.querySelector('span').textContent = 'Release Oling';
      });
      cancelButton.classList.add('is-secondary');
      cancelButton.hidden = true;
      actions.append(releaseButton, cancelButton);
      const warning = Object.assign(document.createElement('p'), {
        className: 'oling-lab-storage-note is-warning',
        textContent:
          'This is a one-use pod. Releasing the Oling will permanently break it.'
      });
      warning.hidden = true;
      card.append(actions, warning);
      return card;
    }

    function createStoredOlingsSection() {
      const section = document.createElement('section');
      section.className =
        'oling-lab-menu-section oling-lab-stored-olings-section';
      section.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Stored Olings'
        })
      );
      const list = document.createElement('div');
      list.className = 'oling-lab-stored-oling-list';
      const refreshList = () => {
        list.replaceChildren();
        const storedOlings = getStoredOlings();
        if (!storedOlings.length) {
          list.appendChild(createEmptyMessage('No Olings are stored in pods.'));
          return;
        }
        storedOlings.forEach((oling) =>
          list.appendChild(createStoredOlingCard(oling, refreshList))
        );
      };
      refreshList();
      section.appendChild(list);
      return section;
    }

    function isPointInside(element, event) {
      if (!element?.getBoundingClientRect || !event) return false;
      const rect = element.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function isPointerOverStoragePanel(event) {
      const podRect = getPointerPodRect(event);
      return Boolean(
        elements.storagePanel &&
        !elements.storagePanel.hidden &&
        state.storagePanelOpen &&
        rectanglesOverlap(
          podRect,
          elements.storagePanel.getBoundingClientRect()
        )
      );
    }

    function setStoragePanelDropTarget(active, message = '') {
      if (!elements.storagePanel) return;
      elements.storagePanel.classList.toggle('is-drop-target', active);
      if (active) {
        elements.storagePanel.dataset.storageDropMessage = message;
      } else {
        delete elements.storagePanel.dataset.storageDropMessage;
      }
    }

    function rectanglesOverlap(a, b) {
      if (!a || !b || !a.width || !a.height || !b.width || !b.height) {
        return false;
      }
      return !(
        a.right < b.left ||
        a.left > b.right ||
        a.bottom < b.top ||
        a.top > b.bottom
      );
    }

    function openTransferDialog(oling, previousDialog = null) {
      const currentPlacedId = String(
        getStoredPod(oling)?.containerPlacedId || ''
      );
      const destinations = getPodStorageInstances().filter(
        ({ placed, capacity }) =>
          String(placed.placedId) !== currentPlacedId &&
          getStoredOlings(placed.placedId).length < capacity
      );
      if (!destinations.length || typeof openSharedPopup !== 'function') {
        setPanelMessage('No other Pod Rack has an available slot.', true);
        return;
      }
      if (previousDialog) closeSharedPopup?.(previousDialog);
      const dialog = document.createElement('section');
      dialog.className =
        'oe-purchase-dialog oling-lab-pod-release-dialog oling-lab-pod-transfer-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty('--oe-purchase-primary-colour', '#d6f6ee');
      dialog.style.setProperty('--oe-purchase-secondary-colour', '#58bda6');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const title = Object.assign(document.createElement('h2'), {
        className: 'oe-purchase-title',
        textContent: `Move ${oling?.name || 'this Oling'}?`
      });
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      content.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-message',
          textContent: 'Choose another Pod Rack with an available slot.'
        })
      );
      const list = document.createElement('div');
      list.className = 'oling-lab-pod-transfer-list';
      destinations.forEach(({ placed, definition, capacity }) => {
        const button = Object.assign(document.createElement('button'), {
          className: 'oling-lab-pod-transfer-option',
          type: 'button',
          textContent: `${definition.name} · ${getStoredOlings(placed.placedId).length}/${capacity}`
        });
        button.addEventListener('click', async () => {
          [...list.children].forEach((item) => {
            item.disabled = true;
          });
          try {
            await transferStoredOling(getOlingId(oling), placed.placedId);
            closeSharedPopup?.(dialog);
            renderStoragePanel();
            renderLab();
            playSound('uiDragMove');
          } catch (error) {
            [...list.children].forEach((item) => {
              item.disabled = false;
            });
            setPanelMessage(
              error?.message || 'Could not move this occupied pod.',
              true
            );
            playSound('uiError');
          }
        });
        button.dataset.soundIntent = 'confirm';
        list.appendChild(button);
      });
      const cancel = Object.assign(document.createElement('button'), {
        className: 'oling-lab-pod-release-cancel',
        type: 'button',
        textContent: 'Cancel'
      });
      cancel.dataset.sound = 'none';
      cancel.addEventListener('click', () => closeSharedPopup?.(dialog));
      content.append(list, cancel);
      dialog.append(title, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
    }

    function openReleaseConfirmation(oling) {
      const pod = getStoredPod(oling);
      const capacityBlock = getReleaseBlockReason();
      if (typeof openSharedPopup !== 'function') return;
      const oneUse = isOneUsePod(pod);
      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog oling-lab-pod-release-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty(
        '--oe-purchase-primary-colour',
        oneUse ? '#ffc9b8' : '#d6f6ee'
      );
      dialog.style.setProperty(
        '--oe-purchase-secondary-colour',
        oneUse ? '#e8846b' : '#58bda6'
      );
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const title = Object.assign(document.createElement('h2'), {
        className: 'oe-purchase-title',
        textContent: `Release ${oling?.name || 'this Oling'}?`
      });
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      content.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-message',
          textContent: oneUse
            ? 'This is a one-use pod. Releasing the Oling will permanently break the pod.'
            : 'This Oling will return to the lab and the reusable pod will return to your inventory.'
        })
      );
      const message = Object.assign(document.createElement('p'), {
        className: 'oling-lab-storage-dialog-status',
        textContent: capacityBlock
      });
      const actions = document.createElement('div');
      actions.className = 'oling-lab-pod-release-actions';
      const cancel = Object.assign(document.createElement('button'), {
        className: 'oling-lab-pod-release-cancel',
        type: 'button',
        textContent: 'Keep Oling stored'
      });
      cancel.dataset.sound = 'none';
      const confirm = Object.assign(document.createElement('button'), {
        className: 'oe-purchase-confirm',
        type: 'button',
        textContent: oneUse ? 'Release & break pod' : 'Release Oling',
        disabled: Boolean(capacityBlock)
      });
      confirm.dataset.soundIntent = 'confirm';
      const canTransfer = getPodStorageInstances().some(
        ({ placed, capacity }) =>
          String(placed.placedId) !== String(pod?.containerPlacedId || '') &&
          getStoredOlings(placed.placedId).length < capacity
      );
      const transfer = canTransfer
        ? Object.assign(document.createElement('button'), {
            className: 'oling-lab-pod-transfer-action',
            type: 'button',
            textContent: 'Move to another Pod Rack'
          })
        : null;
      cancel.addEventListener('click', () => closeSharedPopup?.(dialog));
      confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        cancel.disabled = true;
        message.textContent = 'Releasing Oling…';
        try {
          await releaseOling(getOlingId(oling));
          closeSharedPopup?.(dialog);
          renderStoragePanel();
          renderLab();
          playSound('uiDragPlace');
        } catch (error) {
          message.textContent =
            error?.message || 'Could not release this Oling.';
          confirm.disabled = false;
          cancel.disabled = false;
          playSound('uiError');
        }
      });
      transfer?.addEventListener('click', () =>
        openTransferDialog(oling, dialog)
      );
      actions.append(...[cancel, transfer, confirm].filter(Boolean));
      content.append(message, actions);
      dialog.append(title, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
    }

    function createPanelSection(titleText, countText) {
      const section = document.createElement('section');
      section.className = 'oling-lab-storage-panel-section';
      const heading = document.createElement('div');
      heading.className = 'oling-lab-storage-panel-section-heading';
      heading.appendChild(
        Object.assign(document.createElement('h3'), { textContent: titleText })
      );
      if (Number(countText) > 0) {
        heading.appendChild(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-storage-panel-section-count',
            textContent: countText
          })
        );
      }
      const grid = document.createElement('div');
      grid.className = 'oling-lab-storage-panel-grid';
      section.append(heading, grid);
      return { section, grid };
    }

    function attachPanelPodDrag(card, descriptor) {
      card.draggable = false;
      card.addEventListener('dragstart', (event) => event.preventDefault());
      card.addEventListener('pointerdown', (event) => {
        if (
          !event.isPrimary ||
          (event.pointerType === 'mouse' && event.button !== 0) ||
          podDrag
        ) {
          return;
        }
        podDrag = {
          ...descriptor,
          pointerId: event.pointerId,
          source: card,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
          ghost: null
        };
        card.setPointerCapture?.(event.pointerId);
      });
    }

    function renderStoragePanel() {
      if (!elements.storagePanelContent) return;
      clearOlingPodDropTarget();
      const activeStorage = getPodStorageInstances().find(
        ({ placed }) =>
          String(placed.placedId) ===
          String(state.activePodStoragePlacedId || '')
      );
      if (!activeStorage) {
        closeStoragePanel();
        return;
      }
      const storedOlings = getStoredOlings();
      const ownedPods = getOwnedPods();
      const stored = createPanelSection(
        'Stored Olings',
        String(storedOlings.length)
      );
      if (!storedOlings.length) {
        stored.grid.appendChild(
          createEmptyMessage('No Olings are stored in pods.')
        );
      } else {
        storedOlings.forEach((oling) => {
          const pod = getStoredPod(oling);
          const definition = getPodDefinition(pod?.key);
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'oling-lab-storage-panel-card is-occupied';
          card.dataset.olingId = getOlingId(oling);
          card.setAttribute(
            'aria-label',
            `Drag ${oling?.name || 'Oling'} into the lab to release it`
          );
          const artwork = createPodArtwork(definition, oling);
          card.append(
            artwork,
            Object.assign(document.createElement('span'), {
              className: 'oling-lab-storage-panel-oling-name',
              textContent: oling?.name || 'Oling'
            })
          );
          card.addEventListener('click', () => {
            if (card.dataset.dragged === 'true') {
              card.dataset.dragged = 'false';
              return;
            }
            openReleaseConfirmation(oling);
          });
          attachPanelPodDrag(card, { kind: 'occupied', oling });
          stored.grid.appendChild(card);
        });
      }

      const empty = createPanelSection(
        'Empty Pods',
        String(
          ownedPods.reduce((sum, pod) => sum + Number(pod.quantity || 0), 0)
        )
      );
      if (!ownedPods.length) {
        empty.grid.appendChild(
          createEmptyMessage('You do not have any empty Oling Pods.')
        );
      } else {
        ownedPods.forEach((ownedPod) => {
          const definition = getPodDefinition(ownedPod.key);
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'oling-lab-storage-panel-card is-empty';
          card.dataset.podKey = ownedPod.key;
          card.setAttribute(
            'aria-label',
            `${definition?.name || 'Oling Pod'}, ${ownedPod.quantity} available. Drag over an Oling or drop an Oling here.`
          );
          card.append(
            createPodArtwork(definition),
            Object.assign(document.createElement('span'), {
              className: 'oling-lab-storage-panel-stack-count',
              textContent: String(Number(ownedPod.quantity || 0))
            }),
            Object.assign(document.createElement('span'), {
              className: 'oling-lab-storage-panel-uses',
              textContent: getPodUsesLabel(definition, {
                releaseOutcome: definition?.lifecycle?.onRelease
              })
            })
          );
          card.addEventListener('click', () => {
            if (card.dataset.dragged === 'true') {
              card.dataset.dragged = 'false';
              return;
            }
            setPanelMessage(
              'Drag this pod over an active Oling to capture it.'
            );
          });
          attachPanelPodDrag(card, {
            kind: 'empty',
            podKey: ownedPod.key
          });
          empty.grid.appendChild(card);
        });
      }
      elements.storagePanelContent.replaceChildren(
        stored.section,
        empty.section
      );
      if (elements.storagePanelTitle) {
        elements.storagePanelTitle.textContent = activeStorage.definition.name;
      }
      setPanelMessage(
        storedOlings.length >= activeStorage.capacity
          ? `This Pod Rack is full (${storedOlings.length}/${activeStorage.capacity}).`
          : `${storedOlings.length} of ${activeStorage.capacity} occupied slots.`
      );
    }

    function openStoredOlingsMenu(placedId = null) {
      const storage = getPodStorageInstances().find(
        ({ placed }) =>
          !placedId || String(placed.placedId) === String(placedId)
      );
      if (!storage) {
        setStatus('Place a Pod Rack before opening Oling storage.');
        return;
      }
      state.activePodStoragePlacedId = storage.placed.placedId;
      closeShelfStoragePanel({ sound: false });
      closeGatewayPanel({ sound: false });
      if (!elements.storagePanel) {
        openMenu(storage.definition.name, [createStoredOlingsSection()], {
          theme: 'inventory'
        });
        return;
      }
      const wasExpanded = Boolean(
        state.storagePanelOpen &&
          !state.storagePanelCollapsed &&
          !elements.storagePanel.hidden
      );
      closeMenu?.();
      state.storagePanelOpen = true;
      state.storagePanelCollapsed = false;
      renderStoragePanel();
      elements.storagePanelToggle?.setAttribute('aria-expanded', 'true');
      if (elements.storagePanelToggle) {
        elements.storagePanelToggle.textContent = 'Hide';
        elements.storagePanelToggle.dataset.sound = 'none';
        delete elements.storagePanelToggle.dataset.soundIntent;
      }
      const show = () => {
        if (!state.storagePanelOpen) return;
        if (!wasExpanded) playSound('sidePanelOpen');
      };
      if (panelTransitions) {
        void panelTransitions.open(elements.storagePanel, { afterOpen: show });
      } else if (typeof window.requestAnimationFrame === 'function') {
        elements.storagePanel.hidden = false;
        window.requestAnimationFrame(() => {
          elements.storagePanel.classList.add('is-open');
          show();
        });
      } else {
        elements.storagePanel.hidden = false;
        elements.storagePanel.classList.add('is-open');
        show();
      }
    }

    function closeStoragePanel(options = {}) {
      if (!elements.storagePanel) return;
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.storagePanel
      );
      if (!state.storagePanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasVisible = Boolean(
        state.storagePanelOpen && !elements.storagePanel.hidden
      );
      clearPodDrag();
      clearOlingPodDropTarget();
      state.storagePanelOpen = false;
      state.storagePanelCollapsed = false;
      state.activePodStoragePlacedId = null;
      elements.storagePanelToggle?.setAttribute('aria-expanded', 'false');
      const playCloseSound = () => {
        if (wasVisible && options.sound !== false) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.storagePanel.classList.remove('is-open', 'is-collapsed');
        elements.storagePanelContent?.replaceChildren();
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.storagePanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.storagePanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    }

    function toggleStoragePanel() {
      if (!state.storagePanelOpen || !elements.storagePanel) return;
      state.storagePanelCollapsed = !state.storagePanelCollapsed;
      elements.storagePanel.classList.toggle(
        'is-collapsed',
        state.storagePanelCollapsed
      );
      elements.storagePanelToggle?.setAttribute(
        'aria-expanded',
        String(!state.storagePanelCollapsed)
      );
      if (elements.storagePanelToggle) {
        elements.storagePanelToggle.textContent = state.storagePanelCollapsed
          ? 'Show'
          : 'Hide';
        elements.storagePanelToggle.dataset.sound = 'none';
        delete elements.storagePanelToggle.dataset.soundIntent;
      }
      playSound(
        state.storagePanelCollapsed ? 'sidePanelClose' : 'sidePanelOpen'
      );
    }

    function createPodGhost(drag) {
      const ghost = document.createElement('div');
      ghost.className = `oling-lab-pod-drag-ghost is-${drag.kind}`;
      if (drag.kind === 'occupied') {
        const pod = getStoredPod(drag.oling);
        ghost.appendChild(
          createPodArtwork(getPodDefinition(pod?.key), drag.oling)
        );
      } else {
        const definition = getPodDefinition(drag.podKey);
        ghost.appendChild(createPodArtwork(definition));
      }
      document.body.appendChild(ghost);
      return ghost;
    }

    function clearLiveCaptureLayers() {
      if (!podDrag) return;
      podDrag.captureLayers?.forEach((layer) => layer.remove());
      podDrag.captureLayerRoamer?.classList.remove('has-pod-capture-layers');
      podDrag.ghost?.classList.remove('has-live-capture-layers');
      podDrag.captureLayers = null;
      podDrag.captureLayerRoamer = null;
    }

    function syncLiveCaptureLayers(roamer, definition) {
      if (podDrag?.captureLayerRoamer === roamer) return true;
      clearLiveCaptureLayers();
      const layers = roamer ? getPodLayerAssets(definition) : null;
      if (!roamer || !layers) return false;
      const captureLayers = [
        createPodImage(layers.back, 'oling-lab-pod-capture-layer is-back'),
        createPodImage(layers.front, 'oling-lab-pod-capture-layer is-front'),
        createPodImage(layers.base, 'oling-lab-pod-capture-layer is-base')
      ];
      roamer.append(...captureLayers);
      roamer.classList.add('has-pod-capture-layers');
      podDrag.captureLayers = captureLayers;
      podDrag.captureLayerRoamer = roamer;
      podDrag.ghost?.classList.add('has-live-capture-layers');
      return true;
    }

    function getPointerPodRect(event) {
      if (!podDrag?.ghost) return null;
      if (!podDrag.freeSize) {
        const rect = podDrag.ghost.getBoundingClientRect?.() || {};
        podDrag.freeSize = Math.max(
          Number(podDrag.ghost.offsetWidth) || 0,
          Number(rect.width) || 0,
          Number(rect.height) || 0,
          104
        );
      }
      const half = podDrag.freeSize / 2;
      return {
        left: event.clientX - half,
        right: event.clientX + half,
        top: event.clientY - half,
        bottom: event.clientY + half,
        width: podDrag.freeSize,
        height: podDrag.freeSize
      };
    }

    function positionPodGhost(event, snappedRoamer = null) {
      if (!podDrag?.ghost) return;
      if (snappedRoamer?.getBoundingClientRect) {
        const rect = snappedRoamer.getBoundingClientRect();
        podDrag.ghost.style.left = `${rect.left + rect.width / 2}px`;
        podDrag.ghost.style.top = `${rect.top + rect.height / 2}px`;
        podDrag.ghost.style.width = `${rect.width}px`;
        podDrag.ghost.style.height = `${rect.height}px`;
        podDrag.ghost.classList.add('is-snapped');
        return;
      }
      podDrag.ghost.style.left = `${event.clientX}px`;
      podDrag.ghost.style.top = `${event.clientY}px`;
      podDrag.ghost.style.removeProperty('width');
      podDrag.ghost.style.removeProperty('height');
      podDrag.ghost.classList.remove('is-snapped');
    }

    function findOlingUnderPointer(event) {
      const roamers = [...document.querySelectorAll('.oling-lab-roamer')];
      const pointerPodRect = getPointerPodRect(event);
      const roamer = roamers.find((candidate) =>
        rectanglesOverlap(pointerPodRect, candidate.getBoundingClientRect())
      );
      if (!roamer) return null;
      const oling = (state.olings || []).find(
        (candidate) => getOlingId(candidate) === roamer.dataset.olingId
      );
      return oling && !getStoreBlockReason(oling) ? { oling, roamer } : null;
    }

    function setPodCaptureHover(olingId) {
      const nextId = String(olingId || '');
      if (highlightedOlingId === nextId) return;
      if (highlightedOlingId) {
        getRoaming()?.setPodCaptureHover?.(highlightedOlingId, false);
      }
      highlightedOlingId = nextId || null;
      if (highlightedOlingId) {
        getRoaming()?.setPodCaptureHover?.(highlightedOlingId, true);
      }
    }

    function clearOlingPodDropTarget() {
      setPodCaptureHover(null);
      highlightedPodCard?.classList.remove('is-drop-target');
      highlightedPodCard = null;
    }

    function updateOlingPodDropTarget(oling, event) {
      highlightedPodCard?.classList.remove('is-drop-target');
      highlightedPodCard = null;
      if (getStoreBlockReason(oling)) return null;
      const cards = [
        ...(elements.storagePanelContent?.querySelectorAll?.(
          '.oling-lab-storage-panel-card.is-empty'
        ) || [])
      ];
      highlightedPodCard =
        cards.find((card) => isPointInside(card, event)) || null;
      highlightedPodCard?.classList.add('is-drop-target');
      return highlightedPodCard;
    }

    function getOlingStorageDropTarget(oling, event) {
      const card = updateOlingPodDropTarget(oling, event);
      return card
        ? {
            podKey: card.dataset.podKey,
            containerPlacedId: state.activePodStoragePlacedId,
            card
          }
        : null;
    }

    async function captureDraggedOling(
      oling,
      target,
      { keepPodHover = false } = {}
    ) {
      highlightedPodCard?.classList.remove('is-drop-target');
      highlightedPodCard = null;
      if (!keepPodHover) setPodCaptureHover(null);
      try {
        await storeOling(
          getOlingId(oling),
          target?.podKey,
          target?.containerPlacedId || state.activePodStoragePlacedId
        );
        renderStoragePanel();
        renderLab();
        playSound('uiDragStore');
        return true;
      } catch {
        setPanelMessage(
          'That Oling could not be captured. It has resumed roaming.',
          true
        );
        playSound('uiError');
        return false;
      } finally {
        if (keepPodHover) setPodCaptureHover(null);
      }
    }

    function movePodDrag(event) {
      if (!podDrag || event.pointerId !== podDrag.pointerId) return;
      const distance = Math.hypot(
        event.clientX - podDrag.startX,
        event.clientY - podDrag.startY
      );
      if (!podDrag.active && distance < 6) return;
      if (!podDrag.active) {
        podDrag.active = true;
        podDrag.source.classList.add('is-drag-source');
        podDrag.source.dataset.dragged = 'true';
        podDrag.ghost = createPodGhost(podDrag);
        playSound('uiDragPickup');
      }
      if (podDrag.kind === 'empty') {
        const overPanel = isPointerOverStoragePanel(event);
        if (!overPanel) podDrag.hasLeftPanel = true;
        const overStorage = Boolean(podDrag.hasLeftPanel && overPanel);
        const target = overStorage ? null : findOlingUnderPointer(event);
        const oling = target?.oling || null;
        podDrag.overStorage = overStorage;
        podDrag.targetOling = oling;
        podDrag.targetRoamer = target?.roamer || null;
        syncLiveCaptureLayers(
          podDrag.targetRoamer,
          getPodDefinition(podDrag.podKey)
        );
        positionPodGhost(event, podDrag.targetRoamer);
        setStoragePanelDropTarget(overStorage, 'Drop here to return empty pod');
        podDrag.ghost?.classList.toggle('is-over-storage', overStorage);
        setPodCaptureHover(oling ? getOlingId(oling) : null);
        setPanelMessage(
          overStorage
            ? 'Release to return this empty pod to storage.'
            : oling
              ? `Release to capture ${oling.name || 'this Oling'}.`
              : 'Move the pod over an active Oling, or back into storage.'
        );
      } else {
        positionPodGhost(event);
        const overPanel = isPointerOverStoragePanel(event);
        if (!overPanel) podDrag.hasLeftPanel = true;
        const overStorage = Boolean(podDrag.hasLeftPanel && overPanel);
        const overLab = !overPanel && isPointInside(elements.viewport, event);
        podDrag.overStorage = overStorage;
        podDrag.overLab = overLab;
        setStoragePanelDropTarget(
          overStorage,
          'Drop here to keep Oling stored'
        );
        podDrag.ghost?.classList.toggle('is-over-storage', overStorage);
        podDrag.ghost?.classList.toggle('is-valid', overLab);
        setPanelMessage(
          overStorage
            ? `Release to keep ${podDrag.oling?.name || 'this Oling'} stored.`
            : overLab
              ? `Release to return ${podDrag.oling?.name || 'this Oling'} to the lab.`
              : 'Drag the occupied pod into the lab, or back into storage.'
        );
      }
      event.preventDefault();
    }

    function clearPodDrag({ keepHover = false } = {}) {
      if (!podDrag) return;
      podDrag.source?.classList.remove('is-drag-source');
      clearLiveCaptureLayers();
      podDrag.ghost?.remove();
      setStoragePanelDropTarget(false);
      podDrag = null;
      if (!keepHover) setPodCaptureHover(null);
    }

    function finishPodDrag(event, cancelled = false) {
      if (!podDrag || event.pointerId !== podDrag.pointerId) return;
      const completed = podDrag;
      const wasActive = completed.active;
      const keepHover = Boolean(
        !cancelled && completed.kind === 'empty' && completed.targetOling
      );
      clearPodDrag({ keepHover });
      if (wasActive) {
        window.setTimeout?.(() => {
          if (completed.source?.dataset) {
            completed.source.dataset.dragged = 'false';
          }
        }, 0);
      }
      if (!wasActive || cancelled) return;
      if (completed.kind === 'empty' && completed.overStorage) {
        setPanelMessage('The empty pod remains available in storage.');
        playSound('uiDragStore');
      } else if (completed.kind === 'empty' && completed.targetOling) {
        captureDraggedOling(
          completed.targetOling,
          {
            podKey: completed.podKey,
            containerPlacedId: state.activePodStoragePlacedId
          },
          { keepPodHover: true }
        );
      } else if (completed.kind === 'occupied' && completed.overStorage) {
        setPanelMessage(
          `${completed.oling?.name || 'This Oling'} remains safely stored.`
        );
        playSound('uiDragStore');
      } else if (completed.kind === 'occupied' && completed.overLab) {
        openReleaseConfirmation(completed.oling);
      } else {
        setPanelMessage(
          'Drag a pod into the lab, or drag an Oling onto an empty pod.'
        );
        playSound('uiError');
      }
      event.preventDefault();
    }

    elements.storagePanelToggle?.addEventListener('click', toggleStoragePanel);
    elements.storagePanelBack?.addEventListener('click', () => {
      closeStoragePanel();
      elements.actionPanel
        ?.querySelector('.oling-lab-action-panel-button.is-interact')
        ?.focus();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener?.('pointermove', movePodDrag);
      document.addEventListener?.('pointerup', (event) => finishPodDrag(event));
      document.addEventListener?.('pointercancel', (event) =>
        finishPodDrag(event, true)
      );
      document.addEventListener?.('keydown', (event) => {
        if (event.key === 'Escape') clearPodDrag();
      });
    }

    return {
      createPodArtwork,
      getStoredOlings,
      createStoreOlingTab,
      createStoredOlingsSection,
      openStoredOlingsMenu,
      closeStoragePanel,
      renderStoragePanel,
      updateOlingPodDropTarget,
      getOlingStorageDropTarget,
      captureDraggedOling,
      clearOlingPodDropTarget
    };
  }

  window.createOlingLabStorageTools = createOlingLabStorageTools;
})();
