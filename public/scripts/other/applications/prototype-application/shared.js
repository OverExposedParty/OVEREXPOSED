(function () {
    const modules = window.Error404PrototypeApplicationModules = window.Error404PrototypeApplicationModules || {};

    function getConfig(application) {
        return application?.config && typeof application.config === "object" ? application.config : {};
    }

    function versionUrl(path) {
        return typeof versionAssetUrl === "function" ? versionAssetUrl(path, { cacheBustKey: "ERROR_404" }) : path;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function isHexColour(value) {
        return /^#[0-9a-f]{6}$/i.test(String(value || ""));
    }

    function setColourProperty(element, property, value) {
        if (!isHexColour(value)) return;

        element.style.setProperty(property, value);
    }

    function getBackgroundUrl(config) {
        return config.background?.url || config.backgroundUrl || config.backgroundImage || "";
    }

    function applyViewportBackground(viewport, config) {
        const backgroundUrl = getBackgroundUrl(config);
        if (!backgroundUrl) return;

        viewport.style.setProperty("--prototype-background-image", `url("${versionUrl(backgroundUrl)}")`);
        viewport.dataset.hasPrototypeBackground = "true";
    }

    function applyPanelColours(shell, config) {
        const buttonColours = config.panelButtonColours || {};
        const legacyButtonColour = config.panelButtonColour;

        setColourProperty(shell, "--prototype-panel-background-colour", config.panelBackgroundColour);
        setColourProperty(shell, "--prototype-panel-text-colour", config.panelTextColour);
        setColourProperty(shell, "--prototype-panel-email-address-input-background", config.panelEmailAddressInput);
        setColourProperty(shell, "--prototype-panel-button-default-background", buttonColours.default?.background || buttonColours.default?.main || legacyButtonColour);
        setColourProperty(shell, "--prototype-panel-button-default-text", buttonColours.default?.text || buttonColours.default?.accent || config.panelTextColour);
        setColourProperty(shell, "--prototype-panel-button-hover-background", buttonColours.hover?.background || buttonColours.hover?.main);
        setColourProperty(shell, "--prototype-panel-button-hover-text", buttonColours.hover?.text || buttonColours.hover?.accent);
        setColourProperty(shell, "--prototype-panel-button-selected-background", buttonColours.selected?.background || buttonColours.selected?.main);
        setColourProperty(shell, "--prototype-panel-button-selected-text", buttonColours.selected?.text || buttonColours.selected?.accent);
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getTouchCenter(touches) {
        const first = touches[0];
        const second = touches[1] || touches[0];
        return {
            x: (first.clientX + second.clientX) / 2,
            y: (first.clientY + second.clientY) / 2
        };
    }

    function getTouchDistance(touches) {
        if (touches.length < 2) return 0;

        const x = touches[0].clientX - touches[1].clientX;
        const y = touches[0].clientY - touches[1].clientY;
        return Math.hypot(x, y);
    }

    function createControlsOverlay() {
        const overlay = createElement("div", "prototype-app-controls-overlay");
        overlay.setAttribute("aria-live", "polite");

        const computerControls = createElement("div", "prototype-app-controls-card computer");
        computerControls.append(
            createElement("h4", "prototype-app-controls-title", "CONTROLS"),
            createElement("p", "prototype-app-controls-line", "MIDDLE MOUSE DRAG: ORBIT"),
            createElement("p", "prototype-app-controls-line", "RIGHT MOUSE DRAG: PAN"),
            createElement("p", "prototype-app-controls-line", "SCROLL WHEEL: ZOOM")
        );

        const touchControls = createElement("div", "prototype-app-controls-card touch");
        touchControls.append(
            createElement("h4", "prototype-app-controls-title", "CONTROLS"),
            createElement("p", "prototype-app-controls-line", "DRAG: ORBIT"),
            createElement("p", "prototype-app-controls-line", "TWO FINGER DRAG: PAN"),
            createElement("p", "prototype-app-controls-line", "PINCH: ZOOM")
        );

        overlay.append(computerControls, touchControls);
        return overlay;
    }

    Object.assign(modules, {
        getConfig,
        versionUrl,
        createElement,
        applyViewportBackground,
        applyPanelColours,
        clamp,
        getTouchCenter,
        getTouchDistance,
        createControlsOverlay
    });
})();
