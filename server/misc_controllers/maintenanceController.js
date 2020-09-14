'use strict';
var _        = require('lodash'),
    Promise  = require('bluebird');

var projModel        = require("../project/proj_model"),
    ProjectMigrator  = require('../migrators/Project.js'),
    OldUserHelpers   = require('../migrators/UserHelpers.js'),
    CacheMaster      = require('../services/CacheMaster.js');

///
/// Maintenance scripts
///

/**
 * For each project with more than 1 version, sorts the version array with the latest one at 0, and oldest at the end
 */
function sortVersions (req, res) {
    // Fetch all projects with more than 2 versions
    var logPrefix = "[MaintenanceController.sortVersions] ";

    var projects = projModel.listAllAsync()
    .then(function(allProjects) {
        return _.filter(allProjects, function(p) { return p.versions && p.versions.length > 1; });
    });

    projects.tap(function(projs) { console.log(logPrefix + "Got %s projects with more than 1 version", projs.length); });

    // find out if they need to be sorted. since we push the latest version to the end, we check if the last version is the biggest
    // of them all or not
    projects.then(function(projs) {
        return _.partition(projs, isProjectSorted);
    })
    .spread(function(sorted, unsorted) {
        console.log("Sorted Projects :", sorted.length);
        console.log("UnSorted Projects :", unsorted.length);
        console.assert(_.all(sorted, assertSorting), "Sorted Projects must be sorted");

        var projP = _.map(unsorted, function(proj) {
            proj.versions = sortProjectVersion(proj);
            _.each(proj.versions, function(ver, index) {
                ver.num = index;
            });
            return proj.saveAsync()
            .then(function(proj) {
                return proj[0];
            });
        });
        return Promise.all(projP);
    })
    .then(function(projs) {
        //console.log(logPrefix + "Projs sorted", _.pluck(projs,"versions"));
        res.json(200, "" + projs.length + " sorted");
    }).catch(function(err) {
        res.send(400, err.stack || err);
    });

    function isProjectSorted(p) {
        var sortedArr = sortProjectVersion(p);
        var isSorted = _.all(sortedArr, function(ver, index) { return ver.num === index;});
        return isSorted;
    }
    function assertSorting (project) {
        return _.all(project.versions, function(ver, index) { return ver.num === index; });
    }
    function sortProjectVersion(p) {
        // descending sort
        return _.sortBy(p.toObject().versions, "dateModified").reverse();
    }
}

function migrateProject (req, res) {
    console.log("!!!!!!!!!MIGRATION REQUEST!!!!!!!!!");
    console.log("User Email: ", req.body.email);
    console.log("Org Name: ", req.body.orgName);
    console.log("Project Id: ", req.body.projectId);
    if(!req.body.email || !req.body.orgName || !req.body.projectId)
        res.send(400, "incorrect params given");
    else {
        var postMigrator = ProjectMigrator.migrateProject(req.body.email, req.body.orgName, req.body.projectId);

        postMigrator.then(function(project) {
            console.log("Successfully migrated project with Id: ", project.id);
            var cache = CacheMaster.getForOrgs();
            cache.remove(project.org.ref);
            res.json(200, project);
        })
        .caught(function(err) {
            console.log("Got error in migration:", err);
            var code = 500;
            var msg = err.message || "Something unexpected Happened";
            res.json(code, msg);

        });
    }
}

function listProjectsForEmail (req, res) {
    if(!req.body.email) {
        res.send(400, "Email not given");
    } else {
        OldUserHelpers.fetchOldUser(req.body.email)
        .then(function(oldUser) {
            res.json(200,oldUser.projects);
        })
        .caught(function(err) {
            console.log("Got error in fetching projects for user:", err);
            var code = 500;
            var msg = err.message || "Something unexpected Happened";
            res.json(code, msg);
        });
    }

    console.log("Fetching projects for the user with email:", req.body.email);
}

//API
module.exports = {
    sortVersions : sortVersions,
    migrateProject : migrateProject,
    listProjectsForEmail : listProjectsForEmail
};

