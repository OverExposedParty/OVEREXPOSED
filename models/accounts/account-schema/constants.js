const ACCOUNT_STATUSES = [
  'active',
  'pending_verification',
  'suspended',
  'banned',
  'deleted'
];
const LOGIN_PROVIDERS = [
  'email',
  'google',
  'discord',
  'snapchat',
  'apple',
  'github'
];
const ADMIN_ROLES = ['owner', 'admin', 'support', 'moderator', 'special'];
const ACCESS_ROLES = ['beta_tester'];
const CONSENT_STATUSES = ['accepted', 'declined', 'withdrawn'];
const ORDER_STATUSES = [
  'pending',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
  'chargeback'
];

module.exports = { ACCOUNT_STATUSES, LOGIN_PROVIDERS, ADMIN_ROLES, ACCESS_ROLES, CONSENT_STATUSES, ORDER_STATUSES };
