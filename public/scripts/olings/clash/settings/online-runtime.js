(function (globalScope) {
  const socketIoSource = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
  let socketIoPromise = null;

  function ensureSocketIo() {
    if (typeof globalScope.io === 'function') {
      return Promise.resolve(globalScope.io);
    }
    if (socketIoPromise) return socketIoPromise;

    socketIoPromise = new Promise((resolve, reject) => {
      const existing = [...document.querySelectorAll('script[src]')].find(
        (script) => script.src === socketIoSource
      );
      const script = existing || document.createElement('script');
      const handleLoad = () => {
        if (typeof globalScope.io === 'function') resolve(globalScope.io);
        else reject(new Error('Socket.IO loaded without exposing its client.'));
      };
      const handleError = () => {
        socketIoPromise = null;
        reject(new Error('Unable to load the Oling Clash online client.'));
      };

      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener('error', handleError, { once: true });
      if (!existing) {
        script.src = socketIoSource;
        script.async = true;
        document.head.append(script);
      }
    });
    return socketIoPromise;
  }

  globalScope.OlingClashLobbyOnline = Object.freeze({ ensureSocketIo });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ensureSocketIo };
  }
})(typeof window !== 'undefined' ? window : globalThis);
