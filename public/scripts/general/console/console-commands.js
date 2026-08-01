(function () {
  let commandScriptsReady = null;

  function loadCommandScript(src) {
    if (typeof LoadScript === 'function') {
      return LoadScript(src);
    }

    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src =
        typeof versionAssetUrl === 'function' ? versionAssetUrl(src) : src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function ensureCommandScripts() {
    if (!commandScriptsReady) {
      commandScriptsReady = loadCommandScript(
        '/scripts/general/commands/command-registry.js'
      ).then(() =>
        Promise.all([
          loadCommandScript('/scripts/general/commands/achievement-commands.js'),
          loadCommandScript('/scripts/general/commands/oling-commands.js'),
          loadCommandScript('/scripts/general/commands/shop-commands.js'),
          loadCommandScript('/scripts/party-games/general/party-games-commands.js')
        ])
      );
    }

    return commandScriptsReady;
  }

  async function runCommand(message, { pageType, writeConsoleMessage }) {
    await ensureCommandScripts();
    await window.OverexposedCommands.runCommand(message, {
      pageType,
      writeConsoleMessage
    });
  }

  window.ConsoleCommands = {
    run: runCommand
  };
})();
