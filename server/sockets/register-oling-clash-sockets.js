const { MATCH_CODE_PATTERN } = require('../services/oling-clashes');

function registerOlingClashSockets({ io, debugLog }) {
  io.on('connection', (socket) => {
    socket.on('oling-clash:join-room', (matchCode) => {
      const normalized = String(matchCode || '')
        .trim()
        .toUpperCase();
      if (!MATCH_CODE_PATTERN.test(normalized)) return;
      socket.join(normalized);
      debugLog(`Oling Clash room joined: ${normalized}`);
      socket.emit('oling-clash:joined-room', { matchCode: normalized });
    });
    socket.on('oling-clash:leave-room', (matchCode) => {
      const normalized = String(matchCode || '')
        .trim()
        .toUpperCase();
      if (!MATCH_CODE_PATTERN.test(normalized)) return;
      socket.leave(normalized);
      socket.emit('oling-clash:left-room', { matchCode: normalized });
    });
  });
}

module.exports = { registerOlingClashSockets };
