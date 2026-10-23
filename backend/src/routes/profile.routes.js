
const express = require("express");
const router = express.Router();

const profileController = require("../controllers/profile.controller");
const {authenticate} = require("../middleware/authenticate");

router.get("/me", authenticate, profileController.getMyProfile);
router.patch("/me", authenticate, profileController.updateMyProfile);

module.exports = router;
