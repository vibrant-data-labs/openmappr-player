'use strict';

var Promise = require('bluebird'),
    assert = require('assert'),
    _ = require('lodash');

var dataSetModel = Promise.promisifyAll(require("../models/dataSetModel.js")),
    DSModel = require("../datasys/datasys_model"),
    userModel = require("../user/user_model.js"),
    orgModel = require("../org/org_model.js"),
    db = require('../schemas'),
    db_old = require('../db_old.js');


function migrateProject(useremail, orgName, projectId) {
    // check if  user, org exist in the new project. If not, then migrate them as well
    // for the project, need to migrate version / players to the new schema
    console.log("Migrating project with id: ", projectId);
    return loadOrgAndUser(useremail, orgName)
        .spread(function(user, org) {
            console.log("Loaded User:", user);
            console.log("Loaded Org:", org);

            console.assert(user._id, "User should have an id");
            console.assert(org._id, "Org should have an id");

            console.assert(user.email === useremail, "User should correct email:" + user.email);
            console.assert(org.orgName === orgName, "org should have correct name: " + org.orgName);
            var projectP = migrateProjectObject(projectId, user, org._id);
            return projectP.then(function(projDoc) {
                console.log("Adding project to the user and org models");
                var newProj = {
                    ref: projDoc._id,
                    projName: projDoc.projName,
                    picture: projDoc.picture,
                    owner: {
                        ref: projDoc.owner.ref
                    },
                    members: projDoc.users.members,
                    dateModified: projDoc.dateModified
                };
                org.projects.push(newProj);
                user.projects.push({
                    ref: projDoc._id,
                    org: org._id,
                    owner: projDoc.owner,
                    permission: 'isOwner',
                    projName: projDoc.projName,
                    dateJoined: Date.now()
                });
                return Promise.join(user.saveAsync(), org.saveAsync(), function() {
                    console.log("User and org successfully updated");
                    return projDoc;
                });
            });
        });
}
// returns a promise containing and array of 2 elems. 0-> user, 1-> org
function loadOrgAndUser(useremail, orgName) {
    console.log("Trying to Load org: ", orgName);
    console.log("Trying to Load user: ", useremail);

    return orgModel.listByOrgNameAsync(orgName)
        .then(function(org) {
            console.log("Org found in new database:", org);
            return Promise.all([userModel.listByEmailAsync(useremail), org]);
        })
        .error(function() {
            // no org found
            console.log("No Org found. creating a new one for user: ", useremail);
            var userP = userModel.listByEmailAsync(useremail)
                .error(function() {
                    console.log("No User found. migrating the old one");
                    return migrateUser(useremail);
                });

            return userP.then(function(user) {
                console.log("Migrating older org for the user: ", user.email);
                return Promise.all([user, migrateOrg(orgName, user)]);
            })
            .spread(function(user, org) {
                user.orgs.push({
                    ref: org._id,
                    owner: {
                        ref: user._id
                    },
                    orgName: org.orgName,
                    role: 'isOwner',
                    isPending: false,
                    dateJoined: Date.now()
                });
                return user.saveAsync().get(0).then(function(user) {
                    console.log("Org added to the user object and saved!");
                    // console.log("Saved User: ", user);
                    return [user, org];
                });
            });
        })
        .tap(function() {
            // console.log("Loaded array:", userOrg);
        });
}

function migrateUser(email) {
    return new Promise(function(resolve, reject) {
        console.log("Migrating user with email:", email);

        db_old.user().findOne({
            "email": email
        }).exec(function(err, oldUser) {
            if (err) {
                console.error("Unable to find user with email: ", email);
                console.error("Got Error", err);
                throw new Error("User doesn't exist in old db: " + err);
            }
            if (!oldUser) {
                console.error("Couldn't find the user with the email: ", email);
                throw new Error("User with the given email does not exist in the db");
            }
            // migrate him to new self
            console.log("Found the old user", oldUser);
            var oldUsrObj = oldUser.toObject();
            delete oldUsrObj.orgs;
            delete oldUsrObj.projects;
            oldUsrObj.orgs = [];
            oldUsrObj.projects = [];
            console.log("Generating new user from obj:", oldUsrObj);
            assert(oldUsrObj._id && oldUsrObj._id.toString().length > 0, "_id should exist");
            var newUser = new db.User(oldUsrObj);
            newUser.save(function(err, usrDoc) {
                if (err) {
                    console.log('Database Error: could not add new user', err);
                    reject(err);
                } else {
                    console.log('Successfully created new user: ');
                    resolve(usrDoc);
                }
            });
        });
    });
}

function migrateOrg(orgName, userDoc) {
    return new Promise(function(resolve, reject) {
        console.log("Migrating org with name: ", orgName);
        db_old.org().findOne({
            'orgName': orgName
        }).exec(function(err, oldOrg) {
            if (err) {
                console.error("Unable to find org with name: ", orgName);
                console.error("Got Error", err);
                throw new Error("Org doesn't exist in old db" + err);
            }
            if (!oldOrg) {
                console.error("Couldn't find the org with the name: ", orgName);
                throw new Error("Org with the given name does not exist in the db");
            }
            // migrate it to new self
            console.log("Found the old org", oldOrg);
            var oldOrgObj = oldOrg.toObject();
            delete oldOrgObj.players;
            delete oldOrgObj.dataPipes;
            delete oldOrgObj.surveyTemplates;
            delete oldOrgObj.projects;

            oldOrgObj.surveyTemplates = [];
            oldOrgObj.projects = [];
            oldOrgObj.owner = {
                ref: userDoc.id
            };
            oldOrgObj.user = {
                members: [],
                pending: []
            };

            assert(oldOrgObj._id && oldOrgObj._id.toString().length > 0, "_id should exist");
            oldOrgObj.users.members.push({
                ref: userDoc._id,
                name: userDoc.name,
                email: userDoc.email,
                role: 'isOwner',
                dateJoined: Date.now()
            });
            console.log("Generating new org from obj:", oldOrgObj);
            var newOrg = new db.org(oldOrgObj);
            newOrg.save(function(err, orgDoc) {
                if (err) {
                    console.log('Database Error: could not add new org', err);
                    reject(err);
                } else {
                    console.log('Organization successfully migrated!. Id ', orgDoc.id);
                    resolve(orgDoc);
                }
            });
        });
    });
}

