const DEFAULT_PARTY_ROOM_INACTIVITY_SECONDS = 1200;

function getConfiguredInactivitySeconds() {
  const configured = Number(
    process.env.PARTY_ROOM_INACTIVITY_SECONDS ||
      process.env.PARTY_ROOM_ARCHIVE_AFTER_SECONDS
  );
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_PARTY_ROOM_INACTIVITY_SECONDS;
}

const PARTY_ROOM_INACTIVITY_SECONDS = getConfiguredInactivitySeconds();
const PARTY_ROOM_INACTIVITY_MS = PARTY_ROOM_INACTIVITY_SECONDS * 1000;

function toTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getPartyRoomLastActivity(room) {
  const timestamps = [
    room?.state?.lastPinged,
    room?.lastPinged,
    room?.session?.createdAt
  ]
    .map(toTimestamp)
    .filter((value) => value != null);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
}

function getPartyRoomActiveSince(now = Date.now()) {
  const currentTimestamp = toTimestamp(now) ?? Date.now();
  return new Date(currentTimestamp - PARTY_ROOM_INACTIVITY_MS);
}

function isPartyRoomActive(room, now = Date.now()) {
  const lastActivity = getPartyRoomLastActivity(room);
  if (lastActivity == null) return false;
  return lastActivity > getPartyRoomActiveSince(now).getTime();
}

function isPartyRoomExpired(room, now = Date.now()) {
  return !isPartyRoomActive(room, now);
}

module.exports = {
  DEFAULT_PARTY_ROOM_INACTIVITY_SECONDS,
  PARTY_ROOM_INACTIVITY_MS,
  PARTY_ROOM_INACTIVITY_SECONDS,
  getPartyRoomActiveSince,
  getPartyRoomLastActivity,
  isPartyRoomActive,
  isPartyRoomExpired
};
