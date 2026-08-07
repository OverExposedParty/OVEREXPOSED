const mongoose = require('mongoose');

const gameModeReleaseMetadataSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, trim: true },
    releaseId: { type: String, required: true, trim: true },
    runtimeBuild: { type: String, required: true, trim: true },
    contentHash: { type: String, required: true, trim: true },
    capturedAt: { type: Date, required: true }
  },
  { _id: false }
);

module.exports = gameModeReleaseMetadataSchema;
