// Mongoose connection and schemas for proctoring data
// Requires: npm install mongoose

const mongoose = require("mongoose");

let isConnected = false;

async function connectMongo() {
  if (isConnected) return mongoose.connection;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in environment");
  const dbName = process.env.MONGODB_DB || "proctor";
  await mongoose.connect(uri, { dbName });
  isConnected = true;
  return mongoose.connection;
}

// Event subdocument
const ProctorEventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "LOOKING_AWAY",
        "NO_FACE",
        "MULTIPLE_FACES",
        "PHONE_DETECTED",
        "BOOK_DETECTED",
        "DEVICE_DETECTED",
        "DROWSINESS",
        "AUDIO_DETECTED",
      ],
      required: true,
    },
    message: { type: String, default: "" },
    atMs: { type: Number, required: true },
  },
  { _id: false },
);

// Counts subdocument
const ProctorCountsSchema = new mongoose.Schema(
  {
    focusLost: { type: Number, default: 0 },
    absenceEvents: { type: Number, default: 0 },
    multipleFaces: { type: Number, default: 0 },
    phoneDetections: { type: Number, default: 0 },
    bookDetections: { type: Number, default: 0 },
    deviceDetections: { type: Number, default: 0 },
  },
  { _id: false },
);

// Report schema
const ProctorReportSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, index: true, unique: true },
    candidateName: { type: String, default: "" },
    startedAt: { type: String, required: true },
    endedAt: { type: String, default: "" },
    durationMs: { type: Number, default: 0 },
    events: { type: [ProctorEventSchema], default: [] },
    counts: { type: ProctorCountsSchema, default: {} },
    integrityScore: { type: Number, default: 100 },
  },
  { timestamps: true },
);

ProctorReportSchema.index({ startedAt: -1 });

const ProctorReport =
  mongoose.models.ProctorReport ||
  mongoose.model("ProctorReport", ProctorReportSchema, "reports");

module.exports = {
  connectMongo,
  ProctorReport,
};


