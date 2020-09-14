'use strict';
var _ = require('lodash');
var CacheMaster = require('../services/CacheMaster');
/**
 * Common functions across all routers
 */

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        //not logged in
        return res.send(401);
    }
}

function ensureAdminAccess(req, res, next) {
    if (!_isAdmin(req)) {
        console.log('[ROUTE.ensureAdminAccess] access denied: ' + req.route.path);
        return res.send(403);
    }
    return next();
}

function ensureOwnerAccess(req, res, next) {
    if (!_isOrgAdmin(req)) {
        console.log('[ROUTE.ensureOrgAdminAccess] access denied: ' + req.route.path);
        return res.send(403);
    }
    return next();
}

function ensureAdminOrOwnerAccess(req, res, next) {
    if(!_isAdmin(req) && !_isOrgAdmin(req)) {
        console.log('[ROUTE.ensureAdminOrOwnerAccess] access denied: ' + req.route.path);
        return res.send(403);
    }
    return next();
}

function projReadAccess (req, res, next) {
    if(_.filter(req.project.users.members, {ref: req.user._id})){
        // console.log('[proj_router] view access granted to ' + req.user.email);
        next();
    } else {
        res.json(403);
    }
}

function projWriteAccess (req, res, next) {
    if( _.filter(
        req.project.users.members,
        function(member){
            return ((member.ref === req.user._id.toHexString()) && (member.permission === 'member'));
        }
    )) {
        // console.log('[proj_router] edit access granted to ' + req.user.email);
        next();
    } else {
        res.json(403);
    }
}
function cleanUserOrgCache (req, res, next) {
    var usrCache = CacheMaster.getForUsers();
    if(req.user) {
        usrCache.remove(req.user.id);
    }
    if(req.org) {
        usrCache.remove(req.org.id);
    }
    next();
}

function _isAdmin(req) {
    if(req.user.role.bitMask === 4) {
        req.user._isAdmin = true;
        return true;
    }
    else {
        return false;
    }
}

function _isOrgAdmin(req) {
    var orgUser = _.find(req.org.users.members, 'ref', req.user._id.toHexString());
    if(_.isObject(orgUser) && (orgUser.role === 'owner' || orgUser.role === 'isOwner')) {
        req.user._isOwner = true;
        return true;
    }
    else {
        return false;
    }
}

module.exports = {
    ensureAuthenticated,
    ensureAdminAccess,
    ensureOwnerAccess,
    ensureAdminOrOwnerAccess,
    projReadAccess,
    projWriteAccess,
    cleanUserOrgCache
};
