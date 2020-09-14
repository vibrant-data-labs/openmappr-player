'use strict';

var _ = require('lodash'),
    express = require('express');

var controller    = require('./org_controller'),
    commonRouter  = require('../common/common_routers'),
    user_controller = require('../user/user_controller');



var ensureAuth        = commonRouter.ensureAuthenticated,
    cleanUserOrgCache = commonRouter.cleanUserOrgCache;


var router = express.Router({mergeParams : true});

// list all orgs for the given user
// ?projectId={{pid}} only provide org which contain this project
router.get("/", ensureAuth, controller.getOrgs);

var orgRoute = router.route('/:oid');
// /:oid routes
orgRoute
    .get(ensureAuth, readAccess, controller.readDoc)
    // .post(ensureAuth, writeAccess, controller.updateDoc)
    // .put(ensureAuth, writeAccess, controller.updateDoc)
    // .delete(ensureAuth, ensureAdminAccess, controller.deleteDoc);
    .delete(controller.deleteOrg);

router.get('/:oid/accept/:inviteToken', cleanUserOrgCache, user_controller.acceptOrgInvite);

router.get('/:oid/projectsDetails', ensureAuth, readAccess, controller.readOrgProjectsDetails);
router.get('/:oid/surveysDetails', ensureAuth, readAccess, controller.readOrgSurveysDetails);
router.get('/:oid/profile', controller.readOrgPublicDetails);
router.post('/:oid/user', cleanUserOrgCache, controller.addUserToOrg);

/// Permission MGMT

//LEVEL 2 AUTHORIZATION
// function adminAccess (req, res, next) {
//  if(req.user.role.bitMask === 4){
//      console.log('[org_router] admin access granted to ' + req.user.email);
//      next();
//  } else {
//      res.json(403);
//  }
// }

function readAccess (req, res, next) {
    if(_.some(req.org.users.members, elem => elem.ref === req.user.id )) {
        // console.log('[org_router] View access granted to user: ' + req.user.email);
        next();
    } else {
        // console.log('[org_router] View access denied to user: ' + req.user.email);
        res.send(403);
    }
}

// function writeAccess (req, res, next) {
//  if( _.filter(
//          req.org.users.members,
//          function(member){
//              return ((member.ref === req.user._id.toHexString()) && (member.permission === 'isEditor'));
//          }
//      ))
//  {
//      console.log('[org_router] edit access granted to editor: ' + req.user.email);
//      next();
//  } else {
//      res.json(403);
//  }
// }

// function deleteAccess (req, res, next) {
//  if(req.org.owner.ref === req.user._id.toHexString()){
//      console.log('[org_router] deletion access granted to owner: ' + req.user.email);
//      next();
//  } else {
//      res.json(403);
//  }
// }
module.exports = router;
