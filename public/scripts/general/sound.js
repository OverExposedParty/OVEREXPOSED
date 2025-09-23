let audioContext;
let soundBuffers = {};

// Initialize AudioContext once
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Load a single sound and store it in soundBuffers
async function loadSound(key, url) {
    initAudioContext();

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        soundBuffers[key] = decodedBuffer;
        console.log(`✅ Sound loaded: ${key}`);
    } catch (error) {
        console.error(`❌ Error loading sound: ${key}`, error);
    }
}

async function playSoundEffect(soundKey) {
    console.log("🎵 Playing sound effect:", soundKey);
    if (!audioContext) {
        console.warn("Audio context is not initialized.");
        return;
    }
    const bool = localStorage.getItem('settings-sound');
    if (bool === 'false') return;

    if (audioContext.state === "suspended") {
        await audioContext.resume();
    }

    const buffer = soundBuffers[soundKey];
    if (!buffer) {
        console.warn(`Sound not loaded: ${soundKey}`);
        return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

async function LoadBasicSoundEffects() {
    const soundEffects = {
        containerOpen: '/sounds/header/container-open.wav',
        containerClose: '/sounds/header/container-close.wav',
        sliderEnabled: '/sounds/header/slider-enabled.wav',
        sliderDisabled: '/sounds/header/slider-disabled.wav',
        splashScreenUp: '/sounds/header/splash-screen-up.wav',
        splashScreenDown: '/sounds/header/splash-screen-down.wav',
        buttonClicked: '/sounds/header/button-click.wav',
        buttonDeselect: '/sounds/header/button-deselect.wav',
        postUploaded: '/sounds/overexposure/post-uploaded.wav',
    };

    for (const [key, url] of Object.entries(soundEffects)) {
        await loadSound(key, url);
    }
}

document.addEventListener("click", function (event) {
    if (event.target.tagName === "BUTTON") {
        if (event.target.classList.contains('disabled')) return;

        if (event.target.classList.contains('sound-save')) {
            //playSoundEffect('postUploaded');
            return;
        };

        if (event.target.classList.contains('sound-toggle')) {
            if (event.target.classList.contains('active')) {
                playSoundEffect('buttonClicked');
            }
            else {
                playSoundEffect('buttonDeselect');
            }
            return;
        }
        else {
            playSoundEffect('buttonClicked');
        }
    }
});

(async () => {
    await LoadBasicSoundEffects();
})();