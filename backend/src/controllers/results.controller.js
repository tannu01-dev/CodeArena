
const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");
const Assessment = require("../models/Assessment");
const AuditLog = require("../models/AuditLog");
const Submission = require("../models/Submission");
const { audit } = require("../services/audit");

function normalizeScore(attempt) {
  const answers = Array.isArray(attempt.answers)
    ? attempt.answers
    : [];

  const earned = answers.reduce(
    (sum, answer) =>
      sum + Math.max(0, Number(answer.earnedPoints) || 0),
    0
  );

  const max = answers.reduce(
    (sum, answer) =>
      sum + Math.max(0, Number(answer.maxPoints) || 0),
    0
  );

  const storedTotal = Number(attempt.totalPoints) || 0;
  const totalPoints = max || storedTotal;
  const score = max
    ? earned
    : Math.max(0, Number(attempt.score) || 0);

  return {
    score: Math.min(score, totalPoints || score),
    totalPoints,
    percentage:
      totalPoints > 0
        ? Math.round(
            (Math.min(score, totalPoints) / totalPoints) * 10000
          ) / 100
        : 0,
  };
}

exports.candidateReports = async (req, res) => {
  try {
    const attempts = await Attempt.find({
      userId: req.user.id,
      status: { $in: ["submitted", "terminated"] },
    })
      .populate("assessmentId", "title durationMinutes createdBy")
      .sort({ submittedAt: -1, updatedAt: -1 })
      .lean();

    const reports = attempts.map((attempt) => ({
      attemptId: attempt._id,
      assessment: attempt.assessmentId?.title || "Assessment",
      assessmentId:
        attempt.assessmentId?._id || attempt.assessmentId,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      status: attempt.status,
      endedReason: attempt.endedReason || "",
      ...normalizeScore(attempt),
      answers: (attempt.answers || []).map((a) => ({
        problemId: a.problemId,
        earnedPoints: a.earnedPoints || 0,
        maxPoints: a.maxPoints || 0,
        evaluationStatus: a.evaluationStatus || "pending",
        isCorrect: a.isCorrect ?? null,
      })),
    }));

    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load candidate reports.",
    });
  }
};

exports.submissionHistory = async (req, res) => {
  try {
    const { attemptId } = req.params;

    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await Attempt.findById(attemptId)
      .populate("assessmentId", "title createdBy")
      .lean();

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Attempt not found.",
      });
    }

    const isOwner =
      String(attempt.userId) === String(req.user.id);

    const isRecruiter =
      req.user.role === "recruiter" &&
      String(attempt.assessmentId?.createdBy) ===
        String(req.user.id);

    if (
      !isOwner &&
      !isRecruiter &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot view this submission history.",
      });
    }

    const records = await Submission.find({ attemptId })
      .populate("problemId", "title type points")
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(300)
      .lean();

    if (
      !records.length &&
      Array.isArray(attempt.answers) &&
      attempt.answers.length
    ) {
      const problemIds = attempt.answers.map(
        (a) => a.problemId
      );

      const problems = await require("../models/Problem")
        .find({ _id: { $in: problemIds } })
        .select("title type points")
        .lean();

      const problemMap = new Map(
        problems.map((p) => [String(p._id), p])
      );

      const legacy = attempt.answers.map((a, index) => {
        const problem =
          problemMap.get(String(a.problemId)) || {};

        return {
          id: `legacy-${String(attempt._id)}-${index}`,
          problemId: a.problemId,
          problemTitle: problem.title || "Question",
          questionType: problem.type || "unknown",
          kind: "assessment",
          code: a.code || "",
          answer: a.answer || "",
          language: a.language || "",
          status: a.evaluationStatus || "pending",
          verdict:
            a.evaluationStatus === "graded"
              ? a.isCorrect
                ? "Correct"
                : "Incorrect"
              : a.evaluationMessage || "Pending",
          earnedPoints: Number(a.earnedPoints || 0),
          maxPoints: Number(
            a.maxPoints || problem.points || 0
          ),
          passedTests: 0,
          totalTests: 0,
          testResults: [],
          evaluationMessage:
            a.evaluationMessage ||
            "Legacy saved response; detailed test history was not stored at the time.",
          submittedAt:
            a.lastSavedAt ||
            attempt.submittedAt ||
            attempt.updatedAt,
          evaluatedAt: null,
        };
      });

      return res.json({
        success: true,
        attemptId,
        assessmentTitle:
          attempt.assessmentId?.title || "Assessment",
        submissions: legacy,
        legacyFallback: true,
      });
    }

    res.json({
      success: true,
      attemptId,
      assessmentTitle:
        attempt.assessmentId?.title || "Assessment",
      submissions: records.map((item) => ({
        id: item._id,
        problemId: item.problemId?._id || item.problemId,
        problemTitle: item.problemId?.title || "Question",
        questionType: item.problemId?.type || "unknown",
        kind: item.kind,
        code: item.code || "",
        answer: item.answer || "",
        language: item.language || "",
        status: item.status,
        verdict: item.verdict,
        earnedPoints: Number(item.earnedPoints || 0),
        maxPoints: Number(item.maxPoints || 0),
        passedTests: Number(item.passedTests || 0),
        totalTests: Number(item.totalTests || 0),
        testResults: (item.testResults || []).map((r) => ({
          passed: r.passed,
          status: r.status,
          stdout: r.stdout,
          stderr: r.stderr,
          time: r.time,
          memory: r.memory,
        })),
        evaluationMessage: item.evaluationMessage || "",
        submittedAt: item.submittedAt,
        evaluatedAt: item.evaluatedAt,
      })),
    });
  } catch (error) {
    console.error("Submission history error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load submission history.",
    });
  }
};

