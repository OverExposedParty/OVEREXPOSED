(function () {
  window.OverexposedCommands?.registerCommandPack({
    id: 'overexposure',
    commands: {
      clear: {
        description: 'Clear the console messages.',
        run: () => {
          const messages = document.querySelector(
            '#overexposure-console .chat-messages'
          );

          if (messages) {
            messages.innerHTML = '';
          }
        }
      },
      page: {
        description: 'Show the current page path.',
        run: ({ writeConsole }) => {
          writeConsole(window.location.pathname || '/');
        }
      }
    }
  });
})();
