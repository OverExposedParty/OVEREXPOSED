function waitForButtons(selector, callback) {
    const observer = new MutationObserver(() => {
        const buttons = document.querySelectorAll(selector);
        if (buttons.length > 0) {
            observer.disconnect();
            callback(buttons);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function handleTTSButtons(buttons) {
    const defaultButtonIndex = 0;
    const savedKey = localStorage.getItem('selectedTTSButton');

    if (savedKey) {
        buttons.forEach(button => {
            if (button.getAttribute('data-key') === savedKey) {
                selectButton(button);
            }
        });
    } else {
        selectButton(buttons[defaultButtonIndex]);
        localStorage.setItem('selectedTTSButton', buttons[defaultButtonIndex].getAttribute('data-key'));
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => {
                btn.classList.remove('selected');
                localStorage.setItem(btn.getAttribute('data-key'), 'false');
            });

            localStorage.setItem(button.getAttribute('data-key'), 'true');
            localStorage.setItem('selectedTTSButton', button.getAttribute('data-key'));
            selectButton(button);
        });
    });

    function selectButton(button) {
        button.classList.add('selected');
    }
}

waitForButtons('.tts-voice-button', handleTTSButtons);

function waitForElementWithTimeout(selector, callback, timeout = 10000) {
    const element = document.querySelector(selector);
    if (element) {
        callback(element);
        return;
    }

    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                const element = document.querySelector(selector);
                if (element) {
                    callback(element);
                    observer.disconnect();
                    clearTimeout(timeoutId);
                    return;
                }
            }
        }
    });

    function waitForElement(selector, callback) {
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
                obs.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    const timeoutId = setTimeout(() => {
        observer.disconnect();
        console.warn(`Timeout: Element with selector "${selector}" not found within ${timeout}ms.`);
    }, timeout);
}
