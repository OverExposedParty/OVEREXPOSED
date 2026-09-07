const mongoose = require('mongoose');

const {
  CLASH_ACTIONS,
  CLASH_DAMAGE_SOURCES,
  CLASH_DAMAGE_TYPES,
  CLASH_LAYERS,
  CLASH_PLAYER_SLOTS
} = require('./oling-clash-constants');
const {
  olingClashAbilitySnapshotSchema
} = require('./oling-clash-ability-schema');
const {
  olingClashRulesetSnapshotSchema
} = require('./oling-clash-ruleset-schema');
const {
  olingClashStatusSnapshotSchema
} = require('./oling-clash-status-schema');
const {
  OLING_CLASH_GAME_ID_PATTERN,
  createOlingClashGameId
} = require('./oling-clash-game-id');

const { Schema } = mongoose;
const MATCH_CODE_PATTERN = /^[A-Za-z0-9]{3}-[A-Za-z0-9]{3}$/;
const MATCH_STATUSES = Object.freeze([
  'waiting',
  'ready',
  'active',
  'completed',
  'abandoned'
]);
const MATCH_PHASES = Object.freeze([
  'waiting',
  'starting',
  'selection',
  'resolution',
  'replacement',
  'complete'
]);
const END_REASONS = Object.freeze([
  'team_defeated',
  'surrender',
  'disconnect',
  'abandoned',
  'admin',
  'unknown'
]);
const STATUS_DURATION_TYPES = Object.freeze([
  'round',
  'activation',
  'clash',
  'until-consumed'
]);
const LAST_MOVE_ACTIONS = Object.freeze([...CLASH_ACTIONS, 'draw']);
const EVENT_VISIBILITIES = Object.freeze(['public', 'player', 'server']);
const MAX_EMBEDDED_EVENTS = 500;

const buildSnapshotSchema = new Schema(
  {
    body: { type: String, required: true, trim: true, lowercase: true },
    eyes: { type: String, required: true, trim: true, lowercase: true },
    mouth: { type: String, required: true, trim: true, lowercase: true },
    flight: { type: String, required: true, trim: true, lowercase: true }
  },
  { _id: false }
);

const olingSnapshotSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 40, default: null },
    build: { type: buildSnapshotSchema, required: true },
    equipment: { type: Schema.Types.Mixed, default: () => ({}) },
    traits: { type: Schema.Types.Mixed, default: () => ({}) },
    abilities: {
      type: [olingClashAbilitySnapshotSchema],
      default: []
    }
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const statusInstanceSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    revision: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    sourcePlayerSlot: {
      type: String,
      enum: CLASH_PLAYER_SLOTS,
      default: null
    },
    sourceTeamSlot: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: null
    },
    targetPart: { type: String, enum: CLASH_LAYERS, default: null },
    stacks: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 1
    },
    appliedRound: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    expiresAfterRound: {
      type: Number,
      validate: {
        validator: (value) =>
          value === null || (Number.isInteger(value) && value >= 0),
        message: 'expiresAfterRound must be a non-negative integer or null.'
      },
      default: null
    },
    durationType: {
      type: String,
      enum: STATUS_DURATION_TYPES,
      default: 'until-consumed'
    },
    remaining: {
      type: Number,
      validate: {
        validator: (value) =>
          value === null || (Number.isInteger(value) && value >= 0),
        message: 'remaining must be a non-negative integer or null.'
      },
      default: null
    },
    data: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { timestamps: false }
);

const abilityProgressSchema = new Schema(
  {
    abilityKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    abilityRevision: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    activationCount: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    data: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false, timestamps: false }
);

const removedPositiveStatusSchema = new Schema(
  {
    status: { type: statusInstanceSchema, required: true },
    removedRound: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 80,
      required: true
    }
  },
  { _id: false, timestamps: false }
);

const teamOlingSchema = new Schema(
  {
    teamSlot: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    playerOlingId: {
      type: Schema.Types.ObjectId,
      ref: 'PlayerOling',
      required: true
    },
    snapshot: { type: olingSnapshotSchema, required: true },
    maxHeartUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    heartUnits: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    overgrowthUnits: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    bloodUnits: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    pendingReclaimUnits: {
      type: Number,
      min: 0,
      max: 1,
      validate: Number.isInteger,
      default: 0
    },
    shieldCount: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    defeated: { type: Boolean, default: false },
    abilityProgress: { type: [abilityProgressSchema], default: [] },
    removedPositiveStatuses: {
      type: [removedPositiveStatusSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length <= 20;
        },
        message: 'Removed Positive Status history cannot exceed 20 entries.'
      }
    },
    statuses: { type: [statusInstanceSchema], default: [] }
  },
  { timestamps: false }
);

