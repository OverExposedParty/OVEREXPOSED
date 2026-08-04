const EMAIL_AUTOMATION_TRIGGERS = Object.freeze([
  'email-verification',
  'password-reset-request',
  'email-address-change'
]);

const EMAIL_AUTOMATION_STATUSES = Object.freeze(['active', 'inactive']);

module.exports = {
  EMAIL_AUTOMATION_STATUSES,
  EMAIL_AUTOMATION_TRIGGERS
};
