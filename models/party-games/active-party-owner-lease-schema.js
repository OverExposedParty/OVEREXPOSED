const mongoose = require('mongoose');

const activePartyOwnerLeaseSchema = new mongoose.Schema(
  {
    partyId: { type: String, required: true },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: undefined,
      select: false
    },
    partyOwnerIdHash: {
      type: String,
      required: true,
      select: false
    },
    leaseToken: {
      type: String,
      required: true,
      select: false
    },
    status: {
      type: String,
      enum: ['pending', 'active'],
      default: 'pending',
      required: true
    },
    gamemode: { type: String, default: null },
    expiresAt: { type: Date, default: undefined },
    activatedAt: { type: Date, default: null },
    revision: { type: Number, min: 1, default: 1 }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

activePartyOwnerLeaseSchema.index({ partyId: 1 }, { unique: true });
activePartyOwnerLeaseSchema.index({ partyOwnerIdHash: 1 }, { unique: true });
activePartyOwnerLeaseSchema.index(
  { accountId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      accountId: { $type: 'objectId' }
    }
  }
);
activePartyOwnerLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  'ActivePartyOwnerLease',
  activePartyOwnerLeaseSchema,
  'active-party-owner-leases'
);
