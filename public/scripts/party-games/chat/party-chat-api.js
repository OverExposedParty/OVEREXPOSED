(function () {
  function getPartyCode() {
    if (window.partyCode) return window.partyCode;
    if (typeof partyCode !== 'undefined') return partyCode;
    return null;
  }

  async function getChatLog() {
    const currentPartyCode = getPartyCode();
    if (!currentPartyCode) return { chat: [] };

    const response = await fetch(`/api/chat/${currentPartyCode}`);
    const existingData = await response.json();
    return existingData.data ?? existingData;
  }

  async function sendMessage({
    username = '[CONSOLE]',
    message,
    eventType = 'message'
  }) {
    const currentPartyCode = getPartyCode();
    if (!message || !username) return { success: false };

    if (!currentPartyCode) {
      return {
        success: false,
        error: 'NO_PARTY_CODE'
      };
    }

    const response = await fetch(`/api/chat/${currentPartyCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, message, eventType })
    });

    return response.json();
  }

  async function deleteChat() {
    const currentPartyCode = getPartyCode();
    if (!currentPartyCode) return { success: false };

    const response = await fetch(`/api/chat/${currentPartyCode}`, {
      method: 'DELETE'
    });
    return response.json();
  }

  window.PartyChatApi = {
    getChatLog,
    sendMessage,
    deleteChat
  };
})();
