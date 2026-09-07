(function () {
  function createOlingLabAdventureApi() {
    async function request(pathname, options = {}) {
      const response = await fetch(pathname, {
        headers: { Accept: 'application/json' },
        ...options
      });
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error?.message || 'Adventure request failed.');
      }
      return payload;
    }
    return {
      loadGateway: () => request('/api/olings/adventures'),
      returnOling: (runId) =>
        request('/api/olings/adventures/return', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ runId })
        })
    };
  }
  window.createOlingLabAdventureApi = createOlingLabAdventureApi;
})();
