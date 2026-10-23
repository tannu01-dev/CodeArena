
const User = require("../models/User");

const editableFields = [
  "name",
  "bio",
  "title",
  "company",
  "location",
  "skills",
  "github",
  "linkedin",
  "website",
];

function serializeProfile(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    title: user.title || "",
    company: user.company || "",
    location: user.location || "",
    skills: user.skills || [],
    github: user.github || "",
    linkedin: user.linkedin || "",
    website: user.website || "",
    profileCompleted: user.profileCompleted || false,
    createdAt: user.createdAt,
  };
}

exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      profile: serializeProfile(user),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateMyProfile = async (req, res, next) => {
  try {
    const updates = {};

    for (const field of editableFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (
      updates.name !== undefined &&
      (typeof updates.name !== "string" ||
        !updates.name.trim() ||
        updates.name.trim().length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 1 and 100 characters.",
      });
    }

    if (
      updates.bio !== undefined &&
      (typeof updates.bio !== "string" || updates.bio.length > 1000)
    ) {
      return res.status(400).json({
        success: false,
        message: "Bio must be 1000 characters or fewer.",
      });
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    if (updates.skills !== undefined) {
      if (
        !Array.isArray(updates.skills) ||
        updates.skills.length > 50 ||
        !updates.skills.every(
          (skill) =>
            typeof skill === "string" &&
            skill.trim().length > 0 &&
            skill.trim().length <= 50
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide a valid list of up to 50 skills.",
        });
      }

      updates.skills = [
        ...new Set(updates.skills.map((skill) => skill.trim())),
      ];
    }

    const textFields = [
      "title",
      "company",
      "location",
      "github",
      "linkedin",
      "website",
    ];

    for (const field of textFields) {
      if (updates[field] !== undefined) {
        if (
          typeof updates[field] !== "string" ||
          updates[field].length > 300
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${field} value.`,
          });
        }

        updates[field] = updates[field].trim();
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const hasBasicDetails =
      Boolean(user.name) &&
      Boolean(user.title) &&
      Boolean(user.bio) &&
      user.skills.length > 0;

    user.profileCompleted = hasBasicDetails;
    await user.save();

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      profile: serializeProfile(user),
    });
  } catch (error) {
    next(error);
  }
};
