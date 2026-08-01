(function () {
    const APPLICATION_TYPE = "prototype-application";
    const MODULE_SCRIPTS = [
        "/scripts/other/applications/prototype-application/shared.js",
        "/scripts/other/applications/prototype-application/package-viewer.js",
        "/scripts/other/applications/prototype-application/three-model-viewer.js"
    ];
    let modulesPromise = null;

    function loadScript(src) {
        if (window.Error404SplashScripts?.loadScript) {
            return window.Error404SplashScripts.loadScript(src);
        }

        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"], script[src^="${src}?"]`);
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
            script.src = typeof versionAssetUrl === "function"
                ? versionAssetUrl(src, { cacheBustKey: "ERROR_404" })
                : src;
            script.onload = () => {
                script.dataset.loaded = "true";
                resolve();
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function loadModules() {
        const modules = window.Error404PrototypeApplicationModules;
        if (modules?.createThreeModelViewer && modules.createPackageModel && modules.initViewControls) {
            return Promise.resolve(modules);
        }

        if (!modulesPromise) {
            modulesPromise = MODULE_SCRIPTS
                .reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve())
                .then(() => {
                    const loadedModules = window.Error404PrototypeApplicationModules;
                    if (!loadedModules?.createThreeModelViewer || !loadedModules.createPackageModel || !loadedModules.initViewControls) {
                        throw new Error("Prototype application modules are not available");
                    }
                    return loadedModules;
                })
                .catch((error) => {
                    modulesPromise = null;
                    throw error;
                });
        }

        return modulesPromise;
    }

    async function submitNewsletter(config, email) {
        if (config.newsletterEndpoint) {
            const response = await fetch(config.newsletterEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, source: config.productName || APPLICATION_TYPE })
            });

            if (!response.ok) {
                throw new Error("Newsletter request failed");
            }
            return;
        }

        const storageKey = config.newsletterStorageKey || "prototype-application-newsletter";
        const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (!existing.includes(email)) existing.push(email);
        localStorage.setItem(storageKey, JSON.stringify(existing));
    }

    function initApplication({ mount, application }, modules) {
        const {
            applyAnimationLayout,
            applyPanelColours,
            applyViewportBackground,
            createControlsOverlay,
            createElement,
            createPackageModel,
            createThreeModelViewer,
            getConfig,
            initViewControls
        } = modules;
        const config = getConfig(application);
        const animations = Array.isArray(config.animations) && config.animations.length > 0
            ? config.animations
            : [{ id: "idle" }];

        mount.dataset.applicationReady = "true";
        mount.classList.add("prototype-application");
        mount.replaceChildren();

        const shell = createElement("div", "prototype-app-shell");
        applyPanelColours(shell, config);
        const viewport = createElement("div", "prototype-app-viewport");
        applyViewportBackground(viewport, config);
        const controls = createElement("aside", "prototype-app-controls");
        const voidScene = createElement("div", "prototype-app-void");
        const controlsOverlay = createControlsOverlay();
        const modelViewer = config.modelFilePath ? createThreeModelViewer({ config, viewport, overlay: controlsOverlay }) : null;
        const model = modelViewer ? modelViewer.element : createPackageModel(config);

        voidScene.appendChild(createElement("div", "prototype-app-ground-shadow"));
        voidScene.appendChild(model);
        viewport.append(voidScene, controlsOverlay);
        if (!modelViewer) {
            initViewControls({ mount, viewport, scene: voidScene, overlay: controlsOverlay });
        }

        const title = createElement("h3", "prototype-app-title", config.productName || "PROTOTYPE VIEWER");
        const animationGroup = createElement("div", "prototype-app-button-group");
        animationGroup.setAttribute("aria-label", "Change prototype layout");

        animations.forEach((animation, index) => {
            const button = createElement("button", "prototype-app-animation-button", animation.label || String(index + 1));
            button.type = "button";
            button.setAttribute("aria-label", `Prototype layout ${index + 1}`);
            button.addEventListener("click", () => {
                if (modelViewer) {
                    modelViewer.seekToAnimation(animation);
                } else {
                    applyAnimationLayout(model, animation);
                }
                animationGroup.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
            });
            animationGroup.appendChild(button);
            if (index === 0) {
                button.classList.add("is-active");
                if (modelViewer) {
                    modelViewer.seekToAnimation(animation);
                } else {
                    applyAnimationLayout(model, animation);
                }
            }
        });

        const description = createElement("p", "prototype-app-description", config.modelDescription || "");
        if (!config.modelDescription) description.hidden = true;

        const form = createElement("form", "prototype-app-newsletter");
        const formTitle = createElement("h4", "prototype-app-newsletter-title", config.newsletterTitle || "NEWSLETTER");
        const input = createElement("input", "prototype-app-email-input");
        input.type = "email";
        input.name = "email";
        input.placeholder = config.newsletterPlaceholder || "email address";
        input.autocomplete = "email";
        input.required = true;

        const submit = createElement("button", "prototype-app-submit-button", "SIGN UP");
        submit.type = "submit";
        const status = createElement("p", "prototype-app-status");
        status.setAttribute("role", "status");

        form.append(formTitle, input, submit, status);
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            submit.disabled = true;
            status.textContent = "SENDING...";

            try {
                await submitNewsletter(config, input.value.trim());
                status.textContent = "SIGNED UP";
                form.reset();
            } catch {
                status.textContent = "TRY AGAIN";
            } finally {
                submit.disabled = false;
            }
        });

        controls.append(title, animationGroup, description, form);
        shell.append(viewport, controls);
        mount.appendChild(shell);

        return {
            id: application?.id || APPLICATION_TYPE,
            mount,
            destroy() {
                modelViewer?.destroy();
            }
        };
    }

    function init(context = {}) {
        if (!context.mount) return null;

        return loadModules().then((modules) => initApplication(context, modules));
    }

    window.Error404PrototypeApplication = { init };
    window.Error404Applications = window.Error404Applications || {};
    window.Error404Applications[APPLICATION_TYPE] = window.Error404PrototypeApplication;
})();