teamOlingSchema.pre('validate', function validateHeartUnits() {
  if (this.heartUnits > this.maxHeartUnits) {
    this.invalidate(
      'heartUnits',
      'Permanent Hearts cannot exceed maximum permanent Hearts.'
    );
  }
  const progressKeys = this.abilityProgress.map(
    (progress) => `${progress.abilityKey}:${progress.abilityRevision}`
  );
  if (new Set(progressKeys).size !== progressKeys.length) {
    this.invalidate(
      'abilityProgress',
      'Each ability revision can have only one progress entry per Oling.'
    );
  }
});

const selectionSchema = new Schema(
  {
    round: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    action: { type: String, enum: CLASH_ACTIONS, required: true },
    tagTeamSlot: {
      type: Number,
      min: 0,
      validate: {
        validator: (value) => value === null || Number.isInteger(value),
        message: 'tagTeamSlot must be a non-negative integer or null.'
      },
      default: null
    },
    effectChoice: {
      type: new Schema(
        {
          abilityKey: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
          },
          targetTeamSlot: {
            type: Number,
            min: 0,
            validate: Number.isInteger,
            required: true
          },
          optionKey: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
          }
        },
        { _id: false }
      ),
      default: null
    },
    committedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const selectionDraftSchema = new Schema(
  {
    round: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    action: { type: String, enum: CLASH_ACTIONS, default: null },
    tagTeamSlot: {
      type: Number,
      min: 0,
      validate: {
        validator: (value) => value === null || Number.isInteger(value),
        message: 'tagTeamSlot must be a non-negative integer or null.'
      },
      default: null
    },
    effectChoice: {
      type: selectionSchema.path('effectChoice').schema,
      default: null
    },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const lastMoveSchema = new Schema(
  {
    teamSlot: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    action: { type: String, enum: LAST_MOVE_ACTIONS, required: true },
    activationStatus: { type: String, trim: true, default: 'revealed' },
    outcome: { type: String, enum: ['win', 'loss', 'draw'], required: true },
    round: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    }
  },
  { _id: false, timestamps: false }
);

const playerSchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },
    socketId: { type: String, trim: true, default: null },
    playerName: { type: String, trim: true, maxlength: 80, default: 'PLAYER' },
    playerLevel: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 1
    },
    oeIcon: { type: String, trim: true, default: '0000:0100:0200:0300' },
    slot: { type: String, enum: CLASH_PLAYER_SLOTS, required: true },
    connected: { type: Boolean, default: true },
    isAi: { type: Boolean, default: false },
    aiDifficulty: { type: Number, min: 0, max: 1, default: null },
    ready: { type: Boolean, default: false },
    gameLoaded: { type: Boolean, default: false },
    rematchAccepted: { type: Boolean, default: false },
    activeTeamSlot: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    tagCharges: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 2
    },
    tagRechargeProgress: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    statuses: { type: [statusInstanceSchema], default: [] },
    lastMoves: { type: [lastMoveSchema], default: undefined },
    selectionDraft: { type: selectionDraftSchema, default: null },
    selection: { type: selectionSchema, default: null },
    team: {
      type: [teamOlingSchema],
      validate: {
        validator: (team) =>
          Array.isArray(team) && (team.length === 0 || team.length === 3),
        message:
          'A Clash player must have either no team or exactly three Olings.'
      },
      default: []
    }
  },
  { _id: false }
);

playerSchema.pre('validate', function validateTeamSlots() {
  const teamSlots = this.team.map((oling) => oling.teamSlot);
  if (new Set(teamSlots).size !== teamSlots.length) {
    this.invalidate('team', 'Each Oling must have a unique team slot.');
  }
  if (
    teamSlots.length &&
    !teamSlots.some((teamSlot) => teamSlot === this.activeTeamSlot)
  ) {
    this.invalidate(
      'activeTeamSlot',
      'The active team slot must reference an Oling on the player team.'
    );
  }
});

const rulesetReferenceSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    revision: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    snapshot: { type: olingClashRulesetSnapshotSchema, required: true }
  },
  { _id: false }
);

const statusDefinitionReferenceSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    revision: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    snapshot: { type: olingClashStatusSnapshotSchema, required: true }
  },
  { _id: false }
);

const clashEventSchema = new Schema(
  {
    sequence: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    round: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    type: { type: String, required: true, trim: true, lowercase: true },
    actorAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    actorSlot: {
      type: String,
      enum: CLASH_PLAYER_SLOTS,
      default: null
    },
    damageSource: {
      type: String,
      enum: CLASH_DAMAGE_SOURCES,
      default: null
    },
    damageType: {
      type: String,
      enum: CLASH_DAMAGE_TYPES,
      default: null
    },
    visibility: {
      type: String,
      enum: EVENT_VISIBILITIES,
      default: 'public'
    },
    payload: { type: Schema.Types.Mixed, default: () => ({}) },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const olingClashMatchSchema = new Schema(
  {
    gameId: {
      type: String,
      required: true,
      default: () => createOlingClashGameId(),
      match: OLING_CLASH_GAME_ID_PATTERN
    },
    matchCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: MATCH_CODE_PATTERN
    },
    status: { type: String, enum: MATCH_STATUSES, default: 'waiting' },
    phase: { type: String, enum: MATCH_PHASES, default: 'waiting' },
    round: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    phaseEndsAt: { type: Date, default: null },
    stateRevision: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 0
    },
    derivedStateVersion: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: undefined
    },
    latestRoundResult: { type: Schema.Types.Mixed, default: undefined },
    ruleset: { type: rulesetReferenceSchema, required: true },
    statusDefinitions: {
      type: [statusDefinitionReferenceSchema],
      default: []
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    players: {
      type: [playerSchema],
      validate: {
        validator: (players) => Array.isArray(players) && players.length <= 2,
        message: 'A Clash match cannot contain more than two players.'
      },
      default: []
    },
    winnerAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    endReason: { type: String, enum: END_REASONS, default: null },
    events: {
      type: [clashEventSchema],
      validate: {
        validator: (events) =>
          Array.isArray(events) &&
          events.length <= MAX_EMBEDDED_EVENTS &&
          new Set(events.map((event) => event.sequence)).size === events.length,
        message: `Oling Clash matches require unique event sequences and cannot exceed ${MAX_EMBEDDED_EVENTS} events.`
      },
      default: []
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    suppressReservedKeysWarning: true
  }
);

olingClashMatchSchema.pre('validate', function validatePlayerSlots() {
  const playerSlots = this.players.map((player) => player.slot);
  if (new Set(playerSlots).size !== playerSlots.length) {
    this.invalidate('players', 'Each Clash player must use a unique slot.');
  }
});

olingClashMatchSchema.index({ matchCode: 1 }, { unique: true });
olingClashMatchSchema.index(
  { gameId: 1 },
  {
    unique: true,
    partialFilterExpression: { gameId: { $type: 'string' } }
  }
);
olingClashMatchSchema.index({ status: 1, updatedAt: -1 });
olingClashMatchSchema.index({ status: 1, phase: 1, phaseEndsAt: 1 });
olingClashMatchSchema.index({ 'players.accountId': 1, status: 1 });

module.exports = mongoose.model(
  'OlingClashMatch',
  olingClashMatchSchema,
  'oling-clash-matches'
);
module.exports.END_REASONS = END_REASONS;
module.exports.EVENT_VISIBILITIES = EVENT_VISIBILITIES;
module.exports.MAX_EMBEDDED_EVENTS = MAX_EMBEDDED_EVENTS;
module.exports.MATCH_PHASES = MATCH_PHASES;
module.exports.MATCH_STATUSES = MATCH_STATUSES;
module.exports.STATUS_DURATION_TYPES = STATUS_DURATION_TYPES;
module.exports.abilityProgressSchema = abilityProgressSchema;
module.exports.clashEventSchema = clashEventSchema;
module.exports.olingSnapshotSchema = olingSnapshotSchema;
module.exports.lastMoveSchema = lastMoveSchema;
module.exports.playerSchema = playerSchema;
module.exports.selectionDraftSchema = selectionDraftSchema;
module.exports.statusInstanceSchema = statusInstanceSchema;
module.exports.statusDefinitionReferenceSchema =
  statusDefinitionReferenceSchema;
module.exports.teamOlingSchema = teamOlingSchema;
module.exports.rulesetReferenceSchema = rulesetReferenceSchema;
