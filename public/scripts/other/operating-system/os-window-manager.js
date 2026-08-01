(function () {
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function create(screen) {
        const desktop = screen.querySelector(".monitor-os-desktop");
        const taskbarItems = screen.querySelector(".monitor-os-taskbar-items");
        const windows = new Map();
        let topZIndex = 10;

        function getDesktopBounds() {
            return desktop.getBoundingClientRect();
        }

        function focusWindow(record) {
            topZIndex += 1;
            record.element.style.zIndex = String(topZIndex);
            windows.forEach((item) => item.taskbarButton?.classList.toggle("is-active", item === record));
        }

        function createIconImage(iconPath, className, alt = "") {
            if (!iconPath) return null;

            const image = document.createElement("img");
            image.className = className;
            image.src = iconPath;
            image.alt = alt;
            image.decoding = "async";
            return image;
        }

        function updateTaskbar(record) {
            if (!record.taskbarButton) {
                const button = document.createElement("button");
                button.className = "monitor-os-taskbar-button";
                button.type = "button";
                button.title = record.title;
                button.setAttribute("aria-label", record.title);

                const icon = createIconImage(record.iconPath, "monitor-os-taskbar-icon", record.title);
                if (icon) {
                    button.appendChild(icon);
                } else {
                    button.textContent = record.title.slice(0, 1);
                }

                button.addEventListener("click", () => {
                    if (record.closed) {
                        openWindow(record.id);
                        return;
                    }

                    if (record.minimized) {
                        restoreWindow(record.id);
                    } else {
                        minimizeWindow(record.id);
                    }
                });
                taskbarItems.appendChild(button);
                record.taskbarButton = button;
            }

            record.taskbarButton.hidden = record.closed;
            record.taskbarButton.classList.toggle("is-active", !record.minimized && !record.closed);
        }

        function constrainWindow(record) {
            if (record.maximized) return;

            const bounds = getDesktopBounds();
            const windowRect = record.element.getBoundingClientRect();
            const maxLeft = Math.max(0, bounds.width - windowRect.width);
            const maxTop = Math.max(0, bounds.height - windowRect.height);

            record.x = clamp(record.x, 0, maxLeft);
            record.y = clamp(record.y, 0, maxTop);
            record.element.style.left = `${record.x}px`;
            record.element.style.top = `${record.y}px`;
        }

        function setMaximized(record, maximized) {
            record.maximized = maximized;
            record.element.classList.toggle("is-maximized", record.maximized);

            if (!record.maximized) {
                constrainWindow(record);
            }
        }

        function setPercentLayout(record, config) {
            const bounds = getDesktopBounds();
            record.x = bounds.width * ((config.x ?? 12) / 100);
            record.y = bounds.height * ((config.y ?? 12) / 100);
            record.element.style.width = `${bounds.width * ((config.width ?? 58) / 100)}px`;
            record.element.style.height = `${bounds.height * ((config.height ?? 56) / 100)}px`;
            constrainWindow(record);
        }

        function makeDraggable(record, titlebar) {
            let drag = null;

            titlebar.addEventListener("pointerdown", (event) => {
                if (event.target.closest("button") || record.maximized) return;

                focusWindow(record);
                const bounds = getDesktopBounds();
                drag = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    initialX: record.x,
                    initialY: record.y,
                    bounds
                };
                titlebar.setPointerCapture(event.pointerId);
            });

            titlebar.addEventListener("pointermove", (event) => {
                if (!drag || drag.pointerId !== event.pointerId) return;

                const rect = record.element.getBoundingClientRect();
                record.x = clamp(drag.initialX + event.clientX - drag.startX, 0, drag.bounds.width - rect.width);
                record.y = clamp(drag.initialY + event.clientY - drag.startY, 0, drag.bounds.height - rect.height);
                record.element.style.left = `${record.x}px`;
                record.element.style.top = `${record.y}px`;
            });

            titlebar.addEventListener("pointerup", (event) => {
                if (!drag || drag.pointerId !== event.pointerId) return;
                titlebar.releasePointerCapture(event.pointerId);
                drag = null;
            });
        }

        function registerWindow(config) {
            if (windows.has(config.id)) return windows.get(config.id);

            const element = document.createElement("section");
            element.className = "monitor-os-window";
            element.dataset.windowId = config.id;
            element.innerHTML = `
                <div class="monitor-os-window-titlebar">
                    <div class="monitor-os-window-title">
                        <span class="monitor-os-window-title-text"></span>
                    </div>
                    <div class="monitor-os-window-controls">
                        <button class="monitor-os-window-control minimize" type="button" aria-label="Minimise">-</button>
                        <button class="monitor-os-window-control maximize" type="button" aria-label="Expand">&#9633;</button>
                        <button class="monitor-os-window-control close" type="button" aria-label="Close">&times;</button>
                    </div>
                </div>
                <div class="monitor-os-window-content">${config.content || ""}</div>
            `;

            const record = {
                id: config.id,
                title: config.title,
                iconPath: config.iconPath || "",
                element,
                taskbarButton: null,
                minimized: false,
                maximized: false,
                closed: true,
                x: 0,
                y: 0,
                config
            };

            element.classList.add("is-closed");
            element.hidden = true;

            const content = element.querySelector(".monitor-os-window-content");
            if (config.contentClassName) {
                content.classList.add(config.contentClassName);
            }

            if (config.titlebarColour) {
                element.style.setProperty("--window-titlebar-colour", config.titlebarColour);
            }

            if (config.titlebarTextColour) {
                element.style.setProperty("--window-titlebar-text-colour", config.titlebarTextColour);
            }

            if (config.backgroundColour) {
                element.style.setProperty("--window-background-colour", config.backgroundColour);
            }

            const title = element.querySelector(".monitor-os-window-title");
            const titleText = element.querySelector(".monitor-os-window-title-text");
            const titleIcon = createIconImage(record.iconPath, "monitor-os-window-title-icon", "");
            titleText.textContent = record.title;
            if (titleIcon) {
                title.prepend(titleIcon);
            }

            element.addEventListener("pointerdown", () => focusWindow(record));
            element.querySelectorAll(".monitor-os-window-control").forEach((control) => {
                control.addEventListener("pointerdown", (event) => event.stopPropagation());
            });
            element.querySelector(".minimize").addEventListener("click", (event) => {
                event.stopPropagation();
                minimizeWindow(record.id);
            });
            element.querySelector(".maximize").addEventListener("click", (event) => {
                event.stopPropagation();
                toggleMaximize(record.id);
            });
            element.querySelector(".close").addEventListener("click", (event) => {
                event.stopPropagation();
                closeWindow(record.id);
            });
            makeDraggable(record, element.querySelector(".monitor-os-window-titlebar"));

            desktop.appendChild(element);
            windows.set(config.id, record);
            setPercentLayout(record, config);
            updateTaskbar(record);

            return record;
        }

        function openWindow(id) {
            const record = windows.get(id);
            if (!record) return null;

            const wasClosed = record.closed;
            record.closed = false;
            record.minimized = false;
            record.element.classList.remove("is-closed");
            record.element.classList.remove("is-minimized");
            record.element.hidden = false;
            if (wasClosed) {
                setMaximized(record, record.config.openExpanded === true);
            }
            updateTaskbar(record);
            focusWindow(record);
            constrainWindow(record);
            if (wasClosed && typeof record.config.onOpen === "function") {
                record.config.onOpen(record);
            }
            return record;
        }

        function minimizeWindow(id) {
            const record = windows.get(id);
            if (!record || record.closed) return;

            record.minimized = true;
            record.element.classList.add("is-minimized");
            updateTaskbar(record);
        }

        function restoreWindow(id) {
            const record = windows.get(id);
            if (!record || record.closed) return;

            record.minimized = false;
            record.element.classList.remove("is-minimized");
            updateTaskbar(record);
            focusWindow(record);
        }

        function closeWindow(id) {
            const record = windows.get(id);
            if (!record) return;

            record.closed = true;
            record.minimized = false;
            record.element.classList.add("is-closed");
            record.element.classList.remove("is-minimized");
            record.element.hidden = true;
            if (typeof record.config.onClose === "function") {
                record.config.onClose(record);
            }
            updateTaskbar(record);
        }

        function toggleMaximize(id) {
            const record = windows.get(id);
            if (!record || record.closed) return;

            setMaximized(record, !record.maximized);
            focusWindow(record);
        }

        window.addEventListener("resize", () => {
            windows.forEach((record) => constrainWindow(record));
        });

        return {
            registerWindow,
            openWindow,
            minimizeWindow,
            restoreWindow,
            closeWindow,
            toggleMaximize
        };
    }

    window.OSWindowManager = { create };
})();
