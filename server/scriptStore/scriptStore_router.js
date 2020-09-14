"use strict";

var express = require("express");

var controller = require("./scriptStore_controller"),
    commonRouter = require("../common/common_routers");

var ensureAuth = commonRouter.ensureAuthenticated;

/// /scripts routes
var router = express.Router();

router
    .get("/", ensureAuth, controller.getScripts)
    .post("/", ensureAuth, controller.storeScripts);

module.exports = router;