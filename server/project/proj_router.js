'use strict';

var _ = require('lodash'),
    express = require('express');

var controller    = require('./proj_controller'),
    projUpdater = require('./proj_updater'),
    commonRouter  = require('../common/common_routers');


var ensureAuth        = commonRouter.ensureAuthenticated,
    ensureOwnerAccess = commonRouter.ensureOwnerAccess,
    cleanUserOrgCache = commonRouter.cleanUserOrgCache;


var router = express.Router({mergeParams : true});

// post to /projects creates them
router
    .post('/',ensureAuth, createAccess, cleanUserOrgCache, controller.create)
    .delete('/:projectId([0-9a-fA-F]{24})', ensureAuth, cleanUserOrgCache, controller.deleteDoc);

var projRoute = router.route('/:pid([0-9a-fA-F]{24})');
// /:pid routes
projRoute
    .get(ensureAuth, readAccess,  controller.readDoc)
    .post(ensureAuth, writeAccess, cleanUserOrgCache, projUpdater.updateLastModified, controller.updateDoc);

router.post('/:pid/clone', ensureAuth, writeAccess, cleanUserOrgCache, controller.clone);
router.post('/:pid/cloneToOrg', ensureAuth, ensureOwnerAccess, cleanUserOrgCache, controller.cloneToOrg);
router.post('/:pid/settings', ensureAuth, writeAccess, projUpdater.updateLastModified, controller.updateProjSettings);
router.post('/:pid/reindex', ensureAuth, writeAccess, controller.reIndexProjForES);


// {
//     path: '/api/orgs/:oid([a-z0-9]{24})/projects/:pid([a-z0-9]{24})/cloneToOrg',
//     httpMethod: 'POST',
//     middleware: [ensureAuthenticated, projController.cloneToOrg]
// },

//LEVEL 2 AUTHORIZATION
// function adminAccess (req, res, next) {
//     if(req.user.role.bitMask === 4){
//         console.log('[proj_router] admin access granted to ' + req.user.email);
//         next();
//     } else {
//         res.send(403);
//     }
// }

function readAccess (req, res, next) {
    if(req.org._id.toHexString() != req.project.org.ref ) {
        console.warn('[proj_router: ] org id doesn\'t match project\'s org id');
        return res.send(403);
    }
    if((_.find(req.user.orgs, 'ref', req.project.org.ref)) || req.user.role.bitMask === 4) {
        console.log('[proj_router] view access granted to ' + req.user.email);
        next();
    } else {
        res.send(403);
    }
}

function createAccess (req, res, next) {
    if( _.filter(
            req.org.users.members,
            function(member){
                return ((member.ref === req.user._id.toHexString()) && (member.permission === 'isEditor'));
            }
        ))
    {
        console.log('[proj_router] create project access granted to editor: ' + req.user.email);
        next();
    } else {
        res.send(403);
    }
}

function writeAccess (req, res, next) {
    if( _.filter(
        req.project.users.members,
        function(member){
            return ((member.ref === req.user._id.toHexString()) && (member.permission === 'isEditor'));
        }
    )) {
        console.log('[proj_router] edit access granted to ' + req.user.email);
        next();
    } else {
        res.send(403);
    }
}

// function deleteAccess (req, res, next) {
//     if(req.project.owner.ref === req.user._id.toHexString()){
//         console.log('[proj_router] deletion access granted to ' + req.user.email);
//         next();
//     } else {
//         res.send(403);
//     }
// }

module.exports = router;