exports.recruiterAnalytics = async (req, res) => {
  try {
    const owned = await Assessment.find({
      createdBy: req.user.id,
    })
      .select("_id title")
      .lean();

    const ids = owned.map((x) => x._id);

    const attempts = await Attempt.find({
      assessmentId: { $in: ids },
      status: { $in: ["submitted", "terminated"] },
    })
      .populate("assessmentId", "title")
      .lean();

    const byAssessment = new Map(
      owned.map((a) => [
        String(a._id),
        {
          assessmentId: a._id,
          title: a.title,
          attempts: 0,
          averageScore: 0,
          passCount: 0,
          completionCount: 0,
          scoreSum: 0,
        },
      ])
    );

    for (const attempt of attempts) {
      const key = String(
        attempt.assessmentId?._id || attempt.assessmentId
      );

      const item = byAssessment.get(key);

      if (!item) continue;

      const score = normalizeScore(attempt);

      item.attempts += 1;
      item.scoreSum += score.percentage;

      if (score.percentage >= 60) {
        item.passCount += 1;
      }

      if (attempt.status === "submitted") {
        item.completionCount += 1;
      }
    }

    const assessments = Array.from(
      byAssessment.values()
    )
      .map((x) => ({
        ...x,
        averageScore: x.attempts
          ? Math.round(
              (x.scoreSum / x.attempts) * 100
            ) / 100
          : 0,
        passRate: x.attempts
          ? Math.round(
              (x.passCount / x.attempts) * 10000
            ) / 100
          : 0,
      }))
      .map(({ scoreSum, ...rest }) => rest);

    res.json({
      success: true,
      summary: {
        assessments: owned.length,
        attempts: attempts.length,
        averageScore: attempts.length
          ? Math.round(
              (attempts.reduce(
                (s, a) =>
                  s + normalizeScore(a).percentage,
                0
              ) /
                attempts.length) *
                100
            ) / 100
          : 0,
        completionRate: attempts.length
          ? Math.round(
              (attempts.filter(
                (a) => a.status === "submitted"
              ).length /
                attempts.length) *
                10000
            ) / 100
          : 0,
      },
      assessments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not calculate recruiter analytics.",
    });
  }
};

