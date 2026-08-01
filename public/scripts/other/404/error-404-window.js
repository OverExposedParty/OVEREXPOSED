(function () {
    const SCRIPT_BASE = "/scripts/other/operating-system/";
    const APPLICATIONS_PATH = "/json-files/error-404/applications.json";
    const DEFAULT_ICON_FILE_PATHS = {
        application: "/images/error-404/icons/default-application-icons/application.svg",
        mp3Application: "/images/error-404/icons/default-application-icons/audio.svg",
        prototypeApplication: "/images/error-404/icons/default-application-icons/3d-model.svg",
        textFile: "/images/error-404/icons/default-application-icons/text-file.svg"
    };

    function versionUrl(path) {
        return typeof versionAssetUrl === "function" ? versionAssetUrl(path, { cacheBustKey: "ERROR_404" }) : path;
    }

    function loadScript(src) {
        if (window.Error404SplashScripts?.loadScript) {
            return window.Error404SplashScripts.loadScript(src);
        }

        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"], script[src^="${src}?"]`);
            if (existing) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = versionUrl(src);
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    async function fetchJson(path) {
        const response = await fetch(versionUrl(path));
        if (!response.ok) {
            throw new Error(`Failed to load ${path}`);
        }

        return response.json();
    }

    async function fetchText(path) {
        const response = await fetch(versionUrl(path));
        if (!response.ok) {
            throw new Error(`Failed to load ${path}`);
        }

        return response.text();
    }

    function slugify(value) {
        return String(value || "application")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "application";
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function isHexColour(value) {
        return /^#[0-9a-f]{6}$/i.test(String(value || ""));
    }

    function getDefaultIconFilePath(app, windowData = {}) {
        const elements = Array.isArray(windowData.elements) ? windowData.elements : [];
        const hasTextFile = elements.some((element) => element.type === "text");
        const hasPrototypeApplication =
            app.applicationType === "prototype-application" ||
            elements.some((element) =>
                element.type === "application" &&
                element.applicationType === "prototype-application"
            );
        const hasMp3Application =
            app.applicationType === "mp3-application" ||
            elements.some((element) =>
                element.type === "application" &&
                element.applicationType === "mp3-application"
            );

        if (hasTextFile) return DEFAULT_ICON_FILE_PATHS.textFile;
        if (hasMp3Application) return DEFAULT_ICON_FILE_PATHS.mp3Application;
        if (hasPrototypeApplication) return DEFAULT_ICON_FILE_PATHS.prototypeApplication;
        return DEFAULT_ICON_FILE_PATHS.application;
    }

    async function renderWindowElements(elements = []) {
        const hasApplication = elements.some((element) => element.type === "application");
        const applications = [];
        const contentParts = await Promise.all(elements.map(async (element) => {
            if (element.type === "application") {
                const applicationId = slugify(element.id || element.name || "application");
                const label = escapeHtml(element.label || element.name || "Application");
                applications.push({
                    id: applicationId,
                    script: element.script || "",
                    label: element.label || element.name || "Application",
                    applicationType: element.applicationType || "",
                    config: element.config || {}
                });

                return `<div class="monitor-os-window-application" data-application-id="${applicationId}" aria-label="${label}"></div>`;
            }

            const rawText = element.type === "text" && element.filePath ? await fetchText(element.filePath) : element.text;
            const text = escapeHtml(rawText);
            const colour = isHexColour(element.colour) ? element.colour : "#000000";
            const colourStyle = ` style="color: ${colour}"`;

            if (element.type === "text") {
                const label = escapeHtml(element.label || "Read only text file");
                return `<pre class="monitor-os-readonly-text-file" aria-label="${label}" role="textbox" aria-readonly="true" tabindex="0">${text}</pre>`;
            }

            if (element.type === "heading") {
                return `<h2${colourStyle}>${text}</h2>`;
            }

            return `<p${colourStyle}>${text}</p>`;
        }));

        return {
            content: contentParts.join(""),
            contentClassName: hasApplication ? "monitor-os-window-content--application" : "",
            applications
        };
    }

    function createDesktopIcon(screen, manager, app) {
        const desktop = screen.querySelector(".monitor-os-desktop");
        if (!desktop || desktop.querySelector(`[data-window-open="${app.id}"]`)) return;

        const icon = document.createElement("button");
        icon.className = "monitor-os-icon";
        icon.type = "button";
        icon.dataset.windowOpen = app.id;

        const image = document.createElement("img");
        image.className = "monitor-os-icon-image";
        image.src = versionUrl(app.iconFilePath || DEFAULT_ICON_FILE_PATHS.application);
        image.alt = "";
        image.decoding = "async";

        const label = document.createElement("span");
        label.className = "monitor-os-icon-label";
        label.textContent = app.name;

        icon.append(image, label);
        icon.addEventListener("dblclick", () => manager.openWindow(app.id));
        icon.addEventListener("click", () => manager.openWindow(app.id));
        desktop.appendChild(icon);
    }

    async function registerApplicationWindow(manager, app) {
        const windowData = app.windowFilePath ? await fetchJson(app.windowFilePath) : {};
        const windowConfig = windowData.window || {};
        app.iconFilePath = app.iconFilePath || getDefaultIconFilePath(app, windowData);
        const renderedWindow = await renderWindowElements(windowData.elements);
        let activeApplicationInstances = [];
        let applicationInitRun = 0;
        let initialisingApplications = null;

        await Promise.all(renderedWindow.applications.map((application) => {
            if (!application.script) return Promise.resolve();
            return loadScript(application.script);
        }));

        function getWindowContent(windowRecord) {
            return windowRecord.element.querySelector(".monitor-os-window-content");
        }

        function resetWindowContent(windowRecord) {
            const content = getWindowContent(windowRecord);
            if (content) {
                content.innerHTML = renderedWindow.content;
            }
        }

        function destroyApplications() {
            activeApplicationInstances.forEach((instance) => {
                if (typeof instance?.destroy !== "function") return;

                try {
                    instance.destroy();
                } catch (error) {
                    console.error("Error 404 application failed to destroy:", error);
                }
            });
            activeApplicationInstances = [];
        }

        function startApplications(windowRecord) {
            if (initialisingApplications) return initialisingApplications;

            const runId = ++applicationInitRun;
            const applicationStarts = renderedWindow.applications.map((application) => {
                const mount = windowRecord.element.querySelector(`[data-application-id="${application.id}"]`);
                const registeredApplication =
                    window.Error404Applications?.[application.id] ||
                    window.Error404Applications?.[application.applicationType];

                if (!mount || typeof registeredApplication?.init !== "function") return Promise.resolve(null);

                return Promise.resolve().then(() => registeredApplication.init({
                    mount,
                    applicationId: application.id,
                    windowId: app.id,
                    app,
                    application,
                    windowData
                }));
            });

            initialisingApplications = Promise.all(applicationStarts)
                .then((instances) => {
                    if (runId === applicationInitRun) {
                        activeApplicationInstances = instances.filter(Boolean);
                        return;
                    }

                    instances.forEach((instance) => {
                        if (typeof instance?.destroy !== "function") return;

                        try {
                            instance.destroy();
                        } catch (error) {
                            console.error("Stale Error 404 application failed to destroy:", error);
                        }
                    });
                })
                .catch((error) => {
                    console.error("Error 404 application failed to initialise:", error);
                })
                .finally(() => {
                    if (runId === applicationInitRun) {
                        initialisingApplications = null;
                    }
                });

            return initialisingApplications;
        }

        function restartApplications(windowRecord) {
            resetWindowContent(windowRecord);
            startApplications(windowRecord);
        }

        function closeApplications(windowRecord) {
            applicationInitRun += 1;
            initialisingApplications = null;
            destroyApplications();
            resetWindowContent(windowRecord);
        }

        const windowRecord = manager.registerWindow({
            id: app.id,
            title: windowData.title || app.name,
            iconPath: app.iconFilePath ? versionUrl(app.iconFilePath) : "",
            width: windowConfig.width ?? 58,
            height: windowConfig.height ?? 56,
            x: windowConfig.x ?? 22,
            y: windowConfig.y ?? 14,
            openExpanded: windowConfig.openExpanded === true,
            titlebarColour: isHexColour(windowConfig.titlebarColour) ? windowConfig.titlebarColour : undefined,
            titlebarTextColour: isHexColour(windowConfig.titlebarTextColour) ? windowConfig.titlebarTextColour : undefined,
            backgroundColour: isHexColour(windowConfig.backgroundColour) ? windowConfig.backgroundColour : undefined,
            content: renderedWindow.content,
            contentClassName: renderedWindow.contentClassName,
            onOpen: restartApplications,
            onClose: closeApplications
        });

        return windowRecord;
    }

    async function loadApplicationScript(app) {
        const scriptPath = app.script?.filePath;
        if (!scriptPath) return;

        await loadScript(scriptPath);
    }

    async function init(screen, options = {}) {
        await loadScript(`${SCRIPT_BASE}os-window-manager.js`);

        if (!window.OSWindowManager) return null;

        const manager = window.OSWindowManager.create(screen);
        const applications = await fetchJson(APPLICATIONS_PATH);
        const normalizedApplications = applications.map((app) => ({
            ...app,
            id: app.id || slugify(app.name)
        })).filter((app) => app.active === true);

        await Promise.all(normalizedApplications.map((app) => loadApplicationScript(app)));
        await Promise.all(normalizedApplications.map((app) => registerApplicationWindow(manager, app)));

        const openLaunchApplications = options.openLaunchApplications !== false;
        normalizedApplications.forEach((app) => {
            createDesktopIcon(screen, manager, app);

            if (openLaunchApplications && app.loadOnLaunch === true) {
                manager.openWindow(app.id);
            }
        });

        return manager;
    }

    window.Error404Window = { init };
})();
