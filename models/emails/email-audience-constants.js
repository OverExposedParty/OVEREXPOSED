const EMAIL_AUDIENCE_TYPES = ['dynamic', 'static', 'manual'];
const EMAIL_AUDIENCE_STATUSES = ['active', 'inactive'];
const EMAIL_AUDIENCE_MATCH_MODES = ['all', 'any'];
const EMAIL_AUDIENCE_CONDITION_FIELDS = [
  'emailVerified',
  'accountStatus',
  'createdAt',
  'lastActiveAt',
  'country',
  'preferredLanguage',
  'hasPurchased',
  'hasPlayedGame',
  'adminRole'
];
const EMAIL_AUDIENCE_CONDITION_OPERATORS = ['is', 'is-not', 'before', 'after'];

module.exports = {
  EMAIL_AUDIENCE_TYPES,
  EMAIL_AUDIENCE_STATUSES,
  EMAIL_AUDIENCE_MATCH_MODES,
  EMAIL_AUDIENCE_CONDITION_FIELDS,
  EMAIL_AUDIENCE_CONDITION_OPERATORS
};
