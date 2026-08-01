(function () {
    const ERROR_404_WINDOW_SCRIPT = "/scripts/other/404/error-404-window.js";

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
            script.src = typeof versionAssetUrl === "function" ? versionAssetUrl(src, { cacheBustKey: "ERROR_404" }) : src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function createOperatingSystemScreen() {
        const monitorSetup = document.querySelector(".error-monitor-setup");
        if (!monitorSetup) return null;

        let osScreen = monitorSetup.querySelector(".monitor-os-screen");
        if (osScreen) return osScreen;

        osScreen = document.createElement("div");
        osScreen.className = "monitor-os-screen";
        osScreen.innerHTML = `
            <div class="monitor-os-desktop"></div>
            <div class="monitor-os-taskbar">
                <div class="monitor-os-start" aria-hidden="true">
                    <svg class="monitor-os-start-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 103.01">
                        <g>
                            <g>
                                <path d="M2.02,6.52C5.88-.4,13.48-2.01,19.84,2.75c5.11,3.83,8.14,13.84,5.76,19.1-2.26,4.99-8.97,8.62-14.41,7.75C5.05,28.62.74,24.17.12,18.02c-.09-1.01,0-2.05,0-2.97-.45-3.12.45-5.88,1.9-8.53ZM10.34,22.29c2.41,1.25,4.63.71,6.74-.74,3.06-2.14,2.41-5.32,1.75-8.05-.8-3.33-2.5-6.83-6.74-6.42-4.34.42-5.02,3.98-5.02,8.73-.06,1.87.09,4.81,3.27,6.48Z"/>
                                <path d="M48.3,24.02c-1.75,3.36-4.4,5.88-8.76,5.7-4.46-.18-6.86-2.97-7.84-6.65-1.63-6.15-2.85-12.39-4.04-18.63-.83-4.4,6.15-6.89,7.22-.86.92,5.23,1.93,10.43,3.09,15.6.27,1.16.27,3.06,2.14,3.06,1.49,0,1.81-1.54,2.26-2.61,1.99-4.63,3.39-9.45,3.74-14.47.18-2.55,1.04-4.75,4.01-4.52,2.97.24,3.54,2.55,3.18,6.45-.83,4.93-1.96,11.23-4.99,16.93Z"/>
                                <path d="M76.68,3.19c.15,4.63-4.49,3.68-7.72,3.83-.45.03-.92-.03-1.37,0-2.02.18-5.05-.5-4.93,2.41.09,2.53,2.91,1.19,4.52,1.25,2.29.12,4.31.18,4.6,3.06.3,2.91-1.81,3.39-3.95,3.86-.3.06-.62,0-.89.12-1.49.56-4.34-.98-4.25,1.81.12,2.91,3.98,2.91,11.47,2.64,1.99-.06,3.24.77,3.59,2.64.3,1.72-.74,2.79-2.23,3.48-9,4.13-18.78-1.04-20.62-10.52-.71-3.65-.27-7.13.5-10.55C56.53,2.27,61.02.04,69.28.01c2.61.36,7.25-1.28,7.4,3.18Z"/>
                                <path d="M79.03,4.91c-.27-2.5,1.19-4.13,3.06-4.37,4.55-.59,9.24-1.25,13.55,1.28,4.81,2.82,5.94,8.88,1.9,12.69-2.38,2.23-2.26,3.77-.39,5.94.8.92,1.34,2.05,1.93,3.09,1.01,1.81.39,3.3-1.25,4.25-1.75,1.01-3.62.92-4.96-.83-1.19-1.54-2.23-3.24-3.42-4.78-.45-.56-1.04-1.19-1.93-.86-.8.3-.83.89-.83,3.3.03,2.67-.77,5.17-3.86,5.11-3.36-.06-3.39-2.88-3.39-5.38.03-2.88,0-5.7,0-8.59h.15v-.03c-.18-3.59-.18-7.22-.56-10.81ZM88.92,6.76c-1.84-.12-2.88.8-2.82,2.64.06,1.6.89,2.67,2.58,2.32,1.6-.33,3.33-.77,3.77-2.76-.48-1.81-2.02-2.11-3.54-2.2Z"/>
                            </g>
                            <g>
                                <path d="M29.4,36.33c.2,6.16-5.96,4.89-10.26,5.09-.59.04-1.22-.04-1.82,0-2.68.24-6.71-.67-6.55,3.2.12,3.35,3.87,1.58,6,1.66,3.04.16,5.72.24,6.12,4.06.39,3.87-2.41,4.5-5.25,5.13-.39.08-.83,0-1.18.16-1.97.75-5.76-1.3-5.64,2.41.16,3.87,5.29,3.87,15.23,3.51,2.64-.08,4.3,1.03,4.77,3.51.39,2.29-.99,3.71-2.96,4.62-11.96,5.48-24.94-1.38-27.39-13.97-.95-4.85-.36-9.47.67-14.01,1.5-6.59,7.46-9.55,18.43-9.59,3.47.47,9.63-1.7,9.83,4.22Z"/>
                                <path d="M46.45,38.54c4.77,6.83,4.89,6.83,9.83-.2.75-1.1,1.38-2.21,2.21-3.28,1.97-2.53,4.38-3.99,7.5-1.93,2.96,1.93,3.16,4.62,1.22,7.42-2.01,2.92-3.71,6.2-6.27,8.52-3.71,3.35-3.04,6.04-.39,9.55,2.53,3.39,8.29,7.34,2.6,11.56-5.64,4.18-8.01-2.17-10.65-5.52-2.13-2.72-3.67-2.53-5.88-.36-1.74,1.7-3.75,3.16-5.64,4.66-2.21,1.74-4.5,1.85-6.71,0-3.59-3.04-.87-6.47.95-8.56,5.01-5.76,5.29-12,.91-18.74-1.42-2.17-3.39-4.3-1.34-7.14,1.1-1.5,2.53-2.45,4.66-2.41,3.63.71,5.13,3.75,7.02,6.43Z"/>
                                <path d="M70.01,38.42c-.08-4.58,2.25-6.59,6.83-6.27,5.33.36,10.58,1.18,15.59,3.04,5.13,1.89,7.46,5.6,7.58,11.13.12,5.41-2.41,8.64-7.06,10.77-1.5.67-3.04,1.78-4.54,1.78-6.63.08-10.69,2.05-9.79,9.63.28,2.17-2.13,3.16-4.46,3.04-2.76-.16-4.02-1.78-4.06-4.3-.08-5.21-.04-10.42-.04-15.63h-.04c0-4.38.08-8.8,0-13.18ZM78.92,46.31c-.12,2.68.51,5.09,3.83,4.54,3.24-.55,8.05-.67,7.89-4.85-.2-5.09-6.08-2.25-8.41-4.3-3.91-.04-3.24,2.56-3.31,4.62Z"/>
                            </g>
                            <g>
                                <path d="M1.99,80.14c3.81-6.82,11.3-8.4,17.56-3.72,5.04,3.78,8.02,13.64,5.68,18.82-2.22,4.92-8.84,8.49-14.2,7.64-6.06-.97-10.3-5.36-10.92-11.42-.09-1,0-2.02,0-2.93-.44-3.07.44-5.8,1.87-8.4ZM10.18,95.68c2.37,1.23,4.57.7,6.65-.73,3.02-2.11,2.37-5.24,1.73-7.93-.79-3.28-2.46-6.73-6.65-6.32-4.27.41-4.95,3.92-4.95,8.61-.06,1.84.09,4.74,3.22,6.38Z"/>
                                <path d="M47.3,76.22c1.76,1.26,2.63,3.02,1.46,5.03-1.14,1.93-2.99,1.73-4.8,1.02-.29-.12-.56-.29-.82-.44-2.37-1.23-5.83-2.28-6.94-.15-1.14,2.22,2.69,2.72,4.39,3.89,1,.67,2.08,1.23,3.13,1.84,3.16,1.87,5.59,4.27,5.04,8.2-.61,4.33-4.04,6.03-7.9,7-4.68,1.17-10.25-.44-12.35-3.63-1.41-2.14-2.14-4.51.21-6.41,2.37-1.93,3.92-.03,5.21,1.67.91,1.17,1.84,1.93,3.4,1.76,1.29-.15,3.07.53,3.51-1.17.38-1.43-1.29-1.79-2.28-2.37-1.81-1.08-3.75-1.99-5.53-3.1-3.16-1.99-6.03-4.33-5.12-8.55.94-4.42,4.51-6.03,8.55-6.97.73-.18,1.52-.09,2.28-.12,3.13-.06,6.03.67,8.58,2.49Z"/>
                                <path d="M72.27,76.86c.15,4.57-4.42,3.63-7.61,3.78-.44.03-.91-.03-1.35,0-1.99.18-4.98-.5-4.86,2.37.09,2.49,2.87,1.17,4.45,1.23,2.25.12,4.24.18,4.54,3.02.29,2.87-1.79,3.34-3.89,3.81-.29.06-.61,0-.88.12-1.46.56-4.27-.97-4.19,1.79.12,2.87,3.92,2.87,11.3,2.61,1.96-.06,3.19.76,3.54,2.61.29,1.7-.73,2.75-2.2,3.42-8.87,4.07-18.5-1.02-20.32-10.36-.7-3.6-.26-7.03.5-10.39,1.11-4.89,5.53-7.08,13.67-7.11,2.58.35,7.14-1.26,7.29,3.13Z"/>
                                <path d="M99.09,92.81c-1.67,4.65-5.42,7.05-9.92,8.37-12.15,3.51-13.29,2.66-13.76-9.4-.15-3.69-.61-7.38-.79-11.07-.29-6.44.67-7,8.72-7,11.89-.2,19.35,8.93,15.75,19.09ZM82.64,93.72c.09.88.12,1.73,1.41,1.84,2.78.26,8.23-3.4,8.66-5.97.73-4.19-1.43-7.76-5.44-8.84-4.71-1.29-5.56-.61-5.44,4.63.23,2.55.53,5.42.82,8.34Z"/>
                            </g>
                        </g>
                    </svg>
                </div>
                <div class="monitor-os-taskbar-items" aria-label="Open windows"></div>
            </div>
        `;
        monitorSetup.appendChild(osScreen);
        return osScreen;
    }

    function positionOperatingSystemScreen(screen) {
        const monitorSetup = document.querySelector(".error-monitor-setup");
        const monitorSvg = document.getElementById("error-monitor");
        const screenPath = document.getElementById("screen");

        if (!monitorSetup || !monitorSvg || !screenPath) return;

        const setupRect = monitorSetup.getBoundingClientRect();
        const svgRect = monitorSvg.getBoundingClientRect();
        const viewBox = monitorSvg.viewBox.baseVal;
        const screenBox = screenPath.getBBox();
        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;
        const paddingX = screenBox.width * scaleX * 0.012;
        const paddingY = screenBox.height * scaleY * 0.018;
        const left = svgRect.left - setupRect.left + screenBox.x * scaleX + paddingX;
        const top = svgRect.top - setupRect.top + screenBox.y * scaleY + paddingY;
        const width = screenBox.width * scaleX - paddingX * 2;
        const height = screenBox.height * scaleY - paddingY * 2;
        const taskbarHeight = Math.max(18, Math.min(34, height * 0.07));

        screen.style.left = `${left}px`;
        screen.style.top = `${top}px`;
        screen.style.width = `${width}px`;
        screen.style.height = `${height}px`;
        screen.style.setProperty("--monitor-taskbar-height", `${taskbarHeight}px`);
    }

    async function init(options = {}) {
        const screen = createOperatingSystemScreen();
        if (!screen) return null;

        positionOperatingSystemScreen(screen);
        window.addEventListener("resize", () => positionOperatingSystemScreen(screen));

        await loadScript(ERROR_404_WINDOW_SCRIPT);
        return window.Error404Window?.init?.(screen, options);
    }

    window.OperatingSystem = { init };
})();
