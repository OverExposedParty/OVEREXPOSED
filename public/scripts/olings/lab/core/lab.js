(function () {
  window.OEAudio?.register({
    olingLabMove: {
      src: '/sounds/olings/lab/move.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }
  });

  window.createOlingLabStartup();
  if (typeof window.SetScriptLoaded === 'function') {
    window.SetScriptLoaded('/scripts/olings/lab/core/lab.js');
  }

  if (window.Ready && typeof window.Ready.set === 'function') {
    window.Ready.set('oling-lab', true);
  }
})();
