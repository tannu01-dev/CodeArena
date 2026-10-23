const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", maxlength: 5000 },
    instructions: { type: String, default: "", maxlength: 5000 },
    problemIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    }],
    durationMinutes: { type: Number, min: 1, max: 600, default: 30 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Assessment || mongoose.model("Assessment", assessmentSchema);
