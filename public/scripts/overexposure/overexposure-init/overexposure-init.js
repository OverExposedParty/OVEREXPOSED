(async () => {
  try {
    // === 0. Base DOM ===
    await LoadScript('/scripts/overexposure/core/overexposure-dom.js');

    // === 1. Lowest level / globals ===
    await LoadScript('/scripts/overexposure/core/overexposure-config.js');
    await LoadScript('/scripts/overexposure/core/overexposure-utils.js');

    // === 2. Services ===
    await LoadScript('/scripts/overexposure/services/overexposure-sounds.js');
    await LoadScript('/scripts/overexposure/services/overexposure-names.js');
    await LoadScript('/scripts/overexposure/services/overexposure-settings.js');

    // === 3. UI Components ===
    await LoadScript('/scripts/overexposure/ui/overexposure-tags.js');
    await LoadScript('/scripts/overexposure/ui/overexposure-editor.js');
    await LoadScript('/scripts/overexposure/ui/overexposure-moderation.js');
    await LoadScript('/scripts/overexposure/ui/overexposure-cards.js');

    // === 4. Data Layer ===
    await LoadScript('/scripts/overexposure/data/overexposure-data.js');

    // === 5. Controls ===
    await LoadScript('/scripts/overexposure/controls/overexposure-computer-controls.js');
    await LoadScript('/scripts/overexposure/controls/overexposure-touch-controls.js');

    // === Wire-up ===
    await Ready.when('user-customisation-icon', { timeout: 10000 });
    await fetchOverexposurePosts();
    debugLog("Fetched Overexposure posts");

    titleTextInput.addEventListener("input", togglePublishButton);
    contentsTextArea.addEventListener("input", togglePublishButton);

    titleTextInput.addEventListener("input", SetOverexposureClassArray);
    contentsTextArea.addEventListener("input", SetOverexposureClassArray);

    if (localStorage.getItem('first-time-overexposure') === null) {
      const requestFirstTimeOeCustomisation = () => {
        const openCustomisationRequest = () => {
          window.requestAccountOeCustomisation({
            requireNonDefault: true,
            closeOnSave: true,
            preventClose: true
          })
            .catch((error) => {
              console.warn("Failed to request OE customisation:", error);
            })
            .finally(() => {
              localStorage.setItem('first-time-overexposure', 'no');
            });
        };

        if (typeof window.requestAccountOeCustomisation === 'function') {
          openCustomisationRequest();
          return;
        }

        waitForFunction("requestAccountOeCustomisation", openCustomisationRequest);
      };

      const isDirectPostOpen =
        Boolean(getIDFromURL()) &&
        getIDFromURL() !== 'overexposure' &&
        isContainerVisible(overexposureContainer);

      if (isDirectPostOpen) {
        window.openDeferredOverexposureOeCustomisation = () => {
          delete window.openDeferredOverexposureOeCustomisation;
          requestFirstTimeOeCustomisation();
          return true;
        };
      } else {
        requestFirstTimeOeCustomisation();
      }
    }

    // === Final marker ===
    if (typeof window.syncSettingsConsoleState === 'function') {
      window.syncSettingsConsoleState();
    }

    SetScriptLoaded('/scripts/overexposure/overexposure-init/overexposure-init.js');
    Ready.set('overexposure-init');
  } catch (err) {
    console.error("❌ Error loading Overexposure scripts:", err);
  }
})();
