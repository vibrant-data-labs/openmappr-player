'use strict';
/**
 */

var _       = require('lodash'),
    projModel = require("./proj_model.js"),
    orgModel = require("../org/org_model.js");

//API
module.exports = {
    updateLastModified: updateLastModified
};

function updateLastModified(req, res, next) {
    var logPrefix = '[proj_updater.updateLastModified: ] ';
    if(_.isEmpty(req.project) || _.isEmpty(req.user)) {
        console.warn(logPrefix + 'some required info is missing to update project last modified');
        console.log(logPrefix + 'Project: ', _.get(req.project, '_id'));
        console.log(logPrefix + 'Org: ', _.get(req.project, 'org.ref'));
        console.log(logPrefix + 'User: ', _.get(req.user, '_id'));
        return next();
    }

    projModel.updateLastModifiedAsync(req.project._id.toString(), req.user._id.toString())
    .then(() => {
        console.log(logPrefix + 'Last modified updated in project for projectId: ' + req.project._id);
        return orgModel.updateProjLastModifiedAsync(req.project.org.ref, req.project._id.toString(), req.user._id.toString());
    })
    .then(() => {
        console.log(logPrefix + 'Last modified updated in org for projectId: ' + req.project._id);
        console.log(logPrefix + 'Last modified updated for project');
    })
    .catch((err) => {
        console.log(logPrefix + 'Last modified could not be updated for project');
        console.error(err);
    })
    .finally(() => {
        next();
    });
}

