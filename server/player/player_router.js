'use strict';

var express = require('express');

var controller    = require('./player_controller'),
    commonRouter  = require('../common/common_routers'),
    projUpdater = require('../project/proj_updater');


var ensureAuth        = commonRouter.ensureAuthenticated;

var cleanUserOrgCache = commonRouter.cleanUserOrgCache;

//mounted on projects/:pid([a-z0-9]{24})/players
var router = express.Router({mergeParams : true});

router
    .get('/',controller.readByProjId)
    .post('/', ensureAuth, cleanUserOrgCache, controller.create);

router.route('/:plid')
    .get (ensureAuth, controller.read)
    .post(ensureAuth, cleanUserOrgCache, projUpdater.updateLastModified, controller.update);

router
    .post('/:plid/finalise', ensureAuth, projUpdater.updateLastModified, controller.finalisePlayer)
    .post('/:plid/regenToken', ensureAuth, projUpdater.updateLastModified, controller.regenerateAccessToken)
    .post('/:plid/isDisabled', ensureAuth, projUpdater.updateLastModified, controller.updateDisabledStatus);

module.exports = router;
