document.addEventListener("DOMContentLoaded", function () {

    LoadScript('/scripts/overexposure/overexposure-dom.js')

        // === 1. Lowest level / globals ===
        .then(() => LoadScript('/scripts/overexposure/overexposure-config.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-utils.js'))

        // === 2. Services ===
        .then(() => LoadScript('/scripts/overexposure/overexposure-sounds.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-names.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-settings.js'))

        // === 3. UI Components ===
        .then(() => LoadScript('/scripts/overexposure/overexposure-tags.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-editor.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-moderation.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-cards.js'))

        // === 4. Data Layer ===
        .then(() => LoadScript('/scripts/overexposure/overexposure-data.js'))

        .then(() => LoadScript('/scripts/overexposure/overexposure-computer-controls.js'))
        .then(() => LoadScript('/scripts/overexposure/overexposure-touch-controls.js'))

        // === Wire-up ===
        .then(() => {
            waitForFunction("fetchConfessions", async () => {
                await fetchConfessions();
            });

            titleTextInput.addEventListener("input", togglePublishButton);
            contentsTextArea.addEventListener("input", togglePublishButton);

            titleTextInput.addEventListener("input", SetOverexposureClassArray);
            contentsTextArea.addEventListener("input", SetOverexposureClassArray);

            if (localStorage.getItem('first-time-overexposure') === null) {
                localStorage.setItem('first-time-overexposure', 'no');
                waitForFunction("toggleUserCustomisation", () => {
                    toggleUserCustomisation(true);
                });
            }

            SetScriptLoaded('/scripts/overexposure/overexposure-init.js');
        })

        // Debug / catch errors
        .catch(err => {
            console.error("❌ Error loading Overexposure scripts:", err);
        });

});