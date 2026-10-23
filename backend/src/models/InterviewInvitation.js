const mongoose = require("mongoose");
const interviewInvitationSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPosting", default: null, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "JobApplication", default: null, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", default: null },
  type: { type: String, enum: ["interview", "assessment"], default: "interview" },
  title: { type: String, required: true, maxlength: 180 },
  message: { type: String, default: "", maxlength: 3000 },
  scheduledAt: { type: Date, default: null },
  meetingUrl: { type: String, default: "", maxlength: 1000 },
  status: { type: String, enum: ["pending", "accepted", "declined", "cancelled", "completed"], default: "pending", index: true },
  respondedAt: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.models.InterviewInvitation || mongoose.model("InterviewInvitation", interviewInvitationSchema);
