const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const permissionsPolicy = require('permissions-policy');

const {
  PUBLIC_DIRECTORY,
  ONE_YEAR_IN_SECONDS,
  STATIC_ASSET_EXTENSIONS,
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_SCRIPT_SRC,
  DEFAULT_CONNECT_SRC,
  DEFAULT_STYLE_SRC,
  DEFAULT_IMG_SRC,
  DEFAULT_MEDIA_SRC,
  DEFAULT_FONT_SRC
} = require('./constants');
const { debugLog, isProduction } = require('./logger');

function configureMiddleware(app) {
  app.use(attachRequestContext);
  app.use(expressJsonSafe());
  app.use(compression({ threshold: 1024 }));
  app.use((req, res, next) => {
    res.locals.cspNonce = generateCspNonce();
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      hsts: false,
      crossOriginOpenerPolicy: isProduction ? { policy: 'same-origin' } : false,
      originAgentCluster: isProduction
    })
  );

  if (isProduction) {
    app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));
  }

  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      buildContentSecurityPolicy(res.locals.cspNonce)
    );
    next();
  });

  app.use(helmet.frameguard({ action: 'sameorigin' }));
  app.use(helmet.noSniff());
  app.use(helmet.referrerPolicy({ policy: 'no-referrer-when-downgrade' }));

  app.use(
    permissionsPolicy({
      features: {
        geolocation: ['self'],
        microphone: []
      }
    })
  );

  app.use(cors(buildCorsOptions()));

  app.use((req, res, next) => {
    const ext = path.extname(req.path).toLowerCase();
    let hasVersionQuery = false;

    try {
      const requestUrl = new URL(req.originalUrl, 'http://localhost');
      hasVersionQuery = requestUrl.searchParams.has('v');
    } catch {
      hasVersionQuery = false;
    }

    if (STATIC_ASSET_EXTENSIONS.has(ext)) {
      if (hasVersionQuery) {
        res.setHeader(
          'Cache-Control',
          `public, max-age=${ONE_YEAR_IN_SECONDS}, immutable`
        );
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    } else if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  });

  app.use(expressStaticSafe());
}

function expressJsonSafe() {
  const express = require('express');
  return express.json();
}

function expressStaticSafe() {
  const express = require('express');
  return express.static(PUBLIC_DIRECTORY, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.svg')) {
        res.set('Content-Type', 'image/svg+xml');
      }
    }
  });
}

function buildCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error(`Origin ${origin} is not allowed by CORS`);
      error.status = 403;
      error.code = 'cors_origin_denied';
      callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    optionsSuccessStatus: 204
  };
}

function getAllowedOrigins() {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const baseOrigins = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  return new Set(baseOrigins);
}

function buildScriptSrc(cspNonce = null) {
  const values = [...DEFAULT_SCRIPT_SRC];

  if (cspNonce) {
    values.push(`'nonce-${cspNonce}'`);
  }

  return [...new Set(values)];
}

function buildConnectSrc() {
  const values = [...DEFAULT_CONNECT_SRC];

  for (const origin of getAllowedOrigins()) {
    values.push(origin);

    if (origin.startsWith('https://')) {
      values.push(`wss://${origin.slice('https://'.length)}`);
    } else if (origin.startsWith('http://')) {
      values.push(`ws://${origin.slice('http://'.length)}`);
    }
  }

  return [...new Set(values)];
}

function buildContentSecurityPolicy(cspNonce = null) {
  const directives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    scriptSrc: buildScriptSrc(cspNonce),
    connectSrc: buildConnectSrc(),
    styleSrc: DEFAULT_STYLE_SRC,
    imgSrc: DEFAULT_IMG_SRC,
    mediaSrc: DEFAULT_MEDIA_SRC,
    fontSrc: DEFAULT_FONT_SRC,
    frameSrc: [
      'https://www.googletagmanager.com',
      'https://*.google-analytics.com',
      'https://script.google.com',
      'https://script.googleusercontent.com'
    ],
    formAction: ["'self'"],
    upgradeInsecureRequests: isProduction ? [] : null
  };

  return Object.entries(directives)
    .filter(([, values]) => Array.isArray(values))
    .map(
      ([directive, values]) =>
        `${camelToKebabCase(directive)} ${values.join(' ')}`
    )
    .join('; ');
}

function camelToKebabCase(value) {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function generateCspNonce() {
  return crypto.randomBytes(16).toString('base64');
}

function attachRequestContext(req, res, next) {
  const requestId = crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.apiSuccess = (payload = {}, status = 200) => {
    res.status(status).json({
      success: true,
      requestId,
      ...payload
    });
  };

  res.apiError = ({
    status = 500,
    code = 'internal_error',
    message = 'Internal Server Error',
    details
  } = {}) => {
    const body = {
      success: false,
      requestId,
      error: {
        code,
        message
      }
    };

    if (details !== undefined) {
      body.error.details = details;
    }

    return res.status(status).json(body);
  };

  debugLog(`[REQ ${requestId}] --> ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    debugLog(
      `[REQ ${requestId}] <-- ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`
    );
  });

  next();
}

module.exports = {
  configureMiddleware
};
