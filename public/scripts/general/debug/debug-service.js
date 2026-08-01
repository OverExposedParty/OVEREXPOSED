(function initialiseOEDebugService() {
    const HISTORY_LIMIT = 250;
    const STORAGE_KEYS = Object.freeze({
        filter: 'oe-debug-filter',
        level: 'oe-debug-level'
    });
    const LEVELS = Object.freeze({
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    });
    const FILTER_SUGGESTIONS = Object.freeze([
        'all',
        'off',
        'audio',
        'audio.errors',
        'audio.playback',
        'audio.preload',
        'audio.queue',
        'audio.settings',
        'loader',
        'loader.diagnostics',
        'loader.lifecycle',
        'loader.ready',
        'loader.scripts',
        'notifications',
        'notifications.active-lobby',
        'party',
        'party.chat',
        'runtime',
        'runtime.errors',
        'legacy',
        'general'
    ]);
    const SENSITIVE_KEY_PATTERN = /(authorization|cookie|credential|password|secret|session|token)/i;
    const MAX_DEPTH = 3;
    const MAX_ITEMS = 20;
    const MAX_KEYS = 20;
    const MAX_STRING_LENGTH = 500;
    const MAX_ENTRY_NODES = 100;
    const MAX_ENTRY_CHARACTERS = 4000;
    const history = [];
    const subscribers = new Set();
    const statusSubscribers = new Set();
    const nativeConsole = {
        debug: console.debug?.bind(console) || console.log.bind(console),
        info: console.info?.bind(console) || console.log.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console)
    };
    let nextEntryId = 1;

    function readStorage(key) {
        try {
            return window.localStorage?.getItem(key) ?? null;
        } catch {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage?.setItem(key, value);
        } catch {
            // Debugging preferences must not affect application execution.
        }
    }

    function normaliseCategory(value) {
        const category = String(value || '').trim().toLowerCase();
        return /^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(category)
            ? category
            : '';
    }

    function normaliseFilter(value, fallback = 'off') {
        const filter = String(value || '').trim().toLowerCase();
        if (filter === 'all' || filter === 'off') return filter;
        return normaliseCategory(filter) || fallback;
    }

    function normaliseLevel(value, fallback = 'debug') {
        const level = String(value || '').trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(LEVELS, level)
            ? level
            : fallback;
    }

    const storedFilter = readStorage(STORAGE_KEYS.filter);
    let activeFilter = normaliseFilter(
        storedFilter,
        window.OE_DEBUG ? 'all' : 'off'
    );
    let minimumLevel = normaliseLevel(
        readStorage(STORAGE_KEYS.level),
        'debug'
    );

    function truncateString(value) {
        const text = String(value);
        return text.length > MAX_STRING_LENGTH
            ? `${text.slice(0, MAX_STRING_LENGTH)}…`
            : text;
    }

    function sanitiseValue(
        value,
        depth = 0,
        seen = new WeakSet(),
        budget = { nodes: MAX_ENTRY_NODES, characters: MAX_ENTRY_CHARACTERS }
    ) {
        if (budget.nodes <= 0 || budget.characters <= 0) {
            return '[entry-limit]';
        }
        budget.nodes -= 1;

        if (value === null || value === undefined) return value;
        if (typeof value === 'string') {
            const result = truncateString(value).slice(0, budget.characters);
            budget.characters -= result.length;
            return result;
        }
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        if (typeof value === 'bigint') return String(value);
        if (typeof value === 'function') return `[function ${value.name || 'anonymous'}]`;
        if (typeof value !== 'object') return truncateString(value);

        if (value instanceof Error) {
            return {
                name: sanitiseValue(
                    value.name || 'Error',
                    depth + 1,
                    seen,
                    budget
                ),
                message: sanitiseValue(
                    value.message || '',
                    depth + 1,
                    seen,
                    budget
                ),
                ...(value.code === undefined
                    ? {}
                    : {
                        code: sanitiseValue(
                            value.code,
                            depth + 1,
                            seen,
                            budget
                        )
                    })
            };
        }

        if (depth >= MAX_DEPTH) return '[depth-limit]';
        if (seen.has(value)) return '[circular]';
        seen.add(value);

        if (Array.isArray(value)) {
            const result = value
                .slice(0, MAX_ITEMS)
                .map((item) =>
                    sanitiseValue(item, depth + 1, seen, budget)
                );
            if (value.length > MAX_ITEMS) {
                result.push(`[${value.length - MAX_ITEMS} more item(s)]`);
            }
            return result;
        }

        const result = {};
        let keys;
        try {
            keys = Object.keys(value);
        } catch {
            return '[unavailable]';
        }

        keys.slice(0, MAX_KEYS).forEach((key) => {
            if (SENSITIVE_KEY_PATTERN.test(key)) {
                result[truncateString(key).slice(0, 80)] = '[redacted]';
                return;
            }

            const safeKey = truncateString(key).slice(0, 80);
            try {
                result[safeKey] = sanitiseValue(
                    value[key],
                    depth + 1,
                    seen,
                    budget
                );
            } catch {
                result[safeKey] = '[unavailable]';
            }
        });
        if (keys.length > MAX_KEYS) {
            result.__truncatedKeys = keys.length - MAX_KEYS;
        }
        return result;
    }

    function matchesFilter(category, level) {
        if (activeFilter === 'off') return false;
        if (LEVELS[level] < LEVELS[minimumLevel]) return false;
        return activeFilter === 'all'
            || category === activeFilter
            || category.startsWith(`${activeFilter}.`);
    }

    function notifySubscriber(subscriber, entry) {
        if (!matchesFilter(entry.category, entry.level)) return;
        try {
            subscriber.listener(entry);
        } catch {
            // A debug consumer must never throw back into its publisher.
        }
    }

    function replayHistory() {
        subscribers.forEach((subscriber) => {
            if (subscriber.replayOnConfigurationChange === false) return;
            history.forEach((entry) => notifySubscriber(subscriber, entry));
        });
    }

    function notifyStatusSubscribers() {
        const status = getStatus();
        statusSubscribers.forEach((listener) => {
            try {
                listener(status);
            } catch {
                // A status consumer must never throw back into the service.
            }
        });
    }

    function publish(level, category, message, data) {
        try {
            const normalisedSeverity = normaliseLevel(level);
            const normalisedCategory = normaliseCategory(category) || 'general';
            const entry = Object.freeze({
                id: nextEntryId++,
                timestamp: Date.now(),
                level: normalisedSeverity,
                category: normalisedCategory,
                message: truncateString(message ?? ''),
                ...(data === undefined ? {} : { data: sanitiseValue(data) })
            });

            const previousHistorySize = history.length;
            history.push(entry);
            if (history.length > HISTORY_LIMIT) history.shift();
            if (history.length !== previousHistorySize) {
                notifyStatusSubscribers();
            }

            if (!matchesFilter(entry.category, entry.level)) return entry;

            const prefix = `[OE:${entry.category}] ${entry.message}`;
            if (Object.prototype.hasOwnProperty.call(entry, 'data')) {
                nativeConsole[entry.level](prefix, entry.data);
            } else {
                nativeConsole[entry.level](prefix);
            }
            subscribers.forEach((subscriber) => notifySubscriber(subscriber, entry));
            return entry;
        } catch {
            return null;
        }
    }

    function getStatus() {
        return Object.freeze({
            filter: activeFilter,
            minimumLevel,
            enabled: activeFilter !== 'off',
            historySize: history.length,
            historyLimit: HISTORY_LIMIT
        });
    }

    function setFilter(filter) {
        const normalised = normaliseFilter(filter, '');
        if (!normalised) return false;
        activeFilter = normalised;
        window.OE_DEBUG = activeFilter !== 'off';
        writeStorage(STORAGE_KEYS.filter, activeFilter);
        notifyStatusSubscribers();
        replayHistory();
        return getStatus();
    }

    function setMinimumLevel(level) {
        const normalised = normaliseLevel(level, '');
        if (!normalised) return false;
        minimumLevel = normalised;
        writeStorage(STORAGE_KEYS.level, minimumLevel);
        notifyStatusSubscribers();
        replayHistory();
        return getStatus();
    }

    function subscribe(listener, options = {}) {
        if (typeof listener !== 'function') return () => {};

        const subscriber = {
            listener,
            replayOnConfigurationChange:
                options.replayOnConfigurationChange !== false
        };
        subscribers.add(subscriber);

        if (options.replay !== false) {
            history.forEach((entry) => notifySubscriber(subscriber, entry));
        }

        return () => {
            subscribers.delete(subscriber);
        };
    }

    function subscribeStatus(listener, options = {}) {
        if (typeof listener !== 'function') return () => {};

        statusSubscribers.add(listener);
        if (options.replay !== false) {
            try {
                listener(getStatus());
            } catch {
                // A status consumer must never throw back into the service.
            }
        }

        return () => {
            statusSubscribers.delete(listener);
        };
    }

    function legacyLog(level, args) {
        try {
            const values = Array.from(args);
            const firstValue = values.shift();
            const message = typeof firstValue === 'string'
                ? firstValue
                : 'Legacy debug output';
            const details = typeof firstValue === 'string'
                ? values
                : [firstValue, ...values];
            return publish(
                level,
                'legacy',
                message,
                details.length === 0
                    ? undefined
                    : details.length === 1
                        ? details[0]
                        : details
            );
        } catch {
            return null;
        }
    }

    const service = {
        debug: (category, message, data) =>
            publish('debug', category, message, data),
        info: (category, message, data) =>
            publish('info', category, message, data),
        warn: (category, message, data) =>
            publish('warn', category, message, data),
        error: (category, message, data) =>
            publish('error', category, message, data),
        getHistory: () => history.slice(),
        getStatus,
        setFilter,
        setMinimumLevel,
        subscribe,
        subscribeStatus,
        levels: Object.freeze(Object.keys(LEVELS)),
        filterSuggestions: FILTER_SUGGESTIONS
    };

    window.OEDebug = Object.freeze(service);
    window.OE_DEBUG = activeFilter !== 'off';
    window.debugLog = (...args) => legacyLog('debug', args);
    window.debugWarn = (...args) => legacyLog('warn', args);
})();
