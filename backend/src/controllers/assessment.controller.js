
const mongoose = require("mongoose");
const Assessment = require("../models/Assessment");
const Problem = require("../models/Problem");
const Attempt = require("../models/Attempt");

function canManage(assessment, user) {
  return (
    user.role === "admin" ||
    String(assessment.createdBy) === String(user.id)
  );
}

function publicAssessment(assessment) {
  const a = assessment.toObject ? assessment.toObject() : assessment;

  return {
    _id: a._id,
    title: a.title,
    description: a.description,
    instructions: a.instructions,
    problemIds: a.problemIds,
    durationMinutes: a.durationMinutes,
    status: a.status,
    startAt: a.startAt,
    endAt: a.endAt,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

exports.listAssessments = async (req, res, next) => {
  try {
    const filter =
      req.user.role === "candidate"
        ? { status: "published" }
        : req.user.role === "admin"
          ? {}
          : { createdBy: req.user.id };

    const assessments = await Assessment.find(filter)
      .sort({ createdAt: -1 })
      .populate("problemIds", "title difficulty type points")
      .lean();

    const normalizedAssessments = assessments.map((a) => {
      // A legacy/corrupt record may have null/missing problemIds. Keep the
      // assessment list available instead of crashing the whole endpoint.
      const populatedProblems = Array.isArray(a.problemIds)
        ? a.problemIds.filter(Boolean)
        : [];

      return {
        ...publicAssessment({ ...a, problemIds: populatedProblems }),
        problems: populatedProblems,
        problemIds: populatedProblems.map((p) =>
          p && typeof p === "object" && p._id ? p._id : p
        ),
      };
    });

    return res.status(200).json({
      success: true,
      assessments: normalizedAssessments,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAssessment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });
    }

    const assessment = await Assessment.findById(req.params.id)
      .populate("problemIds");

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    const allowed =
      req.user.role === "admin" ||
      (req.user.role === "recruiter" &&
        canManage(assessment, req.user)) ||
      assessment.status === "published";

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "This assessment is not available.",
      });
    }

    const problems = (assessment.problemIds || []).map((p) => ({
      _id: p._id,
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      type: p.type,
      tags: p.tags,
      constraints: p.constraints,
      examples: p.examples,
      starterCode: p.starterCode,
      options: p.options,
      points: p.points,
    }));

    res.json({
      success: true,
      assessment: {
        ...publicAssessment(assessment),
        problems,
        problemIds: problems.map((p) => p._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createAssessment = async (req, res, next) => {
  try {
    const {
      title,
      description = "",
      instructions = "",
      problemIds = [],
      durationMinutes = 30,
      startAt = null,
      endAt = null,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assessment title is required.",
      });
    }

    if (
      !Array.isArray(problemIds) ||
      problemIds.length < 1 ||
      problemIds.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Select between 1 and 100 problem IDs.",
      });
    }

    if (!problemIds.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({
        success: false,
        message: "One or more problem IDs are invalid.",
      });
    }

    const foundCount = await Problem.countDocuments({
      _id: { $in: problemIds },
    });

    if (foundCount !== new Set(problemIds.map(String)).size) {
      return res.status(400).json({
        success: false,
        message:
          "One or more problems do not exist or duplicate IDs were supplied.",
      });
    }

    const duration = Number(durationMinutes);

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 600
    ) {
      return res.status(400).json({
        success: false,
        message: "Duration must be between 1 and 600 minutes.",
      });
    }

    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      return res.status(400).json({
        success: false,
        message: "End time must be after start time.",
      });
    }

    const assessment = await Assessment.create({
      title: title.trim(),
      description,
      instructions,
      problemIds,
      durationMinutes: duration,
      startAt: startAt || null,
      endAt: endAt || null,
      createdBy: req.user.id,
      status: "draft",
    });

    res.status(201).json({
      success: true,
      message: "Assessment created as draft.",
      assessment: publicAssessment(assessment),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAssessment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });
    }

    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    if (!canManage(assessment, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Only the creator or an admin can manage this assessment.",
      });
    }

    if (assessment.status === "published" && req.body.problemIds) {
      return res.status(400).json({
        success: false,
        message:
          "Unpublish the assessment before changing its problem list.",
      });
    }

    const allowed = [
      "title",
      "description",
      "instructions",
      "problemIds",
      "durationMinutes",
      "startAt",
      "endAt",
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        assessment[key] = req.body[key];
      }
    }

    if (assessment.problemIds.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Assessment must contain at least one problem.",
      });
    }

    await assessment.save();

    res.json({
      success: true,
      message: "Assessment updated.",
      assessment: publicAssessment(assessment),
    });
  } catch (error) {
    next(error);
  }
};

exports.publishAssessment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });
    }

    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    if (!canManage(assessment, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Only the creator or an admin can publish this assessment.",
      });
    }

    if (!assessment.problemIds.length) {
      return res.status(400).json({
        success: false,
        message: "Add at least one problem before publishing.",
      });
    }

    const problemsCount = await Problem.countDocuments({
      _id: { $in: assessment.problemIds },
    });

    if (problemsCount !== assessment.problemIds.length) {
      return res.status(400).json({
        success: false,
        message: "Assessment contains a missing problem.",
      });
    }

    assessment.status =
      assessment.status === "published" ? "draft" : "published";

    await assessment.save();

    res.json({
      success: true,
      message: `Assessment ${assessment.status}.`,
      assessment: publicAssessment(assessment),
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAssessment = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });
    }

    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    if (!canManage(assessment, req.user)) {
      return res.status(403).json({
        success: false,
        message:
          "Only the creator or an admin can delete this assessment.",
      });
    }

    const attempts = await Attempt.countDocuments({
      assessmentId: assessment._id,
    });

    if (attempts > 0) {
      return res.status(409).json({
        success: false,
        message:
          "This assessment has attempts and cannot be deleted. Archive it instead.",
      });
    }

    assessment.status = "archived";

    await assessment.save();

    res.json({
      success: true,
      message: "Assessment archived.",
    });
  } catch (error) {
    next(error);
  }
};