exports.recruiterSubmissions = async (req, res) => {
  try {
    const ownedFilter =
      req.user.role === "admin"
        ? {}
        : { createdBy: req.user.id };

    const owned = await Assessment.find(ownedFilter)
      .select("_id title")
      .lean();

    const ownedIds = owned.map((a) => a._id);

    const filter = {
      assessmentId: { $in: ownedIds },
      status: { $in: ["submitted", "terminated"] },
    };

    if (req.query.assessmentId) {
      if (!mongoose.isValidObjectId(req.query.assessmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assessment ID.",
        });
      }

      if (
        !ownedIds.some(
          (id) => String(id) === String(req.query.assessmentId)
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot view submissions for this assessment.",
        });
      }

      filter.assessmentId = req.query.assessmentId;
    }

    const attempts = await Attempt.find(filter)
      .populate("assessmentId", "title")
      .populate("userId", "name email")
      .sort({ submittedAt: -1, updatedAt: -1 })
      .limit(250)
      .lean();

    const allProblemIds = [
      ...new Set(
        attempts.flatMap((a) =>
          (a.answers || []).map((answer) =>
            String(answer.problemId)
          )
        )
      ),
    ];

    const problems = await require("../models/Problem")
      .find({ _id: { $in: allProblemIds } })
      .select("title type points")
      .lean();

    const problemMap = new Map(
      problems.map((p) => [String(p._id), p])
    );

    const historyRows = await Submission.find({
      attemptId: { $in: attempts.map((a) => a._id) },
    })
      .sort({ submittedAt: -1 })
      .lean();

    const latestSubmissionByAnswer = new Map();

    for (const row of historyRows) {
      const key = `${String(row.attemptId)}:${String(
        row.problemId
      )}`;

      if (!latestSubmissionByAnswer.has(key)) {
        latestSubmissionByAnswer.set(key, row);
      }
    }

    const submissions = attempts.map((attempt) => {
      const score = normalizeScore(attempt);

      return {
        attemptId: attempt._id,
        assessmentId: attempt.assessmentId?._id,
        assessmentTitle:
          attempt.assessmentId?.title || "Assessment",
        candidate: {
          id: attempt.userId?._id,
          name: attempt.userId?.name || "Candidate",
          email: attempt.userId?.email || "",
        },
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        score: score.score,
        totalPoints: score.totalPoints,
        percentage: score.percentage,
        pendingEvaluations: Number(
          attempt.pendingEvaluations || 0
        ),
        failedEvaluations: (attempt.answers || []).filter(
          (answer) => answer.evaluationStatus === "failed"
        ).length,
        answers: (attempt.answers || []).map((answer) => {
          const problem =
            problemMap.get(String(answer.problemId)) || {};

          return {
            problemId: answer.problemId,
            questionTitle: problem.title || "Question",
            questionType: problem.type || "unknown",
            response: answer.answer || "",
            code: answer.code || "",
            language: answer.language || "",
            earnedPoints: Number(answer.earnedPoints || 0),
            maxPoints: Number(
              answer.maxPoints || problem.points || 0
            ),
            evaluationStatus:
              answer.evaluationStatus || "pending",
            evaluationMessage:
              answer.evaluationMessage || "",
            isCorrect: answer.isCorrect ?? null,
            verdict:
              latestSubmissionByAnswer.get(
                `${String(attempt._id)}:${String(
                  answer.problemId
                )}`
              )?.verdict || "Pending",
            passedTests: Number(
              latestSubmissionByAnswer.get(
                `${String(attempt._id)}:${String(
                  answer.problemId
                )}`
              )?.passedTests || 0
            ),
            totalTests: Number(
              latestSubmissionByAnswer.get(
                `${String(attempt._id)}:${String(
                  answer.problemId
                )}`
              )?.totalTests || 0
            ),
          };
        }),
      };
    });

    res.json({ success: true, submissions });
  } catch (error) {
    console.error("Recruiter submissions error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load candidate submissions.",
    });
  }
};

