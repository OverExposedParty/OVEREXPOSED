const crypto = require('crypto');

const TRACKING_WINDOW_DAYS = 30;
const RESEND_EVENT_FIELDS = {
  'email.sent': { status: 'sent', dateField: 'sentAt' },
  'email.delivered': { status: 'delivered', dateField: 'deliveredAt' },
  'email.delivery_delayed': {
    status: 'delivery_delayed',
    dateField: 'deliveryDelayedAt'
  },
  'email.bounced': { status: 'bounced', dateField: 'bouncedAt' },
  'email.failed': { status: 'failed', dateField: 'failedAt' },
  'email.complained': { status: 'complained', dateField: 'complainedAt' },
  'email.clicked': { dateField: 'firstClickedAt' }
};

function createTrackingId() {
  return crypto.randomUUID();
}

function normalizeEmailAddress(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeTagValue(value, fallback = 'unknown') {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 256);
  return normalized || fallback;
}

function buildResendTags(tracking = {}) {
  if (!tracking.trackingId) return [];
  return [
    { name: 'tracking_id', value: normalizeTagValue(tracking.trackingId) },
    { name: 'email_type', value: normalizeTagValue(tracking.type) },
    { name: 'template_key', value: normalizeTagValue(tracking.templateKey) },
    {
      name: 'automation_trigger',
      value: normalizeTagValue(tracking.automationTrigger)
    }
  ];
}

async function createEmailDelivery(EmailDelivery, input) {
  if (!EmailDelivery?.create) return null;
  try {
    return await EmailDelivery.create({
      trackingId: input.trackingId,
      provider: 'resend',
      type: input.type || (input.isTest ? 'test' : 'automation'),
      templateKey: input.templateKey || '',
      automationTrigger: input.automationTrigger || '',
      recipient: normalizeEmailAddress(input.recipient),
      subject: input.subject || '',
      status: input.status || 'pending',
      isTest: Boolean(input.isTest),
      createdAt: input.createdAt || new Date()
    });
  } catch (error) {
    console.error('[EMAIL] Failed to create delivery tracking record:', error);
    return null;
  }
}

async function updateEmailDelivery(EmailDelivery, trackingId, update) {
  if (!trackingId || !EmailDelivery?.updateOne) return;
  try {
    await EmailDelivery.updateOne({ trackingId }, update);
  } catch (error) {
    console.error('[EMAIL] Failed to update delivery tracking record:', error);
  }
}

function getWebhookFailureReason(event) {
  return String(
    event?.data?.bounce?.message ||
      event?.data?.failed?.reason ||
      event?.data?.reason ||
      ''
  ).slice(0, 1000);
}

function getWebhookTrackingId(event) {
  const tags = event?.data?.tags;
  if (!tags) return '';
  if (Array.isArray(tags)) {
    return tags.find((tag) => tag?.name === 'tracking_id')?.value || '';
  }
  return tags.tracking_id || '';
}

async function applyResendWebhookEvent({ EmailDelivery, event, eventId }) {
  const eventConfig = RESEND_EVENT_FIELDS[event?.type];
  const providerMessageId = String(event?.data?.email_id || '').trim();
  const trackingId = getWebhookTrackingId(event);
  if (
    !EmailDelivery?.updateOne ||
    !eventConfig ||
    (!providerMessageId && !trackingId)
  ) {
    return { matched: false, ignored: true };
  }

  const occurredAt = new Date(event.created_at || Date.now());
  const safeOccurredAt = Number.isNaN(occurredAt.getTime())
    ? new Date()
    : occurredAt;
  const query = trackingId ? { trackingId } : { providerMessageId };
  if (eventId) query.providerEventIds = { $ne: eventId };

  const set = {
    providerMessageId: providerMessageId || undefined,
    lastEventAt: safeOccurredAt
  };
  if (eventConfig.status) set.status = eventConfig.status;
  if (eventConfig.dateField !== 'firstClickedAt') {
    set[eventConfig.dateField] = safeOccurredAt;
  }
  const failureReason = getWebhookFailureReason(event);
  if (failureReason) set.failureReason = failureReason;

  const update = { $set: set };
  if (eventId) update.$addToSet = { providerEventIds: eventId };
  if (eventConfig.dateField === 'firstClickedAt') {
    query.firstClickedAt = null;
    update.$set.firstClickedAt = safeOccurredAt;
  }
  Object.keys(update.$set).forEach((key) => {
    if (update.$set[key] === undefined) delete update.$set[key];
  });

  const result = await EmailDelivery.updateOne(query, update);
  return {
    matched: Boolean(result?.matchedCount || result?.modifiedCount),
    ignored: false
  };
}

function decodeWebhookSecret(secret) {
  const encoded = String(secret || '').replace(/^whsec_/, '');
  return Buffer.from(encoded, 'base64');
}

