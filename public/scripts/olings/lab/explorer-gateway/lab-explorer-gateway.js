(function () {
  function createOlingLabExplorerGateway(dependencies) {
    const {
      state,
      elements = {},
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
      closeMenu,
      createTabMenu,
      clearAdventureTimer,
      resolveMenuConfig,
      getOlingViews = () => null,
      closeRestPanel = () => {},
      closeIncubatorPanel = () => {},
      closeShelfStoragePanel = () => {}
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
    const adventureApi = window.createOlingLabAdventureApi();
    const panelTransitions = window.OlingLabPanelTransitions;
    let gatewayPanelBackAction = null;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

    function getRewardLabels(rewards) {
      if (Array.isArray(rewards)) return rewards;
      const accountXp = Math.max(
        0,
        Math.floor(Number(rewards?.accountXp) || 0)
      );
      const opals = Math.max(0, Math.floor(Number(rewards?.opals) || 0));
      return [
        ...(accountXp ? [`${accountXp} Account XP`] : []),
        ...(opals ? [`${opals} Opals`] : [])
      ];
    }

    function setGatewayPanelHeaderAction(onBack = null, ariaLabel = '') {
      gatewayPanelBackAction =
        typeof onBack === 'function' ? onBack : null;
      const control = elements.gatewayPanelClose;
      if (!control) return;
      const isBack = Boolean(gatewayPanelBackAction);
      control.classList.toggle('is-close', !isBack);
      control.textContent = isBack ? 'Back' : 'Close';
      control.setAttribute(
        'aria-label',
        isBack ? ariaLabel || 'Back' : 'Close Explorer Gateway menu'
      );
    }

    function setGatewayPanelCollapsed(collapsed) {
      if (!state.gatewayPanelOpen || !elements.gatewayPanel) return;
      const changed = state.gatewayPanelCollapsed !== collapsed;
      state.gatewayPanelCollapsed = collapsed;
      elements.gatewayPanel.classList.toggle('is-collapsed', collapsed);
      elements.gatewayPanelToggle.textContent = collapsed ? 'Show' : 'Hide';
      elements.gatewayPanelToggle.setAttribute(
        'aria-expanded',
        String(!collapsed)
      );
      if (changed) playSound(collapsed ? 'sidePanelClose' : 'sidePanelOpen');
    }

    function closeGatewayPanel({ sound = true } = {}) {
      if (!elements.gatewayPanel) return;
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.gatewayPanel
      );
      if (!state.gatewayPanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasExpanded = Boolean(
        state.gatewayPanelOpen &&
        !state.gatewayPanelCollapsed &&
        !elements.gatewayPanel.hidden
      );
      clearAdventureTimer();
      state.gatewayPanelOpen = false;
      state.gatewayPanelCollapsed = false;
      setGatewayPanelHeaderAction();
      elements.gatewayPanelToggle?.setAttribute('aria-expanded', 'false');
      const playCloseSound = () => {
        if (sound && wasExpanded) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.gatewayPanel.classList.remove('is-open', 'is-collapsed');
        elements.gatewayPanelContent?.replaceChildren();
        elements.gatewayPanelFooter?.replaceChildren();
        if (elements.gatewayPanelFooter)
          elements.gatewayPanelFooter.hidden = true;
        if (elements.gatewayPanelTabs) {
          elements.gatewayPanelTabs.hidden = true;
          elements.gatewayPanelTabs.replaceChildren();
        }
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.gatewayPanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.gatewayPanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    }

    function prepareGatewayPanel() {
      const wasExpanded = Boolean(
        state.gatewayPanelOpen && !state.gatewayPanelCollapsed
      );
      closeMenu?.();
      getOlingViews()?.closeOlingPanel?.({ sound: false });
      getOlingViews()?.closeStoragePanel?.({ sound: false });
      closeShelfStoragePanel({ sound: false });
      closeIncubatorPanel({ sound: false });
      closeRestPanel({ sound: false });
      state.gatewayPanelOpen = true;
      state.gatewayPanelCollapsed = false;
      const theme = resolveMenuConfig?.({ theme: 'quests-adventures' }) || {};
      for (const [property, value] of [
        ['--wall-decoration-panel-primary', theme.primaryColour],
        ['--wall-decoration-panel-secondary', theme.secondaryColour]
      ]) {
        if (value) elements.gatewayPanel.style.setProperty(property, value);
      }
      elements.gatewayPanelTitle.textContent = 'Explorer Gateway';
      setGatewayPanelHeaderAction();
      elements.gatewayPanelToggle.textContent = 'Hide';
      elements.gatewayPanelToggle.setAttribute('aria-expanded', 'true');
      return wasExpanded;
    }

    function finishGatewayPanelOpen(wasExpanded) {
      const show = () => {
        if (!state.gatewayPanelOpen) return;
        if (!wasExpanded) playSound('sidePanelOpen');
      };
      if (panelTransitions) {
        void panelTransitions.open(elements.gatewayPanel, {
          afterOpen: show
        });
      } else if (typeof window.requestAnimationFrame === 'function') {
        elements.gatewayPanel.hidden = false;
        window.requestAnimationFrame(() => {
          elements.gatewayPanel.classList.add('is-open');
          show();
        });
      } else {
        elements.gatewayPanel.hidden = false;
        elements.gatewayPanel.classList.add('is-open');
        show();
      }
    }

    elements.gatewayPanelToggle?.addEventListener('click', () =>
      setGatewayPanelCollapsed(!state.gatewayPanelCollapsed)
    );
    elements.gatewayPanelClose?.addEventListener('click', () => {
      if (gatewayPanelBackAction) {
        gatewayPanelBackAction();
        return;
      }
      closeGatewayPanel();
      elements.room
        ?.querySelector('[data-oling-lab-item-id="explorer_gateway"]')
        ?.focus();
    });

    async function openExplorerGateway(
      initialTab = state.explorerTabLabel || 'Overview',
      options = {}
    ) {
      try {
        const data = await adventureApi.loadGateway();
        if (options.shouldOpen && !options.shouldOpen()) return;
        const active = data.active;
        const usesSidePanel = Boolean(
          elements.gatewayPanel &&
          elements.gatewayPanelTabs &&
          elements.gatewayPanelContent &&
          elements.gatewayPanelFooter
        );
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
          ) {
            playSound('uiError');
            return setStatus(
              'Place a door with an exit area before starting an adventure.'
            );
          }
          closeSelectedTarget();
          setStatus(
            `${data.olings.find((oling) => String(oling.id || oling._id) === String(selectedId))?.name || 'Your Oling'} is heading to the door.`
          );
          renderLab();
          refresh();
        };
        const createEnergyCost = (value, label = 'Energy') => {
          const amount = Math.max(0, Math.floor(Number(value) || 0));
          const stat = document.createElement('div');
          stat.className = 'oling-lab-explorer-detail-energy';
          stat.setAttribute('aria-label', `${label}: ${amount}`);
          const icon = createImage(
            '/images/olings/lab/gui/icons/general/energy.svg',
            ''
          );
          icon.className = 'oling-lab-explorer-detail-energy-icon';
          icon.setAttribute('aria-hidden', 'true');
          stat.append(
            icon,
            Object.assign(document.createElement('strong'), {
              textContent: String(amount)
            })
          );
          return stat;
        };
        const createDuration = (value) => {
          const duration = document.createElement('div');
          duration.className = 'oling-lab-explorer-detail-duration';
          duration.append(
            Object.assign(document.createElement('span'), {
              textContent: 'Duration'
            }),
            Object.assign(document.createElement('strong'), {
              textContent: formatTime(value)
            })
          );
          return duration;
        };
        const createDetailPreview = (
          oling,
          name,
          { onPrevious = null, onNext = null } = {}
        ) => {
          const previewWindow = document.createElement('div');
          previewWindow.className =
            'oling-lab-explorer-oling-slot oling-lab-explorer-detail-preview';
          if (onPrevious) {
            const previous = createInlineAction('Previous Oling', onPrevious, {
              soundIntent: 'previous'
            });
            previous.classList.add(
              'oling-lab-explorer-oling-arrow',
              'is-previous'
            );
            previewWindow.appendChild(previous);
          }
          previewWindow.appendChild(
            createOlingPreview(
              oling,
              'oling-lab-oling-preview oling-lab-explorer-oling-preview'
            )
          );
          if (onNext) {
            const next = createInlineAction('Next Oling', onNext, {
              soundIntent: 'next'
            });
            next.classList.add('oling-lab-explorer-oling-arrow', 'is-next');
            previewWindow.appendChild(next);
          }
          previewWindow.appendChild(
            Object.assign(document.createElement('strong'), {
              textContent: name || 'Oling'
            })
          );
          return previewWindow;
        };
        const createRewardsPanel = (heading, rewards) => {
          const panel = document.createElement('article');
          panel.className =
            'oling-lab-explorer-detail-card oling-lab-explorer-detail-rewards';
          panel.appendChild(
            Object.assign(document.createElement('h3'), {
              textContent: heading
            })
          );
          const list = document.createElement('div');
          list.className = 'oling-lab-explorer-detail-reward-list';
          getRewardLabels(rewards).forEach((reward) => {
            list.appendChild(
              Object.assign(document.createElement('span'), {
                textContent: reward
              })
            );
          });
          panel.appendChild(list);
          return panel;
        };
        const getAdventureAvailability = (oling, adventure) => {
          const name = oling?.name || 'This Oling';
          const olingId = oling?.id || oling?._id || '';
          const requiredEnergy = Math.max(
            0,
            Math.floor(Number(adventure?.energyCost) || 0)
          );
          const currentEnergy = Math.max(
            0,
            Math.floor(Number(oling?.care?.energy ?? 100) || 0)
          );
          if (olingId && getRoaming()?.isHeadingToAdventure?.(olingId)) {
            return {
              key: 'preparing',
              label: 'Heading to gateway',
              message: `${name} is preparing to leave. You can cancel before departure.`,
              canUseAction: true
            };
          }
          if (!olingId) {
            return {
              key: 'unavailable',
              label: 'Unavailable',
              message: 'No Oling is available to send on this adventure.',
              canUseAction: false
            };
          }
          if (active) {
            return {
              key: 'unavailable',
              label: 'Gateway occupied',
              message: `${active.olingName || 'An Oling'} is already on an adventure.`,
              canUseAction: false
            };
          }
          if (oling.care?.isSleeping) {
            return {
              key: 'resting',
              label: 'Resting',
              message: `Wake ${name} before choosing them for an adventure.`,
              canUseAction: false
            };
          }
          if (currentEnergy < requiredEnergy) {
            return {
              key: 'low-energy',
              label: 'Not enough energy',
              message: `${name} has ${currentEnergy} Energy and needs ${requiredEnergy}.`,
              canUseAction: false
            };
          }
          return {
            key: 'ready',
            label: 'Ready',
            message: `${name} can be chosen for this adventure.`,
            canUseAction: true
          };
        };
        const createOlingStatusPanel = (oling, adventure) => {
          const availability = getAdventureAvailability(oling, adventure);
          const panel = document.createElement('article');
          panel.className = `oling-lab-explorer-oling-status is-${availability.key}`;
          const heading = document.createElement('div');
          heading.append(
            Object.assign(document.createElement('span'), {
              textContent: 'Oling status'
            }),
            Object.assign(document.createElement('strong'), {
              textContent: availability.label
            })
          );
          panel.appendChild(heading);
          return panel;
        };
        const overview = () => {
          if (usesSidePanel) setGatewayPanelHeaderAction();
          const dashboard = document.createElement('section');
          dashboard.className = 'oling-lab-gateway-overview';
          const visual = document.createElement('div');
          visual.className =
            'oling-lab-gateway-overview-visual oling-lab-gateway-overview-preview';
          visual.append(
            createImage(
              '/images/olings/lab/furniture/door-modules/explorer-gateway/explorer-gateway.svg',
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
          dashboard.append(visual, cards, copy);
          return section(dashboard);
        };
        const adventures = () => {
          const selected = data.adventures.find(
            (adventure) => adventure.key === state.explorerAdventureKey
          );
          if (selected) {
            const goBack = () => {
              state.explorerAdventureKey = null;
              openExplorerGateway('Adventures');
            };
            if (usesSidePanel)
              setGatewayPanelHeaderAction(goBack, 'Back to adventures');
            const view = document.createElement('section');
            view.className = 'oling-lab-explorer-adventure-detail';
            const olings = data.olings;
            const index = Math.max(
              0,
              Math.min(state.explorerOlingIndex, olings.length - 1)
            );
            const chosen = olings[index];
            selectedId = chosen?.id || chosen?._id || '';
            const previewWindow = createDetailPreview(
              chosen,
              chosen ? chosen.name || 'Oling' : 'No Olings',
              {
                onPrevious: olings.length
                  ? () => {
                      state.explorerOlingIndex =
                        (index - 1 + olings.length) % olings.length;
                      openExplorerGateway('Adventures');
                    }
                  : null,
                onNext: olings.length
                  ? () => {
                      state.explorerOlingIndex =
                        (index + 1) % olings.length;
                      openExplorerGateway('Adventures');
                    }
                  : null
              }
            );
            const panels = document.createElement('div');
            panels.className = 'oling-lab-explorer-detail-panels';
            const adventurePanel = document.createElement('article');
            adventurePanel.className =
              'oling-lab-explorer-detail-card oling-lab-explorer-detail-adventure';
            adventurePanel.style.backgroundImage = `linear-gradient(rgb(22 31 36 / 42%), rgb(22 31 36 / 42%)), url('/images/olings/lab/gui/backgrounds/adventures/${encodeURIComponent(selected.key)}.jpg')`;
            adventurePanel.append(
              Object.assign(document.createElement('h3'), {
                textContent: selected.name
              }),
              createEnergyCost(selected.energyCost),
              createDuration(selected.durationMs)
            );
            panels.append(
              adventurePanel,
              createRewardsPanel('Guaranteed rewards', selected.rewards)
            );
            if (!usesSidePanel) {
              const back = createInlineAction('Back', goBack, {
                soundIntent: 'previous'
              });
              back.classList.add('oling-lab-explorer-adventure-back');
              view.appendChild(back);
            }
            view.append(
              previewWindow,
              createOlingStatusPanel(chosen, selected),
              panels
            );
            return section(view);
          }
          if (usesSidePanel) setGatewayPanelHeaderAction();
          const grid = document.createElement('div');
          grid.className = 'oling-lab-explorer-adventure-grid';
          data.adventures.forEach((adventure) => {
            const button = createInlineAction(adventure.name, () => {
              state.explorerAdventureKey = adventure.key;
              openExplorerGateway();
            });
            button.classList.add('oling-lab-explorer-adventure-tile');
            button.dataset.badge = `${Math.max(
              0,
              Math.floor(Number(adventure.rewards?.opals) || 0)
            )} Opals`;
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
          try {
            const b = await adventureApi.returnOling(active?.runId);
            state.activeAdventure = null;
            getRoaming()?.returnFromAdventure?.(
              b.olingId,
              active?.doorPlacedId
            );
            setStatus(b.message);
            renderLab();
            refresh();
            playSound('economyReward');
          } catch (error) {
            setStatus(error.message || 'Adventure still in progress.');
            playSound('uiError');
          }
        };
        const activeTab = () => {
          if (usesSidePanel) setGatewayPanelHeaderAction();
          if (!active)
            return section(
              Object.assign(document.createElement('p'), {
                className: 'oling-lab-menu-empty',
                textContent: 'No Oling is currently away.'
              })
            );
          const scene = document.createElement('section');
          scene.className = 'oling-lab-active-adventure-scene';
          scene.style.backgroundImage = `url('/images/olings/lab/gui/backgrounds/adventures/${active.adventureKey}.jpg')`;
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
          if (!data.history.length) {
            if (usesSidePanel) setGatewayPanelHeaderAction();
            return section(
              Object.assign(document.createElement('p'), {
                className: 'oling-lab-menu-empty',
                textContent: 'Your discoveries will appear here.'
              })
            );
          }
          const entry = Number.isInteger(state.explorerDiscoveryIndex)
            ? data.history[state.explorerDiscoveryIndex]
            : null;
          if (entry) {
            const goBack = () => {
              state.explorerDiscoveryIndex = null;
              openExplorerGateway('Discoveries');
            };
            if (usesSidePanel)
              setGatewayPanelHeaderAction(goBack, 'Back to discoveries');
            const detail = document.createElement('section');
            detail.className =
              'oling-lab-explorer-adventure-detail is-discovery';
            const oling = data.olings.find(
              (item) => (item.id || item._id) === entry.olingId
            );
            const previewWindow = createDetailPreview(
              oling,
              entry.olingName || oling?.name || 'Oling'
            );
            const panels = document.createElement('div');
            panels.className = 'oling-lab-explorer-detail-panels';
            const adventurePanel = document.createElement('article');
            adventurePanel.className =
              'oling-lab-explorer-detail-card oling-lab-explorer-detail-adventure is-discovery';
            if (entry.adventureKey) {
              adventurePanel.style.backgroundImage = `linear-gradient(rgb(22 31 36 / 42%), rgb(22 31 36 / 42%)), url('/images/olings/lab/gui/backgrounds/adventures/${encodeURIComponent(entry.adventureKey)}.jpg')`;
            }
            const completed = document.createElement('div');
            completed.className = 'oling-lab-explorer-detail-completed';
            completed.append(
              Object.assign(document.createElement('span'), {
                textContent: 'Completed'
              }),
              Object.assign(document.createElement('strong'), {
                textContent: new Date(entry.completedAt).toLocaleDateString()
              })
            );
            adventurePanel.append(
              Object.assign(document.createElement('h3'), {
                textContent: entry.adventureName || 'Discovery'
              }),
              completed,
              createEnergyCost(entry.energyCost, 'Energy used'),
              createDuration(entry.durationMs || 0)
            );
            panels.append(
              adventurePanel,
              createRewardsPanel('Rewards found', entry.rewards)
            );
            if (!usesSidePanel) {
              const back = createInlineAction('Back', goBack, {
                soundIntent: 'previous'
              });
              back.classList.add('oling-lab-explorer-adventure-back');
              detail.appendChild(back);
            }
            detail.append(previewWindow, panels);
            return section(detail);
          }
          if (usesSidePanel) setGatewayPanelHeaderAction();
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
        const wasExpanded = usesSidePanel ? prepareGatewayPanel() : false;
        const createActionContent = (tab) => {
          let actions = [];
          if (tab.label === 'Active Adventure') {
            const action = createInlineAction('', returnOling, {
              sound: false
            });
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
            actions = [action];
          } else if (tab.label === 'Adventures' && state.explorerAdventureKey) {
            const adventure = data.adventures.find(
              (item) => item.key === state.explorerAdventureKey
            );
            if (adventure) {
              const headingToDoor =
                getRoaming()?.isHeadingToAdventure?.(selectedId);
              const selectedOling = data.olings.find(
                (oling) => String(oling.id || oling._id) === String(selectedId)
              );
              const availability = getAdventureAvailability(
                selectedOling,
                adventure
              );
              const action = createInlineAction(
                headingToDoor ? 'Cancel adventure' : 'Start adventure',
                () => start(adventure),
                {
                  disabled: !availability.canUseAction,
                  soundIntent: headingToDoor ? 'close' : 'confirm'
                }
              );
              action.title = availability.canUseAction
                ? ''
                : availability.message;
              action.classList.add('oling-lab-explorer-adventure-start');
              actions = [action];
            }
          } else if (tab.label === 'Overview') {
            const label = active
              ? 'View active adventure'
              : 'Choose an adventure';
            const action = createInlineAction(
              label,
              () =>
                openExplorerGateway(active ? 'Active Adventure' : 'Adventures'),
              { soundIntent: 'open' }
            );
            action.classList.add('oling-lab-gateway-overview-action');
            action.dataset.label = label;
            actions = [action];
          }
          if (usesSidePanel && elements.gatewayPanelFooter) {
            elements.gatewayPanelFooter.hidden = actions.length === 0;
          }
          return actions;
        };
        const tabMenu = createTabMenu(tabs, {
          initialLabel: initialTab,
          onActivate: (tab) => {
            state.explorerTabLabel = tab.label;
          },
          actionContent: createActionContent
        });
        if (usesSidePanel) {
          const tabList = tabMenu.querySelector(':scope > .oling-lab-tab-list');
          const actionArea = tabMenu.querySelector(
            ':scope > .oling-lab-container-action-area'
          );
          tabMenu.classList.add('has-external-tabs');
          elements.gatewayPanelTabs.replaceChildren(tabList);
          elements.gatewayPanelTabs.hidden = false;
          elements.gatewayPanelContent.replaceChildren(tabMenu);
          elements.gatewayPanelFooter.replaceChildren(actionArea);
          finishGatewayPanelOpen(wasExpanded);
        } else {
          openMenu('Explorer Gateway', [tabMenu], {
            theme: 'quests-adventures'
          });
        }
      } catch (error) {
        setStatus(error.message);
        playSound('uiError');
      }
    }

    return {
      openExplorerGateway,
      closeGatewayPanel
    };
  }

  window.createOlingLabExplorerGateway = createOlingLabExplorerGateway;
})();
