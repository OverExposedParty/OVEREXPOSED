(function () {
  function createMessageInput({
    input,
    submitButton = null,
    onSubmit,
    historyFilter = () => true,
    maxHistory = 50,
    refocusAfterSubmit = true
  }) {
    if (!input) {
      throw new Error('Message input not found.');
    }

    const history = [];
    let historyIndex = 0;
    let draft = '';

    function saveHistory(value) {
      if (!historyFilter(value)) return;

      if (history[history.length - 1] !== value) {
        history.push(value);
        if (history.length > maxHistory) {
          history.shift();
        }
      }

      historyIndex = history.length;
      draft = '';
    }

    function navigateHistory(direction) {
      if (!history.length) return false;

      if (historyIndex === history.length) {
        draft = input.value;
      }

      historyIndex += direction;
      historyIndex = Math.max(0, Math.min(historyIndex, history.length));
      input.value = historyIndex === history.length ? draft : history[historyIndex];

      const cursorPosition = input.value.length;
      input.setSelectionRange(cursorPosition, cursorPosition);
      return true;
    }

    async function submitCurrentMessage() {
      const message = input.value.trim();
      if (!message) return;

      saveHistory(message);
      await onSubmit(message);
      input.value = '';
    }

    input.addEventListener('keydown', async (event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const direction = event.key === 'ArrowUp' ? -1 : 1;
        if (navigateHistory(direction)) {
          event.preventDefault();
        }
        return;
      }

      if (event.key !== 'Enter') return;

      event.preventDefault();
      await submitCurrentMessage();
    });

    submitButton?.addEventListener('click', async () => {
      await submitCurrentMessage();
      if (refocusAfterSubmit) {
        input.focus();
      }
    });
  }

  window.MessageInput = {
    create: createMessageInput
  };
})();
