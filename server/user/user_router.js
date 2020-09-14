'use strict';

var express = require('express');

var controller    = require('./user_controller'),
    commonRouter  = require('../common/common_routers');


const USER_IDENT = '/:uid';

var ensureAuth        = commonRouter.ensureAuthenticated,
    cleanUserOrgCache = commonRouter.cleanUserOrgCache;

/// /api/users routes
var router = express.Router({mergeParams : true});

// /api/users/:uname Not sure if it is used
router.get('/:uname', ensureAuth, readAccess, controller.readDoc);

// /api/users/:uid
var user = router.route(USER_IDENT);

// /:uid routes
user
    .get(ensureAuth, readAccess,  controller.readDoc)
    .post(ensureAuth, cleanUserOrgCache, controller.updateProfile);
    // .delete(ensureAuth, ensureAdminAccess, controller.deleteDoc);

router.post(USER_IDENT + '/updateAuthInfo', ensureAuth, cleanUserOrgCache, controller.updateAuthInfo);

// /:uid/org routes
router.get(USER_IDENT + '/org', ensureAuth, readAccess, controller.listUserOrgs);

// /:uid/projects
router.get(USER_IDENT + '/projects', ensureAuth, readAccess, controller.listUserProjects);



/// Permission MGMT

//LEVEL2 AUTHORIZATION
// function adminAccess (req, res, next) {
//     if(req.user.role.bitMask === 4){
//         console.log('[user_routes] admin access granted to ' + req.user.email);
//         next();
//     } else {
//         res.json(403);
//     }
// }

function readAccess (req, res, next) {
    if(req.user){
        console.log('[user_routes] view access granted to ' + req.user.email);
        next();
    } else {
        res.json(403);
    }
}

// function writeAccess (req, res, next) {
//     if(req.user){
//         console.log('[user_routes] edit access granted to ' + req.user.email);
//         next();
//     } else {
//         res.json(403);
//     }
// }

// function deleteAccess (req, res, next) {
//     if(false){
//         //user documents can be deleted only by the Mappr Admins at this point
//     } else {
//         res.json(403);
//     }
// }

module.exports = router;
