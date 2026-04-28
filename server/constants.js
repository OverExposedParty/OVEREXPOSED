const path = require('path');

const ROOT_DIRECTORY = path.resolve(__dirname, '..');
const PUBLIC_DIRECTORY = path.join(ROOT_DIRECTORY, 'public');
const WEBSITE_CACHE_VERSION =
  process.env.WEBSITE_CACHE_VERSION || '2026-04-26-1';
const DEPLOYMENT_VERSION = WEBSITE_CACHE_VERSION;
const ONE_YEAR_IN_SECONDS = 31536000;
const PARTY_CODE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PARTY_CODE_MAX_ATTEMPTS = 100;
const CHANGE_STREAM_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];
const ONLINE_GAMEMODE_MIN_PLAYERS = {
  'truth-or-dare': 2,
  paranoia: 3,
  'never-have-i-ever': 2,
  'most-likely-to': 3,
  imposter: 3,
  'would-you-rather': 2,
  mafia: 5
};
const ONLINE_GAMEMODE_MAX_PLAYERS = {
  'truth-or-dare': 20,
  paranoia: 15,
  'never-have-i-ever': 20,
  'most-likely-to': 20,
  imposter: 16,
  'would-you-rather': 20,
  mafia: 20
};
const PLAYER_TURN_ORDER_GAMEMODES = new Set(['truth-or-dare', 'paranoia']);
const PARTY_META_IMAGE_FILENAMES = {
  waitingForHost: ['waiting-for-host.jpg', 'play.jpg'],
  gameHasStarted: ['game-has-started.jpg'],
  gameHasFinished: ['game-has-finished.jpg'],
  lobbyFull: ['lobby-full.jpg', 'lobby full.jpg', 'play.jpg']
};
const STATIC_ASSET_EXTENSIONS = new Set([
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.mp3',
  '.wav',
  '.ogg',
  '.json'
]);
const DEFAULT_ALLOWED_ORIGINS = [
  'https://overexposed.app',
  'https://www.overexposed.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const DEFAULT_SCRIPT_SRC = [
  "'self'",
  'https://code.responsivevoice.org',
  'https://www.googletagmanager.com',
  'https://cdnjs.cloudflare.com',
  'https://unpkg.com',
  'https://cdn.socket.io'
];
const DEFAULT_CONNECT_SRC = [
  "'self'",
  'https://www.google-analytics.com',
  'https://*.google-analytics.com',
  'https://docs.google.com',
  'https://doc-0g-8s-sheets.googleusercontent.com',
  'https://script.google.com',
  'https://script.googleusercontent.com',
  'https://cdn.socket.io',
  'https://cdnjs.cloudflare.com',
  'https://unpkg.com',
  'ws:',
  'wss:'
];
const DEFAULT_STYLE_SRC = ["'self'", "'unsafe-inline'"];
const DEFAULT_IMG_SRC = [
  "'self'",
  'data:',
  'blob:',
  'https://www.google-analytics.com',
  'https://*.google-analytics.com'
];
const DEFAULT_MEDIA_SRC = ["'self'", 'blob:'];
const DEFAULT_FONT_SRC = ["'self'", 'data:'];

function formatGamemodeName(gamemode = '') {
  return gamemode
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  ROOT_DIRECTORY,
  PUBLIC_DIRECTORY,
  WEBSITE_CACHE_VERSION,
  DEPLOYMENT_VERSION,
  ONE_YEAR_IN_SECONDS,
  PARTY_CODE_CHARACTERS,
  PARTY_CODE_MAX_ATTEMPTS,
  CHANGE_STREAM_BACKOFF_MS,
  ONLINE_GAMEMODE_MIN_PLAYERS,
  ONLINE_GAMEMODE_MAX_PLAYERS,
  PLAYER_TURN_ORDER_GAMEMODES,
  PARTY_META_IMAGE_FILENAMES,
  STATIC_ASSET_EXTENSIONS,
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_SCRIPT_SRC,
  DEFAULT_CONNECT_SRC,
  DEFAULT_STYLE_SRC,
  DEFAULT_IMG_SRC,
  DEFAULT_MEDIA_SRC,
  DEFAULT_FONT_SRC,
  formatGamemodeName
};
