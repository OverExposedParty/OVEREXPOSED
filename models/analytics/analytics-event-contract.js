const ANALYTICS_EVENT_NAMES = Object.freeze([
  'notification.impression',
  'notification.action_clicked',
  'notification.dismissed',
  'notification.closed',
  'notification.conversion',
  'auth.attempted',
  'auth.completed',
  'auth.failed',
  'game.pack_changed',
  'game.rule_changed',
  'game.started',
  'game.question_shown',
  'game.question_advanced',
  'game.question_abandoned',
  'game.ended',
  'game.abandoned'
]);

const ANALYTICS_RETENTION_DAYS = 120;

module.exports = {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_RETENTION_DAYS
};
