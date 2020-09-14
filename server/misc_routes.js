'use strict';
var path = require('path');

var athenaController = require('./misc_controllers/athenaController');
var svgRenderController = require('./misc_controllers/svgRenderController');
var elasticSearchController = require('./misc_controllers/elasticSearchController');
var jobController = require('./misc_controllers/jobController');
var maintenanceController = require('./misc_controllers/maintenanceController');
var shortUrlController = require('./misc_controllers/shortURLController');
var etlController = require('./etl/etl_controller.js');
var commonRouter  = require('./common/common_routers');
var projUpdater = require('./project/proj_updater');
var projModel = require('./project/proj_model');
var playerEditable = require('./player/player_editable');

var cleanUserOrgCache = commonRouter.cleanUserOrgCache;

//mounted to '/'
function setup_misc_routes(router) {
    router
        .get('/athena/algos', athenaController.listAlgo)
        .post('/athena/algo', cleanUserOrgCache, _loadProject, projUpdater.updateLastModified,  athenaController.create);

    router
        .post('/api/svg_render', svgRenderController.rendersvg)
        .get('/api/svg_get/:svg_id', svgRenderController.getSvg);

    router
        .post('/api/shorten_url', shortUrlController.getShortUrl);

    // demographics extractor
    router
        .post('/api/etl_scripts/extract_demo_for_entities', etlController.slice_extract_users_for_entity)
        .post('/api/etl_scripts/extract_cluster_users_entities', etlController.extract_cluster_users_entities);

    router
        .post('/api/elasticsearch/search_nodes', elasticSearchController.searchNodes)
        .get('/api/elasticsearch/dataset/:dsid/search/:queryterm', elasticSearchController.searchTerm)
        .get('/api/elasticsearch/ping', elasticSearchController.pingSearchServer)
        .get('/api/elasticsearch/sanitycheck', elasticSearchController.searchSanityCheck);

    router
        .get('/api/jobs', jobController.find)
        .post('/api/jobs', jobController.create)

        .get('/api/jobs/dummy', jobController.dummy)

        .get('/api/jobs/:id', jobController.findOne)
        .delete('/api/jobs/:id', jobController.destroy);

    router
        .post('/api/dummy_post', (req, res) => {
            console.log("[dummy_post]", req.body);
            return res.status(200).json(req.body);
        });

    router
        .post('/api/google_form_response', playerEditable.updateDsAndNetworks);

    router
        .get('/api/maintain/sort_versions', maintenanceController.sortVersions)
        .post('/api/maintain/migrate_project', maintenanceController.migrateProject)
        .post('/api/maintain/list_old_projects', maintenanceController.listProjectsForEmail);
}

function _loadProject(req, res, next) {
    if(!req.body.projectId) {
        console.log('[misc_routes._loadProject: ] Project Id not found');
        return next();
    }

    projModel.listById(req.body.projectId, function(err, docs) {
        if(docs) {
            console.log('[misc_routes._loadProject: ] Project loaded for athena.algo');
            req.project = docs;
        }
        else {
            console.error('[misc_routes._loadProject: ] Project not loaded');
        }
        next();
    });
}

module.exports = setup_misc_routes;
