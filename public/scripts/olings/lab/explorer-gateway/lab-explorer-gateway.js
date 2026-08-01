(function () {
  function createOlingLabExplorerGateway(dependencies) {
    const {
      state,
      createDetailRow,
      getRoaming,
      setStatus,
      getAdventureDoorPlacedId,
      closeSelectedTarget,
      renderLab,
      createImage,
      createInlineAction,
      formatTitle,
      openMenu,
      createTabMenu,
      clearAdventureTimer
    } = dependencies;
    const {
      createOlingPreview,
      createSelectionSection,
      details,
      formatTime,
      section
    } = window.createOlingLabExplorerRenderTools({
      state,
      createDetailRow,
      createImage,
      createInlineAction,
      formatTitle
    });

    async function openExplorerGateway(
      initialTab = state.explorerTabLabel || 'Overview'
    ) {
      try {
        const response = await fetch('/api/olings/adventures', {
          headers: { Accept: 'application/json' }
        });
        const payload = await response.json();
        if (!response.ok || payload.success === false)
          throw new Error(
            payload.error?.message || 'Could not open the Explorer Gateway.'
          );
        const data = payload;
        const active = data.active;
        state.activeAdventure = active;
        let selectedId = data.olings[0]?.id || data.olings[0]?._id || '';
        const refresh = () => openExplorerGateway();
        const start = (adventure) => {
          if (getRoaming()?.isHeadingToAdventure?.(selectedId)) {
            getRoaming().cancelAdventureJourney(selectedId);
            setStatus(
              'Adventure cancelled — your Oling is returning to its usual getRoaming().'
            );
            refresh();
            return;
          }
          const doorPlacedId = getAdventureDoorPlacedId();
          if (
            !doorPlacedId ||
            !getRoaming()?.sendToAdventure?.(
              selectedId,
              doorPlacedId,
              adventure
            )
          )
            return setStatus(
              'Place a door with an exit area before starting an adventure.'
            );
          closeSelectedTarget();
          setStatus(
            `${data.olings.find((oling) => String(oling.id || oling._id) === String(selectedId))?.name || 'Your Oling'} is heading to the door.`
          );
          renderLab();
          refresh();
        };
        const overview = () => {
          const dashboard = document.createElement('section');
          dashboard.className = 'oling-lab-gateway-overview';
          const visual = document.createElement('div');
          visual.className = 'oling-lab-gateway-overview-visual';
          visual.append(
            createImage(
              '/images/olings/furniture/door-modules/explorer-gateway/explorer-gateway.svg',
              'Explorer Gateway'
            ),
            Object.assign(document.createElement('strong'), {
              className: active ? 'is-active' : 'is-idle',
              textContent: active ? 'Adventure Active' : 'Idle'
            })
          );
          const cards = document.createElement('div');
          cards.className = 'oling-lab-gateway-overview-cards';
          cards.append(
            details([['Gateway level', String(data.gatewayLevel)]]),
            details([['Active Oling', active?.olingName || 'None']]),
            details([
              [
                'Time remaining',
                active
                  ? formatTime(new Date(active.completesAt) - Date.now())
                  : '—'
              ]
            ])
          );
          const copy = Object.assign(document.createElement('p'), {
            textContent: active
              ? `${active.olingName || 'Your Oling'} is exploring ${active.adventureName}.`
              : 'The Gateway is ready for an explorer.'
          });
          const stage = document.createElement('div');
          stage.className = 'oling-lab-gateway-overview-stage';
          stage.append(visual, cards, copy);
          dashboard.append(stage);
          return section(dashboard);
        };
        const adventures = () => {
          const selected = data.adventures.find(
            (adventure) => adventure.key === state.explorerAdventureKey
          );
          if (selected) {
            const view = document.createElement('section');
            view.className = 'oling-lab-explorer-adventure-detail';
            const back = createInlineAction('Back', () => {
              state.explorerAdventureKey = null;
              openExplorerGateway();
            });
            back.classList.add('oling-lab-explorer-adventure-back');
            const header = Object.assign(document.createElement('header'), {
              className: 'oling-lab-explorer-adventure-header'
            });
            header.append(
              Object.assign(document.createElement('h3'), {
                textContent: selected.name
              }),
              back
            );
            const setup = document.createElement('div');
            setup.className = 'oling-lab-explorer-adventure-setup';
            setup.append(
              Object.assign(document.createElement('div'), {
                className: 'oling-lab-explorer-adventure-image',
                textContent: selected.name
              })
            );
            const slot = document.createElement('div');
            slot.className = 'oling-lab-explorer-oling-slot';
            const olings = data.olings;
            const index = Math.max(
              0,
              Math.min(state.explorerOlingIndex, olings.length - 1)
            );
            const chosen = olings[index];
            selectedId = chosen?.id || chosen?._id || '';
            const previous = createInlineAction('Previous Oling', () => {
              state.explorerOlingIndex =
                (index - 1 + olings.length) % olings.length;
              openExplorerGateway('Adventures');
            });
            previous.classList.add(
              'oling-lab-explorer-oling-arrow',
              'is-previous'
            );
            const next = createInlineAction('Next Oling', () => {
              state.explorerOlingIndex = (index + 1) % olings.length;
              openExplorerGateway('Adventures');
            });
            next.classList.add('oling-lab-explorer-oling-arrow', 'is-next');
            const preview = createOlingPreview(
              chosen,
              'oling-lab-oling-preview oling-lab-explorer-oling-preview'
            );
            slot.append(
              previous,
              preview,
              next,
              Object.assign(document.createElement('strong'), {
                textContent: chosen ? chosen.name || 'Oling' : 'No Olings'
              })
            );
            setup.append(slot);
            const isEnergetic =
              String(chosen?.personalityKey || '').toLowerCase() ===
              'energetic';
            const selectedEnergyCost = isEnergetic
              ? Math.round(Number(selected.energyCost || 0) * 85) / 100
              : Number(selected.energyCost || 0);
            const requirements = document.createElement('div');
            requirements.className =
              'oling-lab-explorer-adventure-requirements';
            requirements.append(
              details([['Duration', formatTime(selected.durationMs)]]),
              details([
                [
                  'Energy',
                  isEnergetic
                    ? `${selectedEnergyCost} (-15%)`
                    : String(selectedEnergyCost)
                ]
              ]),
              details([['Level', String(selected.recommendedLevel)]])
            );
            const rewards = Object.assign(document.createElement('div'), {
              className: 'oling-lab-explorer-adventure-rewards'
            });
            rewards.appendChild(
              Object.assign(document.createElement('strong'), {
                textContent: 'Possible rewards'
              })
            );
            selected.possibleRewards.forEach((reward) => {
              const item = document.createElement('div');
              item.appendChild(
                Object.assign(document.createElement('span'), {
                  textContent: reward
                })
              );
              rewards.appendChild(item);
            });
            view.append(header, setup, requirements, rewards);
            return section(view);
          }
          const grid = document.createElement('div');
          grid.className = 'oling-lab-explorer-adventure-grid';
          data.adventures.forEach((adventure) => {
            const button = createInlineAction(adventure.name, () => {
              state.explorerAdventureKey = adventure.key;
              openExplorerGateway();
            });
            button.classList.add('oling-lab-explorer-adventure-tile');
            button.dataset.badge = `Lvl ${adventure.recommendedLevel}`;
            button.appendChild(
              Object.assign(document.createElement('small'), {
                textContent: formatTime(adventure.durationMs)
              })
            );
            grid.appendChild(button);
          });
          return section(grid);
        };
        const returnOling = async () => {
          const r = await fetch('/api/olings/adventures/return', {
            method: 'POST',
            headers: { Accept: 'application/json' }
          });
          const b = await r.json();
          if (!r.ok || b.success === false)
            return setStatus(
              b.error?.message || 'Adventure still in progress.'
            );
          state.activeAdventure = null;
          getRoaming()?.returnFromAdventure?.(b.olingId, active?.doorPlacedId);
          setStatus(b.message);
          renderLab();
          refresh();
        };
        const activeTab = () => {
          if (!active)
            return section(
              Object.assign(document.createElement('p'), {
                className: 'oling-lab-menu-empty',
                textContent: 'No Oling is currently away.'
              })
            );
          const scene = document.createElement('section');
          scene.className = 'oling-lab-active-adventure-scene';
          scene.style.backgroundImage = `url('/images/olings/gui/backgrounds/adventures/${active.adventureKey}.jpg')`;
          const oling = data.olings.find(
            (item) => (item.id || item._id) === active.olingId
          );
          const preview = createOlingPreview(
            oling,
            'oling-lab-oling-preview oling-lab-active-adventure-oling'
          );
          scene.append(
            preview,
            Object.assign(document.createElement('strong'), {
              className: 'oling-lab-active-adventure-name',
              textContent: active.olingName || oling?.name || 'Oling'
            })
          );
          return section(scene);
        };
        const discoveries = () => {
          if (!data.history.length)
            return section(
              Object.assign(document.createElement('p'), {
                className: 'oling-lab-menu-empty',
                textContent: 'Your discoveries will appear here.'
              })
            );
          const entry = Number.isInteger(state.explorerDiscoveryIndex)
            ? data.history[state.explorerDiscoveryIndex]
            : null;
          if (entry) {
            const detail = document.createElement('section');
            detail.className = 'oling-lab-explorer-adventure-detail';
            const back = createInlineAction('Back', () => {
              state.explorerDiscoveryIndex = null;
              openExplorerGateway('Discoveries');
            });
            back.classList.add('oling-lab-explorer-adventure-back');
            const header = Object.assign(document.createElement('header'), {
              className: 'oling-lab-explorer-adventure-header'
            });
            header.append(
              Object.assign(document.createElement('h3'), {
                textContent: entry.adventureName || 'Discovery'
              }),
              back
            );
            const setup = document.createElement('div');
            setup.className = 'oling-lab-explorer-adventure-setup';
            setup.append(
              Object.assign(document.createElement('div'), {
                className: 'oling-lab-explorer-adventure-image',
                textContent: entry.adventureName || 'Discovery'
              })
            );
            const oling = data.olings.find(
              (item) => (item.id || item._id) === entry.olingId
            );
            const olingCard = document.createElement('div');
            olingCard.className = 'oling-lab-explorer-oling-slot';
            const preview = createOlingPreview(
              oling,
              'oling-lab-oling-preview oling-lab-explorer-oling-preview'
            );
            olingCard.append(
              preview,
              Object.assign(document.createElement('strong'), {
                textContent: entry.olingName || oling?.name || 'Oling'
              })
            );
            setup.appendChild(olingCard);
            const requirements = document.createElement('div');
            requirements.className =
              'oling-lab-explorer-adventure-requirements';
            requirements.append(
              details([
                ['Completed', new Date(entry.completedAt).toLocaleDateString()]
              ]),
              details([['Duration', formatTime(entry.durationMs || 0)]]),
              details([['Energy used', String(entry.energyCost || 0)]])
            );
            const rewards = Object.assign(document.createElement('div'), {
              className: 'oling-lab-explorer-adventure-rewards'
            });
            rewards.appendChild(
              Object.assign(document.createElement('strong'), {
                textContent: 'Rewards found'
              })
            );
            (entry.rewards || []).forEach((reward) => {
              const item = document.createElement('div');
              item.appendChild(
                Object.assign(document.createElement('span'), {
                  textContent: reward
                })
              );
              rewards.appendChild(item);
            });
            detail.append(header, setup, requirements, rewards);
            return section(detail);
          }
          const list = document.createElement('div');
          list.className = 'oling-lab-discovery-list';
          data.history.forEach((item, index) => {
            const row = createInlineAction(
              item.adventureName || 'Discovery',
              () => {
                state.explorerDiscoveryIndex = index;
                openExplorerGateway('Discoveries');
              }
            );
            row.classList.add('oling-lab-discovery-row');
            row.append(
              Object.assign(document.createElement('small'), {
                textContent: `${item.olingName || 'Oling'} · ${new Date(item.completedAt).toLocaleDateString()}`
              })
            );
            list.appendChild(row);
          });
          return section(list);
        };
        const selection = () =>
          createSelectionSection(data.olings, selectedId, (id) => {
            selectedId = id;
            openExplorerGateway();
          });
        const tabs = [
          { label: 'Overview', content: overview },
          { label: 'Adventures', content: adventures },
          ...(active
            ? [{ label: 'Active Adventure', content: activeTab }]
            : []),
          { label: 'Discoveries', content: discoveries }
        ];
        openMenu(
          'Explorer Gateway',
          [
            createTabMenu(tabs, {
              initialLabel: initialTab,
              onActivate: (tab) => {
                state.explorerTabLabel = tab.label;
              },
              actionContent: (tab) => {
                if (tab.label === 'Active Adventure') {
                  const action = createInlineAction('', returnOling);
                  const syncReturnAction = () => {
                    const remainingMs = Math.max(
                      0,
                      new Date(active.completesAt).getTime() - Date.now()
                    );
                    action.disabled = remainingMs > 0;
                    action.textContent =
                      remainingMs > 0
                        ? `Return in ${formatTime(remainingMs)}`
                        : 'Return Oling';
                    if (remainingMs <= 0) clearAdventureTimer();
                  };
                  syncReturnAction();
                  window.setTimeout(() => {
                    if (!action.isConnected) return;
                    clearAdventureTimer();
                    state.adventureTimerInterval = window.setInterval(
                      syncReturnAction,
                      1000
                    );
                  }, 0);
                  return [action];
                }
                if (tab.label === 'Adventures' && state.explorerAdventureKey) {
                  const adventure = data.adventures.find(
                    (item) => item.key === state.explorerAdventureKey
                  );
                  if (!adventure) return [];
                  const headingToDoor =
                    getRoaming()?.isHeadingToAdventure?.(selectedId);
                  const selectedOling = data.olings.find(
                    (oling) =>
                      String(oling.id || oling._id) === String(selectedId)
                  );
                  const isResting = Boolean(selectedOling?.care?.isSleeping);
                  const action = createInlineAction(
                    headingToDoor ? 'Cancel adventure' : 'Start adventure',
                    () => start(adventure),
                    { disabled: Boolean(active) || !selectedId || isResting }
                  );
                  action.title = isResting
                    ? 'Wake this Oling before starting an adventure.'
                    : '';
                  action.classList.add('oling-lab-explorer-adventure-start');
                  return [action];
                }
                if (tab.label !== 'Overview') return [];
                const label = active
                  ? 'View active adventure'
                  : 'Choose an adventure';
                const action = createInlineAction(label, () =>
                  openExplorerGateway(
                    active ? 'Active Adventure' : 'Adventures'
                  )
                );
                action.classList.add('oling-lab-gateway-overview-action');
                action.dataset.label = label;
                return [action];
              }
            })
          ],
          { theme: 'quests-adventures' }
        );
      } catch (error) {
        setStatus(error.message);
      }
    }

    return {
      openExplorerGateway
    };
  }

  window.createOlingLabExplorerGateway = createOlingLabExplorerGateway;
})();
