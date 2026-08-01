function stripError404ScriptQuery(src) {
    return String(src || "").split("?")[0];
}

function trackError404Script(src) {
    const baseSrc = stripError404ScriptQuery(src);
    window.pageScripts = window.pageScripts || {};

    if (!window.pageScripts[baseSrc]) {
        window.pageScripts[baseSrc] = {
            addDataLoaded: true,
            cacheBustKey: "ERROR_404",
            zIndex: 0
        };
    }

    return baseSrc;
}

function markError404ScriptLoaded(src) {
    const baseSrc = stripError404ScriptQuery(src);

    if (typeof SetScriptLoaded === "function") {
        SetScriptLoaded(baseSrc);
    }
}

function loadError404Script(src) {
    const baseSrc = trackError404Script(src);

    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${baseSrc}"], script[src^="${baseSrc}?"]`);
        if (existing) {
            if (existing.dataset.loaded === "true") {
                resolve();
                return;
            }

            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.dataset.loaded = "false";
        script.src = typeof versionAssetUrl === "function" ? versionAssetUrl(baseSrc, { cacheBustKey: "ERROR_404" }) : baseSrc;
        script.onload = () => {
            markError404ScriptLoaded(baseSrc);
            resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

window.Error404SplashScripts = {
    loadScript: loadError404Script,
    markLoaded: markError404ScriptLoaded,
    track: trackError404Script
};

document.body.classList.add("error-404-page");
window.error404Screen = document.getElementById("screen");

const isTerminalRoute = window.location.pathname.toLowerCase().replace(/\/+$/, "") === "/terminal";
if (isTerminalRoute) {
    document.title = "TERMINAL | OVEREXPOSED";
    document.body.classList.add("terminal-page");
}

loadError404Script("/scripts/other/operating-system/operating-system.js")
    .then(() => window.OperatingSystem?.init?.({
        openLaunchApplications: !isTerminalRoute
    }))
    .catch((error) => console.error("Error loading 404 operating system:", error))
    .finally(() => {
        if (typeof SetScriptLoaded === "function") {
            SetScriptLoaded("/scripts/other/404/404.js");
        }
    });
