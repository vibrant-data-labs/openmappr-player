'use strict';

var express = require('express');

var userController    = require('./user/user_controller'),
    orgController   = require('./org/org_controller'),
    commonRouter  = require('./common/common_routers');

var ensureAuth        = commonRouter.ensureAuthenticated,
    ensureAdminAccess = commonRouter.ensureAdminAccess,
    ensureAdminOrOwnerAccess = commonRouter.ensureAdminOrOwnerAccess,
    cleanUserOrgCache = commonRouter.cleanUserOrgCache;

/// /api/admin routes
var router = express.Router({mergeParams : true});

router
    .get('/users', ensureAuth, ensureAdminAccess, userController.listAll)
    .post('/users/:uid', ensureAuth, ensureAdminAccess, cleanUserOrgCache, userController.updateUser)
    .delete('/users/:uid', ensureAuth, ensureAdminAccess, cleanUserOrgCache, userController.deleteUser);

router
    .get('/orgs', ensureAuth, ensureAdminAccess, orgController.listAll)
    .post('/orgs', ensureAuth, ensureAdminAccess, cleanUserOrgCache, orgController.create)
    .post('/orgs/:oid', ensureAuth, ensureAdminAccess, cleanUserOrgCache, orgController.edit)
    .delete('/orgs/:oid', ensureAuth, ensureAdminAccess, cleanUserOrgCache, orgController.deleteOrg)

    .post('/orgs/:oid/user', ensureAuth, ensureAdminOrOwnerAccess, cleanUserOrgCache, orgController.inviteUserToOrg)
    .post('/orgs/:oid/user/cancelinvite', ensureAuth, ensureAdminOrOwnerAccess, cleanUserOrgCache, orgController.cancelUserInvite)
    .post('/orgs/:oid/user/:uid', ensureAuth, ensureAdminAccess, cleanUserOrgCache, orgController.updateUserOrgRole)
    .delete('/orgs/:oid/user/:uid', ensureAuth, ensureAdminOrOwnerAccess, cleanUserOrgCache, orgController.removeUserFromOrg);


module.exports = router;
