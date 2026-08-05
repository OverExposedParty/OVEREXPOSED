(function () {
  function createOePanelTableExpandedRow(context) {
    const palettes = window.OE_PANEL_PALETTES;
    const {
      gridConfig,
      container,
      activeRowIndexes,
      editingRows,
      displayRows,
      getEditableRowKey,
      getRowValue,
      getRowSaveEndpoint,
      getRowActionEndpoint,
      isEditableField,
      renderTableRows
    } = context;

    function createExpandedContent(rowConfig, rowIndex) {
      const panel = document.createElement('div');
      panel.className = 'oe-panel-data-table-expanded-panel';
      const editableRowKey = getEditableRowKey(rowConfig, rowIndex);
      const isEditing = editingRows.has(editableRowKey);

      const details = document.createElement('dl');
      details.className = 'oe-panel-data-table-expanded-details';
      const rowDetails =
        rowConfig.details && typeof rowConfig.details === 'object'
          ? rowConfig.details
          : {};
      const configuredFields = Array.isArray(gridConfig.expandedFields)
        ? gridConfig.expandedFields
        : [];
      const fallbackFields = Object.keys(rowDetails).length
        ? Object.keys(rowDetails).map((key) => ({ key }))
        : [
            {
              key: 'recordId',
              label: 'Record ID',
              value: `${gridConfig.id}-${rowIndex + 1}`
            },
            { key: 'roomCode', label: 'Room Code' },
            { key: 'roomStatus', label: 'Status' }
          ];
      const expandedFields = configuredFields.length
        ? configuredFields
        : fallbackFields;
      let currentSection = '';

      function getCollapsedText(value, maxLength = 180) {
        const text = String(value || '').trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, maxLength - 1).trim()}...`;
      }

      function toDateTimeLocalValue(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        const pad = (number) => String(number).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
          date.getDate()
        )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
          date.getSeconds()
        )}`;
      }

      expandedFields.forEach((fieldConfig) => {
        if (fieldConfig.section && fieldConfig.section !== currentSection) {
          currentSection = fieldConfig.section;
          const sectionTitle = document.createElement('h4');
          sectionTitle.className = 'oe-panel-data-table-expanded-section';
          sectionTitle.textContent = currentSection;
          details.appendChild(sectionTitle);
        }
        const key = fieldConfig.key || fieldConfig.valueKey;
        const label = fieldConfig.label || key || 'Extra Information';
        const value =
          rowConfig[key] ?? rowDetails[key] ?? fieldConfig.value ?? '-';
        const detailGroup = document.createElement('div');
        detailGroup.className = 'oe-panel-data-table-expanded-detail';
        if (key) {
          detailGroup.dataset.oePanelExpandedField = key;
        }

        const term = document.createElement('dt');
        term.textContent = label;

        const description = document.createElement('dd');
        const paletteValue = !isEditing
          ? palettes?.createValue({
              value,
              row: rowConfig,
              fieldConfig,
              dataSource: gridConfig.dataSource
            })
          : null;
        if (isEditing && isEditableField(fieldConfig)) {
          if (fieldConfig.inputType === 'select') {
            const select = document.createElement('select');
            select.className = 'oe-panel-data-table-expanded-input';
            select.dataset.oePanelEditField = key;
            select.setAttribute('aria-label', `Edit ${label}`);
            (fieldConfig.options || []).forEach((optionValue) => {
              const option = document.createElement('option');
              option.value = optionValue;
              option.textContent = String(optionValue)
                .replace(/-/g, ' ')
                .replace(/\b\w/g, (character) => character.toUpperCase());
              select.appendChild(option);
            });
            select.value = value === '-' ? '' : String(value).toLowerCase();
            const selectPalette = palettes?.inferConfig(
              fieldConfig,
              gridConfig.dataSource
            );
            if (selectPalette?.type) {
              palettes.decorateSelect(select, selectPalette.type);
            }
            description.appendChild(select);
          } else {
            const input = document.createElement('input');
            input.className = 'oe-panel-data-table-expanded-input';
            input.type = 'text';
            input.value = value === '-' ? '' : String(value);
            input.dataset.oePanelEditField = key;
            if (fieldConfig.inputType) {
              input.dataset.oePanelInputType = fieldConfig.inputType;
            }
            input.setAttribute('aria-label', `Edit ${label}`);
            const paletteConfig = palettes?.inferConfig(
              fieldConfig,
              gridConfig.dataSource
            );
            if (paletteConfig?.type && paletteConfig.type !== 'colour') {
              palettes.decorateSelect(input, paletteConfig.type);
            }
            description.appendChild(
              paletteConfig?.type === 'colour'
                ? palettes.createColourInput(input)
                : input
            );
          }
        } else if (paletteValue) {
          description.appendChild(paletteValue);
        } else if (fieldConfig.expandable) {
          const fullText = String(value || '-');
          const collapsedText = getCollapsedText(
            fullText,
            fieldConfig.collapsedLength
          );
          const text = document.createElement('span');
          text.className = 'oe-panel-data-table-expanded-text';
          text.textContent = collapsedText || '-';
          description.appendChild(text);

          if (fullText !== collapsedText) {
            const toggle = document.createElement('button');
            toggle.className = 'oe-panel-data-table-expanded-text-toggle';
            toggle.type = 'button';
            toggle.setAttribute('aria-label', 'Expand excerpt');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.addEventListener('click', () => {
              const isExpanded =
                toggle.getAttribute('aria-expanded') === 'true';
              toggle.setAttribute('aria-expanded', String(!isExpanded));
              toggle.setAttribute(
                'aria-label',
                isExpanded ? 'Expand excerpt' : 'Collapse excerpt'
              );
              text.textContent = isExpanded ? collapsedText : fullText;
              detailGroup.classList.toggle('expanded-text', !isExpanded);
            });
            description.appendChild(toggle);
          }
        } else {
          description.textContent = value;
        }

        detailGroup.append(term, description);
        details.appendChild(detailGroup);
      });

      if (isEditing) {
        const modeInput = details.querySelector(
          '[data-oe-panel-edit-field="availabilityMode"]'
        );
        const timeZoneInput = details.querySelector(
          '[data-oe-panel-input-type="availability-timezone"]'
        );
        const boundaryInputs = Array.from(
          details.querySelectorAll(
            '[data-oe-panel-input-type="availability-boundary"]'
          )
        );

        function configureAvailabilityInputs({ reset = false } = {}) {
          if (!modeInput) return;
          const mode = modeInput.value;
          if (timeZoneInput) timeZoneInput.disabled = mode !== 'annual';
          boundaryInputs.forEach((input) => {
            const previousMode = input.dataset.oePanelAvailabilityMode;
            if (reset && previousMode && previousMode !== mode) {
              input.value = '';
            }
            input.disabled = mode === 'always';
            input.type = mode === 'fixed' ? 'datetime-local' : 'text';
            input.step = mode === 'fixed' ? '1' : '';
            input.placeholder = mode === 'annual' ? 'XXXX-MM-DDTHH:mm:ss' : '';
            if (mode === 'fixed' && input.value) {
              input.value = toDateTimeLocalValue(input.value);
            }
            input.dataset.oePanelAvailabilityMode = mode;
          });
        }

        configureAvailabilityInputs();
        modeInput?.addEventListener('change', () => {
          configureAvailabilityInputs({ reset: true });
        });
      }

      const rowActions = (
        gridConfig.editable === true
          ? [
              {
                label: isEditing ? 'Save' : 'Edit',
                action: isEditing ? 'save' : 'edit'
              },
              ...(Array.isArray(gridConfig.rowActions)
                ? gridConfig.rowActions.filter(
                    (actionConfig) =>
                      !['edit', 'save'].includes(
                        actionConfig.action || actionConfig.value
                      )
                  )
                : [])
            ]
          : Array.isArray(gridConfig.rowActions)
            ? gridConfig.rowActions
            : [
                { label: 'Archive', action: 'archive' },
                { label: 'Delete', action: 'delete' }
              ]
      ).filter((actionConfig) => {
        const condition = actionConfig.hiddenWhen;
        return !(
          condition?.key && rowConfig[condition.key] === condition.equals
        );
      });

      async function saveEditableRow(button) {
        const endpoint = getRowSaveEndpoint(rowConfig);
        if (!endpoint) {
          window.alert('This field cannot be saved to the database yet.');
          return;
        }

        const values = {};
        details
          .querySelectorAll('[data-oe-panel-edit-field]')
          .forEach((input) => {
            if (input.disabled) return;
            let value = input.value.trim();
            if (
              input.dataset.oePanelInputType === 'availability-boundary' &&
              input.dataset.oePanelAvailabilityMode === 'fixed' &&
              value
            ) {
              value = new Date(value).toISOString();
            }
            values[input.dataset.oePanelEditField] = value;
          });
        const changedValues = Object.fromEntries(
          Object.entries(values).filter(([key, value]) => {
            const currentValue = getRowValue(rowConfig, key);
            const normalisedCurrentValue =
              currentValue === '-' ? '' : String(currentValue || '').trim();
            return value !== normalisedCurrentValue;
          })
        );

        if (!Object.keys(changedValues).length) {
          editingRows.delete(editableRowKey);
          renderTableRows();
          return;
        }

        if (
          !window.confirm('Are you sure you want to save this edited field?')
        ) {
          return;
        }

        button.disabled = true;

        try {
          const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(changedValues)
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload.success === false) {
            throw new Error(
              payload?.error?.message || 'This field could not be saved.'
            );
          }

          const updatedRow =
            payload.data?.row || payload.data?.config || changedValues;
          Object.assign(rowConfig, updatedRow);
          if (updatedRow.updatedAt) {
            rowConfig.updatedAtLabel = new Date(
              updatedRow.updatedAt
            ).toLocaleString();
          }
          if (gridConfig.dataSource === 'socialMediaContent') {
            window.dispatchEvent(
              new CustomEvent('oe-panel-social-content-created')
            );
          }
          if (
            ['partyPacks', 'partyRules', 'partyRoles'].includes(
              gridConfig.dataSource
            )
          ) {
            const itemTypeBySource = {
              partyPacks: 'pack',
              partyRules: 'rule',
              partyRoles: 'role'
            };
            window.dispatchEvent(
              new CustomEvent('oe-panel-gamemode-settings-alert', {
                detail: {
                  action: 'updated',
                  itemType: itemTypeBySource[gridConfig.dataSource],
                  title:
                    updatedRow.title ||
                    updatedRow.rule ||
                    updatedRow.role ||
                    rowConfig.title ||
                    rowConfig.rule ||
                    rowConfig.role,
                  gamemode: updatedRow.gamemode || rowConfig.gamemode,
                  changes: changedValues
                }
              })
            );
          }
          if (
            ['oeCustomisationPacks', 'oeCustomisationImages'].includes(
              gridConfig.dataSource
            )
          ) {
            window.dispatchEvent(
              new CustomEvent('oe-panel-oe-customisation-data-changed')
            );
          }
          if (['olingEggs', 'olingTraits'].includes(gridConfig.dataSource)) {
            window.dispatchEvent(
              new CustomEvent('oe-panel-olings-data-changed')
            );
          }
          if (gridConfig.dataSource === 'shopProducts') {
            window.dispatchEvent(
              new CustomEvent('oe-panel-shop-products-changed')
            );
          }
          if (gridConfig.dataSource === 'emailTemplates') {
            window.OE_PANEL_DATA?.clear?.('emailTemplates');
          }
          window.dispatchEvent(
            new CustomEvent('oe-panel-admin-logs-data-changed')
          );
          editingRows.delete(editableRowKey);
          renderTableRows();
        } catch (error) {
          window.alert(error.message || 'This field could not be saved.');
        } finally {
          button.disabled = false;
        }
      }

      async function deleteRow(button) {
        const endpoint = getRowActionEndpoint('delete', rowConfig);
        if (!endpoint) {
          window.alert('This row cannot be deleted from the database yet.');
          return;
        }

        if (
          !window.confirm(
            gridConfig.deleteConfirmMessage ||
              'Are you sure you want to delete this row?'
          )
        ) {
          return;
        }

        button.disabled = true;

        try {
          const response = await fetch(endpoint, { method: 'DELETE' });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload.success === false) {
            throw new Error(
              payload?.error?.message || 'This row could not be deleted.'
            );
          }

          if (
            ['partyPacks', 'partyRules', 'partyRoles'].includes(
              gridConfig.dataSource
            )
          ) {
            const itemTypeBySource = {
              partyPacks: 'pack',
              partyRules: 'rule',
              partyRoles: 'role'
            };
            window.dispatchEvent(
              new CustomEvent('oe-panel-gamemode-settings-alert', {
                detail: {
                  action: 'deleted',
                  itemType: itemTypeBySource[gridConfig.dataSource],
                  title: rowConfig.title || rowConfig.rule || rowConfig.role,
                  gamemode: rowConfig.gamemode
                }
              })
            );
          }
          if (
            ['oeCustomisationPacks', 'oeCustomisationImages'].includes(
              gridConfig.dataSource
            )
          ) {
            window.dispatchEvent(
              new CustomEvent('oe-panel-oe-customisation-data-changed')
            );
          }
          if (['olingEggs', 'olingTraits'].includes(gridConfig.dataSource)) {
            window.dispatchEvent(
              new CustomEvent('oe-panel-olings-data-changed')
            );
          }
          if (gridConfig.dataSource === 'shopProducts') {
            window.dispatchEvent(
              new CustomEvent('oe-panel-shop-products-changed')
            );
          }
          if (gridConfig.dataSource === 'emailTemplates') {
            window.OE_PANEL_DATA?.clear?.('emailTemplates');
          }
          if (gridConfig.dataSource === 'emailAutomations') {
            window.dispatchEvent(
              new CustomEvent('oe-panel-email-automations-changed')
            );
          }
          if (gridConfig.dataSource === 'emailAudiences') {
            window.dispatchEvent(
              new CustomEvent('oe-panel-email-audiences-changed')
            );
          }
          if (gridConfig.dataSource === 'emailSuppressions') {
            window.dispatchEvent(
              new CustomEvent('oe-panel-email-suppressions-changed')
            );
          }
          window.dispatchEvent(
            new CustomEvent('oe-panel-admin-logs-data-changed')
          );
          displayRows.splice(rowIndex, 1);
          activeRowIndexes.clear();
          renderTableRows();
        } catch (error) {
          window.alert(error.message || 'This row could not be deleted.');
        } finally {
          button.disabled = false;
        }
      }

      function runRowAction(action, button) {
        if (action === 'edit') {
          editingRows.add(editableRowKey);
          renderTableRows();
          return;
        }

        if (action === 'save') {
          saveEditableRow(button);
          return;
        }

        if (action === 'archive') {
          rowConfig.archived = true;
          rowConfig.archivedAt = new Date().toLocaleString();
          rowConfig.status = 'Archived';
          activeRowIndexes.delete(rowIndex);
          renderTableRows();
        }

        if (action === 'delete') {
          deleteRow(button);
          return;
        }

        container.dispatchEvent(
          new CustomEvent('oe-panel-table-row-action', {
            bubbles: true,
            detail: { action, row: rowConfig, rowIndex, gridId: gridConfig.id }
          })
        );
      }

      panel.appendChild(details);

      if (rowActions.length) {
        const actionContainer = document.createElement('div');
        actionContainer.className = 'oe-panel-data-table-expanded-actions';

        rowActions.forEach((actionConfig) => {
          const button = document.createElement('button');
          const disabledCondition = actionConfig.disabledWhen;
          const isDisabled = Boolean(
            disabledCondition?.key &&
            rowConfig[disabledCondition.key] === disabledCondition.equals
          );
          button.className = 'oe-panel-data-table-expanded-action';
          button.type = 'button';
          button.disabled = isDisabled;
          button.textContent =
            actionConfig.label || actionConfig.action || 'Action';
          button.dataset.oePanelTableAction =
            actionConfig.action || actionConfig.value || button.textContent;
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            runRowAction(button.dataset.oePanelTableAction, button);
          });
          const disabledTooltip = isDisabled
            ? rowConfig[actionConfig.disabledTitleKey] ||
              actionConfig.disabledTitle ||
              ''
            : '';
          if (disabledTooltip) {
            const tooltip = document.createElement('span');
            tooltip.className = 'oe-panel-data-table-expanded-action-tooltip';
            tooltip.dataset.tooltip = disabledTooltip;
            tooltip.title = disabledTooltip;
            tooltip.tabIndex = 0;
            tooltip.setAttribute(
              'aria-label',
              `${button.textContent}: ${disabledTooltip}`
            );
            tooltip.appendChild(button);
            actionContainer.appendChild(tooltip);
          } else {
            actionContainer.appendChild(button);
          }
        });

        panel.appendChild(actionContainer);
      }

      return panel;
    }

    return createExpandedContent;
  }

  window.createOePanelTableExpandedRow = createOePanelTableExpandedRow;
})();
