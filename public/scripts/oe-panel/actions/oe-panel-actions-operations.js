(function () {
  function createOePanelActionOperations(options) {
    const { fetchGamemodeSettingsAlerts } = options;

  async function runEndpointAction(actionConfig, button) {
    const endpoint = actionConfig.endpoint;
    if (!endpoint) return;
  
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Working...';
  
    try {
      const response = await fetch(endpoint, {
        method: actionConfig.method || 'POST'
      });
      const payload = await response.json().catch(() => ({}));
  
      if (!response.ok || payload.success === false) {
        throw new Error(payload?.error?.message || 'Action failed.');
      }
  
      const message =
        payload.data?.message || actionConfig.successMessage || 'Done.';
      button.textContent = message;
      await fetchGamemodeSettingsAlerts();
      await fetchGamemodeSettingsAlerts('export-needed');
      window.dispatchEvent(
        new CustomEvent('oe-panel-admin-logs-data-changed')
      );
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1400);
    } catch (error) {
      window.alert(error.message || 'Action failed.');
      button.textContent = originalText;
      button.disabled = false;
    }
  }
  
  async function runDownloadAction(actionConfig, button) {
    const endpoint = actionConfig.downloadEndpoint;
    if (!endpoint) return;
  
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Exporting...';
  
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || 'Export failed.');
      }
  
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const filename =
        disposition.match(/filename="([^"]+)"/i)?.[1] || 'export.json';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
  
      button.textContent = 'Exported';
      window.dispatchEvent(
        new CustomEvent('oe-panel-admin-logs-data-changed')
      );
      window.setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 1400);
    } catch (error) {
      window.alert(error.message || 'Export failed.');
      button.textContent = originalText;
      button.disabled = false;
    }
  }
  

    return { runEndpointAction, runDownloadAction };
  }

  window.createOePanelActionOperations = createOePanelActionOperations;
})();
