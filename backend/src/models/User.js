
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["candidate", "recruiter", "admin"],
      default: "candidate",
    },

    // Used by the login controller to disable compromised or suspended accounts.
    // Default true keeps existing accounts without this field usable.
    isActive: {
      type: Boolean,
      default: true,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    title: {
      type: String,
      default: "",
      maxlength: 120,
    },

    company: {
      type: String,
      default: "",
      maxlength: 120,
    },

    location: {
      type: String,
      default: "",
      maxlength: 120,
    },

    skills: {
      type: [String],
      default: [],
    },

    github: {
      type: String,
      default: "",
    },

    linkedin: {
      type: String,
      default: "",
    },

    website: {
      type: String,
      default: "",
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);
