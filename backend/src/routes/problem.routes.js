const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const controller = require("../controllers/problem.controller");

router.get("/", authenticate, controller.listProblems);
router.get("/:id", authenticate, controller.getProblem);
router.post("/", authenticate, requireRole("recruiter", "admin"), controller.createProblem);
router.patch("/:id", authenticate, requireRole("recruiter", "admin"), controller.updateProblem);
router.delete("/:id", authenticate, requireRole("recruiter", "admin"), controller.deleteProblem);

module.exports = router;
