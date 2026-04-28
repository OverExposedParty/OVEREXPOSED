function registerPartySockets({
  io,
  debugLog,
  disconnectSocketPartyMemberships
}) {
  io.on('connection', (socket) => {
    debugLog(`✅ Client connected: ${socket.id}`);

    socket.on('join-party', (partyCode) => {
      if (!partyCode) return;
      socket.join(partyCode);
      debugLog(`🎉 User joined room: ${partyCode}`);
      socket.emit('joined-party', { message: `Joined party: ${partyCode}` });
      socket.to(partyCode).emit('user-joined', { socketId: socket.id });
    });

    socket.on('leave-party', (partyCode) => {
      if (!partyCode) return;
      socket.leave(partyCode);
      debugLog(`${socket.id} left room ${partyCode}`);
      socket.emit('left-party', partyCode);
      socket.to(partyCode).emit('user-left', { socketId: socket.id });
    });

    socket.on('disconnect', async () => {
      debugLog(`❌ Client disconnected: ${socket.id}`);

      const rooms = Array.from(socket.rooms).filter(
        (room) => room !== socket.id
      );

      rooms.forEach((room) => {
        socket.to(room).emit('user-disconnected', { socketId: socket.id });
        debugLog(`📢 Notified room ${room} of disconnection`);
      });

      await disconnectSocketPartyMemberships(socket.id);
    });

    socket.on('kick-user', (partyCode) => {
      if (!partyCode) return;

      socket.leave(partyCode);
      debugLog(`${socket.id} kicked from room ${partyCode}`);
      socket.emit('kicked-from-party', partyCode);
      socket.to(partyCode).emit('user-kicked', { socketId: socket.id });
    });

    socket.on('delete-party', (partyCode) => {
      if (!partyCode) return;

      debugLog(`🗑️ Party deleted: ${partyCode}`);
      socket.to(partyCode).emit('party-deleted', { partyCode });
      socket.emit('party-deleted', { partyCode });

      const clientsInRoom = io.sockets.adapter.rooms.get(partyCode);
      if (clientsInRoom) {
        for (const clientId of clientsInRoom) {
          const clientSocket = io.sockets.sockets.get(clientId);
          clientSocket?.leave(partyCode);
        }
      }
    });
  });
}

module.exports = {
  registerPartySockets
};
