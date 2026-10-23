const ExecutionJob = require("../models/ExecutionJob");
const Attempt = require("../models/Attempt");
const Problem = require("../models/Problem");
const Submission = require("../models/Submission");
const LANGUAGE_IDS = { javascript: 63, python: 71, java: 62, cpp: 54, c: 50, csharp: 51, php: 68, ruby: 72, go: 60, rust: 73, typescript: 74 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function isPlaceholder(value) {
  return /your-|placeholder|change-me|example\.com|your-judge0-instance/i.test(String(value || ""));
}
function judgeBaseUrl() {
  // JUDGE0_API_URL is supported for compatibility with existing .env files.
  const raw = String(process.env.JUDGE0_BASE_URL || process.env.JUDGE0_API_URL || "").trim();
  if (!raw || isPlaceholder(raw)) {
    throw new Error("Code evaluation is not configured. Set JUDGE0_BASE_URL (or JUDGE0_API_URL) to a real, reachable Judge0-compatible service URL in backend/.env. Do not use the example placeholder URL.");
  }
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("JUDGE0_BASE_URL must be a valid http(s) URL."); }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error("JUDGE0_BASE_URL must be a valid http(s) URL.");
  }
  return raw.replace(/\/+$/, "");
}
function headers() {
  const h = { "Content-Type": "application/json" };
  const apiKey = String(process.env.JUDGE0_API_KEY || "").trim();
  const apiHost = String(process.env.JUDGE0_API_HOST || "").trim();
  if (apiKey && !isPlaceholder(apiKey)) h["X-RapidAPI-Key"] = apiKey;
  if (apiHost && !isPlaceholder(apiHost)) h["X-RapidAPI-Host"] = apiHost;
  return h;
}
function normalizeOutput(value) { return String(value ?? "").replace(/\r\n/g, "\n").trim(); }
function normalizeLanguage(language) {
  const key = String(language || "").toLowerCase().trim();
  const aliases = { js: "javascript", node: "javascript", nodejs: "javascript", py: "python", "c++": "cpp", "c#": "csharp", ts: "typescript", golang: "go", rs: "rust" };
  return aliases[key] || key;
}
async function judgeOne(sourceCode, language, testCase) {
  language = normalizeLanguage(language);
  if (!LANGUAGE_IDS[language]) throw new Error(`Unsupported language: ${language || "unknown"}`);
  const base = judgeBaseUrl();
  const createResponse = await fetch(`${base}/submissions?base64_encoded=false&wait=false`, {
    method: "POST", headers: headers(), body: JSON.stringify({ source_code: sourceCode, language_id: LANGUAGE_IDS[language], stdin: testCase.input || "", cpu_time_limit: 2, cpu_extra_time: 1, wall_time_limit: 5, memory_limit: 128000, enable_network: false })
  });
  if (!createResponse.ok) throw new Error(`Judge0 submission failed (${createResponse.status}).`);
  const created = await createResponse.json();
  if (!created.token) throw new Error("Judge0 did not return a submission token.");
  const maxPoll = Math.max(3000, Number(process.env.JUDGE0_MAX_POLL_MS || 20000));
  const interval = Math.max(200, Number(process.env.JUDGE0_POLL_INTERVAL_MS || 350));
  const until = Date.now() + maxPoll;
  while (Date.now() < until) {
    await sleep(interval);
    const response = await fetch(`${base}/submissions/${encodeURIComponent(created.token)}?base64_encoded=false`, { headers: headers() });
    if (!response.ok) throw new Error(`Judge0 status request failed (${response.status}).`);
    const result = await response.json();
    const statusId = result.status?.id;
    if (statusId && statusId > 2) {
      const passed = statusId === 3 && normalizeOutput(result.stdout) === normalizeOutput(testCase.expectedOutput);
      return { passed, status: passed ? "Accepted" : (statusId === 3 ? "Wrong Answer" : (result.status?.description || "Unknown")), stdout: String(result.stdout || "").slice(0, 5000), stderr: String(result.stderr || result.compile_output || "").slice(0, 5000), time: String(result.time || ""), memory: Number(result.memory || 0) };
    }
  }
  throw new Error("Judge0 execution timed out while waiting for a verdict.");
}
async function runCasesInParallel(sourceCode, language, testCases) {
  // Limit concurrency to avoid overwhelming public Judge0 instances / API quotas.
  const concurrency = Math.max(1, Math.min(8, Number(process.env.JUDGE0_TEST_CONCURRENCY || 5)));
  const results = new Array(testCases.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= testCases.length) return;
      try {
        results[index] = await judgeOne(sourceCode, language, testCases[index]);
      } catch (error) {
        results[index] = {
          passed: false,
          status: String(error?.message || "Judge Error").includes("timed out") ? "Judge Timeout" : "Judge Error",
          stdout: "",
          stderr: String(error?.message || "Evaluation failed").slice(0, 5000),
          time: "",
          memory: 0,
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, testCases.length) }, () => worker()));
  return results;
}
async function processJob(job) {
  if (!Array.isArray(job.testCases) || job.testCases.length === 0) {
    throw new Error("This problem has no test cases, so it cannot be evaluated.");
  }

  // Execute multiple test cases concurrently instead of waiting for each one in sequence.
  const results = await runCasesInParallel(job.sourceCode, job.language, job.testCases);
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const verdict = passed === total
    ? "Accepted"
    : (results.find((r) => !r.passed)?.status || "Wrong Answer");

  // Persist all result records before marking the execution job completed.
  if (job.mode === "submit") {
    // Prefer the linked history record, but recover older queued jobs whose
    // submissionId was not persisted during queue creation.
    let submission = job.submissionId ? await Submission.findById(job.submissionId) : null;
    if (!submission) {
      submission = await Submission.findOne({
        attemptId: job.attemptId,
        problemId: job.problemId,
        code: job.sourceCode,
        status: { $in: ["pending", "running", "failed"] },
      }).sort({ submittedAt: -1, createdAt: -1 });
    }
    if (submission) {
      submission.code = job.sourceCode;
      submission.language = job.language || submission.language;
      submission.status = "graded";
      submission.verdict = verdict;
      submission.passedTests = passed;
      submission.totalTests = total;
      submission.testResults = results;
      submission.earnedPoints = total
        ? Math.round((Number(submission.maxPoints || 0) * passed) / total)
        : 0;
      submission.evaluationMessage = `Evaluation complete: ${passed}/${total} test cases passed. Verdict: ${verdict}.`;
      submission.evaluatedAt = new Date();
      await submission.save();
    }
  }

  if (job.mode === "submit") {
    const [attempt, problem] = await Promise.all([
      Attempt.findById(job.attemptId),
      Problem.findById(job.problemId),
    ]);
    if (attempt && problem) {
      const answer = attempt.answers.find((a) => String(a.problemId) === String(job.problemId));
      if (answer) {
        // The job is the authoritative snapshot of the code that was evaluated.
        // Do not leave the answer stuck at "running" just because a later autosave
        // changed whitespace/code while this job was in the queue.
        answer.code = job.sourceCode;
        answer.language = job.language || answer.language || "javascript";
        answer.evaluationStatus = "graded";
        answer.evaluationMessage = `Automatic evaluation complete: ${passed}/${total} test cases passed. Verdict: ${verdict}.`;
        answer.earnedPoints = total
          ? Math.round((Number(problem.points || 0) * passed) / total)
          : 0;
        answer.maxPoints = Number(problem.points || 0);
        answer.isCorrect = total > 0 && passed === total;
        attempt.score = attempt.answers.reduce((sum, a) => sum + Math.max(0, Number(a.earnedPoints || 0)), 0);
        attempt.totalPoints = attempt.answers.reduce((sum, a) => sum + Math.max(0, Number(a.maxPoints || 0)), 0);
        attempt.pendingEvaluations = attempt.answers.filter((a) => ["pending", "running"].includes(a.evaluationStatus)).length;
        await attempt.save();
      }
    }
  }

  job.results = results;
  job.passed = passed;
  job.total = total;
  job.score = total ? Math.round((passed / total) * 10000) / 100 : 0;
  job.verdict = verdict;
  job.status = "completed";
  job.errorMessage = "";
  job.finishedAt = new Date();
  await job.save();
}

