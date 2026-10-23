const User = require("../models/User");
const Attempt = require("../models/Attempt");
const Assessment = require("../models/Assessment");
const JobPosting = require("../models/JobPosting");
const JobApplication = require("../models/JobApplication");

exports.getDashboardSummary = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const summary = {
      role: user.role,
      name: user.name,
      profileCompleted: Boolean(user.profileCompleted),
      skillsCount: Array.isArray(user.skills) ? user.skills.length : 0,
    };

    if (user.role === "admin") {
      const [totalUsers, candidates, recruiters] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "candidate" }),
        User.countDocuments({ role: "recruiter" }),
      ]);
      summary.stats = { totalUsers, candidates, recruiters };
    } else if (user.role === "candidate") {
      const [assessmentsCompleted, submissions] = await Promise.all([
        Attempt.countDocuments({ userId: user._id, status: "submitted" }),
        Attempt.countDocuments({ userId: user._id, "answers.0": { $exists: true } }),
      ]);
      summary.stats = {
        skillsCount: Array.isArray(user.skills) ? user.skills.length : 0,
        profileCompleted: Boolean(user.profileCompleted),
        assessmentsCompleted,
        submissions,
      };
    } else if (user.role === "recruiter") {
      const [assessmentsCreated, jobIds] = await Promise.all([
        Assessment.countDocuments({ createdBy: user._id }),
        JobPosting.find({ createdBy: user._id }).distinct("_id"),
      ]);
      const candidatesReviewed = jobIds.length
        ? await JobApplication.countDocuments({ jobId: { $in: jobIds } })
        : 0;
      summary.stats = {
        profileCompleted: Boolean(user.profileCompleted),
        company: user.company || "Not added",
        assessmentsCreated,
        candidatesReviewed,
      };
    } else {
      summary.stats = {};
    }

    return res.json({ success: true, dashboard: summary });
  } catch (error) {
    return next(error);
  }
};
