'use strict';

var express = require('express');

var controller    = require('./snapshot_controller'),
    commonRouter  = require('../common/common_routers'),
    projUpdater = require('../project/proj_updater');


var ensureAuth        = commonRouter.ensureAuthenticated;

var projWriteAccess = commonRouter.projWriteAccess;

// mouted on /snapshots
var router = express.Router({mergeParams : true});

router
    .post('/', ensureAuth, projWriteAccess, projUpdater.updateLastModified, controller.addProjectSnapshot)
    .post('/sequence', ensureAuth, projWriteAccess, projUpdater.updateLastModified, controller.updateProjectSnapshotSequence)
    .post('/update_players', ensureAuth, projWriteAccess, projUpdater.updateLastModified, controller.updateSnapshotsInPlayers)

    .post('/:snapId', ensureAuth, projWriteAccess, projUpdater.updateLastModified, controller.updateProjectSnapshot)
    .delete('/:snapId', ensureAuth, projWriteAccess, projUpdater.updateLastModified, controller.removeProjectSnapshot);


module.exports = router;