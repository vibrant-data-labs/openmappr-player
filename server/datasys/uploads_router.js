'use strict';

var express = require('express');

var controller    = require('./uploads_controller'),
    commonRouter  = require('../common/common_routers');


var ensureAuth        = commonRouter.ensureAuthenticated;

// mounted to org/:oid/datasources
var router = express.Router();

router
    .get( '/:uploadid', controller.getData)
    .post('/', ensureAuth, controller.validateAndStoreData);

module.exports = router;