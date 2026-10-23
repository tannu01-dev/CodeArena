const mongoose = require("mongoose");
const executionJobSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: "Problem", required: true },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission", default: null, index: true },
  mode: { type: String, enum: ["run", "submit"], required: true },
  language: { type: String, required: true },
  sourceCode: { type: String, required: true, maxlength: 50000 },
  testCases: [{ input: { type: String, default: "" }, expectedOutput: { type: String, required: true }, hidden: { type: Boolean, default: true } }],
  status: { type: String, enum: ["queued", "running", "completed", "failed"], default: "queued", index: true },
  verdict: { type: String, default: "Queued" },
  passed: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  results: [{ passed: Boolean, status: String, stdout: String, stderr: String, time: String, memory: Number }],
  errorMessage: { type: String, default: "", maxlength: 1000 },
  idempotencyKey: { type: String, default: "", maxlength: 100 },
  startedAt: Date,
  finishedAt: Date,
}, { timestamps: true });
executionJobSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } });
module.exports = mongoose.models.ExecutionJob || mongoose.model("ExecutionJob", executionJobSchema);
