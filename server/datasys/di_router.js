'use strict';

var express = require('express');

var controller    = require('./di_controller'),
    commonRouter  = require('../common/common_routers'),
    projUpdater = require('../project/proj_updater');


var ensureAuth        = commonRouter.ensureAuthenticated,
    cleanUserOrgCache = commonRouter.cleanUserOrgCache;

var projWriteAccess = commonRouter.projWriteAccess;

//mounted on /di
var router = express.Router({mergeParams : true});

router
    .post('/linkedin', ensureAuth, projWriteAccess,cleanUserOrgCache, controller.importLinkedInContent)
    .post('/importio', ensureAuth, projWriteAccess,cleanUserOrgCache, controller.importImportIO)
    .post('/alchemyapi', ensureAuth, projWriteAccess,cleanUserOrgCache, controller.runAlchemy)
    .post('/alchemynews', ensureAuth, projWriteAccess,cleanUserOrgCache, controller.importAlchemyNews)
    .post('/import_es', ensureAuth, projWriteAccess,cleanUserOrgCache, controller.importFromES)
    .post('/mergedata', ensureAuth, projWriteAccess,cleanUserOrgCache, projUpdater.updateLastModified, controller.mergeNetworkData)
    .post('/merge_stats', ensureAuth, projWriteAccess,cleanUserOrgCache, controller.mergeStats);

module.exports = router;