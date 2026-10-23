const express = require("express");
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/integrity.controller");
const router = express.Router();
router.use(authenticate);
router.post("/:attemptId/violations", controller.recordViolation);
router.get("/:attemptId", controller.getIntegrity);
module.exports = router;
