
const mongoose = require("mongoose");
const Assessment = require("../models/Assessment");
const Problem = require("../models/Problem");
const Attempt = require("../models/Attempt");
const ExecutionJob = require("../models/ExecutionJob");
const Submission = require("../models/Submission");

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

exports.startAttempt = async (req, res, next) => {
  try {
    if (req.user.role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidates can start an assessment.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assessment ID.",
      });
    }

    const assessment = await Assessment.findById(req.params.id);

    if (!assessment || assessment.status !== "published") {
      return res.status(404).json({
        success: false,
        message: "Published assessment not found.",
      });
    }

    const now = new Date();

    if (assessment.startAt && now < assessment.startAt) {
      return res.status(403).json({
        success: false,
        message: "This assessment has not started yet.",
      });
    }

    if (assessment.endAt && now > assessment.endAt) {
      return res.status(403).json({
        success: false,
        message: "This assessment has ended.",
      });
    }

    const existing = await Attempt.findOne({
      assessmentId: assessment._id,
      userId: req.user.id,
      status: "in_progress",
    });

    if (existing) {
      return res.json({
        success: true,
        attempt: existing,
        resumed: true,
      });
    }

    const problems = await Problem.find({
      _id: { $in: assessment.problemIds },
    }).select("_id points");

    const totalPoints = problems.reduce(
      (sum, p) => sum + (p.points || 0),
      0
    );

    const attempt = await Attempt.create({
      assessmentId: assessment._id,
      userId: req.user.id,
      answers: [],
      totalPoints,
      status: "in_progress",
    });

    res.status(201).json({
      success: true,
      attempt,
      resumed: false,
    });
  } catch (error) {
    next(error);
  }
};

