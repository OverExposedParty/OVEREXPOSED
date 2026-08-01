const mongoose = require('mongoose');

const AVAILABILITY_MODES = ['always', 'fixed', 'annual'];

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const annualBoundarySchema = new mongoose.Schema(
  {
    month: { type: Number, min: 1, max: 12, required: true },
    day: { type: Number, min: 1, max: 31, required: true },
    hour: { type: Number, min: 0, max: 23, default: 0 },
    minute: { type: Number, min: 0, max: 59, default: 0 },
    second: { type: Number, min: 0, max: 59, default: 0 },
    millisecond: { type: Number, min: 0, max: 999, default: 0 }
  },
  { _id: false }
);

annualBoundarySchema.pre('validate', function validateAnnualDate() {
  const date = new Date(Date.UTC(2000, this.month - 1, this.day));
  if (date.getUTCMonth() !== this.month - 1 || date.getUTCDate() !== this.day) {
    this.invalidate('day', 'day must be valid for the selected month');
  }
});

const gameContentAvailabilitySchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: AVAILABILITY_MODES,
      default: 'always'
    },
    timeZone: {
      type: String,
      trim: true,
      default: 'UTC',
      validate: {
        validator: isValidTimeZone,
        message: 'timeZone must be a valid IANA timezone'
      }
    },
    availableFrom: { type: Date, default: null },
    availableUntil: { type: Date, default: null },
    annualFrom: { type: annualBoundarySchema, default: null },
    annualUntil: { type: annualBoundarySchema, default: null }
  },
  { _id: false }
);

gameContentAvailabilitySchema.pre('validate', function validateAvailability() {
  if (this.mode === 'always') return;

  if (this.mode === 'fixed') {
    if (!this.availableFrom && !this.availableUntil) {
      this.invalidate(
        'mode',
        'fixed availability requires availableFrom or availableUntil'
      );
    }
    if (
      this.availableFrom &&
      this.availableUntil &&
      this.availableUntil <= this.availableFrom
    ) {
      this.invalidate(
        'availableUntil',
        'availableUntil must be later than availableFrom'
      );
    }
    return;
  }

  if (!this.annualFrom || !this.annualUntil) {
    this.invalidate(
      'mode',
      'annual availability requires annualFrom and annualUntil'
    );
    return;
  }

  const boundaryFields = [
    'month',
    'day',
    'hour',
    'minute',
    'second',
    'millisecond'
  ];
  if (
    boundaryFields.every(
      (field) => this.annualFrom[field] === this.annualUntil[field]
    )
  ) {
    this.invalidate('annualUntil', 'annualUntil must not match annualFrom');
  }
});

module.exports = {
  AVAILABILITY_MODES,
  annualBoundarySchema,
  gameContentAvailabilitySchema,
  isValidTimeZone
};
