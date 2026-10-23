const mongoose = require("mongoose");
const Attempt = require("../models/Attempt");
const Assessment = require("../models/Assessment");
const Problem = require("../models/Problem");
const ExecutionJob = require("../models/ExecutionJob");
const Submission = require("../models/Submission");

const ownerOrAdmin = (attempt, user) => String(attempt.userId) === String(user.id) || user.role === "admin";
function cleanProblem(p) {
  return { _id: p._id, title: p.title, description: p.description, difficulty: p.difficulty, type: p.type, tags: p.tags, constraints: p.constraints, examples: p.examples, starterCode: p.starterCode, options: p.options, points: p.points };
}
async function expireIfNeeded(attempt) {
  if (attempt.status === "in_progress" && attempt.deadlineAt && Date.now() >= new Date(attempt.deadlineAt).getTime()) {
    attempt.status = "submitted";
    attempt.submittedAt = new Date();
    attempt.endedReason = "time_expired";
    await attempt.save();
  }
  return attempt;
}
exports.getWorkspace = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(400).json({ success: false, message: "Invalid attempt ID." });
    let attempt = await Attempt.findById(req.params.attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
    if (!ownerOrAdmin(attempt, req.user)) return res.status(403).json({ success: false, message: "This attempt belongs to another user." });
    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found." });
    if (!attempt.deadlineAt) {
      attempt.deadlineAt = new Date(new Date(attempt.startedAt).getTime() + Number(assessment.durationMinutes || 30) * 60000);
      await attempt.save();
    }
    attempt = await expireIfNeeded(attempt);
    const problems = await Problem.find({ _id: { $in: assessment.problemIds } });
    const answers = new Map(attempt.answers.map((a) => [String(a.problemId), a]));
    res.json({ success: true, workspace: { attempt: { _id: attempt._id, status: attempt.status, startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt, submittedAt: attempt.submittedAt, endedReason: attempt.endedReason, integrityViolationCount: attempt.integrityViolationCount }, assessment: { _id: assessment._id, title: assessment.title, instructions: assessment.instructions, durationMinutes: assessment.durationMinutes }, problems: problems.map((p) => ({ ...cleanProblem(p), draft: answers.get(String(p._id))?.code || p.starterCode || "", language: answers.get(String(p._id))?.language || "javascript", answer: answers.get(String(p._id))?.answer || "", evaluationStatus: answers.get(String(p._id))?.evaluationStatus || "pending" })) } });
  } catch (error) { next(error); }
};
exports.saveDraft = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { problemId, code, language, answer } = req.body || {};
    if (!mongoose.isValidObjectId(attemptId) || !mongoose.isValidObjectId(problemId)) return res.status(400).json({ success: false, message: "Invalid attempt or problem ID." });
    if (typeof code !== "string" || code.length > 50000) return res.status(400).json({ success: false, message: "Code must be text up to 50,000 characters." });
    const attempt = await Attempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
    if (!ownerOrAdmin(attempt, req.user)) return res.status(403).json({ success: false, message: "Not your attempt." });
    if (attempt.status !== "in_progress") return res.status(409).json({ success: false, message: "This attempt is no longer active." });
    if (attempt.deadlineAt && Date.now() >= new Date(attempt.deadlineAt).getTime()) {
      attempt.status = "submitted"; attempt.submittedAt = new Date(); attempt.endedReason = "time_expired"; await attempt.save();
      return res.status(409).json({ success: false, message: "Time has expired. Your attempt was auto-submitted." });
    }
    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment || !assessment.problemIds.some((id) => String(id) === String(problemId))) return res.status(400).json({ success: false, message: "Problem is not part of this assessment." });
    const existing = attempt.answers.find((a) => String(a.problemId) === String(problemId));
    const values = { code, language: String(language || "javascript").slice(0, 40), answer: typeof answer === "string" ? answer.slice(0, 30000) : (existing?.answer || ""), lastSavedAt: new Date() };
    if (existing) Object.assign(existing, values); else attempt.answers.push({ problemId, ...values });
    await attempt.save();
    res.json({ success: true, savedAt: new Date(), message: "Draft saved." });
  } catch (error) { next(error); }
};
exports.submitWorkspace = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    if (!mongoose.isValidObjectId(attemptId)) return res.status(400).json({ success: false, message: "Invalid attempt ID." });
    const attempt = await Attempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ success: false, message: "Attempt not found." });
    if (!ownerOrAdmin(attempt, req.user)) return res.status(403).json({ success: false, message: "Not your attempt." });
    if (attempt.status !== "in_progress") {
      if (String(req.body?.requestId || "") === attempt.submitRequestId) return res.json({ success: true, attemptId: attempt._id, status: attempt.status, score: attempt.score, totalPoints: attempt.totalPoints, pendingEvaluations: attempt.pendingEvaluations, duplicate: true });
      return res.status(409).json({ success: false, message: "This attempt has already ended." });
    }
    const requestId = String(req.body?.requestId || "").slice(0, 100);
    if (requestId && attempt.submitRequestId === requestId) return res.json({ success: true, attemptId: attempt._id, status: attempt.status, duplicate: true });
    const assessment = await Assessment.findById(attempt.assessmentId);
    if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found." });
    const problems = await Problem.find({ _id: { $in: assessment.problemIds } });
    const saved = new Map(attempt.answers.map((a) => [String(a.problemId), a]));
    const jobsToCreate = [];
    const submissionDocs = [];
    let score = 0;
    let pending = 0;

    for (const p of problems) {
      let a = saved.get(String(p._id));
      if (!a) {
        attempt.answers.push({ problemId: p._id, maxPoints: p.points || 0, earnedPoints: 0, evaluationStatus: "pending", evaluationMessage: "No response submitted.", isCorrect: null });
        a = attempt.answers[attempt.answers.length - 1];
        saved.set(String(p._id), a);
      }
      a.maxPoints = Number(p.points || 0);
      if (p.type === "mcq") {
        a.isCorrect = String(a.answer || "") === String(p.correctOptionId || "");
        a.earnedPoints = a.isCorrect ? a.maxPoints : 0;
        a.evaluationStatus = "graded";
        a.evaluationMessage = "Automatically graded against the configured correct option.";
      } else if (p.type === "short_answer") {
        const norm = (v) => String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
        a.isCorrect = norm(a.answer) === norm(p.expectedAnswer);
        a.earnedPoints = a.isCorrect ? a.maxPoints : 0;
        a.evaluationStatus = "graded";
        a.evaluationMessage = "Automatically compared with the configured expected answer.";
      } else {
        const testCases = Array.isArray(p.testCases) ? p.testCases : [];
        if (testCases.length && String(a.code || "").trim()) {
          a.evaluationStatus = "running";
          a.evaluationMessage = "Queued for isolated test-case evaluation.";
          jobsToCreate.push({ attemptId: attempt._id, userId: attempt.userId, problemId: p._id, mode: "submit", language: a.language || "javascript", sourceCode: a.code, testCases: testCases.map((tc) => ({ input: tc.input || "", expectedOutput: String(tc.expectedOutput ?? ""), hidden: !!tc.hidden })), status: "queued", verdict: "Queued", total: testCases.length, idempotencyKey: `final-${attempt._id}-${p._id}-${String(req.body?.requestId || Date.now()).slice(0, 40)}` });
        } else {
          a.evaluationStatus = "pending";
          a.evaluationMessage = !testCases.length ? "No test cases are configured. Recruiter must add test cases and/or manually review this response." : "No code response was submitted for this question.";
          a.earnedPoints = 0;
          a.isCorrect = null;
        }
      }
      if (a.evaluationStatus === "pending" || a.evaluationStatus === "running") pending++;
      score += Number(a.earnedPoints || 0);
      const isCoding = p.type === "coding";
      const hasTests = Array.isArray(p.testCases) && p.testCases.length > 0;
      const hasCode = String(a.code || "").trim().length > 0;
      submissionDocs.push({
        attemptId: attempt._id, assessmentId: attempt.assessmentId, userId: attempt.userId, problemId: p._id,
        code: a.code || "", answer: a.answer || "", language: a.language || "javascript", kind: "assessment",
        status: isCoding ? (hasTests && hasCode ? "running" : (!hasTests ? "not_configured" : "not_submitted")) : "graded",
        verdict: isCoding ? (hasTests && hasCode ? "Queued" : (!hasTests ? "Not Configured" : "No Code Submitted")) : (a.isCorrect ? "Correct" : "Incorrect"),
        earnedPoints: Number(a.earnedPoints || 0), maxPoints: Number(p.points || 0), totalTests: hasTests ? p.testCases.length : 0,
        evaluationMessage: a.evaluationMessage || "", submittedAt: new Date(),
      });
    }

    attempt.score = score;
    attempt.totalPoints = problems.reduce((sum, p) => sum + Number(p.points || 0), 0);
    attempt.pendingEvaluations = pending;
    attempt.status = "submitted";
    attempt.submittedAt = new Date();
    attempt.endedReason = attempt.deadlineAt && Date.now() >= new Date(attempt.deadlineAt).getTime() ? "time_expired" : "candidate_submit";
    attempt.submitRequestId = requestId;
    await attempt.save();

    // Persist an audit/history row for every answer before queuing evaluation jobs.
    const savedSubmissions = submissionDocs.length ? await Submission.insertMany(submissionDocs) : [];
    const submissionByProblem = new Map(savedSubmissions.map((submission) => [String(submission.problemId), submission]));

    // Queue coding answers only after the attempt is durably submitted. The judge worker
    // executes the code in Judge0 and writes the final verdict back to both records.
    for (const job of jobsToCreate) {
      try {
        const submission = submissionByProblem.get(String(job.problemId));
        if (submission) job.submissionId = submission._id;
        await ExecutionJob.updateOne(
          { attemptId: job.attemptId, problemId: job.problemId, mode: "submit", idempotencyKey: job.idempotencyKey },
          { $setOnInsert: job },
          { upsert: true }
        );
        const queued = await ExecutionJob.findOne({ attemptId: job.attemptId, problemId: job.problemId, mode: "submit", idempotencyKey: job.idempotencyKey });
        if (submission && queued) { submission.jobId = queued._id; await submission.save(); }
      } catch (queueError) {
        const answer = attempt.answers.find((item) => String(item.problemId) === String(job.problemId));
        const submission = submissionByProblem.get(String(job.problemId));
        if (answer) { answer.evaluationStatus = "failed"; answer.evaluationMessage = "Could not queue automatic evaluation. Check Judge worker and retry evaluation."; }
        if (submission) { submission.status = "failed"; submission.verdict = "Queue Error"; submission.evaluationMessage = String(queueError.message || "Could not queue evaluation").slice(0, 1000); submission.evaluatedAt = new Date(); await submission.save(); }
      }
    }
    attempt.pendingEvaluations = attempt.answers.filter((a) => ["pending", "running"].includes(a.evaluationStatus)).length;
    attempt.score = attempt.answers.reduce((sum, a) => sum + Number(a.earnedPoints || 0), 0);
    await attempt.save();

    res.json({ success: true, message: attempt.pendingEvaluations ? "Assessment submitted. Automatic evaluation is queued where test cases exist; remaining answers need review." : "Assessment submitted and graded.", attemptId: attempt._id, status: attempt.status, score: attempt.score, totalPoints: attempt.totalPoints, percentage: attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 10000) / 100 : 0, pendingEvaluations: attempt.pendingEvaluations, submittedAt: attempt.submittedAt });
  } catch (error) { next(error); }
};
