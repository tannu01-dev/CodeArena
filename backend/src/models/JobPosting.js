const mongoose = require("mongoose");
const jobPostingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  company: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, maxlength: 12000 },
  requirements: [{ type: String, trim: true, maxlength: 250 }],
  skills: [{ type: String, trim: true, maxlength: 80 }],
  location: { type: String, default: "Remote", maxlength: 160 },
  employmentType: { type: String, enum: ["full-time", "part-time", "contract", "internship"], default: "full-time" },
  status: { type: String, enum: ["draft", "published", "closed"], default: "draft", index: true },
  assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  publishedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null }
}, { timestamps: true });
jobPostingSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.models.JobPosting || mongoose.model("JobPosting", jobPostingSchema);
