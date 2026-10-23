const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/attempt.controller");

router.use(authenticate);
router.post("/:attemptId/submit", controller.submitAttempt);
router.get("/:attemptId", controller.getAttempt);

module.exports = router;
