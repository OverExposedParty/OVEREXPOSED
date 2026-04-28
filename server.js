require('dotenv').config();

const { createAppServer } = require('./server/app');
const { debugLog } = require('./server/logger');

const PORT = process.env.PORT || 3000;
const { server, database } = createAppServer();

(async () => {
  await database.connectDatabases();
  await database.ensureDatabaseIndexes();
  await database.startChangeStreams();

  server.listen(PORT, () => {
    debugLog(`🚀 Server listening on port ${PORT}`);
  });
})();
