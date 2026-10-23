const mongoose = require("mongoose");

const testResultSchema = new mongoose.Schema({
  passed: { type: Boolean, default: false },
  status: { type: String, default: "Unknown" },
  stdout: { type: String, default: "", maxlength: 5000 },
  stderr: { type: String, default: "", maxlength: 5000 },
  time: { type: String, default: "" },
  memory: { type: Number, default: 0 },
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true, index: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", required: true, index: true },
  code: { type: String, default: "", maxlength: 50000 },
  answer: { type: String, default: "", maxlength: 30000 },
  language: { type: String, default: "javascript", maxlength: 40 },
  kind: { type: String, enum: ["solution", "assessment"], default: "solution", index: true },
  status: { type: String, enum: ["pending", "running", "graded", "failed", "not_configured", "not_submitted"], default: "pending", index: true },
  verdict: { type: String, default: "Pending" },
  earnedPoints: { type: Number, min: 0, default: 0 },
  maxPoints: { type: Number, min: 0, default: 0 },
  passedTests: { type: Number, min: 0, default: 0 },
  totalTests: { type: Number, min: 0, default: 0 },
  testResults: { type: [testResultSchema], default: [] },
  evaluationMessage: { type: String, default: "", maxlength: 1000 },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "ExecutionJob", default: null },
  submittedAt: { type: Date, default: Date.now, index: true },
  evaluatedAt: { type: Date, default: null },
}, { timestamps: true });

submissionSchema.index({ attemptId: 1, problemId: 1, submittedAt: -1 });
module.exports = mongoose.models.Submission || mongoose.model("Submission", submissionSchema);
