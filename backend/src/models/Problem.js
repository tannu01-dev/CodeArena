const mongoose = require("mongoose");

const exampleSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    output: { type: String, required: true },
    explanation: { type: String, default: "" },
  },
  { _id: false }
);

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, default: "" },
    expectedOutput: { type: String, required: true },
    hidden: { type: Boolean, default: true },
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 200 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, maxlength: 12000 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
      index: true,
    },
    type: {
      type: String,
      enum: ["coding", "mcq", "short_answer"],
      default: "coding",
      index: true,
    },
    tags: { type: [String], default: [] },
    constraints: { type: String, default: "", maxlength: 3000 },
    examples: { type: [exampleSchema], default: [] },
    starterCode: { type: String, default: "", maxlength: 20000 },
    options: { type: [optionSchema], default: [] },
    correctOptionId: { type: String, default: "" },
    expectedAnswer: { type: String, default: "" },
    testCases: { type: [testCaseSchema], default: [] },
    points: { type: Number, min: 1, max: 1000, default: 10 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

problemSchema.index({ title: "text", description: "text", tags: "text" });

module.exports =
  mongoose.models.Problem || mongoose.model("Problem", problemSchema);