function verifyResendWebhookSignature({
  payload,
  headers,
  secret,
  now = Date.now()
}) {
  const eventId = String(headers?.['svix-id'] || '');
  const timestamp = String(headers?.['svix-timestamp'] || '');
  const signatures = String(headers?.['svix-signature'] || '')
    .split(' ')
    .map((part) => part.replace(/^v1,/, ''))
    .filter(Boolean);
  const timestampMs = Number(timestamp) * 1000;
  if (
    !eventId ||
    !timestamp ||
    !signatures.length ||
    !secret ||
    !Number.isFinite(timestampMs) ||
    Math.abs(now - timestampMs) > 5 * 60 * 1000
  ) {
    return false;
  }

  const signedPayload = `${eventId}.${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', decodeWebhookSecret(secret))
    .update(signedPayload)
    .digest();

  return signatures.some((signature) => {
    let candidate;
    try {
      candidate = Buffer.from(signature, 'base64');
    } catch {
      return false;
    }
    return (
      candidate.length === expected.length &&
      crypto.timingSafeEqual(candidate, expected)
    );
  });
}

async function recordEmailConversion({ EmailDelivery, trackingId }) {
  if (!trackingId || !EmailDelivery?.updateOne) return false;
  try {
    const result = await EmailDelivery.updateOne(
      { trackingId, isTest: false, convertedAt: null },
      { $set: { convertedAt: new Date() } }
    );
    return Boolean(result?.matchedCount || result?.modifiedCount);
  } catch (error) {
    console.error('[EMAIL] Failed to record email conversion:', error);
    return false;
  }
}

function startOfUtcDay(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function formatPercent(numerator, denominator) {
  if (!denominator) return '0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function getFailureDate(delivery) {
  return (
    delivery.failedAt || delivery.bouncedAt || delivery.complainedAt || null
  );
}

function getDeliveryStatus(delivery) {
  if (delivery.failedAt) return 'Failed';
  if (delivery.bouncedAt) return 'Bounced';
  if (delivery.complainedAt) return 'Complaint';
  return 'Failed';
}

async function getEmailPerformance({ EmailDelivery, now = new Date() }) {
  const end = new Date(now);
  const start = startOfUtcDay(end);
  start.setUTCDate(start.getUTCDate() - (TRACKING_WINDOW_DAYS - 1));
  const deliveries = EmailDelivery?.find
    ? await EmailDelivery.find({
        isTest: false,
        createdAt: { $gte: start, $lte: end }
      })
        .sort({ createdAt: -1 })
        .lean()
    : [];

  const sentDeliveries = deliveries.filter((item) => item.sentAt);
  const sent = sentDeliveries.length;
  const delivered = sentDeliveries.filter((item) => item.deliveredAt).length;
  const clicked = sentDeliveries.filter((item) => item.firstClickedAt).length;
  const converted = sentDeliveries.filter((item) => item.convertedAt).length;
  const dayKeys = [];
  const dayCounts = new Map();
  for (let index = 0; index < TRACKING_WINDOW_DAYS; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    dayKeys.push(key);
    dayCounts.set(key, { sent: 0, delivered: 0, clicked: 0, converted: 0 });
  }

  sentDeliveries.forEach((delivery) => {
    const key = new Date(delivery.sentAt).toISOString().slice(0, 10);
    const counts = dayCounts.get(key);
    if (!counts) return;
    counts.sent += 1;
    if (delivery.deliveredAt) counts.delivered += 1;
    if (delivery.firstClickedAt) counts.clicked += 1;
    if (delivery.convertedAt) counts.converted += 1;
  });

  const failures = deliveries
    .filter((delivery) => getFailureDate(delivery))
    .slice(0, 50)
    .map((delivery) => ({
      deliveryId: String(delivery._id || delivery.trackingId),
      email: delivery.recipient,
      reason: delivery.failureReason || getDeliveryStatus(delivery),
      date: getFailureDate(delivery),
      status: getDeliveryStatus(delivery)
    }));
  const labelIndexes = [0, 5, 11, 17, 23, 29];

  return {
    period: { days: TRACKING_WINDOW_DAYS, start, end },
    stats: {
      sent: { value: String(sent), detail: 'Last 30 days' },
      deliveryRate: {
        value: formatPercent(delivered, sent),
        detail: `${delivered} of ${sent} delivered`
      },
      uniqueClickRate: {
        value: formatPercent(clicked, delivered),
        detail: `${clicked} unique recipient${clicked === 1 ? '' : 's'} clicked`
      },
      conversionRate: {
        value: formatPercent(converted, delivered),
        detail: `${converted} completed action${converted === 1 ? '' : 's'}`
      }
    },
    trends: {
      labels: labelIndexes.map((index) => {
        const date = new Date(`${dayKeys[index]}T00:00:00.000Z`);
        return date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC'
        });
      }),
      series: Object.fromEntries(
        ['sent', 'delivered', 'clicked', 'converted'].map((key) => [
          key,
          dayKeys.map((dayKey) => dayCounts.get(dayKey)[key])
        ])
      )
    },
    failures
  };
}

module.exports = {
  applyResendWebhookEvent,
  buildResendTags,
  createEmailDelivery,
  createTrackingId,
  getEmailPerformance,
  recordEmailConversion,
  updateEmailDelivery,
  verifyResendWebhookSignature
};
