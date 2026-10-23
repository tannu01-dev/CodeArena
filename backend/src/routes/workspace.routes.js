const express = require("express");
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/workspace.controller");
const router = express.Router();
router.use(authenticate);
router.get("/:attemptId", controller.getWorkspace);
router.put("/:attemptId/draft", controller.saveDraft);
router.post("/:attemptId/submit", controller.submitWorkspace);
module.exports = router;
