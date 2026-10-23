const mongoose = require("mongoose");
const Problem = require("../models/Problem");

function slugify(value) {
  return String(value || "problem").toLowerCase().trim().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 170) || "problem";
}
async function uniqueSlug(title, excludeId = null) {
  const base = slugify(title);
  let slug = base;
  let counter = 2;
  while (await Problem.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

function safeProblem(problem, includeAnswers = false) {
  const p = problem.toObject ? problem.toObject() : problem;
  const result = {
    _id: p._id,
    slug: p.slug || "",
    title: p.title,
    description: p.description,
    difficulty: p.difficulty,
    type: p.type,
    tags: p.tags || [],
    constraints: p.constraints || "",
    examples: p.examples || [],
    starterCode: p.starterCode || "",
    options: p.options || [],
    points: p.points,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    testCaseCount: Array.isArray(p.testCases) ? p.testCases.length : 0,
  };
  if (includeAnswers && p.type !== "coding") {
    result.correctOptionId = p.correctOptionId || "";
    result.expectedAnswer = p.expectedAnswer || "";
  }
  return result;
}

exports.listProblems = async (req, res, next) => {
  try {
    const { search = "", difficulty, type, tag, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));
    const filter = {};
    if (difficulty && ["easy", "medium", "hard"].includes(difficulty)) filter.difficulty = difficulty;
    if (type && ["coding", "mcq", "short_answer"].includes(type)) filter.type = type;
    if (tag) filter.tags = String(tag).slice(0, 50);
    if (String(search).trim()) {
      filter.$text = { $search: String(search).trim().slice(0, 100) };
    }

    const [items, total] = await Promise.all([
      Problem.find(filter)
        .select("-correctOptionId -expectedAnswer -testCases")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Problem.countDocuments(filter),
    ]);

    res.json({
      success: true,
      problems: items.map((item) => safeProblem(item)),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

exports.getProblem = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid problem ID." });
    }
    const problem = await Problem.findById(req.params.id).select("-correctOptionId -expectedAnswer");
    if (!problem) return res.status(404).json({ success: false, message: "Problem not found." });
    const result = safeProblem(problem);
    if (String(problem.createdBy) === String(req.user.id) || req.user.role === "admin") {
      result.testCases = (problem.testCases || []).map((tc) => ({ input: tc.input || "", expectedOutput: tc.expectedOutput || "", hidden: tc.hidden !== false }));
    }
    res.json({ success: true, problem: result });
  } catch (error) {
    next(error);
  }
};

exports.createProblem = async (req, res, next) => {
  try {
    const {
      title, description, difficulty = "easy", type = "coding", tags = [],
      constraints = "", examples = [], starterCode = "", options = [],
      correctOptionId = "", expectedAnswer = "", testCases = [], points = 10,
    } = req.body;

    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, message: "Title and description are required." });
    }
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({ success: false, message: "Invalid difficulty." });
    }
    if (!["coding", "mcq", "short_answer"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid problem type." });
    }
    if (!Array.isArray(tags) || tags.length > 20 || !tags.every((t) => typeof t === "string")) {
      return res.status(400).json({ success: false, message: "Tags must be a list of up to 20 strings." });
    }
    if (type === "mcq" && (!Array.isArray(options) || options.length < 2 || !correctOptionId || !options.some((o) => o.id === correctOptionId))) {
      return res.status(400).json({ success: false, message: "MCQ needs at least two options and a valid correct option ID." });
    }
    if (type === "short_answer" && !String(expectedAnswer).trim()) {
      return res.status(400).json({ success: false, message: "Expected answer is required for short-answer problems." });
    }

    const slug = await uniqueSlug(title);
    const problem = await Problem.create({
      slug, title: title.trim(), description: description.trim(), difficulty, type,
      tags: tags.map((t) => t.trim()).filter(Boolean),
      constraints, examples, starterCode, options,
      correctOptionId, expectedAnswer, testCases, points,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, message: "Problem created.", problem: safeProblem(problem) });
  } catch (error) {
    next(error);
  }
};

exports.updateProblem = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid problem ID." });
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: "Problem not found." });
    if (String(problem.createdBy) !== String(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only the creator or an admin can edit this problem." });
    }

    const allowed = ["title", "description", "difficulty", "type", "tags", "constraints", "examples", "starterCode", "options", "correctOptionId", "expectedAnswer", "testCases", "points"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) problem[key] = req.body[key];
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "title") || !problem.slug) {
      problem.slug = await uniqueSlug(problem.title, problem._id);
    }
    await problem.save();
    res.json({ success: true, message: "Problem updated.", problem: safeProblem(problem) });
  } catch (error) {
    next(error);
  }
};

exports.deleteProblem = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid problem ID." });
    const problem = await Problem.findById(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: "Problem not found." });
    if (String(problem.createdBy) !== String(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only the creator or an admin can delete this problem." });
    }
    await problem.deleteOne();
    res.json({ success: true, message: "Problem deleted." });
  } catch (error) {
    next(error);
  }
};
