function setByPath(obj, path, value) {
  if (!obj || typeof obj !== "object") return obj;
  if (!path || typeof path !== "string") return obj;

  const keys = path.split(".").filter(Boolean);
  if (!keys.length) return obj;

  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const nextK = keys[i + 1];
    const nextIsIndex = String(+nextK) === nextK;

    if (cur[k] == null || typeof cur[k] !== "object") {
      cur[k] = nextIsIndex ? [] : {};
    }
    cur = cur[k];
  }

  cur[keys[keys.length - 1]] = value;
  return obj;
}

function scheduleFromExistingTimer({ timerValue, remainingMs = null, clearIcons = false, functionToCall = null, onFinish = null }) {
  const remaining = remainingMs != null
    ? Math.max(0, Number(remainingMs))
    : Math.max(0, Number(timerValue) - Date.now());

  if (playerTimeOut?.cancel) playerTimeOut.cancel();
  playerTimeOut = createCancelableTimeout(remaining);

  playerTimeOut.promise.then(async () => {
    if (clearIcons) ClearIcons();

    if (typeof functionToCall === "string") {
      const fn = functionToCall.split(".").reduce((a, k) => a?.[k], window);
      if (typeof fn === "function") await fn();
    }

    if (typeof onFinish === "function") await onFinish();
  });
}

function parseTimerMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === "object") {
    if (v.$date) return parseTimerMs(v.$date);
    if (v.seconds) return v.seconds * 1000;
    if (v._seconds) return v._seconds * 1000;
    if (typeof v.toDate === "function") return v.toDate().getTime();
  }
  return null;
}

async function setPlayerTimeout({ delay = 0, clearIcons = false, playerTimer = null, functionToCall = null }) {
  if (delay == null || !playerTimer) return;

  const players = currentPartyData?.players || [];
  const player = players.find(p => p?.identity?.computerId === deviceId);
  if (!player) return;

  const timerValueMs = Date.now() + Number(delay);
  const timerValue = new Date(timerValueMs).toISOString();

  setByPath(player, playerTimer, timerValue);

  const updatedPartyAfterTimerStart = await performOnlinePartyAction({
    action: 'sync-party-state',
    payload: {
      playerUpdates: [player]
    }
  });

  if (updatedPartyAfterTimerStart) {
    currentPartyData = updatedPartyAfterTimerStart;
  }

  if (playerTimeOut?.cancel) playerTimeOut.cancel();
  playerTimeOut = createCancelableTimeout(timerValueMs - Date.now());

  await playerTimeOut.promise;

  if (clearIcons) ClearIcons();

  if (typeof functionToCall === "string") {
    const fn = functionToCall.split(".").reduce((a, k) => a?.[k], window);
    if (typeof fn === "function") await fn();
  }

  setByPath(player, playerTimer, null);

  const updatedPartyAfterTimerEnd = await performOnlinePartyAction({
    action: 'sync-party-state',
    payload: {
      playerUpdates: [player]
    }
  });

  if (updatedPartyAfterTimerEnd) {
    currentPartyData = updatedPartyAfterTimerEnd;
  }
}

function startPhaseContainerTimer({ remainingMs, durationMs, timerSelector }) {
  if (!timerSelector || remainingMs <= 0) return;

  startTimer({
    timeLeft: remainingMs / 1000,
    duration: durationMs / 1000,
    selectedTimer: timerSelector,
  });
}
