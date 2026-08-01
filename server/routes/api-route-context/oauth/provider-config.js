function createOAuthProviderConfig({ crypto, fs, path }) {
  function getRequestBaseUrl(req) {
    return `${req.protocol}://${req.get('host')}`;
  }

  function getOAuthCallbackUrl(req, provider) {
    return `${getRequestBaseUrl(req)}/api/auth/${provider}/callback`;
  }

  function getApplePrivateKey() {
    const rawKey = process.env.APPLE_PRIVATE_KEY;
    if (rawKey) return rawKey.replace(/\\n/g, '\n');

    const keyPath = process.env.APPLE_PRIVATE_KEY_PATH;
    if (!keyPath) return null;

    try {
      return fs.readFileSync(path.resolve(keyPath), 'utf8');
    } catch (err) {
      console.error('[AUTH] Failed to read Apple private key:', err);
      return null;
    }
  }

  function createAppleClientSecret() {
    const teamId = process.env.APPLE_TEAM_ID;
    const clientId = process.env.APPLE_CLIENT_ID;
    const keyId = process.env.APPLE_KEY_ID;
    const privateKey = getApplePrivateKey();

    if (!teamId || !clientId || !keyId || !privateKey) return null;

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 60 * 60 * 24 * 30,
      aud: 'https://appleid.apple.com',
      sub: clientId
    };
    const signingInput = [
      Buffer.from(JSON.stringify(header)).toString('base64url'),
      Buffer.from(JSON.stringify(payload)).toString('base64url')
    ].join('.');

    try {
      const signature = crypto
        .sign('sha256', Buffer.from(signingInput), {
          key: privateKey,
          dsaEncoding: 'ieee-p1363'
        })
        .toString('base64url');

      return `${signingInput}.${signature}`;
    } catch (err) {
      console.error('[AUTH] Failed to create Apple client secret:', err);
      return null;
    }
  }

  function getOAuthProviderConfig(req, provider) {
    const configs = {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: 'openid email profile',
        userInfoMethod: 'GET'
      },
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        authorizeUrl: 'https://discord.com/oauth2/authorize',
        tokenUrl: 'https://discord.com/api/oauth2/token',
        userInfoUrl: 'https://discord.com/api/users/@me',
        scope: 'identify email',
        userInfoMethod: 'GET'
      },
      snapchat: {
        clientId: process.env.SNAPCHAT_CLIENT_ID,
        clientSecret: process.env.SNAPCHAT_CLIENT_SECRET,
        authorizeUrl: 'https://accounts.snapchat.com/accounts/oauth2/auth',
        tokenUrl: 'https://accounts.snapchat.com/accounts/oauth2/token',
        userInfoUrl: 'https://kit.snapchat.com/v1/me',
        scope:
          'https://auth.snapchat.com/oauth2/api/user.display_name https://auth.snapchat.com/oauth2/api/user.external_id https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar',
        userInfoMethod: 'POST',
        usePkce: true,
        userInfoBody: {
          query: '{me{displayName externalId bitmoji{avatar}}}'
        }
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: createAppleClientSecret(),
        authorizeUrl: 'https://appleid.apple.com/auth/authorize',
        tokenUrl: 'https://appleid.apple.com/auth/token',
        scope: 'name email',
        userInfoMethod: 'TOKEN',
        responseType: 'code id_token',
        responseMode: 'form_post'
      }
    };
    const config = configs[provider];

    if (!config) return null;

    return { ...config, redirectUri: getOAuthCallbackUrl(req, provider) };
  }

  function getSupportedOAuthProvider(provider) {
    return ['google', 'discord'].includes(provider) ? provider : null;
  }

  return {
    getRequestBaseUrl,
    getOAuthCallbackUrl,
    getApplePrivateKey,
    createAppleClientSecret,
    getOAuthProviderConfig,
    getSupportedOAuthProvider
  };
}

module.exports = { createOAuthProviderConfig };
