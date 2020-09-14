'use strict';

var express = require('express');

var controller    = require('./player_controller'),
    commonRouter  = require('../common/common_routers');


var ensureAuth        = commonRouter.ensureAuthenticated;

//mounted on /api/players
var router = express.Router({mergeParams : true});

router
    .get('/:urlStr',controller.readByUrl)
    .post('/:plid/downloadSelection', controller.downloadSelection)
    .post('/checkurlavailable', ensureAuth,  controller.checkUrlAvailable);

module.exports = router;