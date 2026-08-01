(function () {
  function createOePanelActionAdminForms(options) {
    const { container, widget, createActionBackHeader, showActionList, createPackFormField } = options;

  function showAdminLogFilterForm() {
    const detailHeader = createActionBackHeader(
      'Filter Audit',
      'Back to log tools',
      showActionList
    );
    const form = document.createElement('form');
    form.className =
      'oe-panel-social-edit-panels oe-panel-social-idea-form oe-panel-game-pack-form';
    const areaField = createPackFormField('Area', 'area', {
      placeholder: 'OE Customisation'
    });
    const actionField = createPackFormField('Action', 'action', {
      placeholder: 'Deleted'
    });
    const adminField = createPackFormField('Admin', 'admin', {
      placeholder: 'Development'
    });
    const targetField = createPackFormField('Target', 'target', {
      placeholder: 'A003'
    });
    const resultField = createPackFormField('Result', 'result', {
      options: [
        { label: 'Any', value: '' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' }
      ]
    });
    const severityField = createPackFormField('Severity', 'severity', {
      options: [
        { label: 'Any', value: '' },
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' }
      ]
    });
    const dateField = createPackFormField('Date', 'date', {
      placeholder: 'YYYY-MM-DD'
    });
    dateField.input.type = 'date';
  
    const firstRow = document.createElement('div');
    firstRow.className = 'oe-panel-game-pack-form-row is-three-column';
    firstRow.append(areaField.field, resultField.field, severityField.field);
  
    const secondRow = document.createElement('div');
    secondRow.className = 'oe-panel-game-pack-form-row is-three-column';
    secondRow.append(adminField.field, targetField.field, dateField.field);
  
    const filterButton = document.createElement('button');
    filterButton.className = 'oe-panel-social-edit-save';
    filterButton.type = 'submit';
    filterButton.textContent = 'Apply Filter';
  
    form.append(firstRow, actionField.field, secondRow, filterButton);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const query = [
        ['area', formData.get('area')],
        ['action', formData.get('action')],
        ['admin', formData.get('admin')],
        ['target', formData.get('target')],
        ['result', formData.get('result')],
        ['severity', formData.get('severity')],
        ['date', formData.get('date')]
      ]
        .filter(([, value]) => String(value || '').trim())
        .map(([field, value]) => `[${field}:${String(value).trim()}]`)
        .join(' ');
  
      window.dispatchEvent(
        new CustomEvent('oe-panel-table-search-request', {
          detail: {
            gridId: 'admin-logs-grid-1',
            query
          }
        })
      );
    });
  
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view oe-panel-game-pack-create-view';
    widget.replaceChildren(detailHeader, form);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-expand', { bubbles: true })
    );
  }
  
  function showAdminLogArchiveForm() {
    const detailHeader = createActionBackHeader(
      'Archive Logs',
      'Back to log tools',
      showActionList
    );
    const form = document.createElement('form');
    form.className =
      'oe-panel-social-edit-panels oe-panel-social-idea-form oe-panel-game-pack-form';
    const daysField = createPackFormField('Archive Older Than Days', 'days', {
      required: true,
      value: '90',
      inputMode: 'numeric',
      title: 'Choose a value from 7 to 3650 days.'
    });
    daysField.input.type = 'number';
    daysField.input.min = '7';
    daysField.input.max = '3650';
    daysField.input.step = '1';
  
    const archiveButton = document.createElement('button');
    archiveButton.className = 'oe-panel-social-edit-save';
    archiveButton.type = 'submit';
    archiveButton.textContent = 'Archive Logs';
  
    form.append(daysField.field, archiveButton);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const days = Number(daysField.input.value);
      if (!Number.isFinite(days) || days < 7 || days > 3650) {
        window.alert('Choose a value from 7 to 3650 days.');
        return;
      }
  
      if (
        !window.confirm(
          `Archive admin logs older than ${days} days? Archived logs will be hidden from the panel.`
        )
      ) {
        return;
      }
  
      const originalText = archiveButton.textContent;
      archiveButton.disabled = true;
      archiveButton.textContent = 'Archiving...';
  
      try {
        const response = await fetch('/api/oe-panel/admin-logs/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.success === false) {
          throw new Error(
            payload?.error?.message || 'Logs could not be archived.'
          );
        }
  
        archiveButton.textContent = payload.data?.message || 'Archived logs.';
        window.dispatchEvent(
          new CustomEvent('oe-panel-admin-logs-data-changed')
        );
        window.setTimeout(showActionList, 1400);
      } catch (error) {
        window.alert(error.message || 'Logs could not be archived.');
        archiveButton.textContent = originalText;
        archiveButton.disabled = false;
      }
    });
  
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-social-creation oe-panel-social-action-view oe-panel-social-idea-create-view oe-panel-game-pack-create-view';
    widget.replaceChildren(detailHeader, form);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-expand', { bubbles: true })
    );
  }
  

    return { showAdminLogFilterForm, showAdminLogArchiveForm };
  }

  window.createOePanelActionAdminForms = createOePanelActionAdminForms;
})();
