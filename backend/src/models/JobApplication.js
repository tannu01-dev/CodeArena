const mongoose = require("mongoose");
const historySchema = new mongoose.Schema({ stage: { type: String, required: true }, note: { type: String, default: "", maxlength: 1000 }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, changedAt: { type: Date, default: Date.now } }, { _id: false });
const jobApplicationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPosting", required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  coverLetter: { type: String, default: "", maxlength: 5000 },
  resumeUrl: { type: String, default: "", maxlength: 1000 },
  status: { type: String, enum: ["applied", "screening", "assessment", "interview", "offer", "hired", "rejected", "withdrawn"], default: "applied", index: true },
  assessmentAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: "Attempt", default: null },
  history: { type: [historySchema], default: [] },
  appliedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });
jobApplicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });
module.exports = mongoose.models.JobApplication || mongoose.model("JobApplication", jobApplicationSchema);
