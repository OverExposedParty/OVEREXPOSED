const CLASH_ACTIONS = Object.freeze(['attack', 'guard', 'skill']);
const CLASH_LAYERS = Object.freeze(['mouth', 'body', 'flight', 'eyes']);
const CLASH_HEALTH_LAYERS = Object.freeze(['shields', 'overgrowth', 'hearts']);
const CLASH_DAMAGE_TYPES = Object.freeze(['normal', 'piercing', 'true']);
const CLASH_DAMAGE_SOURCES = Object.freeze([
  'clash',
  'draw',
  'bonus',
  'ability',
  'status',
  'burn',
  'execute'
]);
const CLASH_EFFECT_MECHANICS = Object.freeze([
  'damage',
  'heal',
  'cleanse',
  'suppress',
  'block',
  'mark',
  'ward',
  'steal',
  'reflect',
  'transfer',
  'restore',
  'grant-overgrowth',
  'grant-shield',
  'apply-status',
  'store-resource'
]);
const CLASH_STATUS_POLARITIES = Object.freeze([
  'positive',
  'negative',
  'neutral',
  'variable'
]);
const CLASH_TRIGGERS = Object.freeze([
  'attack_win',
  'guard_win',
  'skill_win',
  'draw_survived'
]);
const CLASH_TRIGGER_BY_LAYER = Object.freeze({
  mouth: 'attack_win',
  body: 'guard_win',
  flight: 'skill_win',
  eyes: 'draw_survived'
});
const CLASH_ROLE_TAGS = Object.freeze([
  'striker',
  'guardian',
  'support',
  'disruptor',
  'leech',
  'trickster',
  'tactician'
]);
const CLASH_CONTENT_STATUSES = Object.freeze(['draft', 'published', 'retired']);
const CLASH_PLAYER_SLOTS = Object.freeze(['player-one', 'player-two']);

module.exports = {
  CLASH_ACTIONS,
  CLASH_CONTENT_STATUSES,
  CLASH_DAMAGE_SOURCES,
  CLASH_DAMAGE_TYPES,
  CLASH_EFFECT_MECHANICS,
  CLASH_HEALTH_LAYERS,
  CLASH_LAYERS,
  CLASH_PLAYER_SLOTS,
  CLASH_ROLE_TAGS,
  CLASH_STATUS_POLARITIES,
  CLASH_TRIGGER_BY_LAYER,
  CLASH_TRIGGERS
};
