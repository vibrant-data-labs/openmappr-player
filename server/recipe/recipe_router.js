'use strict';

var express = require('express');

var controller    = require('./recipe_controller'),
    commonRouter  = require('../common/common_routers');


const TMPL_IDENT = '/:recipeid([0-9a-fA-F]{24})';

var ensureAuth        = commonRouter.ensureAuthenticated,
    ensureAdminAccess = commonRouter.ensureAdminAccess;

// debug passthrough
ensureAdminAccess = ensureAuth = function(req, res, next) { next(); };

/// /recipes routes
var router = express.Router();

// /recipes/:recipeid
var recipe = router.route(TMPL_IDENT);
// /:recipeid routes
recipe
    .get(ensureAuth,  controller.readDoc)
    .post(ensureAuth, controller.updateDoc)
    .delete(ensureAuth, ensureAdminAccess, controller.deleteDoc);

router.get('/projects/:pid/import', ensureAuth, controller.importRecipeFromProj);

// /recipes routes
router
    .get('/', ensureAuth, controller.listByOrg)
    .post('/', ensureAuth, controller.create)
    .post(TMPL_IDENT + '/clone', ensureAuth, controller.cloneRecipe);

// /recipes/recipeid/projects routes
router
    .get(TMPL_IDENT + '/projects', ensureAuth, controller.getGenProjects)
    .post(TMPL_IDENT + '/projects', ensureAuth, controller.genProjects);

// runs
router.get(TMPL_IDENT + '/runs', ensureAuth, controller.getRecipeRuns);
router.get(TMPL_IDENT + '/runs/:run_id([0-9a-fA-F]{24})', ensureAuth, controller.getRecipeRunById);
router.get(TMPL_IDENT + '/runs/:run_id([0-9a-fA-F]{24})/logs', ensureAuth, controller.getRecipeRunLogs);

/// Permission MGMT
module.exports = router;
