
const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");
const Assessment = require("../models/Assessment");
const Problem = require("../models/Problem");
const ExecutionJob = require("../models/ExecutionJob");
const Submission = require("../models/Submission");

const LANGUAGES = new Set([
  "javascript",
  "python",
  "java",
  "cpp",
  "c",
  "csharp",
]);

exports.createJob = async (req, res, next) => {
  try {
    const {
      attemptId,
      problemId,
      language,
      sourceCode,
      mode = "run",
      idempotencyKey = "",
    } = req.body || {};

    if (
      ![attemptId, problemId].every(mongoose.isValidObjectId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid attemptId and problemId are required.",
      });
    }

    if (!LANGUAGES.has(language)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported language.",
      });
    }

    if (
      typeof sourceCode !== "string" ||
      !sourceCode.trim() ||
      sourceCode.length > 50000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Source code is required and must be under 50,000 characters.",
      });
    }

    if (!["run", "submit"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Mode must be run or submit.",
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
      });
    }

    if (
      attempt.deadlineAt &&
      Date.now() >= new Date(attempt.deadlineAt).getTime()
    ) {
      return res.status(409).json({
        success: false,
        message: "Assessment time has expired.",
      });
    }

    const assessment = await Assessment.findById(
      attempt.assessmentId
    );

    if (
      !assessment ||
      !assessment.problemIds.some(
        (id) => String(id) === String(problemId)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Problem is not in this assessment.",
      });
    }

    const problem = await Problem.findById(problemId);

    if (!problem || problem.type !== "coding") {
      return res.status(400).json({
        success: false,
        message:
          "Only coding problems can be sent to the code judge.",
      });
    }

    if (idempotencyKey) {
      const existingJob = await ExecutionJob.findOne({
        userId: req.user.id,
        idempotencyKey,
      });

      if (existingJob) {
        return res.status(200).json({
          success: true,
          job: publicJob(existingJob),
          duplicate: true,
        });
      }
    }

    const testCases = (problem.testCases || [])
      .filter(
        (tc) => mode === "submit" || tc.hidden !== true
      )
      .map((tc) => ({
        input: tc.input || "",
        expectedOutput: String(tc.expectedOutput ?? ""),
        hidden: !!tc.hidden,
      }));

    if (!testCases.length) {
      return res.status(400).json({
        success: false,
        message:
          mode === "run"
            ? "No public test cases exist for this problem."
            : "No test cases configured for this problem.",
      });
    }

    const existing = attempt.answers.find(
      (a) => String(a.problemId) === String(problemId)
    );

    const draft = {
      code: sourceCode,
      language,
      lastSavedAt: new Date(),
      evaluationStatus:
        mode === "submit"
          ? "running"
          : existing?.evaluationStatus || "pending",
    };

    if (existing) {
      Object.assign(existing, draft);

      if (mode === "submit") {
        existing.earnedPoints = 0;
        existing.isCorrect = null;
        existing.evaluationMessage =
          "New code submission is being evaluated.";
      }
    } else {
      attempt.answers.push({
        problemId,
        ...draft,
        maxPoints: problem.points || 0,
        earnedPoints: 0,
        isCorrect: null,
      });
    }

    if (mode === "submit") {
      attempt.score = attempt.answers.reduce(
        (sum, item) => sum + Number(item.earnedPoints || 0),
        0
      );

      attempt.pendingEvaluations =
        attempt.answers.filter((item) =>
          ["pending", "running"].includes(
            item.evaluationStatus
          )
        ).length;
    }

    await attempt.save();

    let submission = null;

    if (mode === "submit") {
      submission = await Submission.create({
        attemptId,
        assessmentId: attempt.assessmentId,
        userId: req.user.id,
        problemId,
        code: sourceCode,
        language,
        kind: "solution",
        status: "running",
        verdict: "Queued",
        maxPoints: Number(problem.points || 0),
        totalTests: testCases.length,
        evaluationMessage:
          "Saved and queued for automatic evaluation.",
      });
    }

    let job;

    try {
      job = await ExecutionJob.create({
        attemptId,
        userId: req.user.id,
        problemId,
        submissionId: submission?._id || null,
        mode,
        language,
        sourceCode,
        testCases,
        status: "queued",
        verdict: "Queued",
        total: testCases.length,
        idempotencyKey: idempotencyKey
          ? String(idempotencyKey).slice(0, 100)
          : "",
      });

      if (submission) {
        submission.jobId = job._id;
        await submission.save();
      }
    } catch (queueError) {
      if (submission) {
        submission.status = "failed";
        submission.verdict = "Queue Error";
        submission.evaluationMessage = String(
          queueError.message || "Could not queue evaluation"
        ).slice(0, 1000);
        submission.evaluatedAt = new Date();

        await submission.save();
      }

      throw queueError;
    }

    res.status(202).json({
      success: true,
      job: publicJob(job),
      submissionId: submission?._id || null,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate job request.",
      });
    }

    next(error);
  }
};

function publicJob(job) {
  return {
    _id: job._id,
    attemptId: job.attemptId,
    problemId: job.problemId,
    mode: job.mode,
    language: job.language,
    status: job.status,
    verdict: job.verdict,
    passed: job.passed,
    total: job.total,
    score: job.score,
    results: (job.results || []).map((r) => ({
      passed: r.passed,
      status: r.status,
      stdout: r.stdout,
      stderr: r.stderr,
      time: r.time,
      memory: r.memory,
    })),
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
  };
}

exports.getJob = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID.",
      });
    }

    const job = await ExecutionJob.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    if (
      String(job.userId) !== String(req.user.id) &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not your job.",
      });
    }

    res.json({
      success: true,
      job: publicJob(job),
    });
  } catch (error) {
    next(error);
  }
};
