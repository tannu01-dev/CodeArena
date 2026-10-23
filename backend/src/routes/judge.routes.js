const express = require("express");
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/judge.controller");
const router = express.Router();
router.use(authenticate);
router.post("/jobs", controller.createJob);
router.get("/jobs/:jobId", controller.getJob);
module.exports = router;
