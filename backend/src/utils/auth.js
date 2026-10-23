
const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  return secret;
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      issuer: "codearena-api",
      audience: "codearena-web"
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: "codearena-api",
    audience: "codearena-web"
  });
}


function getCookieOptions() {
  const production = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
  };
}


function getCookieName() {
  return process.env.COOKIE_NAME || "codearena_token";
}

module.exports = {
  createToken,
  verifyToken,
  getCookieOptions,
  getCookieName
};