function migrateProjectObject(projectId, owner, orgId) {
    console.log("loading project from old db with id: ", projectId);
    var ownerId = owner.id;
    return new Promise(function(resolve, reject) {
        db_old.proj()
            .findOne({
                "_id": projectId
            })
            .exec(function(err, projDoc) {
                if (err) {
                    console.error("Unable to load project from db: ", err);
                    throw new Error(err);
                }
                if (!projDoc) {
                    console.log("No project found for Id: ", projectId);
                    throw new Error("No project found for Id: " + projectId);
                }
                // migrate player and versions and update snapshots with def network
                if (projDoc.dataset || projDoc.networks) {
                    console.log("Found a new style project for Id", projectId);
                    console.log("Can't migrate!");
                    throw new Error("Project is of new type, can't migrate");
                }
                console.log("Project found in old database", projDoc);

                var migratedData = migrateData(projDoc);
                var migratedPlayer = migratedData.then(function() {
                    return migratePlayer(projDoc, orgId, projDoc.id);
                });

                Promise.join(migratedData, migratedPlayer, function(data) {
                    var oldProjObj = projDoc.toObject();
                    delete oldProjObj.versions;
                    delete oldProjObj.layers;
                    delete oldProjObj.pins;
                    delete oldProjObj.activity;
                    delete oldProjObj.trash;

                    oldProjObj.org = {
                        ref: orgId
                    };
                    oldProjObj.owner = {
                        ref: ownerId
                    };

                    _.each(oldProjObj.snapshots, function(snap) {
                        snap.networkId = data.network.id;
                        snap.author = {
                            ref: ownerId
                        };
                    });
                    oldProjObj.dataset = {
                        ref: data.dataset.id
                    };
                    oldProjObj.networks = [{
                        ref: data.network.id
                    }];
                    oldProjObj.user = {
                        members: [],
                        pending: []
                    };
                    oldProjObj.users.members.push({
                        ref: owner._id,
                        name: owner.name,
                        email: owner.email,
                        role: 'isOwner',
                        dateJoined: Date.now()
                    });

                    var newProj = new db.proj(oldProjObj);
                    console.log("Saving new project: ", newProj);
                    newProj.save(function(err, projDoc) {
                        if (err) {
                            console.error("Unable to save created project!", err);
                            reject(err);
                        }
                        console.log("Project successfully migrated! Id : ", projDoc.id);
                        resolve(projDoc);
                    });
                });
            });
    });
}

function migrateData(project) {
    console.log("Migrating dataset for project: ", project.id);
    console.log("version Array: ", project.versions);
    return dataSetModel.getDataSetByProject(project, 0)
        .then(function(dataset) {
            console.log("Found dataset! :", dataset._id);
            console.log("Generating datagraph and network for this dataset");
            console.log("Graph stats");
            console.log("Node count: ", dataset.data.nodes.length);
            console.log("Edge count: ", dataset.data.edges.length);
            console.log("NodeAttr count: ", dataset.data.nodeAttrs.length);
            console.log("EdgeAttr count: ", dataset.data.edgeAttrs.length);

            var newDs = DSModel.createDatasetFromGraph(dataset.data, project.id, {
                "from": "migrated from older project"
            });
            var newNw = DSModel.createDefaultNetwork(newDs, dataset.data);
            console.log("Dataset have been transformed into new ones. Saving...");
            return Promise.props({
                "dataset": DSModel.saveDataset(newDs),
                "network": DSModel.saveNetwork(newNw)
            }).tap(function() {
                console.log("Dataset and network have been successfully saved!");
            });
        });
}

function migratePlayer(project, orgId, projectId) {
    console.log("Migrating player for project id: ", project.id);
    return new Promise(function(resolve, reject) {
        db_old.player()
            .findOne({
                "project.ref": project.id
            })
            .exec(function(err, oldPlayerDoc) {
                if (err) {
                    console.error("Unable to load player from db: ", err);
                    reject(err);
                }
                if (!oldPlayerDoc) {
                    console.log("No Player found for project :", project.id);
                    resolve(null);
                } else {
                    console.log("Player found on old database: ", oldPlayerDoc);
                    var oldPlayerObj = oldPlayerDoc.toObject();
                    oldPlayerObj.org = {
                        ref: orgId
                    };
                    oldPlayerObj.project = {
                        ref: projectId
                    };
                    delete oldPlayerObj.owner;
                    delete oldPlayerObj.dataSet;
                    delete oldPlayerObj.dataset;
                    delete oldPlayerObj.snapshots;
                    oldPlayerObj.buildVer = "1_0_0";

                    assert(oldPlayerObj._id && oldPlayerObj._id.toString().length > 0, "_id field should exist");
                    console.log("Generating new player from obj:", oldPlayerObj);
                    var newplayer = db.player(oldPlayerObj);
                    newplayer.save(function(err, playerDoc) {
                        if (err) {
                            console.error("Unable to save created player!", err);
                            reject(err);
                        }
                        console.log("Player successfully migrated! PlayerId: ", playerDoc.id);
                        resolve(playerDoc);
                    });
                }
            });
    });
}

module.exports = {
    migrateProject: migrateProject
};