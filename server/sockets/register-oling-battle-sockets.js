const { MATCH_CODE_PATTERN } = require('../services/oling-battles');

function registerOlingBattleSockets({ io, debugLog }) {
  io.on('connection', (socket) => {
    socket.on('oling-battle:join-room', (matchCode) => {
      if (!MATCH_CODE_PATTERN.test(String(matchCode || '').trim())) return;
      const normalizedMatchCode = String(matchCode).trim().toUpperCase();
      socket.join(normalizedMatchCode);
      debugLog(`Oling battle room joined: ${normalizedMatchCode}`);
      socket.emit('oling-battle:joined-room', {
        matchCode: normalizedMatchCode
      });
      socket.to(normalizedMatchCode).emit('oling-battle:user-joined', {
        matchCode: normalizedMatchCode,
        socketId: socket.id
      });
    });

    socket.on('oling-battle:leave-room', (matchCode) => {
      if (!MATCH_CODE_PATTERN.test(String(matchCode || '').trim())) return;
      const normalizedMatchCode = String(matchCode).trim().toUpperCase();
      socket.leave(normalizedMatchCode);
      socket.emit('oling-battle:left-room', { matchCode: normalizedMatchCode });
      socket.to(normalizedMatchCode).emit('oling-battle:user-left', {
        matchCode: normalizedMatchCode,
        socketId: socket.id
      });
    });
  });
}

module.exports = {
  registerOlingBattleSockets
};
