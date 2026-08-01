(function () {
function loadPartyChatScript(src) {
  if (typeof LoadScript === 'function') {
    return LoadScript(src);
  }

  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = versionAssetUrl(src);
    script.onload = () => {
      resolve();
    };
    script.onerror = (error) => {
      reject(error);
    };
    document.head.appendChild(script);
  });
}

const chatLogCSS = document.createElement('link');
chatLogCSS.rel = 'stylesheet';
chatLogCSS.href = versionAssetUrl('/css/general/online/chat-room.css');
document.head.appendChild(chatLogCSS);

function createPartyChatReady() {
  const timeoutMs = 5000;
  const loadScriptsPromise = Promise.all([
    loadPartyChatScript('/scripts/general/messages/message-panel.js'),
    loadPartyChatScript('/scripts/general/messages/message-input.js'),
    loadPartyChatScript('/scripts/party-games/chat/party-chat-api.js'),
    loadPartyChatScript('/scripts/party-games/chat/party-chat-panel.js')
  ]).then(() => {
    return window.PartyChatPanel.initDefault();
  });

  const timeoutPromise = new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(new Error(`PartyChatReady initialization timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([loadScriptsPromise, timeoutPromise])
    .then((result) => {
      return result;
    })
    .catch(() => {
      return null;
    });
}

window.PartyChatReady = createPartyChatReady();
})();
