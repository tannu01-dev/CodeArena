const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const controller = require("../controllers/assessment.controller");
const attempts = require("../controllers/attempt.controller");

router.use(authenticate);
router.get("/", controller.listAssessments);
router.get("/:id", controller.getAssessment);
router.post("/", requireRole("recruiter", "admin"), controller.createAssessment);
router.patch("/:id", requireRole("recruiter", "admin"), controller.updateAssessment);
router.post("/:id/publish", requireRole("recruiter", "admin"), controller.publishAssessment);
router.delete("/:id", requireRole("recruiter", "admin"), controller.deleteAssessment);
router.post("/:id/attempts", requireRole("candidate"), attempts.startAttempt);

module.exports = router;
