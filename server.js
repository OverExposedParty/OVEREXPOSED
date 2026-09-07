require('dotenv').config();

const { createAppServer } = require('./server/app');
const { debugLog } = require('./server/logger');

const PORT = process.env.PORT || 3000;
const { server, database, olingClashDeadlines } = createAppServer();

(async () => {
  await database.connectDatabases();
  await database.ensureDatabaseIndexes();
  database.startRoomArchiver();
  await database.startChangeStreams();
  olingClashDeadlines.start();

  server.listen(PORT, () => {
    debugLog(`🚀 Server listening on port ${PORT}`);
  });
})();
