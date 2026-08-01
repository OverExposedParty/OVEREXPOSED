const DIGITALOCEAN_REGION_METADATA_URL =
  'http://169.254.169.254/metadata/v1/region';

let cachedServerRegion;
let pendingServerRegion;

function normaliseServerRegion(region) {
  if (typeof region !== 'string') return null;

  const normalised = region.trim().toUpperCase();
  return normalised || null;
}

async function fetchDigitalOceanServerRegion() {
  if (typeof fetch !== 'function') return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300);

  try {
    const response = await fetch(DIGITALOCEAN_REGION_METADATA_URL, {
      signal: controller.signal
    });

    if (!response.ok) return null;

    return normaliseServerRegion(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getServerRegion() {
  if (cachedServerRegion) {
    return cachedServerRegion;
  }

  if (!pendingServerRegion) {
    pendingServerRegion = fetchDigitalOceanServerRegion().then(
      (region) =>
        region || normaliseServerRegion(process.env.SERVER_REGION) || 'LOCAL'
    );
  }

  cachedServerRegion = await pendingServerRegion;
  return cachedServerRegion;
}

module.exports = {
  getServerRegion,
  normaliseServerRegion
};
