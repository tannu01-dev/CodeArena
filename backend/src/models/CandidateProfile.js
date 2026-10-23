const mongoose = require("mongoose");
const candidateProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  headline: { type: String, default: "", maxlength: 180 },
  summary: { type: String, default: "", maxlength: 4000 },
  skills: [{ type: String, trim: true, maxlength: 80 }],
  yearsExperience: { type: Number, min: 0, max: 70, default: 0 },
  education: [{ institution: { type: String, maxlength: 180 }, degree: { type: String, maxlength: 120 }, field: { type: String, maxlength: 120 }, year: { type: Number, min: 1950, max: 2100 } }],
  links: [{ label: { type: String, maxlength: 60 }, url: { type: String, maxlength: 500 } }],
  location: { type: String, default: "", maxlength: 160 },
  searchable: { type: Boolean, default: false, index: true },
  consentVersion: { type: String, default: "", maxlength: 40 },
  consentUpdatedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
module.exports = mongoose.models.CandidateProfile || mongoose.model("CandidateProfile", candidateProfileSchema);
