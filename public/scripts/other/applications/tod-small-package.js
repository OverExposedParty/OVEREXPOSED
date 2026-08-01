(function () {
    const APPLICATION_ID = "tod-small-package-app";
    const PROTOTYPE_APPLICATION_SCRIPT = "/scripts/other/applications/prototype-application.js";

    function versionUrl(path) {
        return typeof versionAssetUrl === "function" ? versionAssetUrl(path, { cacheBustKey: "ERROR_404" }) : path;
    }

    function loadPrototypeApplication() {
        if (window.Error404PrototypeApplication) {
            return Promise.resolve(window.Error404PrototypeApplication);
        }

        if (window.Error404SplashScripts?.loadScript) {
            return window.Error404SplashScripts
                .loadScript(PROTOTYPE_APPLICATION_SCRIPT)
                .then(() => window.Error404PrototypeApplication);
        }

        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${PROTOTYPE_APPLICATION_SCRIPT}"], script[src^="${PROTOTYPE_APPLICATION_SCRIPT}?"]`);
            if (existing) {
                existing.addEventListener("load", () => resolve(window.Error404PrototypeApplication), { once: true });
                existing.addEventListener("error", reject, { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = versionUrl(PROTOTYPE_APPLICATION_SCRIPT);
            script.onload = () => resolve(window.Error404PrototypeApplication);
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function init(context = {}) {
        const { mount } = context;
        if (!mount) return null;

        mount.dataset.applicationReady = "loading";
        return loadPrototypeApplication()
            .then((prototypeApplication) => {
                if (typeof prototypeApplication?.init !== "function") {
                    throw new Error("Prototype application is not available");
                }
                return prototypeApplication.init(context);
            })
            .catch(() => {
                mount.dataset.applicationReady = "error";
                mount.textContent = "Unable to load T.O.D Small Package.";
            });
    }

    window.Error404Applications = window.Error404Applications || {};
    window.Error404Applications[APPLICATION_ID] = { init };
})();
