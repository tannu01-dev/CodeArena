
const mongoose = require("mongoose");
const JobPosting = require("../models/JobPosting");
const JobApplication = require("../models/JobApplication");
const InterviewInvitation = require("../models/InterviewInvitation");
const CandidateProfile = require("../models/CandidateProfile");
const Assessment = require("../models/Assessment");
const { audit } = require("../services/audit");

const STAGES = [
  "applied",
  "screening",
  "assessment",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
];

function validId(id) {
  return mongoose.isValidObjectId(id);
}

async function ownedJob(req, jobId) {
  const job = await JobPosting.findById(jobId);

  if (!job) {
    return { error: [404, "Job not found."] };
  }

  if (
    req.user.role !== "admin" &&
    String(job.createdBy) !== String(req.user.id)
  ) {
    return { error: [403, "You do not own this job."] };
  }

  return { job };
}

exports.listJobs = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === "candidate") {
      filter.status = "published";
    } else if (req.query.mine === "true") {
      filter.createdBy = req.user.id;
    } else if (req.user.role !== "admin") {
      filter.status = "published";
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    const jobs = await JobPosting.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ success: true, jobs });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not list jobs.",
    });
  }
};

exports.getJob = async (req, res) => {
  try {
    const job = await JobPosting.findById(req.params.jobId)
      .populate("createdBy", "name email")
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    if (
      job.status !== "published" &&
      req.user.role !== "admin" &&
      String(job.createdBy?._id || job.createdBy) !==
        String(req.user.id)
    ) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    res.json({ success: true, job });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not load job.",
    });
  }
};

exports.createJob = async (req, res) => {
  try {
    const {
      title,
      company,
      description,
      requirements = [],
      skills = [],
      location = "Remote",
      employmentType = "full-time",
      assessmentId = null,
      status = "draft",
    } = req.body;

    if (!title || !company || !description) {
      return res.status(400).json({
        success: false,
        message: "title, company and description are required.",
      });
    }

    if (!Array.isArray(requirements) || !Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: "requirements and skills must be arrays.",
      });
    }

    if (assessmentId && !validId(assessmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assessmentId.",
      });
    }

    if (assessmentId) {
      const linkedAssessment = await Assessment.findById(
        assessmentId
      )
        .select("createdBy status")
        .lean();

      if (!linkedAssessment) {
        return res.status(400).json({
          success: false,
          message: "Linked assessment not found.",
        });
      }

      if (
        req.user.role !== "admin" &&
        String(linkedAssessment.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only attach your own assessment.",
        });
      }
    }

    if (!["draft", "published"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "New jobs can be draft or published.",
      });
    }

    const job = await JobPosting.create({
      title,
      company,
      description,
      requirements,
      skills,
      location,
      employmentType,
      assessmentId,
      status,
      publishedAt: status === "published" ? new Date() : null,
      createdBy: req.user.id,
    });

    await audit(req, "hiring.job.created", "jobPosting", job._id, {
      status,
    });

    res.status(201).json({ success: true, job });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message || "Could not create job.",
    });
  }
};

exports.updateJob = async (req, res) => {
  try {
    const check = await ownedJob(req, req.params.jobId);

    if (check.error) {
      return res.status(check.error[0]).json({
        success: false,
        message: check.error[1],
      });
    }

    const fields = [
      "title",
      "company",
      "description",
      "requirements",
      "skills",
      "location",
      "employmentType",
      "assessmentId",
    ];

    for (const key of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        if (key === "assessmentId" && req.body[key]) {
          if (!validId(req.body[key])) {
            return res.status(400).json({
              success: false,
              message: "Invalid assessmentId.",
            });
          }

          const linkedAssessment = await Assessment.findById(
            req.body[key]
          )
            .select("createdBy")
            .lean();

          if (!linkedAssessment) {
            return res.status(400).json({
              success: false,
              message: "Linked assessment not found.",
            });
          }

          if (
            req.user.role !== "admin" &&
            String(linkedAssessment.createdBy) !==
              String(req.user.id)
          ) {
            return res.status(403).json({
              success: false,
              message: "You can only attach your own assessment.",
            });
          }
        }

        check.job[key] = req.body[key];
      }
    }

    if (req.body.status) {
      if (
        !["draft", "published", "closed"].includes(req.body.status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid job status.",
        });
      }

      check.job.status = req.body.status;

      if (
        req.body.status === "published" &&
        !check.job.publishedAt
      ) {
        check.job.publishedAt = new Date();
      }

      if (req.body.status === "closed") {
        check.job.closedAt = new Date();
      }
    }

    await check.job.save();

    await audit(
      req,
      "hiring.job.updated",
      "jobPosting",
      check.job._id,
      { status: check.job.status }
    );

    res.json({ success: true, job: check.job });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message || "Could not update job.",
    });
  }
};

exports.applyToJob = async (req, res) => {
  try {
    const job = await JobPosting.findOne({
      _id: req.params.jobId,
      status: "published",
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Published job not found.",
      });
    }

    const profile = await CandidateProfile.findOne({
      userId: req.user.id,
      deletedAt: null,
    })
      .select("_id")
      .lean();

    const application = await JobApplication.create({
      jobId: job._id,
      candidateId: req.user.id,
      coverLetter: String(req.body.coverLetter || "").slice(0, 5000),
      resumeUrl: String(req.body.resumeUrl || "").slice(0, 1000),
      history: [
        {
          stage: "applied",
          note: "Application submitted",
          changedBy: req.user.id,
        },
      ],
    });

    await audit(
      req,
      "hiring.application.created",
      "jobApplication",
      application._id,
      {
        jobId: String(job._id),
        profileExists: Boolean(profile),
      }
    );

    res.status(201).json({ success: true, application });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied to this job.",
      });
    }

    res.status(400).json({
      success: false,
      message: e.message || "Could not submit application.",
    });
  }
};

