// party-core.js
let hostDeviceId = '';
let hostedParty = false;
let waitingForHost = false;
let loadingPage = false;
let isPlaying = false;
let lastKnownPing = 0;
let onlineUsername = 'N/A';
var currentPartyData = null;
window.onlineGameUiReady = false;
window.pendingOnlineInstructionSync = false;
window.onlineInstructionSyncInFlight = false;
window.lastOnlineInstructionSnapshotSignature = null;

const { protocol, hostname } = window.location;
let socket;

function isAuthoritativePartyHost(partyData = currentPartyData) {
  const state = partyData?.state ?? partyData ?? {};
  const authoritativeHostId = state.hostComputerId ?? hostDeviceId;
  const currentDeviceId =
    typeof deviceId === 'undefined' ? null : deviceId;

  return Boolean(
    authoritativeHostId &&
    currentDeviceId &&
    String(authoritativeHostId) === String(currentDeviceId)
  );
}

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
