const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const { configureMiddleware } = require('./middleware');
const { createPartyRuntime } = require('./game-engine/party-runtime');
const { registerApiRoutes } = require('./routes/api');
const { registerPageRoutes } = require('./routes/pages');
const { registerPartySockets } = require('./sockets/register-party-sockets');
const {
  registerOlingBattleSockets
} = require('./sockets/register-oling-battle-sockets');
const { createDatabaseServices } = require('./services/database');
const { createRoomArchiver } = require('./services/database/room-archiver');
const {
  createActivePartyOwnerLeaseService
} = require('./services/active-party-owner-leases');
const models = require('./models');
const logger = require('./logger');

function createAppServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  configureMiddleware(app);

  const partyOwnerLeases = createActivePartyOwnerLeaseService({ models });
  const roomArchiver = createRoomArchiver({ models, partyOwnerLeases });

  const runtime = createPartyRuntime({
    app,
    io,
    models,
    logger,
    partyOwnerLeases,
    roomArchiver
  });

  registerApiRoutes({
    app,
    models,
    runtime,
    partyOwnerLeases
  });

  app.use('/api', (req, res) => {
    res.apiError({
      status: 404,
      code: 'api_route_not_found',
      message: `No API route found for ${req.method} ${req.originalUrl}`
    });
  });

  registerPartySockets({
    io,
    debugLog: logger.debugLog,
    disconnectSocketPartyMemberships: runtime.disconnectSocketPartyMemberships
  });

  registerOlingBattleSockets({
    io,
    debugLog: logger.debugLog
  });

  registerPageRoutes({
    app,
    accountModel: models.Account,
    debugLog: logger.debugLog,
    hostedPartyModels: [
      models.waitingRoomSchema,
      models.partyGameImposterSchema,
      models.partyGameWouldYouRatherSchema
    ],
    waitingRoomModel: models.waitingRoomSchema
  });

  app.use((error, req, res, next) => {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const code =
      typeof error?.code === 'string' ? error.code : 'internal_error';
    const message =
      status >= 500
        ? 'Internal Server Error'
        : error?.message || 'Request failed';

    console.error(`[REQ ${req.id || 'unknown'}] Unhandled error:`, error);

    if (req.originalUrl?.startsWith('/api/')) {
      res.apiError({
        status,
        code,
        message
      });
      return;
    }

    next(error);
  });

  const database = createDatabaseServices({
    io,
    debugLog: logger.debugLog,
    models,
    partyOwnerLeases,
    roomArchiver
  });

  return {
    app,
    server,
    io,
    database
  };
}

module.exports = {
  createAppServer
};
