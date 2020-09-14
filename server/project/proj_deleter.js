'use strict';
var _ = require('lodash'),
    Promise = require("bluebird");

var projModel = require("./proj_model.js"),
    playerModel = require("../player/player_model.js"),
    DSModel = require("../datasys/datasys_model");


function deleteProject(projectId, user, org, shouldSaveUserOrg) {
    var logPrefix = "[proj_deleter] ";
    console.log(logPrefix + "starting to delete project: ", projectId);

    // remove players
    var playerDelete = playerModel.listByProjectIdAsync(projectId)
        .then(player => playerModel.removeByIdAsync(player._id))
        .catch(function(err) {
            console.warn("Unable to delete player for the project: " + projectId, err);
            return null;
        });

    // delete datasets and networks
    var onDataDel = projModel.listByIdAsync(projectId)
        .then(function(proj) {
            if (!proj) {
                return Promise.reject(new Error(logPrefix + "Not found any project with id: " + projectId));
            }
            // delete all datasets
            var onDSDeletion = Promise.resolve(null);
            if (proj.dataset.ref && proj.dataset.ref.length === 24) {
                console.log(logPrefix + "Deleting dataset :", proj.dataset.ref);
                onDSDeletion = DSModel.removeDatasetById(proj.dataset.ref);
            }
            // delete all networks
            var onNWDeletion = Promise.resolve(null);
            if (proj.networks && proj.networks.length > 0) {
                onNWDeletion = Promise.all(proj.networks.map(function(nw) {
                    console.log(logPrefix + "Deleting network :", nw.ref);
                    return DSModel.removeNetworkById(nw.ref).reflect();
                }));
            }

            var onDataDeletion = Promise.join(onDSDeletion, onNWDeletion, function() {
                console.log(logPrefix + "dataset and networks deleted");
            }).catch(function(err) {
                console.error(logPrefix + "Error in deleting dataset:", err.stack || err);
            });

            return onDataDeletion
                .finally(function() {
                    //remove project document
                    console.log(logPrefix + "Removing Project object...");
                    return projModel.removeByIdAsync(proj._id);
                    // if removal successful, respond well
                });
        })
        .catch(err => {
            console.error(err);
            throw err;
        });

    // update user / org
    console.log(logPrefix + "Removing project from User and Org...");
    user.projects = _.filter(user.projects, pr => pr.ref !== projectId);
    org.projects = _.filter(org.projects, pr => pr.ref !== projectId);

    var onUsrOrgUpdate = Promise.resolve(null);
    if (shouldSaveUserOrg) {
        onUsrOrgUpdate = Promise.join(user.save(), org.save(), _.constant(null));
    }

    onUsrOrgUpdate
        .catch(function(err) {
            console.error(logPrefix + 'Error in updating User || Org', err.stack || err);
            throw err;
        });

    var allDel = Promise.all([playerDelete, onDataDel, onUsrOrgUpdate].map(p => p.reflect()))
        .each(function(inspection) {
            if (!inspection.isFulfilled()) {
                console.error("A promise in the array was rejected with", inspection.reason());
            }
        });
    return allDel;
}
module.exports = {
    delete: deleteProject
};
