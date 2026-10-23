
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  createToken,
  getCookieOptions,
  getCookieName
} = require("../utils/auth");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function setSessionCookie(res, user) {
  res.cookie(
    getCookieName(),
    createToken(user),
    getCookieOptions()
  );
}

async function signup(req, res, next) {
  try {
    let { name, email, password, role } = req.body || {};

    name = typeof name === "string" ? name.trim() : "";
    email = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must contain 2 to 80 characters"
      });
    }

    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address"
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must contain 8 to 72 characters"
      });
    }

    // Never accept admin privileges from public signup.
    if (role !== undefined && !["candidate", "recruiter"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid signup role"
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "candidate"
    });

    setSessionCookie(res, user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (
      !normalizedEmail ||
      !EMAIL_PATTERN.test(normalizedEmail) ||
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email and password"
      });
    }

    const user = await User.findOne({
      email: normalizedEmail
    }).select("+password");

    const passwordMatches =
      user && await bcrypt.compare(password, user.password);

    if (!user || !passwordMatches || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    setSessionCookie(res, user);

    return res.json({
      success: true,
      message: "Logged in successfully",
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Your account is unavailable. Please log in again."
      });
    }

    return res.json({
      success: true,
      user: publicUser(user)
    });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  res.clearCookie(getCookieName(), {
    ...getCookieOptions(),
    maxAge: undefined
  });

  return res.json({
    success: true,
    message: "Logged out successfully"
  });
}

module.exports = {
  signup,
  login,
  me,
  logout
};
