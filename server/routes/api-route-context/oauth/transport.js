function createOAuthTransport() {
  function decodeJwtPayload(token) {
    if (typeof token !== 'string') return {};

    const [, payload] = token.split('.');
    if (!payload) return {};

    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return {};
    }
  }

  async function fetchOAuthToken(config, code, codeVerifier = null) {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri
    });

    if (config.usePkce && codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || (!payload.access_token && !payload.id_token)) {
      const error = new Error('OAuth token exchange failed');
      error.details = payload;
      throw error;
    }

    return payload;
  }

  function getAppleDisplayName(userPayload) {
    const name = userPayload?.name;
    if (!name || typeof name !== 'object') return null;

    return [name.firstName, name.lastName].filter(Boolean).join(' ') || null;
  }

  function parseAppleUserPayload(user) {
    if (user && typeof user === 'object') return user;
    if (typeof user !== 'string') return {};

    try {
      return JSON.parse(user);
    } catch {
      return {};
    }
  }

  async function fetchOAuthProfile(
    provider,
    config,
    tokenPayload,
    authBody = {}
  ) {
    if (provider === 'apple') {
      const identity = decodeJwtPayload(tokenPayload.id_token);
      const userPayload = parseAppleUserPayload(authBody.user);
      const expectedAudience = process.env.APPLE_CLIENT_ID;

      if (
        identity.iss !== 'https://appleid.apple.com' ||
        (expectedAudience && identity.aud !== expectedAudience) ||
        (identity.exp && Number(identity.exp) * 1000 < Date.now())
      ) {
        throw new Error('Apple identity token could not be verified');
      }

      return {
        providerUserId: identity.sub,
        email: identity.email || userPayload.email || null,
        displayName: getAppleDisplayName(userPayload),
        avatarUrl: null
      };
    }

    const accessToken = tokenPayload.access_token;
    const requestOptions = {
      method: config.userInfoMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    };

    if (config.userInfoBody) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(config.userInfoBody);
    }

    const response = await fetch(config.userInfoUrl, requestOptions);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error('OAuth profile fetch failed');
      error.details = payload;
      throw error;
    }

    if (provider === 'google') {
      return {
        providerUserId: payload.sub,
        email: payload.email,
        displayName: payload.name || payload.given_name || null,
        avatarUrl: payload.picture || null
      };
    }

    if (provider === 'discord') {
      return {
        providerUserId: payload.id,
        email: payload.email,
        displayName: payload.global_name || payload.username || null,
        avatarUrl:
          payload.id && payload.avatar
            ? `https://cdn.discordapp.com/avatars/${payload.id}/${payload.avatar}.png`
            : null
      };
    }

    const snapchatProfile = payload?.data?.me || payload?.me || payload;
    return {
      providerUserId: snapchatProfile.externalId,
      email: snapchatProfile.email || null,
      displayName: snapchatProfile.displayName || null,
      avatarUrl: snapchatProfile.bitmoji?.avatar || null
    };
  }

  return {
    decodeJwtPayload,
    fetchOAuthToken,
    getAppleDisplayName,
    parseAppleUserPayload,
    fetchOAuthProfile
  };
}

module.exports = { createOAuthTransport };