exports.reevaluateSubmission = async (req, res) => {
  try {
    const attemptId = req.params.attemptId;

    if (!mongoose.isValidObjectId(attemptId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attempt ID.",
      });
    }

    const attempt = await Attempt.findById(attemptId).populate(
      "assessmentId",
      "title createdBy problemIds"
    );

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Submission not found.",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(attempt.assessmentId?.createdBy) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot evaluate this assessment's submissions.",
      });
    }

    if (!["submitted", "terminated"].includes(attempt.status)) {
      return res.status(409).json({
        success: false,
        message: "Only submitted attempts can be evaluated.",
      });
    }

    const problemIds = (attempt.answers || []).map(
      (a) => a.problemId
    );

    const problems = await require("../models/Problem").find({
      _id: { $in: problemIds },
      type: "coding",
    });

    const byId = new Map(
      problems.map((p) => [String(p._id), p])
    );

    const jobs = [];
    const notReady = [];

    for (const answer of attempt.answers) {
      const problem = byId.get(String(answer.problemId));

      if (!problem || !String(answer.code || "").trim()) {
        continue;
      }

      if (
        !Array.isArray(problem.testCases) ||
        !problem.testCases.length
      ) {
        answer.evaluationStatus = "pending";
        answer.evaluationMessage =
          "No test cases are configured. Add test cases to this problem before re-evaluating.";

        notReady.push(problem.title);
        continue;
      }

      const key = `manual-${attempt._id}-${problem._id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      answer.evaluationStatus = "running";
      answer.evaluationMessage =
        "Recruiter requested evaluation. Queued for isolated test-case evaluation.";

      jobs.push({
        attemptId: attempt._id,
        userId: attempt.userId,
        problemId: problem._id,
        mode: "submit",
        language: answer.language || "javascript",
        sourceCode: answer.code,
        testCases: problem.testCases.map((tc) => ({
          input: tc.input || "",
          expectedOutput: String(tc.expectedOutput ?? ""),
          hidden: !!tc.hidden,
        })),
        status: "queued",
        verdict: "Queued",
        total: problem.testCases.length,
        idempotencyKey: key,
      });
    }

    if (!jobs.length) {
      await attempt.save();

      return res.status(400).json({
        success: false,
        message: notReady.length
          ? `No jobs queued. Add test cases first: ${notReady.join(
              ", "
            )}.`
          : "No saved coding responses are available to evaluate.",
      });
    }

    await attempt.save();

    for (const job of jobs) {
      const problem = byId.get(String(job.problemId));

      const submission = await Submission.create({
        attemptId: attempt._id,
        assessmentId: attempt.assessmentId,
        userId: attempt.userId,
        problemId: job.problemId,
        code: job.sourceCode,
        language: job.language,
        kind: "solution",
        status: "running",
        verdict: "Queued",
        maxPoints: Number(problem?.points || 0),
        totalTests: job.testCases.length,
        evaluationMessage:
          "Recruiter queued a re-evaluation of this saved code.",
        submittedAt: new Date(),
      });

      const createdJob = await require(
        "../models/ExecutionJob"
      ).create({
        ...job,
        submissionId: submission._id,
      });

      submission.jobId = createdJob._id;
      await submission.save();
    }

    attempt.pendingEvaluations = attempt.answers.filter(
      (a) => ["pending", "running"].includes(a.evaluationStatus)
    ).length;

    await attempt.save();

    res.json({
      success: true,
      queued: jobs.length,
      pendingEvaluations: attempt.pendingEvaluations,
      message: `Queued ${jobs.length} coding response(s) for evaluation.${
        notReady.length
          ? ` Still missing test cases: ${notReady.join(", ")}.`
          : ""
      }`,
    });
  } catch (error) {
    console.error("Re-evaluate submission error:", error);

    res.status(500).json({
      success: false,
      message: "Could not queue submission evaluation.",
    });
  }
};

exports.exportResults = async (req, res) => {
  try {
    const assessmentId = req.query.assessmentId;

    const filter = {
      status: { $in: ["submitted", "terminated"] },
    };

    if (req.user.role !== "admin") {
      const owned = await Assessment.find({
        createdBy: req.user.id,
      })
        .select("_id")
        .lean();

      filter.assessmentId = {
        $in: owned.map((x) => x._id),
      };
    }

    if (assessmentId) {
      if (!mongoose.isValidObjectId(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assessmentId.",
        });
      }

      const assessment = await Assessment.findById(
        assessmentId
      )
        .select("createdBy")
        .lean();

      if (
        !assessment ||
        (req.user.role !== "admin" &&
          String(assessment.createdBy) !== String(req.user.id))
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot export this assessment.",
        });
      }

      filter.assessmentId = assessment._id;
    }

    const attempts = await Attempt.find(filter)
      .populate("assessmentId", "title")
      .populate("userId", "name email")
      .sort({ submittedAt: -1 })
      .lean();

    const esc = (v) =>
      `"${String(v ?? "")
        .replace(/"/g, '""')
        .replace(/[\r\n]+/g, " ")}"`;

    const rows = [
      [
        "attemptId",
        "assessment",
        "candidateId",
        "candidate",
        "email",
        "status",
        "score",
        "totalPoints",
        "percentage",
        "startedAt",
        "submittedAt",
      ]
        .map(esc)
        .join(","),
    ];

    for (const a of attempts) {
      const score = normalizeScore(a);

      rows.push(
        [
          a._id,
          a.assessmentId?.title,
          a.userId?._id,
          a.userId?.name,
          a.userId?.email,
          a.status,
          score.score,
          score.totalPoints,
          score.percentage,
          a.startedAt?.toISOString?.(),
          a.submittedAt?.toISOString?.(),
        ]
          .map(esc)
          .join(",")
      );
    }

    await audit(
      req,
      "results.exported",
      "attempt",
      assessmentId || "all",
      { rowCount: attempts.length }
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="codearena-results-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`
    );

    res.send(rows.join("\r\n"));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not export results.",
    });
  }
};

exports.auditLogs = async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 100, 1),
      500
    );

    const filter = {};

    if (req.query.action) {
      filter.action = String(req.query.action).slice(0, 120);
    }

    if (
      req.query.actorId &&
      mongoose.isValidObjectId(req.query.actorId)
    ) {
      filter.actorId = req.query.actorId;
    }

    const logs = await AuditLog.find(filter)
      .populate("actorId", "name email role")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Could not load audit logs.",
    });
  }
};
