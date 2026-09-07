const MATCH_CODE_PATTERN = /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/;
const MATCH_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_MATCH_LENGTH_SECONDS = 30;
const DEFAULT_MARKER_POSITION = 50;
const DEFAULT_MARKER_DIRECTION = 1;
const DEFAULT_AI_DIFFICULTY = 0.4;
const HIT_DAMAGE = Object.freeze({ critical: 3, strike: 2, disruption: 0 });
const AI_OLING_PRESETS = Object.freeze([
  {
    key: 'mossy',
    name: 'Mossy',
    maxHealth: 118,
    oeIcon: '0400:0500:0200:0300',
    build: {
      flight: 'moss-wings',
      body: 'moss-body',
      eyes: 'moss-eyes',
      mouth: 'moss-mouth'
    }
  },
  {
    key: 'pebble',
    name: 'Pebble',
    maxHealth: 132,
    oeIcon: '0500:0600:0100:0200',
    build: {
      flight: 'stone-wings',
      body: 'stone-body',
      eyes: 'stone-eyes',
      mouth: 'stone-mouth'
    }
  },
  {
    key: 'ember',
    name: 'Ember',
    maxHealth: 104,
    oeIcon: '0300:0100:0400:0500',
    build: {
      flight: 'magma-wings',
      body: 'magma-body',
      eyes: 'magma-eyes',
      mouth: 'magma-mouth'
    }
  },
  {
    key: 'scrap',
    name: 'Scrap',
    maxHealth: 96,
    oeIcon: '0200:0700:0300:0100',
    build: {
      flight: 'trash-balloons',
      body: 'trash-body',
      eyes: 'trash-eyes',
      mouth: 'trash-mouth'
    }
  },
  {
    key: 'fang',
    name: 'Fang',
    maxHealth: 108,
    oeIcon: '0100:0300:0500:0400',
    build: {
      flight: 'vampire-wings',
      body: 'vampire-body',
      eyes: 'vampire-eyes',
      mouth: 'vampire-mouth'
    }
  }
]);

module.exports = {
  AI_OLING_PRESETS,
  DEFAULT_AI_DIFFICULTY,
  DEFAULT_MARKER_DIRECTION,
  DEFAULT_MARKER_POSITION,
  DEFAULT_MATCH_LENGTH_SECONDS,
  HIT_DAMAGE,
  MATCH_CODE_ALPHABET,
  MATCH_CODE_PATTERN
};
