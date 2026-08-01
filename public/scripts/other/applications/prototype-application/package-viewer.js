(function () {
    const { clamp, createElement, getTouchCenter, getTouchDistance } = window.Error404PrototypeApplicationModules;

    function createPackageModel(config) {
        const model = createElement("div", "prototype-app-package-model");
        model.setAttribute("aria-label", config.modelLabel || config.productName || "3D product model");
        model.setAttribute("role", "img");

        ["front", "back", "right", "left", "top", "bottom"].forEach((side) => {
            const face = createElement("div", `prototype-app-package-face ${side}`);
            if (side === "front") {
                face.appendChild(createElement("span", "prototype-app-package-brand", config.modelLabel || "PACKAGE"));
            }
            model.appendChild(face);
        });

        return model;
    }

    function applyAnimationLayout(model, animation) {
        model.dataset.animation = animation.id || "idle";
    }

    function initViewControls({ mount, viewport, scene, overlay }) {
        const view = {
            inputMode: "computer",
            pointerId: null,
            action: null,
            startX: 0,
            startY: 0,
            startRotateX: 0,
            startRotateY: 0,
            rotateX: 0,
            rotateY: 0,
            zoom: 1,
            pinchDistance: 0,
            pinchZoom: 1,
            hasScheduledOverlayDismissal: false
        };

        function setInputMode(mode) {
            view.inputMode = mode;
            viewport.dataset.inputMode = mode;
            mount.dataset.prototypeInputMode = mode;
        }

        function scheduleOverlayDismissal() {
            if (!overlay || view.hasScheduledOverlayDismissal) return;

            view.hasScheduledOverlayDismissal = true;
            overlay.classList.add("is-dismissed");
        }

        function applyView() {
            scene.style.setProperty("--prototype-view-rotate-x", `${view.rotateX}deg`);
            scene.style.setProperty("--prototype-view-rotate-y", `${view.rotateY}deg`);
            scene.style.setProperty("--prototype-view-zoom", String(view.zoom));
        }

        function setAction(action) {
            view.action = action;
            viewport.dataset.viewAction = action || "";
        }

        function updateZoom(zoom) {
            view.zoom = clamp(zoom, 0.55, 2.8);
        }

        function updateOrbit(deltaX, deltaY) {
            view.rotateX = clamp(view.startRotateX - deltaY * 0.35, -65, 65);
            view.rotateY = view.startRotateY + deltaX * 0.45;
        }

        viewport.addEventListener("wheel", (event) => {
            event.preventDefault();
            setInputMode("computer");
            scheduleOverlayDismissal();
            updateZoom(view.zoom * (event.deltaY > 0 ? 0.9 : 1.1));
            applyView();
        }, { passive: false });

        viewport.addEventListener("mousedown", (event) => {
            if (event.button === 1) event.preventDefault();
        });

        viewport.addEventListener("pointerdown", (event) => {
            if (event.pointerType !== "mouse" || event.button !== 1) return;

            event.preventDefault();
            setInputMode("computer");
            scheduleOverlayDismissal();
            view.pointerId = event.pointerId;
            view.startX = event.clientX;
            view.startY = event.clientY;
            view.startRotateX = view.rotateX;
            view.startRotateY = view.rotateY;
            setAction("orbit");
            viewport.setPointerCapture(event.pointerId);
        });

        viewport.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse" || event.pointerId !== view.pointerId || !view.action) return;

            event.preventDefault();
            const deltaX = event.clientX - view.startX;
            const deltaY = event.clientY - view.startY;

            updateOrbit(deltaX, deltaY);
            applyView();
        });

        function endPointer(event) {
            if (event.pointerId !== view.pointerId) return;

            if (viewport.hasPointerCapture(event.pointerId)) {
                viewport.releasePointerCapture(event.pointerId);
            }
            view.pointerId = null;
            setAction(null);
        }

        viewport.addEventListener("pointerup", endPointer);
        viewport.addEventListener("pointercancel", endPointer);
        viewport.addEventListener("auxclick", (event) => {
            if (event.button === 1) event.preventDefault();
        });

        viewport.addEventListener("touchstart", (event) => {
            if (event.touches.length < 1) return;

            event.preventDefault();
            setInputMode("touch");
            scheduleOverlayDismissal();
            const center = getTouchCenter(event.touches);
            view.startX = center.x;
            view.startY = center.y;
            view.startRotateX = view.rotateX;
            view.startRotateY = view.rotateY;
            view.pinchDistance = getTouchDistance(event.touches);
            view.pinchZoom = view.zoom;
            setAction(event.touches.length > 1 ? "pinch" : "orbit");
        }, { passive: false });

        viewport.addEventListener("touchmove", (event) => {
            if (event.touches.length < 1 || !view.action) return;

            event.preventDefault();
            const center = getTouchCenter(event.touches);

            if (event.touches.length > 1 && view.pinchDistance > 0) {
                const distance = getTouchDistance(event.touches);
                updateZoom(view.pinchZoom * (distance / view.pinchDistance));
                setAction("pinch");
            } else {
                updateOrbit(center.x - view.startX, center.y - view.startY);
                setAction("orbit");
            }

            applyView();
        }, { passive: false });

        viewport.addEventListener("touchend", (event) => {
            if (event.touches.length === 1) {
                const center = getTouchCenter(event.touches);
                view.startX = center.x;
                view.startY = center.y;
                view.startRotateX = view.rotateX;
                view.startRotateY = view.rotateY;
                view.pinchDistance = 0;
                setAction("orbit");
                return;
            }

            setAction(null);
        });

        viewport.addEventListener("touchcancel", () => setAction(null));
        setInputMode(window.matchMedia?.("(pointer: coarse)")?.matches ? "touch" : "computer");
        applyView();
    }

    Object.assign(window.Error404PrototypeApplicationModules, {
        createPackageModel,
        applyAnimationLayout,
        initViewControls
    });
})();
