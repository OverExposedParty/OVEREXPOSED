(async () => {
  try {
    // === 0. Base DOM ===
    await LoadScript('/scripts/overexposure/overexposure-dom.js');

    // === 1. Lowest level / globals ===
    await LoadScript('/scripts/overexposure/overexposure-config.js');
    await LoadScript('/scripts/overexposure/overexposure-utils.js');

    // === 2. Services ===
    await LoadScript('/scripts/overexposure/overexposure-sounds.js');
    await LoadScript('/scripts/overexposure/overexposure-names.js');
    await LoadScript('/scripts/overexposure/overexposure-settings.js');

    // === 3. UI Components ===
    await LoadScript('/scripts/overexposure/overexposure-tags.js');
    await LoadScript('/scripts/overexposure/overexposure-editor.js');
    await LoadScript('/scripts/overexposure/overexposure-moderation.js');
    await LoadScript('/scripts/overexposure/overexposure-cards.js');

    // === 4. Data Layer ===
    await LoadScript('/scripts/overexposure/overexposure-data.js');

    // === 5. Controls ===
    await LoadScript('/scripts/overexposure/overexposure-computer-controls.js');
    await LoadScript('/scripts/overexposure/overexposure-touch-controls.js');

    // === Wire-up ===
    await fetchConfessions();
    console.log("Fetched confessions");

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

    // === Final marker ===
    SetScriptLoaded('/scripts/overexposure/overexposure-init.js');
    Ready.set('overexposure-init');
  } catch (err) {
    console.error("❌ Error loading Overexposure scripts:", err);
  }
})();
