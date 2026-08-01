waitForFunction("playSoundEffect", () => {
    OEAudio.register({
        cardCannotBePlacedHere: {
            src: '/sounds/overexposure/card-cannot-be-place-here.wav',
            group: 'overexposure'
        },
        postIncomplete: {
            src: '/sounds/overexposure/post-incomplete.wav',
            group: 'overexposure'
        },
        postUploaded: {
            src: '/sounds/overexposure/post-uploaded.wav',
            group: 'overexposure'
        }
    });
});
