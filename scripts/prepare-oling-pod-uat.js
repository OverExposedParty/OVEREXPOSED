require('dotenv').config();

const models = require('../server/models');
const {
  grantShopItemsToAccount
} = require('../server/services/opals/purchases');
const {
  recordOlingStorageDiagnostic,
  releaseOlingFromPod,
  storeOlingInPod
} = require('../server/services/olings');

const POD_KEY = 'oling_pod';
const CONFIRM_FLAG = '--confirm';
const QUERY_TIMEOUT_MS = 15000;
const COMMAND_TIMEOUT_MS = 25000;

function getArgument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

function getAccountsUri() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const accountsBaseUri = process.env.MONGO_URI_ACCOUNTS || baseUri;
  if (!accountsBaseUri) {
    throw new Error(
      'Missing MongoDB URI. Configure MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE.'
    );
  }
  return (
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(accountsBaseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts')
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPodQuantity(account, podKey = POD_KEY) {
  return (Array.isArray(account?.olings?.pods) ? account.olings.pods : [])
    .filter((pod) => String(pod?.key || '').toLowerCase() === podKey)
    .reduce((sum, pod) => sum + Number(pod?.quantity || 0), 0);
}

function buildUatReadiness({ account, olings }) {
  const list = Array.isArray(olings) ? olings : [];
  const adventureOlingId = String(
    account?.olings?.adventures?.active?.olingId || ''
  );
  const active = list.filter((oling) => oling?.residency?.state !== 'stored');
  const stored = list.filter((oling) => oling?.residency?.state === 'stored');
  const eligible = active.filter(
    (oling) =>
      !oling?.care?.isSleeping && String(oling?._id) !== adventureOlingId
  );
  const podQuantity = getPodQuantity(account);
  const phase = stored.length
    ? 'ready_to_release'
    : eligible.length && podQuantity
      ? 'ready_to_store'
      : eligible.length
        ? 'pod_required'
        : 'no_eligible_oling';

  return {
    phase,
    activeOlings: active.length,
    storedOlings: stored.length,
    eligibleOlings: eligible.length,
    adventuringOlings: adventureOlingId ? 1 : 0,
    emptyPodQuantity: podQuantity,
    suggestedOlingId: String(stored[0]?._id || eligible[0]?._id || '') || null
  };
}

function verifyReleaseOutcome({ account, olings, olingId, startingPods }) {
  const target = (Array.isArray(olings) ? olings : []).find(
    (oling) => String(oling?._id) === String(olingId || '')
  );
  const expectedPods = Number(startingPods);
  const actualPods = getPodQuantity(account);
  const errors = [];
  if (!target) errors.push('The selected UAT Oling no longer exists.');
  if (target?.residency?.state === 'stored') {
    errors.push('The selected UAT Oling is still stored.');
  }
  if (!Number.isInteger(expectedPods) || expectedPods < 0) {
    errors.push('Provide the pre-grant pod quantity with --starting-pods.');
  } else if (actualPods !== expectedPods) {
    errors.push(
      `Expected ${expectedPods} empty pods after release; found ${actualPods}.`
    );
  }
  return {
    ok: errors.length === 0,
    olingId: String(olingId || '') || null,
    expectedEmptyPods: Number.isInteger(expectedPods) ? expectedPods : null,
    actualEmptyPods: actualPods,
    residency: target?.residency?.state || null,
    errors
  };
}

async function loadAccountOlings(accountId) {
  return models.PlayerOling.find({ ownerId: accountId })
    .select('_id name care.isSleeping residency')
    .sort({ 'residency.labSlot': 1, hatchedAt: 1 })
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean();
}

async function buildSummary() {
  const accounts = await models.Account.find({})
    .select('_id olings.pods olings.adventures.active')
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean();
  const olings = await models.PlayerOling.find({})
    .select('_id ownerId care.isSleeping residency')
    .maxTimeMS(QUERY_TIMEOUT_MS)
    .lean();
  const byOwner = new Map();
  olings.forEach((oling) => {
    const ownerId = String(oling.ownerId);
    const list = byOwner.get(ownerId) || [];
    list.push(oling);
    byOwner.set(ownerId, list);
  });
  const readiness = accounts.map((account) =>
    buildUatReadiness({
      account,
      olings: byOwner.get(String(account._id)) || []
    })
  );
  return {
    accounts: accounts.length,
    accountsWithOlings: readiness.filter((item) => item.activeOlings).length,
    readyToStore: readiness.filter((item) => item.phase === 'ready_to_store')
      .length,
    readyToRelease: readiness.filter(
      (item) => item.phase === 'ready_to_release'
    ).length,
    eligibleButNeedsPod: readiness.filter(
      (item) => item.phase === 'pod_required'
    ).length
  };
}

async function main() {
  const username = String(getArgument('--username')).trim().replace(/^@+/, '');
  const summaryOnly = process.argv.includes('--summary');
  const grant = process.argv.includes('--grant');
  const exercise = process.argv.includes('--exercise');
  const verifyRelease = process.argv.includes('--verify-release');

  if ((grant || exercise) && !process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing to mutate the account without ${CONFIRM_FLAG}.`);
  }
  if (!summaryOnly && !username) {
    throw new Error(
      'Provide an exact username with --username, or use --summary.'
    );
  }

  await models.accountsConnection.openUri(getAccountsUri(), {
    serverSelectionTimeoutMS: QUERY_TIMEOUT_MS,
    socketTimeoutMS: QUERY_TIMEOUT_MS
  });

  if (summaryOnly) {
    console.log(JSON.stringify(await buildSummary(), null, 2));
    return;
  }

  const accounts = await models.Account.find({
    username: { $regex: `^${escapeRegExp(username)}$`, $options: 'i' }
  })
    .limit(2)
    .maxTimeMS(QUERY_TIMEOUT_MS);
  if (accounts.length !== 1) {
    throw new Error(
      `Expected one exact account for "${username}", found ${accounts.length}.`
    );
  }

  let account = accounts[0];
  const preGrantPodQuantity = getPodQuantity(account);
  if (grant) {
    const result = await grantShopItemsToAccount({
      Account: models.Account,
      OlingState: models.OlingState,
      accountId: account._id,
      grants: [{ type: 'oling_pod', key: POD_KEY, quantity: 1 }],
      metadata: { reason: 'Oling Pod browser UAT preparation' }
    });
    if (result.error) throw new Error(result.error.message);
    account = await models.Account.findById(account._id).maxTimeMS(
      QUERY_TIMEOUT_MS
    );
  }

  let olings = await loadAccountOlings(account._id);
  let readiness = buildUatReadiness({ account, olings });
  let exerciseResult = null;

  if (exercise) {
    if (!['ready_to_store', 'ready_to_release'].includes(readiness.phase)) {
      throw new Error(
        `The account is not ready for a live exercise (${readiness.phase}).`
      );
    }

    const olingId = String(
      getArgument('--oling-id', readiness.suggestedOlingId)
    ).trim();
    const podsBeforeExercise = getPodQuantity(account);
    let storeResult = null;

    if (readiness.phase === 'ready_to_store') {
      storeResult = await storeOlingInPod({
        models,
        accountId: account._id,
        olingId,
        podKey: POD_KEY
      });
      recordOlingStorageDiagnostic({
        operation: 'store',
        outcome: storeResult.error ? 'rejected' : 'succeeded',
        accountId: account._id,
        olingId,
        podKey: POD_KEY,
        rosterActiveCount: storeResult.roster?.activeCount,
        error: storeResult.error,
        requestId: 'oling-pod-uat'
      });
      if (storeResult.error) throw new Error(storeResult.error.message);
    }

    const releaseResult = await releaseOlingFromPod({
      models,
      accountId: account._id,
      olingId
    });
    recordOlingStorageDiagnostic({
      operation: 'release',
      outcome: releaseResult.error ? 'rejected' : 'succeeded',
      accountId: account._id,
      olingId,
      podKey: releaseResult.pod?.key || POD_KEY,
      releaseOutcome: releaseResult.pod?.releaseOutcome,
      rosterActiveCount: releaseResult.roster?.activeCount,
      error: releaseResult.error,
      requestId: 'oling-pod-uat'
    });
    if (releaseResult.error) throw new Error(releaseResult.error.message);

    account = await models.Account.findById(account._id).maxTimeMS(
      QUERY_TIMEOUT_MS
    );
    olings = await loadAccountOlings(account._id);
    readiness = buildUatReadiness({ account, olings });
    const expectedPods = Math.max(
      0,
      podsBeforeExercise - (storeResult ? 1 : 0)
    );
    const verification = verifyReleaseOutcome({
      account,
      olings,
      olingId,
      startingPods: expectedPods
    });
    exerciseResult = {
      ok:
        verification.ok &&
        releaseResult.pod?.destroyed === true &&
        releaseResult.roster?.activeCount === 6,
      olingId,
      stored: Boolean(storeResult),
      released: true,
      podDestroyed: releaseResult.pod?.destroyed === true,
      activeCountAfterStore: storeResult?.roster?.activeCount ?? null,
      activeCountAfterRelease: releaseResult.roster?.activeCount ?? null,
      verification
    };
    if (!exerciseResult.ok) process.exitCode = 1;
  }

  const output = {
    username: account.username,
    granted: grant,
    preGrantPodQuantity,
    ...readiness,
    ...(exerciseResult ? { exercise: exerciseResult } : {})
  };

  if (verifyRelease) {
    output.releaseVerification = verifyReleaseOutcome({
      account,
      olings,
      olingId: getArgument('--oling-id'),
      startingPods: getArgument('--starting-pods')
    });
    if (!output.releaseVerification.ok) process.exitCode = 1;
  }

  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  const watchdog = setTimeout(() => {
    console.error(`UAT command timed out after ${COMMAND_TIMEOUT_MS}ms.`);
    process.exit(1);
  }, COMMAND_TIMEOUT_MS);
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      clearTimeout(watchdog);
      await models.accountsConnection.close().catch(() => {});
    });
}

module.exports = {
  COMMAND_TIMEOUT_MS,
  POD_KEY,
  QUERY_TIMEOUT_MS,
  buildUatReadiness,
  getPodQuantity,
  main,
  verifyReleaseOutcome
};
