waitForFunction("loadSound", () => {
    async function LoadOverexposureSounds() {
        const overexposureSounds = {
            cardCannotBePlacedHere: '/sounds/overexposure/card-cannot-be-place-here.wav',
            postIncomplete: '/sounds/overexposure/post-incomplete.wav',
            postUploaded: '/sounds/overexposure/post-uploaded.wav',
        };

        for (const [key, url] of Object.entries(overexposureSounds)) {
            await loadSound(key, url);
        }
    }

    (async () => {
        await LoadOverexposureSounds();
    })();
});