async function pollOnce() {
  const job = await ExecutionJob.findOneAndUpdate(
    { status: "queued" },
    { $set: { status: "running", startedAt: new Date(), verdict: "Running" } },
    { returnDocument: "after", sort: { createdAt: 1 } }
  );
  if (!job) return false;
  try { await processJob(job); }
  catch (error) {
    job.status = "failed"; job.verdict = "Judge Error"; job.errorMessage = String(error.message || "Execution failed").slice(0, 1000); job.finishedAt = new Date(); await job.save();
    if (job.mode === "submit") {
      if (job.submissionId) {
        const submission = await Submission.findById(job.submissionId);
        if (submission) {
          submission.status = "failed";
          submission.verdict = "Judge Error";
          submission.evaluationMessage = job.errorMessage || "Judge service failed.";
          submission.evaluatedAt = new Date();
          await submission.save();
        }
      }
      const attempt = await Attempt.findById(job.attemptId);
      if (attempt) {
        const answer = attempt.answers.find((a) => String(a.problemId) === String(job.problemId));
        if (answer) {
          answer.evaluationStatus = "failed";
          answer.evaluationMessage = job.errorMessage || "Judge service failed; recruiter review is required.";
          attempt.pendingEvaluations = attempt.answers.filter((a) => ["pending", "running"].includes(a.evaluationStatus)).length;
          await attempt.save();
        }
      }
    }
  }
  return true;
}
module.exports = { pollOnce };
