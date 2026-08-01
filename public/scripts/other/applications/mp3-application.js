(function () {
    const APPLICATION_TYPE = "mp3-application";

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

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

        const totalSeconds = Math.floor(seconds);
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
        return `${minutes}:${remainingSeconds}`;
    }

    function getAudioFilePath(config) {
        return config.audioFilePath || config.audio?.filePath || config.audio?.src || "";
    }

    function applyColours(shell, config) {
        setColourProperty(shell, "--mp3-app-background-colour", config.backgroundColour);
        setColourProperty(shell, "--mp3-app-text-colour", config.textColour);
        setColourProperty(shell, "--mp3-app-accent-colour", config.accentColour);
        setColourProperty(shell, "--mp3-app-muted-colour", config.mutedColour);
        setColourProperty(shell, "--mp3-app-control-background", config.controlBackgroundColour);
    }

    function setRangeProgress(range, value, max) {
        const progress = max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0;
        range.style.setProperty("--range-progress", `${progress * 100}%`);
    }

    function init({ mount, application } = {}) {
        if (!mount) return null;

        const config = getConfig(application);
        const audioFilePath = getAudioFilePath(config);

        mount.dataset.applicationReady = "true";
        mount.classList.add("mp3-application");
        mount.replaceChildren();

        const shell = createElement("div", "mp3-app-shell");
        applyColours(shell, config);

        const visual = createElement("div", "mp3-app-visual");
        const disc = createElement("div", "mp3-app-disc");
        const discCore = createElement("span", "mp3-app-disc-core");
        const metadata = createElement("div", "mp3-app-metadata");
        const title = createElement("h3", "mp3-app-title", config.title || config.trackTitle || "MP3 PLAYER");
        const artist = createElement("p", "mp3-app-artist", config.artist || config.subtitle || "");
        const fileName = audioFilePath.split("/").filter(Boolean).pop() || "";

        if (!artist.textContent && fileName) {
            artist.textContent = fileName;
        }

        disc.appendChild(discCore);
        metadata.append(title, artist);
        visual.append(disc, metadata);

        const audio = document.createElement("audio");
        audio.preload = config.preload || "metadata";
        audio.loop = config.loop === true;
        audio.volume = Math.max(0, Math.min(Number(config.initialVolume ?? 0.75), 1));
        if (audioFilePath) {
            audio.src = versionUrl(audioFilePath);
        }

        const controls = createElement("div", "mp3-app-controls");
        const playButton = createElement("button", "mp3-app-play-button");
        playButton.type = "button";
        playButton.setAttribute("aria-label", "Play audio");
        playButton.appendChild(createElement("span", "mp3-app-play-icon"));

        const currentTime = createElement("span", "mp3-app-time", "0:00");
        const durationTime = createElement("span", "mp3-app-time", "0:00");
        const seek = document.createElement("input");
        seek.className = "mp3-app-range mp3-app-seek";
        seek.type = "range";
        seek.min = "0";
        seek.max = "1000";
        seek.step = "1";
        seek.value = "0";
        seek.setAttribute("aria-label", "Audio progress");
        setRangeProgress(seek, 0, 1000);

        const volumeGroup = createElement("div", "mp3-app-volume-group");
        const volumeToggle = createElement("button", "mp3-app-volume-toggle", "VOL");
        volumeToggle.type = "button";
        volumeToggle.setAttribute("aria-label", "Show volume control");
        volumeToggle.setAttribute("aria-expanded", "false");
        const volumeDrawer = createElement("div", "mp3-app-volume-drawer");
        const volume = document.createElement("input");
        const volumeValue = createElement("span", "mp3-app-volume-value", `${Math.round(audio.volume * 100)}%`);
        volume.className = "mp3-app-range mp3-app-volume";
        volume.type = "range";
        volume.min = "0";
        volume.max = "1";
        volume.step = "0.01";
        volume.value = String(audio.volume);
        volume.setAttribute("aria-label", "Volume");
        setRangeProgress(volume, audio.volume, 1);
        volumeDrawer.append(volume, volumeValue);
        volumeGroup.append(volumeToggle, volumeDrawer);

        const status = createElement("p", "mp3-app-status");
        status.setAttribute("role", "status");

        controls.append(playButton, currentTime, seek, durationTime, volumeGroup, status);
        shell.append(visual, controls, audio);
        mount.appendChild(shell);

        let isSeeking = false;

        function setPlayingState(isPlaying) {
            shell.classList.toggle("is-playing", isPlaying);
            playButton.setAttribute("aria-label", isPlaying ? "Pause audio" : "Play audio");
        }

        function setStatus(message) {
            status.textContent = message;
            status.hidden = !message;
        }

        function updateDuration() {
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            durationTime.textContent = formatTime(duration);
            seek.disabled = duration <= 0;
        }

        function updateSeekFromAudio() {
            if (isSeeking) return;

            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            const value = duration > 0 ? (audio.currentTime / duration) * Number(seek.max) : 0;
            seek.value = String(Math.round(value));
            setRangeProgress(seek, Number(seek.value), Number(seek.max));
            currentTime.textContent = formatTime(audio.currentTime);
        }

        async function togglePlayback() {
            if (!audioFilePath) {
                setStatus("NO AUDIO FILE SET");
                return;
            }

            if (audio.paused) {
                try {
                    await audio.play();
                    setStatus("");
                } catch {
                    setPlayingState(false);
                    setStatus("AUDIO BLOCKED");
                }
                return;
            }

            audio.pause();
        }

        playButton.addEventListener("click", togglePlayback);
        volumeToggle.addEventListener("click", () => {
            const isOpen = !volumeGroup.classList.contains("is-open");
            volumeGroup.classList.toggle("is-open", isOpen);
            volumeToggle.setAttribute("aria-expanded", String(isOpen));
            if (isOpen) {
                volume.focus();
            } else {
                volumeToggle.focus();
            }
        });

        seek.addEventListener("input", () => {
            isSeeking = true;
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            const progress = Number(seek.value) / Number(seek.max);
            currentTime.textContent = formatTime(duration * progress);
            setRangeProgress(seek, Number(seek.value), Number(seek.max));
        });

        seek.addEventListener("change", () => {
            const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
            if (duration > 0) {
                audio.currentTime = duration * (Number(seek.value) / Number(seek.max));
            }
            isSeeking = false;
            updateSeekFromAudio();
        });

        volume.addEventListener("input", () => {
            audio.volume = Number(volume.value);
            volumeValue.textContent = `${Math.round(audio.volume * 100)}%`;
            setRangeProgress(volume, Number(volume.value), 1);
        });

        audio.addEventListener("loadedmetadata", () => {
            updateDuration();
            updateSeekFromAudio();
            setStatus("");
        });
        audio.addEventListener("timeupdate", updateSeekFromAudio);
        audio.addEventListener("play", () => setPlayingState(true));
        audio.addEventListener("pause", () => setPlayingState(false));
        audio.addEventListener("ended", () => setPlayingState(false));
        audio.addEventListener("error", () => {
            setPlayingState(false);
            setStatus(audioFilePath ? "AUDIO UNAVAILABLE" : "NO AUDIO FILE SET");
        });

        if (!audioFilePath) {
            setStatus("NO AUDIO FILE SET");
            playButton.disabled = true;
            seek.disabled = true;
        } else if (config.autoplay === true) {
            togglePlayback();
        } else {
            setStatus("");
        }

        updateDuration();

        return {
            id: application?.id || APPLICATION_TYPE,
            mount,
            destroy() {
                audio.pause();
                audio.removeAttribute("src");
                audio.load();
            }
        };
    }

    window.Error404Mp3Application = { init };
    window.Error404Applications = window.Error404Applications || {};
    window.Error404Applications[APPLICATION_TYPE] = window.Error404Mp3Application;
})();
