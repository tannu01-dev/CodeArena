
const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");

const MAX_VIOLATIONS = 3;

const ALLOWED = new Set([
  "copy",
  "cut",
  "paste",
  "tab_hidden",
  "window_blur",
  "fullscreen_exit",
  "other",
]);

exports.recordViolation = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { eventId, type, details = "" } = req.body || {};

    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    if (
      typeof eventId !== "string" ||
      !eventId.trim() ||
      eventId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "A unique eventId is required.",
      });
    }

    if (!ALLOWED.has(type)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported violation type.",
      });
    }

    const attempt = await Attempt.findById(attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    if (String(attempt.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Not your attempt.",
      });
    }

    if (attempt.status !== "in_progress") {
      return res.status(409).json({
        success: false,
        message: "Attempt is not active.",
        status: attempt.status,
        count: attempt.integrityViolationCount,
      });
    }

    if (attempt.processedIntegrityEventIds.includes(eventId)) {
      return res.json({
        success: true,
        duplicate: true,
        count: attempt.integrityViolationCount,
        terminated: attempt.status === "terminated",
      });
    }

    attempt.processedIntegrityEventIds.push(eventId);

    if (attempt.processedIntegrityEventIds.length > 300) {
      attempt.processedIntegrityEventIds =
        attempt.processedIntegrityEventIds.slice(-300);
    }

    attempt.integrityViolationCount += 1;

    attempt.integrityEvents.push({
      eventId,
      type,
      occurredAt: new Date(),
      acceptedAt: new Date(),
      details: String(details).slice(0, 250),
    });

    const terminated =
      attempt.integrityViolationCount >= MAX_VIOLATIONS;

    if (terminated) {
      attempt.status = "terminated";
      attempt.submittedAt = new Date();
      attempt.endedReason = "integrity_violation";
    }

    await attempt.save();

    res.status(200).json({
      success: true,
      duplicate: false,
      count: attempt.integrityViolationCount,
      warning: terminated
        ? "Maximum integrity violations reached. This attempt has been terminated."
        : `Integrity warning ${attempt.integrityViolationCount} of ${MAX_VIOLATIONS}.`,
      terminated,
      status: attempt.status,
    });
  } catch (error) {
    next(error);
  }
};

exports.getIntegrity = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await Attempt.findById(req.params.attemptId).select(
      "userId status integrityViolationCount integrityEvents endedReason"
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    const allowed =
      String(attempt.userId) === String(req.user.id) ||
      ["admin", "recruiter"].includes(req.user.role);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Not allowed.",
      });
    }

    res.json({
      success: true,
      integrity: {
        status: attempt.status,
        count: attempt.integrityViolationCount,
        events: attempt.integrityEvents,
        endedReason: attempt.endedReason,
      },
    });
  } catch (error) {
    next(error);
  }
};
