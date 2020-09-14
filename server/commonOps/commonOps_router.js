"use strict";

var express = require("express");

var controller = require("./commonOps_controller"),
    commonRouter = require("../common/common_routers"),
    projUpdater = require('../project/proj_updater');


const TMPL_IDENT = "/:op_id";

var ensureAuth = commonRouter.ensureAuthenticated;

var projWriteAccess = commonRouter.projWriteAccess;

/// /scripts routes
var router = express.Router();

router
    .get("/", controller.allOps)
    /// ?validate=true to validate execution
    .post(TMPL_IDENT, ensureAuth, projWriteAccess, projUpdater.updateLastModified, controller.runOp);

module.exports = router;