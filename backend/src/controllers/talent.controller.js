
const mongoose = require("mongoose");
const CandidateProfile = require("../models/CandidateProfile");
const Attempt = require("../models/Attempt");
const JobPosting = require("../models/JobPosting");
const { audit } = require("../services/audit");

function validUrl(value) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

exports.getMyProfile = async (req, res) => {
  try {
    const profile = await CandidateProfile.findOne({
      userId: req.user.id,
      deletedAt: null,
    }).lean();

    res.json({
      success: true,
      profile: profile || null,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not load profile.",
    });
  }
};

exports.upsertMyProfile = async (req, res) => {
  try {
    const allowed = [
      "headline",
      "summary",
      "skills",
      "yearsExperience",
      "education",
      "links",
      "location",
    ];

    const data = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        data[key] = req.body[key];
      }
    }

    if (
      data.skills &&
      (
        !Array.isArray(data.skills) ||
        data.skills.length > 80 ||
        data.skills.some(
          (s) => typeof s !== "string" || s.length > 80
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Skills must be an array of up to 80 short strings.",
      });
    }

    if (data.links) {
      if (
        !Array.isArray(data.links) ||
        data.links.length > 20 ||
        data.links.some(
          (l) =>
            !l ||
            typeof l.label !== "string" ||
            !validUrl(l.url)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Each profile link needs a label and valid http(s) URL.",
        });
      }
    }

    if (
      data.education &&
      (
        !Array.isArray(data.education) ||
        data.education.length > 20
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Education must be an array of at most 20 entries.",
      });
    }

    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          ...data,
          deletedAt: null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await audit(
      req,
      "talent.profile.updated",
      "candidateProfile",
      profile._id
    );

    res.json({
      success: true,
      profile,
    });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message || "Profile validation failed.",
    });
  }
};

exports.setConsent = async (req, res) => {
  try {
    if (typeof req.body.searchable !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "searchable must be true or false.",
      });
    }

    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          searchable: req.body.searchable,
          consentVersion: String(
            req.body.consentVersion || "2026-10"
          ).slice(0, 40),
          consentUpdatedAt: new Date(),
          deletedAt: null,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await audit(
      req,
      req.body.searchable
        ? "privacy.search_opt_in"
        : "privacy.search_opt_out",
      "candidateProfile",
      profile._id
    );

    res.json({
      success: true,
      searchable: profile.searchable,
      consentUpdatedAt: profile.consentUpdatedAt,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not update privacy consent.",
    });
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          deletedAt: new Date(),
          searchable: false,
          headline: "",
          summary: "",
          skills: [],
          education: [],
          links: [],
          location: "",
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    await audit(
      req,
      "privacy.profile_erased",
      "candidateProfile",
      profile._id
    );

    res.json({
      success: true,
      message: "Profile data erased and removed from candidate search.",
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not erase profile.",
    });
  }
};

exports.searchCandidates = async (req, res) => {
  try {
    const query = String(req.query.q || "")
      .trim()
      .slice(0, 100);

    const skillList = String(req.query.skills || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20);

    const filter = {
      searchable: true,
      deletedAt: null,
    };

    if (skillList.length) {
      filter.skills = {
        $in: skillList.map(
          (s) =>
            new RegExp(
              `^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
              "i"
            )
        ),
      };
    }

    if (query) {
      const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { headline: new RegExp(safe, "i") },
        { summary: new RegExp(safe, "i") },
        { skills: new RegExp(safe, "i") },
        { location: new RegExp(safe, "i") },
      ];
    }

    const profiles = await CandidateProfile.find(filter)
      .select(
        "headline summary skills yearsExperience education links location userId updatedAt"
      )
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      candidates: profiles,
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Candidate search failed.",
    });
  }
};

exports.matchCandidates = async (req, res) => {
  try {
    const job = await JobPosting.findById(
      req.params.jobId
    ).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(job.createdBy) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the job owner or admin can run matching.",
      });
    }

    const profiles = await CandidateProfile.find({
      searchable: true,
      deletedAt: null,
    })
      .limit(500)
      .lean();

    const target = new Set(
      (job.skills || []).map((s) => String(s).toLowerCase())
    );

    const results = [];

    for (const p of profiles) {
      const skills = (p.skills || []).map(
        (s) => String(s).toLowerCase()
      );

      const overlap = skills.filter((s) => target.has(s));

      const skillScore = target.size
        ? overlap.length / target.size
        : 0;

      const recent = await Attempt.find({
        userId: p.userId,
        status: "submitted",
      })
        .select("score totalPoints answers")
        .sort({ submittedAt: -1 })
        .limit(10)
        .lean();

      const percentages = recent.map((a) => {
        const max =
          (a.answers || []).reduce(
            (n, x) => n + (Number(x.maxPoints) || 0),
            0
          ) ||
          Number(a.totalPoints) ||
          0;

        const earned =
          (a.answers || []).reduce(
            (n, x) => n + (Number(x.earnedPoints) || 0),
            0
          ) ||
          Number(a.score) ||
          0;

        return max
          ? Math.min(100, (earned / max) * 100)
          : 0;
      });

      const assessmentScore = percentages.length
        ? percentages.reduce((a, b) => a + b, 0) /
          percentages.length /
          100
        : null;

      const score =
        Math.round(
          (
            skillScore * 80 +
            (assessmentScore === null
              ? 0
              : assessmentScore * 20)
          ) * 100
        ) / 100;

      results.push({
        profile: {
          _id: p._id,
          userId: p.userId,
          headline: p.headline,
          skills: p.skills,
          yearsExperience: p.yearsExperience,
          location: p.location,
        },
        score,
        matchedSkills: overlap,
        assessmentScore:
          assessmentScore === null
            ? null
            : Math.round(assessmentScore * 10000) / 100,
      });
    }

    results.sort((a, b) => b.score - a.score);

    await audit(
      req,
      "talent.matching.run",
      "jobPosting",
      job._id,
      { candidateCount: results.length }
    );

    res.json({
      success: true,
      job: {
        _id: job._id,
        title: job.title,
      },
      matches: results.slice(0, 100),
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Candidate matching failed.",
    });
  }
};
