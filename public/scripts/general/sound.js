let audioContext;
let soundBuffers = {};

const audioBuffers = {};
async function loadSoundEffects() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const soundEffects = {
        containerOpen: '/sounds/header/container-open.wav',
        containerClose: '/sounds/header/container-close.wav',
        sliderEnabled: '/sounds/header/slider-enabled.wav',
        sliderDisabled: '/sounds/header/slider-disabled.wav',
        splashScreenUp: '/sounds/header/splash-screen-up.wav',
        splashScreenDown: '/sounds/header/splash-screen-down.wav',
        buttonClicked: '/sounds/header/button-click.wav',
        buttonDeselect: '/sounds/header/button-deselect.wav',
        cardFlip: '/sounds/homepage/card-flip.wav',
        cardCannotBePlacedHere: '/sounds/overexposure/card-cannot-be-place-here.wav',
        postIncomplete: '/sounds/overexposure/post-incomplete.wav',
        postUploaded: '/sounds/overexposure/post-uploaded.wav',
        wheelSpin: '/sounds/party-games/wheel-spin.wav',
        coinFlip: '/sounds/party-games/coin-flip.wav',
    };

    for (const [key, url] of Object.entries(soundEffects)) {
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
}



waitForFunction("loadSoundEffects", async () => {
  await loadSoundEffects();
});

async function playSoundEffect(soundKey) {
    if(audioContext === undefined) {
        console.warn("Audio context is not initialized.");
        return;
    }
    const bool = localStorage.getItem('settings-sound');
    if (bool === 'false') {
        return;
    }

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