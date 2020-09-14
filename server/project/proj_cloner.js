'use strict';
var Promise = require('bluebird'),
    _           = require('lodash'),
    UIDUtils = require('../services/UIDUtils.js');

var DSModel      = require("../datasys/datasys_model"),
    projModel        = require("../project/proj_model"),
    playerModel      = require("../player/player_model");

// owner is null, then same owner
// org is null, same org
// Does not perform authorizations
function clone(projToClone, owner, org) {
    // Project contains Players / data. Need to shift them as well
    var logPrefix = "[ProjectApi.cloneProject] ";
    console.log(logPrefix + "Cloning project :", projToClone._id);

    console.assert(org, logPrefix + "need valid org");
    console.assert(owner, logPrefix + "need valid owner");

    var newOrg = projToClone.org.ref !== org.id;
    var newOwner = projToClone.owner.ref !== owner.id;

    if(newOwner) { console.log(logPrefix + "Changing ownership to " + owner.id);}
    else { console.log(logPrefix + "Same owner");}
    if(newOrg) { console.log(logPrefix + "Changing organization to " + org.id);}
    else { console.log(logPrefix + "Same organization");}

    // clone Project object
    // var clonedProject = _.cloneDeep(projToClone.toObject(), function(val, key) {
    //     return key === "_id" ? "" : undefined;
    // });
    var clonedProject = projToClone.toObject();
    console.log(clonedProject);
    var projToCloneId = projToClone._id;
    delete clonedProject._id;

    if(clonedProject.users) { clonedProject.users.pending = []; }
    clonedProject.trash = [];

    if(newOrg) {
        clonedProject.org = {
            ref: org._id
        };
    }
    else {
        clonedProject.projName = "clone of " + projToClone.projName;
    }

    if(newOwner) {
        var userObj = {
            ref: owner._id
        };

        clonedProject.owner = _.clone(userObj);
        _.each(clonedProject.snapshots, function(snap) {
            snap.author = _.clone(userObj);
        });
        clonedProject.users.members = [];
    }

    var onProjectSave = projModel.addAsync(clonedProject);

    onProjectSave.then(function(proj) { console.log(logPrefix + "Project clone saved with Id:", proj._id); });

    var onProjectClone = onProjectSave.then(function(proj) {

        // clone dataset
        var onDSCloned = Promise.resolve(null);

        if(projToClone.dataset.ref && projToClone.dataset.ref.length > 1) {
            console.log(logPrefix + "Cloning datasets...");
            onDSCloned = DSModel.cloneDataset(projToClone.dataset.ref, proj.id);
        }

        // clone dataset for each version
        var oldNW_newNW_map = {};
        console.log(logPrefix + "Cloning networks...");

        var onNWCloned = onDSCloned.then(function(dataset) {
            return Promise.all(
                _.map(projToClone.networks, function(nw) {
                    return DSModel.cloneNetwork(nw.ref, dataset.id, proj.id)
                        .then(function(network) {
                            // update project with new info
                            oldNW_newNW_map[nw.ref] = network.id;
                            return network;
                        })
                        .catch(function(err) {
                            console.error(logPrefix + "Error in Updating org", err);
                        });

                })
            );
        });
        onNWCloned.tap(function() { console.log(logPrefix + "All networks cloned. Map built:", oldNW_newNW_map); });

        // Clone player
        var onPlayerCloned = onDSCloned.then(function() {
            return playerModel.listByProjectIdAsync(projToCloneId);
        }).then(function(player) {
            console.log(logPrefix + "Cloning %s player...", player.playerUrl);
            var clonedPlayer = player.toObject();
            delete clonedPlayer._id;
            if(!newOrg) {
                // Getting cloned
                clonedPlayer.playerUrl = 'play-' + UIDUtils.generateShortUID4();
                clonedPlayer.metrics = {viewCount:0, likes: 0};
            }
            else {
                // Getting moved to new org
                clonedPlayer.org = {
                    ref: org._id
                };
            }

            clonedPlayer.project = {
                ref: proj._id
            };

            clonedPlayer.dateCreated = Date.now();
            clonedPlayer.dateModified = Date.now();

            return playerModel.addAsync(clonedPlayer);
        });
        onPlayerCloned.tap(function() { console.log(logPrefix + "All players cloned"); });


        // wait for all cloning to happen before returning
        return Promise.join(onDSCloned, onNWCloned, onPlayerCloned).then(function(vals) {
            var DSClone = vals[0],
                NWClones = vals[1];

            // Update project clone with dataset & network refs
            return projModel.listByIdAsync(proj._id)
            .then(function(projClone) {
                projClone.dataset.ref = DSClone.id;

                // Change network refs in project.networks
                projClone.networks = [];
                _.each(NWClones, function(nwClone) {
                    projClone.networks.push({
                        ref: nwClone.id
                    });
                });

                // Change network refs in project.snapshots
                _.each(projClone.snapshots, function(snap) {
                    var newNwId = oldNW_newNW_map[snap.networkId];
                    if(!newNwId) throw new Error('New network id not found in IDs map');
                    snap.networkId = newNwId;
                });

                return new Promise(function(resolve, reject) {
                    projClone.save(function(err, updatedProj) {
                        if(err) reject('Project not updated with refs');
                        else resolve(updatedProj);
                    });
                });

            }).then(function(updatedProj) {
                return updatedProj;
            });

        });
    });

    return onProjectClone;
}

module.exports = {clone};
