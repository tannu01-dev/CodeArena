
const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");
const Assessment = require("../models/Assessment");
const JobPosting = require("../models/JobPosting");
const JobApplication = require("../models/JobApplication");
const AuditLog = require("../models/AuditLog");

const ExecutionJob = (() => {
  try {
    return require("../models/ExecutionJob");
  } catch {
    return null;
  }
})();

const { audit } = require("../services/audit");

exports.overview = async (req, res) => {
  try {
    const counts = await Promise.all([
      mongoose.connection.db.collection("users").countDocuments({}),
      Assessment.countDocuments({}),
      Attempt.countDocuments({ status: "in_progress" }),
      Attempt.countDocuments({
        status: { $in: ["submitted", "terminated"] }
      }),
      JobPosting.countDocuments({ status: "published" }),
      JobApplication.countDocuments({}),
      AuditLog.countDocuments({
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      })
    ]);

    let queuedJobs = null;

    if (ExecutionJob) {
      queuedJobs = await ExecutionJob.countDocuments({
        status: { $in: ["queued", "running"] }
      }).catch(() => null);
    }

    res.json({
      success: true,
      overview: {
        users: counts[0],
        assessments: counts[1],
        activeAttempts: counts[2],
        completedAttempts: counts[3],
        publishedJobs: counts[4],
        applications: counts[5],
        auditEventsLast24Hours: counts[6],
        queuedExecutionJobs: queuedJobs,
        socketConnections:
          req.app.get("io")?.engine?.clientsCount ?? null,
        database:
          mongoose.connection.readyState === 1
            ? "connected"
            : "disconnected",
        uptimeSeconds: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (e) {
    res.status(503).json({
      success: false,
      message:
        "System overview unavailable; confirm MongoDB is connected."
    });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const User = mongoose.models.User;

    if (User) {
      const users = await User.find({})
        .select("name email role isActive status createdAt lastLoginAt")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      return res.json({ success: true, users });
    }

    const users = await mongoose.connection.db
      .collection("users")
      .find(
        {},
        {
          projection: {
            password: 0,
            passwordHash: 0,
            resetToken: 0,
            refreshToken: 0
          }
        }
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    res.json({
      success: true,
      users: users.map((u) => ({
        ...u,
        _id: String(u._id)
      }))
    });
  } catch (e) {
    res.status(503).json({
      success: false,
      message:
        "Could not list users. Check the existing User model/collection."
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    if (String(req.params.userId) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot change your own admin account here."
      });
    }

    const { role, isActive } = req.body;

    if (
      role !== undefined &&
      !["candidate", "recruiter", "admin"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Role must be candidate, recruiter, or admin."
      });
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be boolean."
      });
    }

    const update = {};

    if (role !== undefined) update.role = role;
    if (isActive !== undefined) update.isActive = isActive;

    if (!Object.keys(update).length) {
      return res.status(400).json({
        success: false,
        message: "Provide role and/or isActive."
      });
    }

    const User = mongoose.models.User;
    let user;

    if (User) {
      user = await User.findByIdAndUpdate(
        req.params.userId,
        { $set: update },
        { new: true, runValidators: true }
      )
        .select("name email role isActive status createdAt")
        .lean();
    } else {
      const result = await mongoose.connection.db
        .collection("users")
        .findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(req.params.userId)
          },
          { $set: update },
          {
            returnDocument: "after",
            projection: {
              password: 0,
              passwordHash: 0
            }
          }
        );

      user = result.value || result;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    await audit(
      req,
      "admin.user.updated",
      "user",
      req.params.userId,
      update
    );

    res.json({ success: true, user });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message || "Could not update user."
    });
  }
};

exports.terminateAttempt = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID."
      });
    }

    const attempt = await Attempt.findOneAndUpdate(
      {
        _id: req.params.attemptId,
        status: "in_progress"
      },
      {
        $set: {
          status: "terminated",
          submittedAt: new Date(),
          endedReason: "admin_terminated"
        }
      },
      { new: true }
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "No active attempt found."
      });
    }

    await audit(
      req,
      "admin.attempt.terminated",
      "attempt",
      attempt._id,
      {
        reason: String(
          req.body.reason || "Admin terminated"
        ).slice(0, 300)
      }
    );

    req.app
      .get("io")
      ?.to(`attempt:${attempt._id}`)
      .emit("attempt:terminated", {
        attemptId: String(attempt._id),
        reason: "admin_terminated",
        submittedAt: attempt.submittedAt
      });

    res.json({ success: true, attempt });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not terminate attempt."
    });
  }
};
