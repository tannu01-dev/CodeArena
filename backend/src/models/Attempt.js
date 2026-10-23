const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema({
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", required: true },
  answer: { type: String, default: "", maxlength: 30000 },
  code: { type: String, default: "", maxlength: 50000 },
  language: { type: String, default: "javascript", maxlength: 40 },
  earnedPoints: { type: Number, min: 0, default: 0 },
  maxPoints: { type: Number, min: 0, default: 0 },
  evaluationStatus: { type: String, enum: ["graded", "pending", "running", "failed"], default: "pending" },
  evaluationMessage: { type: String, default: "", maxlength: 500 },
  isCorrect: { type: Boolean, default: null },
  lastSavedAt: { type: Date, default: null },
}, { _id: false });

const integrityEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, maxlength: 100 },
  type: { type: String, enum: ["copy", "cut", "paste", "tab_hidden", "window_blur", "fullscreen_exit", "other"], default: "other" },
  occurredAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date, default: Date.now },
  details: { type: String, default: "", maxlength: 250 },
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  answers: { type: [answerSchema], default: [] },
  score: { type: Number, min: 0, default: 0 },
  totalPoints: { type: Number, min: 0, default: 0 },
  pendingEvaluations: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ["in_progress", "submitted", "terminated"], default: "in_progress", index: true },
  startedAt: { type: Date, default: Date.now },
  deadlineAt: { type: Date, default: null, index: true },
  submittedAt: { type: Date, default: null },
  endedReason: { type: String, enum: ["candidate_submit", "time_expired", "integrity_violation", "admin_terminated", ""], default: "" },
  integrityViolationCount: { type: Number, min: 0, default: 0 },
  integrityEvents: { type: [integrityEventSchema], default: [] },
  processedIntegrityEventIds: { type: [String], default: [] },
  submitRequestId: { type: String, default: "", maxlength: 100 },
}, { timestamps: true });

attemptSchema.index({ assessmentId: 1, userId: 1, status: 1 }, { name: "assessment_user_status" });
module.exports = mongoose.models.Attempt || mongoose.model("Attempt", attemptSchema);
