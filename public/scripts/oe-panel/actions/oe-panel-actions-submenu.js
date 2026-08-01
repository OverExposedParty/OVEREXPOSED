(function () {
  function createOePanelActionSubmenu(options) {
    const {
      container,
      widget,
      createActionBackHeader,
      showActionList,
      renderFormWidget,
      showCreatePackForm,
      showCreateOePackForm
    } = options;

    function showActionSubmenu(actionConfig) {
      const childActions = Array.isArray(actionConfig.actions)
        ? actionConfig.actions
        : [];
      const detailHeader = createActionBackHeader(
        actionConfig.label || 'Actions',
        'Back to actions',
        showActionList
      );
      const submenu = document.createElement('div');
      submenu.className = 'oe-panel-action-list';

      childActions.forEach((childActionConfig, childIndex) => {
        const button = document.createElement('button');
        button.className = 'oe-panel-action-button';
        button.type = 'button';
        button.textContent =
          childActionConfig.label || childActionConfig.value || 'Action';

        if (childActionConfig.value) {
          button.dataset.oePanelAction = `${childActionConfig.value}-${
            childIndex + 1
          }`;
        }

        if (childActionConfig.view === 'game-pack-create') {
          button.addEventListener('click', () => {
            showCreatePackForm(actionConfig);
          });
        }

        if (childActionConfig.view === 'oe-pack-create') {
          button.addEventListener('click', () => {
            showCreateOePackForm(actionConfig);
          });
        }

        if (childActionConfig.form) {
          button.addEventListener('click', () => {
            renderFormWidget(container, {
              ...childActionConfig.form,
              onBack: () => {
                container.replaceChildren(widget);
                showActionSubmenu(actionConfig);
              },
              onSuccess: () => {
                container.replaceChildren(widget);
                showActionList();
              }
            });
          });
        }

        if (childActionConfig.event) {
          button.addEventListener('click', () => {
            window.dispatchEvent(
              new CustomEvent(childActionConfig.event, {
                detail: {
                  container,
                  host: widget,
                  actionConfig: childActionConfig,
                  parentActionConfig: actionConfig,
                  restore: () => showActionSubmenu(actionConfig)
                }
              })
            );
          });
        }

        if (childActionConfig.targetSection && childActionConfig.targetGridId) {
          button.addEventListener('click', () => {
            window.dispatchEvent(
              new CustomEvent('oe-panel-section-link-request', {
                detail: {
                  section: childActionConfig.targetSection,
                  gridId: childActionConfig.targetGridId,
                  series: childActionConfig.series,
                  query: childActionConfig.query || ''
                }
              })
            );
          });
        } else if (childActionConfig.targetGridId) {
          button.addEventListener('click', () => {
            window.dispatchEvent(
              new CustomEvent('oe-panel-table-search-request', {
                detail: {
                  gridId: childActionConfig.targetGridId,
                  series: childActionConfig.series,
                  query: childActionConfig.query || ''
                }
              })
            );
          });
        }

        submenu.appendChild(button);
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-actions oe-panel-widget-action-list';
      widget.replaceChildren(detailHeader, submenu);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-shrink', { bubbles: true })
      );
    }

    return { showActionSubmenu };
  }

  window.createOePanelActionSubmenu = createOePanelActionSubmenu;
})();
