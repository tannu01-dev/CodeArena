
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  signup,
  login,
  me,
  logout
} = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later"
  }
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", authenticate, me);

// Protected role examples for testing authorization.
router.get(
  "/candidate",
  authenticate,
  authorize("candidate"),
  (req, res) => res.json({ success: true, message: "Candidate access granted" })
);

router.get(
  "/recruiter",
  authenticate,
  authorize("recruiter"),
  (req, res) => res.json({ success: true, message: "Recruiter access granted" })
);

router.get(
  "/admin",
  authenticate,
  authorize("admin"),
  (req, res) => res.json({ success: true, message: "Admin access granted" })
);

module.exports = router;
