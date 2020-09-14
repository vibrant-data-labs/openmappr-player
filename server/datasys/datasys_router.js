'use strict';

var express = require('express');

var controller    = require('./datasys_controller'),
    uploadsController = require('./uploads_controller'),
    commonRouter  = require('../common/common_routers'),
    projUpdater = require('../project/proj_updater');


var ensureAuth        = commonRouter.ensureAuthenticated,
    cleanUserOrgCache = commonRouter.cleanUserOrgCache;

var projReadAccess = commonRouter.projReadAccess,
    projWriteAccess = commonRouter.projWriteAccess;

var router = express.Router({mergeParams : true});

router
    .get( '/dataset', controller.getDataset)
    .post('/dataset/savedata', ensureAuth, projWriteAccess, uploadsController.validateAndStoreData)
    .post('/dataset/data', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.saveDataToProject)
    .post('/dataset/dsattrs', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.updateDatasetAttrs)
    .post('/dataset/bake_groups', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.bakeGroups)
    .post('/dataset/gen_attr', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.addAttributeToDataset);

router.post('/dataset/datapoints/update_attr_cat_names', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.updateAttrCategoriesForDataset);

router
    .get('/networks', controller.getAllNetworks)
    .get('/networks/:nwid([0-9a-fA-F]{24})', controller.getNetwork)
    .post('/networks/:nwid([0-9a-fA-F]{24})', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.updateNetwork)
    .post('/networks/:nwid([0-9a-fA-F]{24})/gen_attr', ensureAuth, projWriteAccess, cleanUserOrgCache, controller.addAttributeToNetwork)
    .delete('/networks/:nwid([0-9a-fA-F]{24})', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.deleteNetwork)

    .post('/networks/:nwid([0-9a-fA-F]{24})/nwattrs', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.updateNetworkAttrs)
    .post('/networks/:nwid([0-9a-fA-F]{24})/sub_graph', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.createNetworkFromSubGraph);

router.post('/networks/:nwid([0-9a-fA-F]{24})/nodes/update_attr_cat_names', ensureAuth, projWriteAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.updateAttrCategoriesForNetworkNodes);

router.post('/nwdownload', ensureAuth, projReadAccess, controller.downloadNetworksData);
router.post('/changescope', ensureAuth, projReadAccess, projUpdater.updateLastModified, controller.changeAttrsScope);


module.exports = router;