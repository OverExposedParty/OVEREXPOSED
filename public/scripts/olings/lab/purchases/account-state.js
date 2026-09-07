(function () {
  function createOlingLabAccountState({ state }) {
    function syncAccountPayload(payload) {
      if (!payload?.account) return;
      state.account = payload.account;
      localStorage.setItem('oe-account', JSON.stringify(payload.account));
      window.dispatchEvent(
        new CustomEvent('oe-account-state-changed', {
          detail: { account: payload.account }
        })
      );
    }
    return { syncAccountPayload };
  }
  window.createOlingLabAccountState = createOlingLabAccountState;
})();
