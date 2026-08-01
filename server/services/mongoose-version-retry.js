const DEFAULT_MAX_VERSION_RETRY_ATTEMPTS = 3;

function isMongooseVersionError(error) {
  return error?.name === 'VersionError';
}

async function runWithFreshDocumentRetry({
  loadDocument,
  run,
  maxAttempts = DEFAULT_MAX_VERSION_RETRY_ATTEMPTS
} = {}) {
  if (typeof loadDocument !== 'function' || typeof run !== 'function') {
    throw new TypeError('A document loader and operation are required.');
  }

  const attempts = Math.max(1, Math.trunc(Number(maxAttempts) || 0));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const document = await loadDocument();

    try {
      return await run(document, attempt);
    } catch (error) {
      if (!isMongooseVersionError(error) || attempt === attempts) throw error;
    }
  }

  return undefined;
}

module.exports = {
  DEFAULT_MAX_VERSION_RETRY_ATTEMPTS,
  isMongooseVersionError,
  runWithFreshDocumentRetry
};
