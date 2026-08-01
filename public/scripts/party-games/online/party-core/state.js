// party-core.js
let hostDeviceId = '';
let hostedParty = false;
let waitingForHost = false;
let loadingPage = false;
let isPlaying = false;
let lastKnownPing = 0;
let onlineUsername = 'N/A';
window.onlineGameUiReady = false;
window.pendingOnlineInstructionSync = false;
window.onlineInstructionSyncInFlight = false;
window.lastOnlineInstructionSnapshotSignature = null;

const { protocol, hostname } = window.location;
let socket;

let partyCode =
  window.location.pathname.match(
    /\/([A-Za-z0-9]{3}-[A-Za-z0-9]{3})(?:\/|$)/
  )?.[1] ??
  (() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryCode =
      searchParams.get('partyCode') || searchParams.get('party');
    return /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/.test(queryCode || '')
      ? queryCode
      : null;
  })();
