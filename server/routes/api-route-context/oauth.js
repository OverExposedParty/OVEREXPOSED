const { createOAuthProviderConfig } = require('./oauth/provider-config');
const { createOAuthStateTools } = require('./oauth/state');
const { createOAuthTransport } = require('./oauth/transport');
const { createOAuthAccountTools } = require('./oauth/accounts');
const { createOAuthSessionTools } = require('./oauth/sessions');

function createOAuthContext(context) {
  const providerConfig = createOAuthProviderConfig(context);
  const stateTools = createOAuthStateTools({
    crypto: context.crypto,
    getRequestBaseUrl: providerConfig.getRequestBaseUrl
  });

  return {
    ...providerConfig,
    ...stateTools,
    ...createOAuthTransport(),
    ...createOAuthAccountTools(context),
    ...createOAuthSessionTools(context)
  };
}

module.exports = { createOAuthContext };
