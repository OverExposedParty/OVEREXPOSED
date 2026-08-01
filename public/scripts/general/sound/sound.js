(function initialiseOEAudio() {
    const STORAGE_KEYS = {
        enabled: 'settings-sound',
        masterVolume: 'settings-sound-volume'
    };
    const GROUP_STORAGE_KEYS = Object.freeze({
        ui: 'settings-sound-volume-ui',
        notifications: 'settings-sound-volume-notifications',
        'party-games': 'settings-sound-volume-game',
        overexposure: 'settings-sound-volume-game',
        olings: 'settings-sound-volume-game'
    });

    const DEFAULT_GROUP = 'ui';
    const DEFAULT_LANE = 'foreground';
    const PLAYBACK_PRIORITIES = Object.freeze({
        background: 0,
        timerWarning: 10,
        ui: 20,
        notification: 30,
        normal: 40,
        confirmation: 50,
        importantNotification: 55,
        timerExpired: 60,
        phase: 70,
        voice: 80,
        critical: 100
    });
    const CONFLICT_POLICIES = new Set(['drop', 'interrupt', 'queue-latest']);
    const GROUP_PLAYBACK_DEFAULTS = Object.freeze({
        ui: Object.freeze({ priority: 'ui', conflictPolicy: 'interrupt' }),
        notifications: Object.freeze({
            priority: 'notification',
            conflictPolicy: 'drop'
        }),
        'party-games': Object.freeze({
            priority: 'normal',
            conflictPolicy: 'queue-latest'
        })
    });
    const PLAYBACK_END_FALLBACK_MS = 30000;
    const definitions = new Map();
    const preloadedAudio = new Map();
    const groupVolumes = new Map();
    const activeAudio = new Map();
    const lastPlayedAt = new Map();
    const activeLaneRequests = new Map();
    const queuedLaneRequests = new Map();
    let nextLaneRequestId = 1;

    function emitAudioDebug(level, category, message, details) {
        try {
            const logger = window.OEDebug?.[level];
            if (typeof logger === 'function') {
                logger.call(window.OEDebug, category, message, details);
            }
        } catch {
            // Debug instrumentation must never affect the audio path.
        }
    }

    function logPlaybackSkipped(key, reason, details = {}) {
        emitAudioDebug('info', 'audio.playback', 'Playback skipped.', {
            event: 'skipped',
            reason,
            key: key || null,
            ...details
        });
    }

    function getRequestKeys(request) {
        if (Array.isArray(request?.items)) {
            return request.items.map((item) => item.key);
        }
        return [request?.key || null];
    }

    function logRequestSkipped(request, reason, details = {}) {
        if (!request || request.skipLogged) return;
        request.skipLogged = true;
        getRequestKeys(request).forEach((key) => {
            logPlaybackSkipped(key, reason, {
                requestId: request.id,
                lane: request.lane,
                priority: request.priority,
                ...details
            });
        });
    }

    function logRemainingSequenceItemsSkipped(request, reason) {
        if (!Array.isArray(request?.items) || request.skipLogged) return;
        const firstSkippedIndex = request.playback
            ? (request.currentItemIndex ?? -1) + 1
            : request.currentItemIndex ?? 0;
        const skippedItems = request.items.slice(firstSkippedIndex);
        if (!skippedItems.length) return;

        request.skipLogged = true;
        skippedItems.forEach((item) => {
            logPlaybackSkipped(item.key, reason, {
                requestId: request.id,
                lane: request.lane,
                priority: request.priority,
                sequence: true
            });
        });
    }

    const INTERACTION_SOUNDS = Object.freeze({
        select: 'uiSelect',
        deselect: 'uiDeselect',
        confirm: 'uiConfirm',
        success: 'uiSuccess',
        error: 'uiError',
        warning: 'uiWarning',
        increase: 'uiIncrease',
        decrease: 'uiDecrease',
        previous: 'uiPrevious',
        next: 'uiNext',
        scroll: 'uiScroll',
        enabled: 'uiToggleEnabled',
        disabled: 'uiToggleDisabled',
        open: 'containerOpen',
        close: 'containerClose'
    });

    const INTERACTION_SOUND_RULES = [
        {
            selector: '.sound-toggle, .button-toggle',
            resolveIntent: (control) => isControlSelected(control) ? 'deselect' : 'select'
        },
        {
            selector: '.sound-option',
            resolveIntent: (control) => isControlSelected(control) ? null : 'select'
        },
        {
            selector: '.sound-confirm',
            intent: 'confirm'
        },
        {
            selector: [
                '[role="tab"]',
                '.settings-tab',
                '.account-friends-tab',
                '.account-purchase-tab',
                '.oling-lab-tab',
                '.oe-panel-sidebar-button',
                '.game-over-tab'
            ].join(', '),
            resolveIntent: (control) => isControlSelected(control) ? null : 'select'
        },
        {
            selector: '.count-btn',
            resolveIntent: (control) => {
                if (control.classList.contains('increment')) return 'increase';
                if (control.classList.contains('decrement')) return 'decrease';
                return null;
            }
        },
        {
            selector: '.oe-panel-calendar-nav-button',
            resolveIntent: (control) => {
                const label = control.getAttribute('aria-label') || '';
                if (label.startsWith('Previous')) return 'previous';
                if (label.startsWith('Next')) return 'next';
                return null;
            }
        },
        {
            selector: '.oling-lab-scroll',
            intent: 'scroll'
        },
        {
            selector: [
                '#delete-post-button',
                '.oling-battle-lobby-kick',
                '.danger',
                '.is-danger'
            ].join(', '),
            intent: 'warning'
        },
        {
            selector: [
                '.start-game-warning-button',
                '.ready-up',
                '#late-join-game-button',
                '.oling-battle-lobby-ready'
            ].join(', '),
            intent: 'confirm'
        },
        {
            selector: [
                '.select-button',
                '.question-button',
                '.player-button',
                '.player-board-button',
                '.oe-panel-player-lookup-option'
            ].join(', '),
            intent: 'select'
        }
    ];

    let enabled = localStorage.getItem(STORAGE_KEYS.enabled) !== 'false';
    const storedMasterVolume = localStorage.getItem(STORAGE_KEYS.masterVolume);
    let masterVolume = clampVolume(storedMasterVolume, 1);
    if (storedMasterVolume !== null && masterVolume === 0) {
        masterVolume = 1;
        localStorage.setItem(STORAGE_KEYS.masterVolume, '1');
    }
    let hasUserInteracted = false;
    let unlockAttempted = false;

    Object.entries(GROUP_STORAGE_KEYS).forEach(([group, storageKey]) => {
        groupVolumes.set(group, clampVolume(localStorage.getItem(storageKey), 1));
    });

    function clampVolume(value, fallback = 1) {
        if (value === null || value === undefined || value === '') return fallback;

        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(1, Math.max(0, parsed));
    }

    function markUserInteracted() {
        hasUserInteracted = true;
        unlockAudio();
    }

    function isControlSelected(control) {
        return control.classList.contains('active') ||
            control.classList.contains('is-active') ||
            control.getAttribute('aria-selected') === 'true' ||
            control.getAttribute('aria-pressed') === 'true';
    }

    function isControlUnavailable(control) {
        return control.disabled ||
            control.classList.contains('disabled') ||
            control.getAttribute('aria-disabled') === 'true';
    }

    function normalizePriority(priority, fallback = 'normal') {
        if (typeof priority === 'string' && priority in PLAYBACK_PRIORITIES) {
            return PLAYBACK_PRIORITIES[priority];
        }

        const numericPriority = Number(priority);
        if (Number.isFinite(numericPriority)) return numericPriority;
        return PLAYBACK_PRIORITIES[fallback] ?? PLAYBACK_PRIORITIES.normal;
    }

    function normalizeConflictPolicy(policy, fallback = 'interrupt') {
        return CONFLICT_POLICIES.has(policy) ? policy : fallback;
    }

    function normaliseDefinition(key, definition) {
        const value = typeof definition === 'string' ? { src: definition } : definition;
        if (!value || typeof value.src !== 'string' || !value.src.trim()) {
            throw new TypeError(`Sound "${key}" requires a src.`);
        }

        const group = value.group || DEFAULT_GROUP;
        const playbackDefaults = GROUP_PLAYBACK_DEFAULTS[group] || {};

        return {
            src: value.src,
            group,
            volume: clampVolume(value.volume, 1),
            preload: value.preload === true,
            cooldown: Math.max(0, Number(value.cooldown) || 0),
            maxInstances: Math.max(1, Number(value.maxInstances) || Infinity),
            loop: value.loop === true,
            playbackRate: Math.max(0.01, Number(value.playbackRate) || 1),
            playbackRateVariation: Math.max(0, Number(value.playbackRateVariation) || 0),
            lane: value.lane === 'independent'
                ? null
                : String(value.lane || playbackDefaults.lane || DEFAULT_LANE),
            priority: normalizePriority(
                value.priority,
                playbackDefaults.priority || 'normal'
            ),
            conflictPolicy: normalizeConflictPolicy(
                value.conflictPolicy,
                playbackDefaults.conflictPolicy || 'interrupt'
            ),
            interruptible: value.interruptible !== false,
            forceInterrupt: value.forceInterrupt === true,
            clearQueue: value.clearQueue === true
        };
    }

    function resolveSoundSrc(src) {
        return typeof versionAssetUrl === 'function' ? versionAssetUrl(src) : src;
    }

    function getGroupVolume(group = DEFAULT_GROUP) {
        return groupVolumes.get(group) ?? 1;
    }

    function getEffectiveVolume(definition, options = {}) {
        const group = options.group || definition.group;
        const soundVolume = clampVolume(options.volume, definition.volume);
        return clampVolume(soundVolume * masterVolume * getGroupVolume(group), 1);
    }

    function applyAudioOptions(audio, definition, options = {}) {
        audio.loop = options.loop ?? definition.loop;
        audio.volume = getEffectiveVolume(definition, options);

        const baseRate = Math.max(0.01, Number(options.playbackRate ?? definition.playbackRate) || 1);
        const variation = Math.max(0, Number(options.playbackRateVariation ?? definition.playbackRateVariation) || 0);
        const offset = variation ? (Math.random() * 2 - 1) * variation : 0;
        audio.playbackRate = Math.max(0.01, baseRate + offset);

        return audio;
    }

    function createAudioElement(definition, options = {}) {
        if (typeof Audio !== 'function') {
            emitAudioDebug('error', 'audio.errors', 'Audio API is unavailable.', {
                event: 'audio_api_unavailable'
            });
            return null;
        }

        const audio = new Audio(resolveSoundSrc(definition.src));
        audio.preload = 'auto';
        audio.playsInline = true;
        return applyAudioOptions(audio, definition, options);
    }

    function prepareAudioElement(audio, definition, options = {}) {
        applyAudioOptions(audio, definition, options);

        try {
            audio.currentTime = 0;
        } catch (_error) {
            // Some browsers reject currentTime changes before metadata exists.
            emitAudioDebug('warn', 'audio.errors', 'Audio position could not be reset.', {
                event: 'media_reset_failed'
            });
        }

        return audio;
    }

    function getReusableAudioElement(key, definition, options = {}) {
        const preloaded = preloadedAudio.get(key);
        if (preloaded && !getActiveSet(key).has(preloaded)) {
            return prepareAudioElement(preloaded, definition, options);
        }

        return createAudioElement(definition, options);
    }

    function unlockAudio() {
        if (unlockAttempted || !enabled) return;

        const firstDefinition = definitions.values().next().value;
        const audio = firstDefinition ? createAudioElement(firstDefinition) : null;
        if (!audio) return;

        unlockAttempted = true;
        emitAudioDebug('debug', 'audio.playback', 'Attempting browser audio unlock.', {
            event: 'unlock_attempted'
        });

        const previousVolume = audio.volume;
        audio.volume = 0;

        Promise.resolve(audio.play())
            .then(() => {
                audio.pause();
                try {
                    audio.currentTime = 0;
                } catch (_error) {
                    // Ignore reset failures during the browser audio unlock path.
                }
                emitAudioDebug('debug', 'audio.playback', 'Browser audio unlocked.', {
                    event: 'unlock_succeeded'
                });
            })
            .catch((error) => {
                unlockAttempted = false;
                emitAudioDebug('warn', 'audio.errors', 'Browser audio unlock failed.', {
                    event: 'unlock_failed',
                    error
                });
            })
            .finally(() => {
                audio.volume = previousVolume;
            });
    }

    function getActiveSet(key) {
        if (!activeAudio.has(key)) {
            activeAudio.set(key, new Set());
        }
        return activeAudio.get(key);
    }

    function releaseActiveAudio(key, audio) {
        const activeSet = activeAudio.get(key);
        if (!activeSet) return;

        activeSet.delete(audio);
        if (!activeSet.size) {
            activeAudio.delete(key);
        }
    }

    function trackAudio(key, audio) {
        getActiveSet(key).add(audio);

        let released = false;
        const release = ({ naturalEnd = false } = {}) => {
            if (released) return;
            released = true;
            audio.removeEventListener?.('ended', onEnded);
            audio.removeEventListener?.('pause', onPause);
            releaseActiveAudio(key, audio);
            if (naturalEnd) {
                emitAudioDebug('debug', 'audio.playback', 'Playback ended.', {
                    event: 'ended',
                    key
                });
            }
        };
        const onEnded = () => release({ naturalEnd: true });
        const onPause = () => {
            if (audio.ended) onEnded();
        };

        audio.addEventListener('ended', onEnded, { once: true });
        audio.addEventListener('pause', onPause);
        return release;
    }

    function register(soundDefinitions) {
        if (!soundDefinitions || typeof soundDefinitions !== 'object') {
            emitAudioDebug('warn', 'audio', 'Sound registration was ignored.', {
                event: 'registration_ignored',
                reason: 'invalid_definitions'
            });
            return Promise.resolve([]);
        }

        const preloadKeys = [];
        const entries = Object.entries(soundDefinitions);
        entries.forEach(([key, definition]) => {
            try {
                const normalised = normaliseDefinition(key, definition);
                definitions.set(key, normalised);

                if (normalised.preload) {
                    preloadKeys.push(key);
                }
            } catch (error) {
                emitAudioDebug('error', 'audio.errors', 'Sound registration failed.', {
                    event: 'registration_failed',
                    key,
                    error
                });
                throw error;
            }
        });

        emitAudioDebug('info', 'audio', 'Sound definitions registered.', {
            event: 'registered',
            count: entries.length,
            preloadCount: preloadKeys.length,
            totalDefinitions: definitions.size
        });

        return preloadKeys.length ? preload(preloadKeys) : Promise.resolve([]);
    }

    function load(key) {
        const definition = definitions.get(key);
        if (!definition) {
            emitAudioDebug('warn', 'audio.preload', 'Preload skipped.', {
                event: 'skipped',
                reason: 'definition_missing',
                key
            });
            return Promise.resolve(null);
        }
        if (preloadedAudio.has(key)) {
            emitAudioDebug('debug', 'audio.preload', 'Using preloaded sound.', {
                event: 'cache_hit',
                key
            });
            return Promise.resolve(preloadedAudio.get(key));
        }

        const audio = createAudioElement(definition);
        if (!audio) {
            emitAudioDebug('error', 'audio.preload', 'Preload failed.', {
                event: 'failed',
                reason: 'audio_api_unavailable',
                key
            });
            return Promise.resolve(null);
        }

        preloadedAudio.set(key, audio);
        emitAudioDebug('debug', 'audio.preload', 'Preload started.', {
            event: 'started',
            key
        });

        return new Promise((resolve) => {
            let settled = false;
            const finish = (result = 'timeout') => {
                if (settled) return;
                settled = true;
                emitAudioDebug(
                    result === 'error' || result === 'load_threw' ? 'warn' : 'debug',
                    result === 'error' || result === 'load_threw'
                        ? 'audio.errors'
                        : 'audio.preload',
                    result === 'error' || result === 'load_threw'
                        ? 'Preload encountered a media failure.'
                        : 'Preload finished.',
                    {
                        event: result === 'error' || result === 'load_threw'
                            ? 'preload_failed'
                            : 'finished',
                        reason: result,
                        key
                    }
                );
                resolve(audio);
            };

            audio.addEventListener('canplaythrough', () => finish('canplaythrough'), { once: true });
            audio.addEventListener('loadeddata', () => finish('loadeddata'), { once: true });
            audio.addEventListener('error', () => finish('error'), { once: true });

            try {
                audio.load();
            } catch (error) {
                emitAudioDebug('warn', 'audio.errors', 'Preload load call failed.', {
                    event: 'preload_load_threw',
                    key,
                    error
                });
                finish('load_threw');
            }

            window.setTimeout(() => finish('timeout'), 1500);
        });
    }

    function preload(keys) {
        const requestedKeys = Array.isArray(keys) ? keys : [keys];
        emitAudioDebug('info', 'audio.preload', 'Preload requested.', {
            event: 'requested',
            count: requestedKeys.length
        });
        return Promise.all(requestedKeys.map(load));
    }

    function getAudioPlaybackOptions(options = {}) {
        const {
            lane: _lane,
            priority: _priority,
            conflictPolicy: _conflictPolicy,
            interruptible: _interruptible,
            forceInterrupt: _forceInterrupt,
            clearQueue: _clearQueue,
            ...audioOptions
        } = options;
        return audioOptions;
    }

    function getPlaybackConfiguration(definition, options = {}) {
        const requestedLane = options.lane ?? definition.lane;
        return {
            lane: requestedLane === 'independent'
                ? null
                : String(requestedLane || DEFAULT_LANE),
            priority: options.priority === undefined
                ? definition.priority
                : normalizePriority(options.priority),
            conflictPolicy: normalizeConflictPolicy(
                options.conflictPolicy,
                definition.conflictPolicy
            ),
            interruptible: options.interruptible ?? definition.interruptible,
            forceInterrupt: options.forceInterrupt ?? definition.forceInterrupt,
            clearQueue: options.clearQueue ?? definition.clearQueue
        };
    }

    async function playAudio(key, options = {}) {
        if (!enabled && options.ignoreEnabled !== true) {
            logPlaybackSkipped(key, 'sound_disabled');
            return null;
        }
        if (!hasUserInteracted && options.ignoreInteraction !== true) {
            logPlaybackSkipped(key, 'interaction_required');
            return null;
        }

        const definition = definitions.get(key);
        if (!definition) {
            logPlaybackSkipped(key, 'definition_missing');
            return null;
        }

        const now = performance.now();
        const cooldown = Math.max(0, Number(options.cooldown ?? definition.cooldown) || 0);
        const lastPlayed = lastPlayedAt.get(key);
        if (cooldown && lastPlayed !== undefined && now - lastPlayed < cooldown) {
            logPlaybackSkipped(key, 'cooldown_active', {
                cooldownMs: cooldown,
                remainingMs: Math.max(0, Math.ceil(cooldown - (now - lastPlayed)))
            });
            return null;
        }

        const maxInstances = Math.max(1, Number(options.maxInstances ?? definition.maxInstances) || Infinity);
        const activeInstances = activeAudio.get(key)?.size || 0;
        if (activeInstances >= maxInstances) {
            logPlaybackSkipped(key, 'max_instances_reached', {
                activeInstances,
                maxInstances
            });
            return null;
        }

        const audio = getReusableAudioElement(key, definition, options);
        if (!audio) {
            logPlaybackSkipped(key, 'audio_api_unavailable');
            return null;
        }

        const releaseAudio = trackAudio(key, audio);
        lastPlayedAt.set(key, performance.now());
        emitAudioDebug('debug', 'audio.playback', 'Playback starting.', {
            event: 'starting',
            key,
            group: options.group || definition.group,
            volume: audio.volume,
            playbackRate: audio.playbackRate
        });

        try {
            await audio.play();
        } catch (error) {
            releaseAudio();
            emitAudioDebug('error', 'audio.errors', 'Playback failed.', {
                event: 'play_failed',
                reason: 'play_rejected',
                key,
                error
            });
            logPlaybackSkipped(key, 'play_rejected');
            return null;
        }

        emitAudioDebug('info', 'audio.playback', 'Playback started.', {
            event: 'started',
            key,
            group: options.group || definition.group
        });
        return {
            stop: () => {
                emitAudioDebug('info', 'audio.playback', 'Playback stopped.', {
                    event: 'stopped',
                    reason: 'playback_handle_stop',
                    key
                });
                audio.pause();
                audio.currentTime = 0;
                releaseAudio();
            },
            source: audio
        };
    }

    function settleLaneRequest(request, value) {
        if (request.resultSettled) return;
        request.resultSettled = true;
        request.resolveResult(value);
    }

    function dropQueuedLaneRequest(lane, reason = 'queue_cleared') {
        const queuedRequest = queuedLaneRequests.get(lane);
        if (!queuedRequest) return false;

        queuedLaneRequests.delete(lane);
        queuedRequest.cancelled = true;
        logRequestSkipped(queuedRequest, reason);
        settleLaneRequest(queuedRequest, null);
        emitAudioDebug('info', 'audio.queue', 'Queued playback removed.', {
            event: 'removed',
            reason,
            requestId: queuedRequest.id,
            lane
        });
        return true;
    }

    function getPlaybackEndFallback(audio) {
        const duration = Number(audio?.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
            return PLAYBACK_END_FALLBACK_MS;
        }
        return Math.min(PLAYBACK_END_FALLBACK_MS, duration * 1000 + 500);
    }

    function waitForPlaybackEnd(request, playback) {
        const audio = playback?.source;
        if (!audio || audio.ended || typeof audio.addEventListener !== 'function') {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            let settled = false;
            let fallbackTimeoutId = null;
            const finish = () => {
                if (settled) return;
                settled = true;
                audio.removeEventListener?.('ended', finish);
                audio.removeEventListener?.('error', finish);
                audio.removeEventListener?.('pause', finish);
                if (fallbackTimeoutId !== null) {
                    window.clearTimeout(fallbackTimeoutId);
                }
                if (request.finishCurrentPlayback === finish) {
                    request.finishCurrentPlayback = null;
                }
                resolve();
            };

            request.finishCurrentPlayback = finish;
            audio.addEventListener('ended', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
            audio.addEventListener('pause', finish, { once: true });
            fallbackTimeoutId = window.setTimeout(
                finish,
                getPlaybackEndFallback(audio)
            );
        });
    }

    function startNextLaneRequest(lane) {
        const queuedRequest = queuedLaneRequests.get(lane);
        if (!queuedRequest) return;

        queuedLaneRequests.delete(lane);
        emitAudioDebug('debug', 'audio.queue', 'Queued playback starting.', {
            event: 'dequeued',
            requestId: queuedRequest.id,
            lane,
            priority: queuedRequest.priority
        });
        startLaneRequest(queuedRequest);
    }

    function finishLaneRequest(request) {
        if (activeLaneRequests.get(request.lane) !== request) return;

        request.finishCurrentPlayback?.();
        request.finishCurrentPlayback = null;
        request.playback = null;
        activeLaneRequests.delete(request.lane);
        startNextLaneRequest(request.lane);
    }

    function interruptLaneRequest(request, reason = 'interrupted') {
        if (!request) return false;

        request.cancelled = true;
        emitAudioDebug('info', 'audio.playback', 'Lane playback interrupted.', {
            event: 'interrupted',
            reason,
            requestId: request.id,
            lane: request.lane,
            priority: request.priority,
            hadPlayback: Boolean(request.playback)
        });
        if (!request.playback) {
            logRequestSkipped(request, reason);
        } else {
            logRemainingSequenceItemsSkipped(request, reason);
        }
        request.finishCurrentPlayback?.();
        request.finishCurrentPlayback = null;
        request.playback?.stop?.();
        request.playback = null;
        settleLaneRequest(request, null);
        if (activeLaneRequests.get(request.lane) === request) {
            activeLaneRequests.delete(request.lane);
        }
        return true;
    }

    async function runSingleLaneRequest(request) {
        const playback = await playAudio(request.key, request.audioOptions);
        if (request.cancelled || activeLaneRequests.get(request.lane) !== request) {
            playback?.stop?.();
            settleLaneRequest(request, null);
            return;
        }

        request.playback = playback;
        settleLaneRequest(request, playback);
        if (!playback) {
            finishLaneRequest(request);
            return;
        }

        await waitForPlaybackEnd(request, playback);
        finishLaneRequest(request);
    }

    async function runSequenceLaneRequest(request) {
        let lastPlayback = null;

        for (const [itemIndex, item] of request.items.entries()) {
            request.currentItemIndex = itemIndex;
            if (request.cancelled || activeLaneRequests.get(request.lane) !== request) {
                break;
            }

            const playback = await playAudio(item.key, item.audioOptions);
            if (request.cancelled || activeLaneRequests.get(request.lane) !== request) {
                playback?.stop?.();
                break;
            }

            request.playback = playback;
            if (!playback) continue;

            lastPlayback = playback;
            await waitForPlaybackEnd(request, playback);
            request.playback = null;
        }

        settleLaneRequest(request, request.cancelled ? null : lastPlayback);
        finishLaneRequest(request);
    }

    function startLaneRequest(request) {
        if (request.cancelled) return;

        activeLaneRequests.set(request.lane, request);
        emitAudioDebug('debug', 'audio.queue', 'Lane request started.', {
            event: 'started',
            requestId: request.id,
            lane: request.lane,
            priority: request.priority,
            kind: request.items ? 'sequence' : 'single'
        });
        const runner = request.items
            ? runSequenceLaneRequest(request)
            : runSingleLaneRequest(request);
        Promise.resolve(runner).catch((error) => {
            emitAudioDebug('error', 'audio.errors', 'Lane request failed.', {
                event: 'lane_request_failed',
                requestId: request.id,
                lane: request.lane,
                error
            });
            if (!request.playback) {
                logRequestSkipped(request, 'lane_request_failed');
            } else {
                logRemainingSequenceItemsSkipped(
                    request,
                    'lane_request_failed'
                );
            }
            settleLaneRequest(request, null);
            finishLaneRequest(request);
        });
    }

    function queueLaneRequest(request) {
        const queuedRequest = queuedLaneRequests.get(request.lane);
        if (queuedRequest && queuedRequest.priority > request.priority) {
            request.cancelled = true;
            logRequestSkipped(request, 'higher_priority_already_queued', {
                queuedPriority: queuedRequest.priority
            });
            settleLaneRequest(request, null);
            return;
        }

        if (queuedRequest) {
            queuedRequest.cancelled = true;
            logRequestSkipped(queuedRequest, 'replaced_by_latest_request', {
                replacementRequestId: request.id
            });
            settleLaneRequest(queuedRequest, null);
        }
        queuedLaneRequests.set(request.lane, request);
        emitAudioDebug('info', 'audio.queue', 'Playback queued.', {
            event: 'queued',
            requestId: request.id,
            lane: request.lane,
            priority: request.priority,
            replacedRequestId: queuedRequest?.id || null
        });
    }

    function submitLaneRequest(request) {
        if (request.clearQueue) {
            dropQueuedLaneRequest(request.lane, 'cleared_by_new_request');
        }

        const activeRequest = activeLaneRequests.get(request.lane);
        if (!activeRequest) {
            startLaneRequest(request);
            return request.resultPromise;
        }

        const canInterrupt = request.forceInterrupt || (
            activeRequest.interruptible && (
                request.priority > activeRequest.priority ||
                (
                    request.conflictPolicy === 'interrupt' &&
                    request.priority >= activeRequest.priority
                )
            )
        );

        if (canInterrupt) {
            interruptLaneRequest(activeRequest, 'interrupted_by_higher_priority');
            startLaneRequest(request);
            return request.resultPromise;
        }

        if (request.conflictPolicy === 'queue-latest') {
            queueLaneRequest(request);
        } else {
            request.cancelled = true;
            logRequestSkipped(request, 'lane_conflict_drop', {
                activeRequestId: activeRequest.id,
                activePriority: activeRequest.priority,
                conflictPolicy: request.conflictPolicy
            });
            settleLaneRequest(request, null);
        }

        return request.resultPromise;
    }

    function createLaneRequest(configuration) {
        let resolveResult;
        const resultPromise = new Promise((resolve) => {
            resolveResult = resolve;
        });

        return {
            id: nextLaneRequestId++,
            cancelled: false,
            skipLogged: false,
            currentItemIndex: null,
            resultSettled: false,
            resolveResult,
            resultPromise,
            finishCurrentPlayback: null,
            playback: null,
            ...configuration
        };
    }

    function play(key, options = {}) {
        if (!enabled && options.ignoreEnabled !== true) {
            logPlaybackSkipped(key, 'sound_disabled');
            return Promise.resolve(null);
        }
        if (!hasUserInteracted && options.ignoreInteraction !== true) {
            logPlaybackSkipped(key, 'interaction_required');
            return Promise.resolve(null);
        }

        const definition = definitions.get(key);
        if (!definition) {
            logPlaybackSkipped(key, 'definition_missing');
            return Promise.resolve(null);
        }

        const playback = getPlaybackConfiguration(definition, options);
        const audioOptions = getAudioPlaybackOptions(options);
        emitAudioDebug('debug', 'audio.playback', 'Playback requested.', {
            event: 'requested',
            key,
            lane: playback.lane,
            priority: playback.priority,
            conflictPolicy: playback.conflictPolicy
        });
        if (!playback.lane) return playAudio(key, audioOptions);

        return submitLaneRequest(createLaneRequest({
            key,
            audioOptions,
            ...playback
        }));
    }

    function playSequence(keys, options = {}) {
        const requestedItems = Array.isArray(keys) ? keys : [keys];
        if (!enabled && options.ignoreEnabled !== true) {
            requestedItems.forEach((item) => {
                logPlaybackSkipped(
                    typeof item === 'string' ? item : item?.key,
                    'sound_disabled'
                );
            });
            return Promise.resolve(null);
        }
        if (!hasUserInteracted && options.ignoreInteraction !== true) {
            requestedItems.forEach((item) => {
                logPlaybackSkipped(
                    typeof item === 'string' ? item : item?.key,
                    'interaction_required'
                );
            });
            return Promise.resolve(null);
        }

        const sharedAudioOptions = getAudioPlaybackOptions(options);
        const items = requestedItems
            .map((item) => {
                const key = typeof item === 'string' ? item : item?.key;
                const definition = definitions.get(key);
                if (!key || !definition) {
                    logPlaybackSkipped(key, 'definition_missing', {
                        sequence: true
                    });
                    return null;
                }

                return {
                    key,
                    definition,
                    audioOptions: {
                        ...sharedAudioOptions,
                        ...getAudioPlaybackOptions(item?.options || {})
                    }
                };
            })
            .filter(Boolean);
        if (!items.length) {
            if (!requestedItems.length) {
                logPlaybackSkipped(null, 'empty_sequence', {
                    sequence: true
                });
            }
            return Promise.resolve(null);
        }

        const firstDefinition = items[0].definition;
        const playback = getPlaybackConfiguration(firstDefinition, {
            ...options,
            priority: options.priority ?? Math.max(
                ...items.map((item) => item.definition.priority)
            ),
            conflictPolicy: options.conflictPolicy ?? 'queue-latest',
            interruptible: options.interruptible ?? false
        });
        emitAudioDebug('debug', 'audio.playback', 'Playback sequence requested.', {
            event: 'sequence_requested',
            count: items.length,
            lane: playback.lane,
            priority: playback.priority,
            conflictPolicy: playback.conflictPolicy
        });

        if (!playback.lane) {
            return (async () => {
                let lastPlayback = null;
                for (const item of items) {
                    lastPlayback = await playAudio(item.key, item.audioOptions);
                    if (lastPlayback) {
                        await waitForPlaybackEnd({}, lastPlayback);
                    }
                }
                return lastPlayback;
            })();
        }

        return submitLaneRequest(createLaneRequest({
            items,
            ...playback
        }));
    }

    function stopLane(lane = DEFAULT_LANE, options = {}) {
        const normalizedLane = String(lane || DEFAULT_LANE);
        const hadQueuedRequest = options.clearQueue === false
            ? false
            : dropQueuedLaneRequest(normalizedLane, 'lane_stopped_before_playback');
        const activeRequest = activeLaneRequests.get(normalizedLane);
        const hadActiveRequest = interruptLaneRequest(
            activeRequest,
            'lane_stopped'
        );

        if (options.clearQueue === false) {
            startNextLaneRequest(normalizedLane);
        }
        emitAudioDebug('info', 'audio.playback', 'Audio lane stop requested.', {
            event: 'lane_stopped',
            lane: normalizedLane,
            clearedQueued: hadQueuedRequest,
            stoppedActive: hadActiveRequest
        });
        return hadQueuedRequest || hadActiveRequest;
    }

    function getLaneState(lane = DEFAULT_LANE) {
        const normalizedLane = String(lane || DEFAULT_LANE);
        const activeRequest = activeLaneRequests.get(normalizedLane);
        const queuedRequest = queuedLaneRequests.get(normalizedLane);
        return {
            activeKey: activeRequest?.key ?? activeRequest?.items?.[0]?.key ?? null,
            activePriority: activeRequest?.priority ?? null,
            queuedKey: queuedRequest?.key ?? queuedRequest?.items?.[0]?.key ?? null,
            queuedPriority: queuedRequest?.priority ?? null
        };
    }

    function playInteraction(intent, options = {}) {
        const key = INTERACTION_SOUNDS[intent];
        if (!key) {
            logPlaybackSkipped(null, 'interaction_intent_missing', {
                intent: String(intent || '')
            });
            return Promise.resolve(null);
        }
        return play(key, options);
    }

    function setEnabled(nextEnabled, options = {}) {
        const previousEnabled = enabled;
        enabled = Boolean(nextEnabled);
        if (options.persist !== false) {
            localStorage.setItem(STORAGE_KEYS.enabled, String(enabled));
        }

        window.dispatchEvent(new CustomEvent('oe:audio-settings-changed', {
            detail: { enabled, masterVolume }
        }));

        emitAudioDebug('info', 'audio.settings', 'Audio enabled setting changed.', {
            event: 'enabled_changed',
            previousEnabled,
            enabled,
            persisted: options.persist !== false
        });
        return enabled;
    }

    function setMasterVolume(nextVolume, options = {}) {
        const previousMasterVolume = masterVolume;
        masterVolume = clampVolume(nextVolume, masterVolume);
        if (options.persist !== false) {
            localStorage.setItem(STORAGE_KEYS.masterVolume, String(masterVolume));
        }

        window.dispatchEvent(new CustomEvent('oe:audio-settings-changed', {
            detail: { enabled, masterVolume }
        }));

        emitAudioDebug('info', 'audio.settings', 'Master volume changed.', {
            event: 'master_volume_changed',
            previousMasterVolume,
            masterVolume,
            persisted: options.persist !== false
        });
        return masterVolume;
    }

    function setGroupVolume(group, nextVolume) {
        const normalisedGroup = group || DEFAULT_GROUP;
        const previousVolume = getGroupVolume(normalisedGroup);
        const volume = clampVolume(nextVolume, getGroupVolume(normalisedGroup));
        groupVolumes.set(normalisedGroup, volume);
        emitAudioDebug('info', 'audio.settings', 'Group volume changed.', {
            event: 'group_volume_changed',
            group: normalisedGroup,
            previousVolume,
            volume
        });
        return volume;
    }

    const OEAudio = {
        register,
        preload,
        play,
        playSequence,
        playInteraction,
        stopLane,
        setEnabled,
        setMasterVolume,
        setGroupVolume,
        isEnabled: () => enabled,
        getMasterVolume: () => masterVolume,
        getGroupVolume,
        getLaneState,
        priorities: PLAYBACK_PRIORITIES
    };

    window.OEAudio = OEAudio;
    window.loadSound = async function loadSound(key, url) {
        await register({ [key]: { src: url, preload: true } });
        return load(key);
    };
    window.playSoundEffect = function playSoundEffect(key, options) {
        return play(key, options);
    };
    window.playSoundSequence = function playSoundSequence(keys, options) {
        return playSequence(keys, options);
    };
    window.playInteractionSound = function playInteractionSound(intent, options) {
        return playInteraction(intent, options);
    };

    register({
        containerOpen: { src: '/sounds/ui/containers/open.wav', group: 'ui', preload: true },
        containerClose: { src: '/sounds/ui/containers/close.wav', group: 'ui', preload: true },
        uiToggleEnabled: { src: '/sounds/ui/toggles/enabled.wav', group: 'ui', preload: true },
        uiToggleDisabled: { src: '/sounds/ui/toggles/disabled.wav', group: 'ui', preload: true },
        splashScreenUp: { src: '/sounds/ui/splash-screen/up.wav', group: 'ui', preload: true },
        splashScreenDown: { src: '/sounds/ui/splash-screen/down.wav', group: 'ui', preload: true },
        uiSelect: {
            src: '/sounds/ui/buttons/selections/select.wav',
            group: 'ui',
            preload: true,
            cooldown: 40,
            maxInstances: 2
        },
        uiDeselect: {
            src: '/sounds/ui/buttons/selections/deselect.wav',
            group: 'ui',
            preload: true,
            cooldown: 40,
            maxInstances: 2
        },
        uiConfirm: { src: '/sounds/ui/buttons/actions/confirm.wav', group: 'ui', preload: true, cooldown: 80 },
        uiSuccess: { src: '/sounds/ui/buttons/actions/success.wav', group: 'ui', preload: true, cooldown: 80 },
        uiError: {
            src: '/sounds/ui/buttons/actions/error.wav',
            group: 'ui',
            preload: true,
            cooldown: 100,
            priority: 'confirmation'
        },
        uiWarning: {
            src: '/sounds/ui/buttons/actions/warning.wav',
            group: 'ui',
            preload: true,
            cooldown: 100,
            priority: 'confirmation'
        },
        uiIncrease: {
            src: '/sounds/ui/buttons/adjustments/increase.wav',
            group: 'ui',
            preload: true,
            cooldown: 35,
            maxInstances: 1
        },
        uiDecrease: {
            src: '/sounds/ui/buttons/adjustments/decrease.wav',
            group: 'ui',
            preload: true,
            cooldown: 35,
            maxInstances: 1
        },
        uiPrevious: {
            src: '/sounds/ui/buttons/navigation/previous.wav',
            group: 'ui',
            preload: true,
            cooldown: 35,
            maxInstances: 1
        },
        uiNext: {
            src: '/sounds/ui/buttons/navigation/next.wav',
            group: 'ui',
            preload: true,
            cooldown: 35,
            maxInstances: 1
        },
        uiScroll: {
            src: '/sounds/ui/buttons/navigation/scroll.wav',
            group: 'ui',
            preload: true,
            cooldown: 35,
            maxInstances: 1
        },
        socialCopyLink: {
            src: '/sounds/social/copy-link.wav',
            group: 'ui',
            preload: true,
            cooldown: 80,
            maxInstances: 1
        },
        socialChatMessageReceived: {
            src: '/sounds/social/chat-message-received.wav',
            group: 'notifications',
            preload: true,
            cooldown: 250,
            maxInstances: 1
        },
        notificationAttention: {
            src: '/sounds/notifications/shared/attention.wav',
            group: 'notifications',
            preload: true,
            cooldown: 100
        },
        notificationSuccess: {
            src: '/sounds/notifications/shared/success.wav',
            group: 'notifications',
            preload: true,
            cooldown: 100
        },
        notificationFailure: {
            src: '/sounds/notifications/shared/failure.wav',
            group: 'notifications',
            preload: true,
            cooldown: 100,
            priority: 'importantNotification',
            conflictPolicy: 'queue-latest'
        },
        notificationSlideIn: {
            src: '/sounds/notifications/shared/slide-in/default.wav',
            group: 'notifications',
            preload: true,
            cooldown: 60,
            conflictPolicy: 'interrupt'
        },
        notificationSlideOut: {
            src: '/sounds/notifications/shared/slide-out/default.wav',
            group: 'notifications',
            preload: true,
            cooldown: 60,
            lane: 'independent',
            maxInstances: 2
        },
        notificationPartyPositive: {
            src: '/sounds/notifications/party-activity/positive.wav',
            group: 'notifications',
            preload: true,
            cooldown: 100
        },
        notificationPartyNeutral: {
            src: '/sounds/notifications/party-activity/neutral.wav',
            group: 'notifications',
            preload: true,
            cooldown: 100
        },
        notificationPartyNegative: {
            src: '/sounds/notifications/party-activity/negative.wav',
            group: 'notifications',
            preload: true,
            cooldown: 100,
            priority: 'importantNotification',
            conflictPolicy: 'queue-latest'
        },
        gamemodeSettingsPlayerKicked: {
            src: '/sounds/gamemode-settings/kick.wav',
            group: 'party-games',
            preload: true,
            cooldown: 500,
            maxInstances: 1,
            priority: 'importantNotification',
            conflictPolicy: 'queue-latest'
        },
        notificationAchievementLegendary: {
            src: '/sounds/notifications/achievements/legendary.wav',
            group: 'notifications',
            preload: false,
            cooldown: 100,
            priority: 'importantNotification',
            conflictPolicy: 'queue-latest'
        },
        accountCreated: {
            src: '/sounds/account/auth/account-created.wav',
            group: 'notifications',
            preload: true,
            cooldown: 250,
            priority: 'confirmation'
        },
        accountEmailSent: {
            src: '/sounds/account/auth/email-sent.wav',
            group: 'notifications',
            preload: true,
            cooldown: 250,
            priority: 'confirmation'
        }
    });

    document.addEventListener('click', (event) => {
        const control = event.target?.closest?.('button, [role="button"]');
        if (!control || isControlUnavailable(control)) return;

        const requestedSound = control.dataset.sound;
        if (requestedSound === 'none' || control.classList.contains('sound-save')) return;

        if (requestedSound) {
            play(requestedSound);
            return;
        }

        const requestedIntent = control.dataset.soundIntent;
        if (requestedIntent) {
            playInteraction(requestedIntent);
            return;
        }

        const rule = INTERACTION_SOUND_RULES.find(({ selector }) => control.matches(selector));
        if (!rule) return;

        const intent = rule.resolveIntent ? rule.resolveIntent(control) : rule.intent;
        if (intent) playInteraction(intent);
    }, { capture: true });

    ['pointerdown', 'click', 'keydown', 'touchstart'].forEach((eventName) => {
        document.addEventListener(eventName, markUserInteracted, {
            capture: true,
            passive: true
        });
    });
})();
