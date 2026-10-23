
const express = require("express");
const router = express.Router();

const {authenticate} = require("../middleware/authenticate");
const dashboardController = require("../controllers/dashboard.controller");

router.get("/summary", authenticate, dashboardController.getDashboardSummary);

module.exports = router;