exports.myApplications = async (req, res) => {
  try {
    const applications = await JobApplication.find({
      candidateId: req.user.id,
    })
      .populate("jobId", "title company location status employmentType")
      .sort({ appliedAt: -1 })
      .lean();

    res.json({ success: true, applications });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not load applications.",
    });
  }
};

exports.jobApplications = async (req, res) => {
  try {
    const check = await ownedJob(req, req.params.jobId);

    if (check.error) {
      return res.status(check.error[0]).json({
        success: false,
        message: check.error[1],
      });
    }

    const applications = await JobApplication.find({
      jobId: check.job._id,
    })
      .populate("candidateId", "name email")
      .sort({ appliedAt: -1 })
      .lean();

    res.json({ success: true, applications });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not load applications.",
    });
  }
};

exports.updateApplication = async (req, res) => {
  try {
    const application = await JobApplication.findById(
      req.params.applicationId
    ).populate("jobId");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    if (
      req.user.role !== "admin" &&
      String(application.jobId.createdBy) !== String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only the job owner or admin can manage this application.",
      });
    }

    const { status, note = "" } = req.body;

    if (!STAGES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application stage.",
      });
    }

    if (
      ["withdrawn"].includes(application.status) &&
      status !== application.status
    ) {
      return res.status(409).json({
        success: false,
        message: "A withdrawn application cannot be reopened.",
      });
    }

    application.status = status;
    application.updatedBy = req.user.id;

    application.history.push({
      stage: status,
      note: String(note).slice(0, 1000),
      changedBy: req.user.id,
      changedAt: new Date(),
    });

    await application.save();

    await audit(
      req,
      "hiring.application.stage_changed",
      "jobApplication",
      application._id,
      { status }
    );

    res.json({ success: true, application });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message || "Could not update application.",
    });
  }
};

exports.createInvitation = async (req, res) => {
  try {
    const {
      candidateId,
      jobId = null,
      applicationId = null,
      assessmentId = null,
      type = "interview",
      title,
      message = "",
      scheduledAt = null,
      meetingUrl = "",
    } = req.body;

    if (!validId(candidateId) || !title) {
      return res.status(400).json({
        success: false,
        message: "Valid candidateId and title are required.",
      });
    }

    const UserModel = mongoose.models.User;

    const candidateUser = UserModel
      ? await UserModel.findById(candidateId).select("role").lean()
      : await mongoose.connection.db
          .collection("users")
          .findOne(
            {
              _id: new mongoose.Types.ObjectId(candidateId),
            },
            {
              projection: { role: 1 },
            }
          );

    if (!candidateUser) {
      return res.status(404).json({
        success: false,
        message: "Candidate user not found.",
      });
    }

    if (
      candidateUser.role &&
      candidateUser.role !== "candidate" &&
      req.user.role !== "admin"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invitations can only be sent to candidate accounts.",
      });
    }

    if (assessmentId) {
      if (!validId(assessmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid assessmentId.",
        });
      }

      const linkedAssessment = await Assessment.findById(assessmentId)
        .select("createdBy")
        .lean();

      if (!linkedAssessment) {
        return res.status(404).json({
          success: false,
          message: "Assessment not found.",
        });
      }

      if (
        req.user.role !== "admin" &&
        String(linkedAssessment.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only invite candidates to your own assessment.",
        });
      }
    }

    if (!["interview", "assessment"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation type.",
      });
    }

    if (jobId) {
      const check = await ownedJob(req, jobId);

      if (check.error) {
        return res.status(check.error[0]).json({
          success: false,
          message: check.error[1],
        });
      }
    }

    let app = null;

    if (applicationId) {
      if (!validId(applicationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid applicationId.",
        });
      }

      app = await JobApplication.findById(applicationId).populate(
        "jobId"
      );

      if (!app) {
        return res.status(404).json({
          success: false,
          message: "Application not found.",
        });
      }

      if (
        req.user.role !== "admin" &&
        String(app.jobId.createdBy) !== String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message: "You cannot invite for this application.",
        });
      }

      if (String(app.candidateId) !== String(candidateId)) {
        return res.status(400).json({
          success: false,
          message: "candidateId does not match the application.",
        });
      }
    }

    const invitation = await InterviewInvitation.create({
      candidateId,
      recruiterId: req.user.id,
      jobId,
      applicationId,
      assessmentId,
      type,
      title,
      message,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      meetingUrl,
    });

    await audit(
      req,
      "hiring.invitation.created",
      "interviewInvitation",
      invitation._id,
      { type }
    );

    res.status(201).json({ success: true, invitation });
  } catch (e) {
    res.status(400).json({
      success: false,
      message: e.message || "Could not create invitation.",
    });
  }
};

exports.myInvitations = async (req, res) => {
  try {
    const invitations = await InterviewInvitation.find({
      candidateId: req.user.id,
    })
      .populate("jobId", "title company")
      .populate("recruiterId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, invitations });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not load invitations.",
    });
  }
};

exports.respondInvitation = async (req, res) => {
  try {
    const invitation = await InterviewInvitation.findOne({
      _id: req.params.invitationId,
      candidateId: req.user.id,
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invitation not found.",
      });
    }

    const { status } = req.body;

    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Response must be accepted or declined.",
      });
    }

    if (invitation.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "This invitation has already been answered.",
      });
    }

    invitation.status = status;
    invitation.respondedAt = new Date();

    await invitation.save();

    await audit(
      req,
      "hiring.invitation.responded",
      "interviewInvitation",
      invitation._id,
      { status }
    );

    res.json({ success: true, invitation });
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Could not respond to invitation.",
    });
  }
};
