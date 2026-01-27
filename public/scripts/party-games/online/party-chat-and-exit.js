// party-chat-and-exit.js

// --- Chat HTTP helpers ---

async function sendPartyChat({ username = "[CONSOLE]", message, eventType = "message" }) {
  if (!message || !username) return;

  if (!partyCode) {
    CreateChatMessage("[CONSOLE]", "UNABLE TO SEND MESSAGE: NO PARTY CODE", "error", Date.now());
    return;
  }

  try {
    const response = await fetch(`/api/chat/${partyCode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, message, eventType })
    });

    const result = await response.json();
    if (result.success) {
      console.log("Message sent!");
      if (chatLogInput) chatLogInput.value = "";
    } else {
      console.error("Failed to send message:", result.error);
    }
  } catch (err) {
    console.error("Error sending chat message:", err);
  }
}

async function DeletePartyChat() {
  if (!partyCode) return;
  try {
    const res = await fetch(`/api/chat/${partyCode}`, { method: 'DELETE' });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error('Error deleting chat:', err);
  }
}

// --- Exit / unload handlers ---

function removeUserOnExit() {
  if (!partyCode) return;
  if (loadingPage) return;

  // Payload for waiting-room includes gamemode
  const waitingRoomPayload = {
    partyId: partyCode,
    computerIdToRemove: deviceId,
    gamemode: partyGameMode || undefined
  };

  // Payload for main session
  const sessionPayload = {
    partyId: partyCode,
    computerIdToRemove: deviceId
  };

  if (sessionPartyType === "waiting-room") {
    const blob = new Blob([JSON.stringify(waitingRoomPayload)], { type: "application/json" });
    const success = navigator.sendBeacon(`/api/waiting-room/remove-user`, blob);
    console.log("🚀 Beacon to waiting-room queued:", success, waitingRoomPayload);
  }

  const blobSession = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
  const successSession = navigator.sendBeacon(`/api/${sessionPartyType}/remove-user`, blobSession);
  console.log("🚀 Beacon to session queued:", successSession, sessionPayload);
}

function disconnectUserOnExit() {
  if (!partyCode || loadingPage) return;

  const sessionPayload = {
    partyId: partyCode,
    computerId: deviceId
  };

  const blobSession = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
  const successSession = navigator.sendBeacon(`/api/${sessionPartyType}/disconnect-user`, blobSession);
  console.log("🚀 Beacon to session queued:", successSession, sessionPayload);
}

// Use both visibilitychange and beforeunload for maximum reliability
window.addEventListener("beforeunload", disconnectUserOnExit);

function RemoveUserFromParty(computerIdToRemove) {
  let payload = {};
  if (partyCode && computerIdToRemove && loadingPage == false) {
    payload = { partyId: partyCode, computerIdToRemove };

    console.log("🚀 Sending beacon on unload:", payload);

    const data = JSON.stringify(payload);
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(`/api/${sessionPartyType}/remove-user`, blob);
  }
}
