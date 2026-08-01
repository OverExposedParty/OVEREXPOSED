const MATCH_CODE_PATTERN = /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/;
const MATCH_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_MATCH_LENGTH_SECONDS = 30;
const DEFAULT_MARKER_POSITION = 50;
const DEFAULT_MARKER_DIRECTION = 1;
const DEFAULT_AI_DIFFICULTY = 0.4;
const MAX_HIT_HISTORY = 12;
const HIT_DAMAGE = Object.freeze({ critical: 3, strike: 2, disruption: 0 });
const AI_OLING_PRESETS = Object.freeze([
  {
    key: 'mossy',
    name: 'Mossy',
    maxHealth: 118,
    level: 8,
    personalityKey: 'steady',
    oeIcon: '0400:0500:0200:0300',
    build: {
      flight: 'base-moss-wings',
      body: 'base-moss-body',
      eyes: 'base-moss-eyes',
      mouth: 'base-moss-mouth'
    }
  },
  {
    key: 'pebble',
    name: 'Pebble',
    maxHealth: 132,
    level: 6,
    personalityKey: 'stubborn',
    oeIcon: '0500:0600:0100:0200',
    build: {
      flight: 'base-stone-wings',
      body: 'base-stone-body',
      eyes: 'base-stone-eyes',
      mouth: 'base-stone-mouth'
    }
  },
  {
    key: 'ember',
    name: 'Ember',
    maxHealth: 104,
    level: 9,
    personalityKey: 'dramatic',
    oeIcon: '0300:0100:0400:0500',
    build: {
      flight: 'base-magma-wings',
      body: 'base-magma-body',
      eyes: 'base-magma-eyes',
      mouth: 'base-magma-mouth'
    }
  },
  {
    key: 'scrap',
    name: 'Scrap',
    maxHealth: 96,
    level: 5,
    personalityKey: 'scrappy',
    oeIcon: '0200:0700:0300:0100',
    build: {
      flight: 'base-trash-balloons',
      body: 'base-trash-body',
      eyes: 'base-trash-eyes',
      mouth: 'base-trash-mouth'
    }
  },
  {
    key: 'fang',
    name: 'Fang',
    maxHealth: 108,
    level: 10,
    personalityKey: 'brave',
    oeIcon: '0100:0300:0500:0400',
    build: {
      flight: 'base-vampire-wings',
      body: 'base-vampire-body',
      eyes: 'base-vampire-eyes',
      mouth: 'base-vampire-mouth'
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
  MATCH_CODE_PATTERN,
  MAX_HIT_HISTORY
};
