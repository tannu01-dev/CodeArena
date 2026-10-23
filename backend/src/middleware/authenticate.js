
const { getCookieName, verifyToken } = require("../utils/auth");

function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const bearer = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    const cookieName = getCookieName();
    const token = req.cookies?.[cookieName] || req.cookies?.token || bearer;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing from environment variables.");

      return res.status(500).json({
        success: false,
        message: "Server configuration error.",
      });
    }

    const decoded = verifyToken(token);

    const id =
      decoded.id ||
      decoded.userId ||
      decoded._id ||
      decoded.sub;

    if (!id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    req.user = {
      ...decoded,
      id,
      role: decoded.role || "candidate",
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your session is invalid or expired. Please log in again.",
    });
  }
}

// Support both `require("./authenticate")` and `{ authenticate }` imports.
module.exports = authenticate;
module.exports.authenticate = authenticate;
