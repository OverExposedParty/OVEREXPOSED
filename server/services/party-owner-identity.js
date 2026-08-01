const nodeCrypto = require('node:crypto');

const PARTY_OWNER_COOKIE = 'oe_party_owner';
const LEGACY_PARTY_GUEST_COOKIE = 'oe_party_guest';
const PARTY_OWNER_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;
const PARTY_OWNER_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const partyOwnerIdentitySymbol = Symbol('partyOwnerIdentity');

function decodeCookieValue(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return '';
  }
}

function readCookieValue(cookieHeader, name, getCookieValue) {
  if (typeof cookieHeader !== 'string') return '';

  if (typeof getCookieValue === 'function') {
    return decodeCookieValue(getCookieValue(cookieHeader, name));
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeCookieValue(cookie.slice(name.length + 1)) : '';
}

function hashPartyOwnerToken(token, crypto = nodeCrypto) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest('hex');
}

function cachePartyOwnerIdentity(req, identity) {
  if (req && typeof req === 'object') {
    req[partyOwnerIdentitySymbol] = identity;
  }
  return identity;
}

function getPartyOwnerIdentityFromRequest(
  req,
  { crypto = nodeCrypto, getCookieValue } = {}
) {
  if (req?.[partyOwnerIdentitySymbol]) {
    return req[partyOwnerIdentitySymbol];
  }

  const cookieHeader = req?.headers?.cookie;
  const ownerToken = readCookieValue(
    cookieHeader,
    PARTY_OWNER_COOKIE,
    getCookieValue
  );
  if (PARTY_OWNER_TOKEN_PATTERN.test(ownerToken)) {
    return cachePartyOwnerIdentity(req, {
      token: ownerToken,
      tokenHash: hashPartyOwnerToken(ownerToken, crypto),
      source: 'owner',
      ownerCookieSet: true
    });
  }

  const legacyToken = readCookieValue(
    cookieHeader,
    LEGACY_PARTY_GUEST_COOKIE,
    getCookieValue
  );
  if (PARTY_OWNER_TOKEN_PATTERN.test(legacyToken)) {
    return cachePartyOwnerIdentity(req, {
      token: legacyToken,
      tokenHash: hashPartyOwnerToken(legacyToken, crypto),
      source: 'legacy',
      ownerCookieSet: false
    });
  }

  return null;
}

function setPartyOwnerCookie(res, token) {
  if (typeof res?.cookie !== 'function') return false;

  res.cookie(PARTY_OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PARTY_OWNER_COOKIE_MAX_AGE_MS
  });
  return true;
}

function ensurePartyOwnerIdentity(
  req,
  res,
  { crypto = nodeCrypto, getCookieValue } = {}
) {
  let identity = getPartyOwnerIdentityFromRequest(req, {
    crypto,
    getCookieValue
  });

  if (!identity) {
    const token = crypto.randomBytes(32).toString('hex');
    identity = cachePartyOwnerIdentity(req, {
      token,
      tokenHash: hashPartyOwnerToken(token, crypto),
      source: 'generated',
      ownerCookieSet: false
    });
  }

  if (!identity.ownerCookieSet) {
    identity.ownerCookieSet = setPartyOwnerCookie(res, identity.token);
  }

  return identity;
}

function getPartyOwnerIdHashFromRequest(
  req,
  { crypto = nodeCrypto, getCookieValue } = {}
) {
  return (
    getPartyOwnerIdentityFromRequest(req, { crypto, getCookieValue })
      ?.tokenHash || ''
  );
}

module.exports = {
  PARTY_OWNER_COOKIE,
  LEGACY_PARTY_GUEST_COOKIE,
  PARTY_OWNER_COOKIE_MAX_AGE_MS,
  PARTY_OWNER_TOKEN_PATTERN,
  ensurePartyOwnerIdentity,
  getPartyOwnerIdentityFromRequest,
  getPartyOwnerIdHashFromRequest,
  hashPartyOwnerToken
};
