(function () {
    const { clamp, createElement, getTouchCenter, getTouchDistance, versionUrl } = window.Error404PrototypeApplicationModules;
    const THREE_MODULE_PATH = "/vendor/three/build/three.module.js";
    const GLTF_LOADER_MODULE_PATH = "/vendor/three/loaders/GLTFLoader.js";
    let threeModulesPromise = null;

    function loadThreeModules() {
        if (!threeModulesPromise) {
            threeModulesPromise = Promise.all([
                import(THREE_MODULE_PATH),
                import(GLTF_LOADER_MODULE_PATH)
            ]).then(([THREE, gltfLoaderModule]) => ({
                THREE,
                GLTFLoader: gltfLoaderModule.GLTFLoader
            }));
        }

        return threeModulesPromise;
    }

    function frameToSeconds(config, frame) {
        const frameRate = Number(config.modelFrameRate) > 0 ? Number(config.modelFrameRate) : 30;
        const frameOffset = Number.isFinite(Number(config.modelFrameOffset)) ? Number(config.modelFrameOffset) : 1;
        return Math.max(0, (Number(frame) - frameOffset) / frameRate);
    }

    function createModelLoadStatus() {
        const status = createElement("p", "prototype-app-model-status", "LOADING MODEL");
        status.setAttribute("role", "status");
        return status;
    }

    function createThreeModelViewer({ config, viewport, overlay }) {
        const container = createElement("div", "prototype-app-three-model");
        const status = createModelLoadStatus();
        container.appendChild(status);

        const state = {
            destroyed: false,
            renderer: null,
            mixer: null,
            actions: [],
            clipDuration: 0,
            currentTime: 0,
            transitionFrame: null,
            camera: null,
            scene: null,
            modelRoot: null,
            target: null,
            startTarget: null,
            distance: 4,
            minDistance: 1,
            maxDistance: 10,
            rotateX: -14,
            rotateY: -24,
            pointerId: null,
            action: null,
            startX: 0,
            startY: 0,
            startRotateX: 0,
            startRotateY: 0,
            pinchDistance: 0,
            pinchZoom: 1,
            pinchCenterX: 0,
            pinchCenterY: 0,
            hasScheduledOverlayDismissal: false,
            resizeObserver: null,
            pendingAnimation: null,
            renderScheduled: false
        };

        function setInputMode(mode) {
            viewport.dataset.inputMode = mode;
        }

        function scheduleOverlayDismissal() {
            if (!overlay || state.hasScheduledOverlayDismissal) return;

            state.hasScheduledOverlayDismissal = true;
            overlay.classList.add("is-dismissed");
        }

        function setAction(action) {
            state.action = action;
            viewport.dataset.viewAction = action || "";
        }

        function updateCamera() {
            if (!state.camera || !state.target) return;

            const phi = state.THREE.MathUtils.degToRad(90 - state.rotateX);
            const theta = state.THREE.MathUtils.degToRad(state.rotateY);
            const radius = state.distance;
            const sinPhiRadius = Math.sin(phi) * radius;

            state.camera.position.set(
                sinPhiRadius * Math.sin(theta),
                Math.cos(phi) * radius,
                sinPhiRadius * Math.cos(theta)
            );
            state.camera.position.add(state.target);
            state.camera.lookAt(state.target);
        }

        function render() {
            if (state.destroyed || !state.renderer || !state.scene || !state.camera) return;

            state.renderer.render(state.scene, state.camera);
        }

        function requestRender() {
            if (state.renderScheduled) return;

            state.renderScheduled = true;
            requestAnimationFrame(() => {
                state.renderScheduled = false;
                render();
            });
        }

        function resize() {
            if (!state.renderer || !state.camera) return;

            const rect = container.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            state.camera.aspect = width / height;
            state.camera.updateProjectionMatrix();
            state.renderer.setSize(width, height, false);
            requestRender();
        }

        function prepareAnimationActions() {
            state.actions.forEach((action) => {
                action.paused = false;
                action.enabled = true;
                action.setEffectiveWeight(1);
                action.play();
            });
        }

        function setModelTime(seconds) {
            const maxTime = state.clipDuration > 0 ? state.clipDuration : Number.POSITIVE_INFINITY;
            state.currentTime = clamp(seconds, 0, maxTime);
            prepareAnimationActions();
            state.mixer.setTime(state.currentTime);
            state.actions.forEach((action) => {
                action.paused = true;
            });
            requestRender();
        }

        function getTransitionDuration(fromSeconds, toSeconds) {
            const frameRate = Number(config.modelFrameRate) > 0 ? Number(config.modelFrameRate) : 30;
            const speed = Number(config.modelTransitionSpeed) > 0 ? Number(config.modelTransitionSpeed) : 1.85;
            const frameDistance = Math.abs(toSeconds - fromSeconds) * frameRate;
            return clamp(frameDistance / frameRate / speed, 0.28, 1.65);
        }

        function seekToAnimation(animation, options = {}) {
            state.pendingAnimation = animation;
            if (!state.mixer || state.actions.length === 0 || !animation || !Number.isFinite(Number(animation.frame))) {
                return;
            }

            const maxTime = state.clipDuration > 0 ? state.clipDuration : Number.POSITIVE_INFINITY;
            const targetTime = clamp(frameToSeconds(config, animation.frame), 0, maxTime);
            if (state.transitionFrame) {
                cancelAnimationFrame(state.transitionFrame);
                state.transitionFrame = null;
            }

            if (options.instant === true) {
                setModelTime(targetTime);
                return;
            }

            const startTime = state.currentTime;
            const duration = getTransitionDuration(startTime, targetTime);
            const startedAt = performance.now();

            function step(now) {
                if (state.destroyed) return;

                const progress = clamp((now - startedAt) / (duration * 1000), 0, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                setModelTime(startTime + (targetTime - startTime) * eased);

                if (progress < 1) {
                    state.transitionFrame = requestAnimationFrame(step);
                    return;
                }

                state.transitionFrame = null;
                setModelTime(targetTime);
            }

            state.transitionFrame = requestAnimationFrame(step);
        }

        function prepareModelMaterials(root) {
            root.traverse((object) => {
                if (!object.isMesh) return;

                object.frustumCulled = false;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.filter(Boolean).forEach((material) => {
                    material.side = state.THREE.DoubleSide;

                    [
                        "map",
                        "emissiveMap",
                        "aoMap",
                        "alphaMap",
                        "roughnessMap",
                        "metalnessMap",
                        "normalMap"
                    ].forEach((key) => {
                        const texture = material[key];
                        if (!texture) return;

                        if (key === "map" || key === "emissiveMap") {
                            texture.colorSpace = state.THREE.SRGBColorSpace;
                        }
                        texture.needsUpdate = true;
                    });

                    material.needsUpdate = true;
                });
            });
        }

        function updateOrbit(deltaX, deltaY) {
            state.rotateX = clamp(state.startRotateX - deltaY * 0.35, -70, 70);
            state.rotateY = state.startRotateY - deltaX * 0.42;
            updateCamera();
            requestRender();
        }

        function updateZoom(zoom) {
            state.distance = clamp(zoom, state.minDistance, state.maxDistance);
            updateCamera();
            requestRender();
        }

        function updatePan(deltaX, deltaY) {
            if (!state.camera || !state.target || !state.startTarget) return;

            const rect = container.getBoundingClientRect();
            const height = Math.max(1, rect.height);
            const verticalSpan = 2 * state.distance * Math.tan(state.THREE.MathUtils.degToRad(state.camera.fov / 2));
            const worldUnitsPerPixel = verticalSpan / height;
            const forward = new state.THREE.Vector3();
            const right = new state.THREE.Vector3();
            const up = new state.THREE.Vector3();

            state.camera.getWorldDirection(forward);
            right.crossVectors(state.camera.up, forward).normalize();
            up.crossVectors(forward, right).normalize();

            state.target.copy(state.startTarget)
                .addScaledVector(right, deltaX * worldUnitsPerPixel)
                .addScaledVector(up, deltaY * worldUnitsPerPixel);
            updateCamera();
            requestRender();
        }

        function initThreeControls() {
            viewport.addEventListener("wheel", (event) => {
                if (state.destroyed) return;

                event.preventDefault();
                setInputMode("computer");
                scheduleOverlayDismissal();
                updateZoom(state.distance * (event.deltaY > 0 ? 1.1 : 0.9));
            }, { passive: false });

            viewport.addEventListener("mousedown", (event) => {
                if (event.button === 1 || event.button === 2) event.preventDefault();
            });

            viewport.addEventListener("pointerdown", (event) => {
                if (state.destroyed || event.pointerType !== "mouse" || (event.button !== 1 && event.button !== 2)) return;

                event.preventDefault();
                setInputMode("computer");
                scheduleOverlayDismissal();
                state.pointerId = event.pointerId;
                state.startX = event.clientX;
                state.startY = event.clientY;
                state.startRotateX = state.rotateX;
                state.startRotateY = state.rotateY;
                state.startTarget = state.target?.clone() || null;
                setAction(event.button === 2 ? "pan" : "orbit");
                viewport.setPointerCapture(event.pointerId);
            });

            viewport.addEventListener("pointermove", (event) => {
                if (state.destroyed || event.pointerType !== "mouse" || event.pointerId !== state.pointerId || !state.action) return;

                event.preventDefault();
                if (state.action === "pan") {
                    updatePan(event.clientX - state.startX, event.clientY - state.startY);
                } else {
                    updateOrbit(event.clientX - state.startX, event.clientY - state.startY);
                }
            });

            function endPointer(event) {
                if (event.pointerId !== state.pointerId) return;

                if (viewport.hasPointerCapture(event.pointerId)) {
                    viewport.releasePointerCapture(event.pointerId);
                }
                state.pointerId = null;
                setAction(null);
            }

            viewport.addEventListener("pointerup", endPointer);
            viewport.addEventListener("pointercancel", endPointer);
            viewport.addEventListener("auxclick", (event) => {
                if (event.button === 1) event.preventDefault();
            });
            viewport.addEventListener("contextmenu", (event) => event.preventDefault());

            viewport.addEventListener("touchstart", (event) => {
                if (state.destroyed || event.touches.length < 1) return;

                event.preventDefault();
                setInputMode("touch");
                scheduleOverlayDismissal();
                const center = getTouchCenter(event.touches);
                state.startX = center.x;
                state.startY = center.y;
                state.startRotateX = state.rotateX;
                state.startRotateY = state.rotateY;
                state.pinchDistance = getTouchDistance(event.touches);
                state.pinchZoom = state.distance;
                state.pinchCenterX = center.x;
                state.pinchCenterY = center.y;
                state.startTarget = state.target?.clone() || null;
                setAction(event.touches.length > 1 ? "pan" : "orbit");
            }, { passive: false });

            viewport.addEventListener("touchmove", (event) => {
                if (state.destroyed || event.touches.length < 1 || !state.action) return;

                event.preventDefault();
                const center = getTouchCenter(event.touches);

                if (event.touches.length > 1 && state.pinchDistance > 0) {
                    const distance = getTouchDistance(event.touches);
                    updateZoom(state.pinchZoom * (state.pinchDistance / distance));
                    updatePan(center.x - state.pinchCenterX, center.y - state.pinchCenterY);
                    setAction("pan");
                } else {
                    updateOrbit(center.x - state.startX, center.y - state.startY);
                    setAction("orbit");
                }
            }, { passive: false });

            viewport.addEventListener("touchend", (event) => {
                if (state.destroyed) return;

                if (event.touches.length === 1) {
                    const center = getTouchCenter(event.touches);
                    state.startX = center.x;
                    state.startY = center.y;
                    state.startRotateX = state.rotateX;
                    state.startRotateY = state.rotateY;
                    state.pinchDistance = 0;
                    state.startTarget = state.target?.clone() || null;
                    setAction("orbit");
                    return;
                }

                setAction(null);
            });

            viewport.addEventListener("touchcancel", () => setAction(null));
            setInputMode(window.matchMedia?.("(pointer: coarse)")?.matches ? "touch" : "computer");
        }

        async function loadModel() {
            try {
                const { THREE, GLTFLoader } = await loadThreeModules();
                if (state.destroyed) return;

                state.THREE = THREE;
                state.scene = new THREE.Scene();
                state.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);

                state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                state.renderer.outputColorSpace = THREE.SRGBColorSpace;
                state.renderer.toneMapping = THREE.NoToneMapping;
                state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                container.appendChild(state.renderer.domElement);

                const ambientLight = new THREE.HemisphereLight(0xffffff, 0xd8d8d8, 2.1);
                const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
                keyLight.position.set(3, 4, 4);
                const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
                fillLight.position.set(-4, 2, -3);
                state.scene.add(ambientLight, keyLight, fillLight);

                const gltf = await new GLTFLoader().loadAsync(versionUrl(config.modelFilePath));
                if (state.destroyed) return;

                state.modelRoot = gltf.scene;
                prepareModelMaterials(state.modelRoot);
                state.scene.add(state.modelRoot);

                const box = new THREE.Box3().setFromObject(state.modelRoot);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z) || 1;
                state.modelRoot.position.sub(center);
                state.target = new THREE.Vector3(0, 0, 0);
                state.distance = maxDim * 2.2;
                state.minDistance = maxDim * 0.8;
                state.maxDistance = maxDim * 5;

                state.mixer = new THREE.AnimationMixer(state.modelRoot);
                state.actions = gltf.animations.map((clip) => state.mixer.clipAction(clip));
                state.clipDuration = gltf.animations.reduce((duration, clip) => Math.max(duration, clip.duration || 0), 0);
                state.actions.forEach((action) => {
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;
                });

                status.remove();
                initThreeControls();
                updateCamera();
                resize();

                if (state.pendingAnimation) {
                    seekToAnimation(state.pendingAnimation, { instant: true });
                } else {
                    requestRender();
                }
            } catch (error) {
                console.error("Prototype model failed to load:", error);
                status.textContent = "MODEL UNAVAILABLE";
            }
        }

        state.resizeObserver = new ResizeObserver(resize);
        state.resizeObserver.observe(container);
        loadModel();

        return {
            element: container,
            seekToAnimation,
            destroy() {
                state.destroyed = true;
                if (state.transitionFrame) {
                    cancelAnimationFrame(state.transitionFrame);
                }
                state.resizeObserver?.disconnect();
                state.renderer?.dispose();
                state.renderer?.domElement?.remove();
            }
        };
    }

    window.Error404PrototypeApplicationModules.createThreeModelViewer = createThreeModelViewer;
})();