exports.submitAttempt = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await Attempt.findById(req.params.attemptId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    if (
      String(attempt.userId) !== String(req.user.id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot submit another user's attempt.",
      });
    }

    if (attempt.status === "submitted") {
      return res.status(409).json({
        success: false,
        message: "This attempt has already been submitted.",
      });
    }

    if (!Array.isArray(req.body.answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers must be a list.",
      });
    }

    const assessment = await Assessment.findById(attempt.assessmentId);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found.",
      });
    }

    const problems = await Problem.find({
      _id: { $in: assessment.problemIds },
    });

    const byId = new Map(
      problems.map((p) => [String(p._id), p])
    );

    const submittedById = new Map();

    for (const answer of req.body.answers) {
      if (
        !answer ||
        !mongoose.isValidObjectId(answer.problemId) ||
        !byId.has(String(answer.problemId))
      ) {
        return res.status(400).json({
          success: false,
          message:
            "An answer references a problem outside this assessment.",
        });
      }

      submittedById.set(String(answer.problemId), answer);
    }

    let score = 0;
    let pending = 0;

    const savedAnswers = [];
    const jobsToCreate = [];
    const submissionDocs = [];

    for (const problemId of assessment.problemIds) {
      const problem = byId.get(String(problemId));
      const supplied = submittedById.get(String(problemId)) || {};

      const answerText =
        typeof supplied.answer === "string"
          ? supplied.answer.slice(0, 30000)
          : "";

      const code =
        typeof supplied.code === "string"
          ? supplied.code.slice(0, 50000)
          : "";

      const language =
        typeof supplied.language === "string"
          ? supplied.language.slice(0, 40)
          : "javascript";

      const maxPoints = problem.points || 0;

      let earnedPoints = 0;
      let isCorrect = null;
      let evaluationStatus = "pending";

      if (problem.type === "mcq") {
        isCorrect = answerText === problem.correctOptionId;
        earnedPoints = isCorrect ? maxPoints : 0;
        evaluationStatus = "graded";
      } else if (problem.type === "short_answer") {
        isCorrect =
          normalize(answerText) === normalize(problem.expectedAnswer);

        earnedPoints = isCorrect ? maxPoints : 0;
        evaluationStatus = "graded";
      } else {
        const testCases = Array.isArray(problem.testCases)
          ? problem.testCases
          : [];

        if (testCases.length && code.trim()) {
          evaluationStatus = "running";

          jobsToCreate.push({
            attemptId: attempt._id,
            userId: attempt.userId,
            problemId: problem._id,
            mode: "submit",
            language,
            sourceCode: code,
            testCases: testCases.map((tc) => ({
              input: tc.input || "",
              expectedOutput: String(tc.expectedOutput ?? ""),
              hidden: !!tc.hidden,
            })),
            status: "queued",
            verdict: "Queued",
            total: testCases.length,
            idempotencyKey: `final-${attempt._id}-${problem._id}-${String(
              req.body?.requestId || Date.now()
            ).slice(0, 40)}`,
          });
        } else {
          evaluationStatus = "pending";
        }

        pending += 1;
      }

      score += earnedPoints;

      const evaluationMessage =
        problem.type === "coding"
          ? evaluationStatus === "running"
            ? "Queued for isolated test-case evaluation."
            : !problem.testCases?.length
              ? "No test cases are configured. Recruiter must add test cases and/or manually review this response."
              : "No code response was submitted for this question."
          : "";

      savedAnswers.push({
        problemId: problem._id,
        answer: answerText,
        code,
        language,
        earnedPoints,
        maxPoints,
        evaluationStatus,
        evaluationMessage,
        isCorrect,
      });

      const hasTests =
        Array.isArray(problem.testCases) && problem.testCases.length > 0;

      submissionDocs.push({
        attemptId: attempt._id,
        assessmentId: attempt.assessmentId,
        userId: attempt.userId,
        problemId: problem._id,
        answer: answerText,
        code,
        language,
        kind: "assessment",
        status:
          problem.type !== "coding"
            ? "graded"
            : evaluationStatus === "running"
              ? "running"
              : !hasTests
                ? "not_configured"
                : "not_submitted",
        verdict:
          problem.type !== "coding"
            ? isCorrect
              ? "Correct"
              : "Incorrect"
            : evaluationStatus === "running"
              ? "Queued"
              : !hasTests
                ? "Not Configured"
                : "No Code Submitted",
        earnedPoints,
        maxPoints,
        totalTests: hasTests ? problem.testCases.length : 0,
        evaluationMessage,
        submittedAt: new Date(),
      });
    }

    attempt.answers = savedAnswers;
    attempt.score = score;

    attempt.totalPoints = problems.reduce(
      (sum, p) => sum + (p.points || 0),
      0
    );

    attempt.pendingEvaluations = pending;
    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    await attempt.save();

    const savedSubmissions = submissionDocs.length
      ? await Submission.insertMany(submissionDocs)
      : [];

    const submissionByProblem = new Map(
      savedSubmissions.map((item) => [
        String(item.problemId),
        item,
      ])
    );

    for (const job of jobsToCreate) {
      try {
        const submission = submissionByProblem.get(
          String(job.problemId)
        );

        if (submission) {
          job.submissionId = submission._id;
        }

        await ExecutionJob.updateOne(
          {
            attemptId: job.attemptId,
            problemId: job.problemId,
            mode: "submit",
            idempotencyKey: job.idempotencyKey,
          },
          { $setOnInsert: job },
          { upsert: true }
        );

        const queued = await ExecutionJob.findOne({
          attemptId: job.attemptId,
          problemId: job.problemId,
          mode: "submit",
          idempotencyKey: job.idempotencyKey,
        });

        if (submission && queued) {
          submission.jobId = queued._id;
          await submission.save();
        }
      } catch (queueError) {
        const answer = attempt.answers.find(
          (item) =>
            String(item.problemId) === String(job.problemId)
        );

        const submission = submissionByProblem.get(
          String(job.problemId)
        );

        if (answer) {
          answer.evaluationStatus = "failed";
          answer.evaluationMessage =
            "Could not queue automatic evaluation. Check Judge worker and retry evaluation.";
        }

        if (submission) {
          submission.status = "failed";
          submission.verdict = "Queue Error";

          submission.evaluationMessage = String(
            queueError.message || "Could not queue evaluation"
          ).slice(0, 1000);

          submission.evaluatedAt = new Date();

          await submission.save();
        }
      }
    }

    attempt.pendingEvaluations = attempt.answers.filter((a) =>
      ["pending", "running"].includes(a.evaluationStatus)
    ).length;

    attempt.score = attempt.answers.reduce(
      (sum, a) => sum + Number(a.earnedPoints || 0),
      0
    );

    await attempt.save();

    res.json({
      success: true,
      message: pending
        ? "Assessment submitted. Automatic evaluation is queued where test cases exist; remaining answers need review."
        : "Assessment submitted and graded.",
      attempt: {
        _id: attempt._id,
        assessmentId: attempt.assessmentId,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        pendingEvaluations: attempt.pendingEvaluations,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getAttempt = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await Attempt.findById(req.params.attemptId)
      .populate("assessmentId", "title durationMinutes createdBy");

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    const isOwner =
      String(attempt.userId) === String(req.user.id);

    const isAssessmentRecruiter =
      req.user.role === "recruiter" &&
      String(attempt.assessmentId?.createdBy) === String(req.user.id);

    if (
      !isOwner &&
      req.user.role !== "admin" &&
      !isAssessmentRecruiter
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this result.",
      });
    }

    res.json({
      success: true,
      attempt: {
        _id: attempt._id,
        assessment: attempt.assessmentId,
        userId: attempt.userId,
        answers: attempt.answers,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        pendingEvaluations: attempt.pendingEvaluations,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
