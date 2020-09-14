'use strict';
var _ = require('lodash');

var projModel = require("./proj_model.js"),
    userModel = require('../user/user_model'),
    orgModel = require('../org/org_model'),
    projCloner = require('./proj_cloner'),
    projDeleter = require('./proj_deleter'),
    DSModel = require("../datasys/datasys_model"),
    elasticSearchService = require('../services/elasticsearch'),
    logPrefix = '[projectController] ';

// function projSaveCallback(err, projDoc, numbersAffected, fileId, req, res) {
//     if (err) {
//         res.json(500, 'project save err - ' + err);
//         console.log('[projController.addDataToProjectVersion] Database Error: could not update project');
//     } else {
//         console.log('[projController.addDataToProjectVersion] Success');
//         //update org
//         var index = 0;
//         if (typeof req.org.dataPipes === "undefined" || req.org.dataPipes.length === 0) {
//             req.org.dataPipes = [];
//         } else {
//             index = req.org.dataPipes[req.org.dataPipes.length - 1].num + 1;
//         }
//         //change num to id and use short UID
//         req.org.dataPipes.push({
//             num: index, //last data pipe num + 1
//             sourceType: 'staticfile',
//             transformer: 'gexfparser',
//             dataSetRef: fileId,
//             isDataChunked: true
//         });
//         req.org.save(function(err, orgDoc, numbersAffected) {
//             if (err) {
//                 console.log('org saved in mongo');
//             }
//             res.json(200, fileId);
//         });
//     }
// }
// update user and org post project creation
function postProjectCreate(user, org, projDoc) {
    var newProj = {
        ref: projDoc._id,
        projName: projDoc.projName,
        picture: projDoc.picture,
        owner: {
            ref: projDoc.owner.ref
        },
        members: projDoc.users.members,
        dateModified: projDoc.dateModified,
        lastViewed: {
            userRef: projDoc.lastViewed.userRef,
            date: projDoc.lastViewed.date
        }
    };

    //update org
    org.projects.push(newProj);

    return org.save()
        .catch(err => console.error('[proj_controller.postProjectCreate] Project created but could not update org. ', err))
        .then(function() {
            user.projects.push({
                ref: projDoc._id,
                org: org._id,
                owner: projDoc.owner,
                permission: 'isOwner',
                projName: projDoc.projName,
                dateJoined: Date.now()
            });
            return user.save();
        })
        .catch(err => console.error('[proj_controller.postProjectCreate] Project created but could not update user (owner). ', err));
}


module.exports = {

    // listAll: function(req, res) {
    //  //admin only
    //  module.exports.authorizeEntityAdminAccess(req, res, function() {
    //      projModel.listAll(function(err, docs) {
    //          if (err) {
    //              console.log('[projController.listAll] error');
    //              res.status(500, err);
    //          } else {
    //              console.log('[projController.listAll] num of proj found: ' + docs.length);
    //              res.status(200).send(docs);
    //          }
    //      });
    //  });
    // },

    create: function(req, res) {
        var p = req.body;
        console.log('[proj_controller.create] Creating new project');

        var newProj = {};

        //required params
        newProj.projName = p.projName || 'Untitled Map'; //name required
        newProj.org = {
            ref: req.org._id
        };
        newProj.owner = {
            ref: req.user._id
        };
        newProj.lastViewed = {
            userRef: req.user._id
        };

        //optional params
        if (p.descr) newProj.descr = p.descr;
        if (p.picture) newProj.picture = p.picture;
        if (p.tags) newProj.tags = p.tags;

        projModel.add(newProj, function(err, projDoc) {
            if (err) {
                console.error('[proj_controller.create] Error creating project. ', err);
                return res.status(500).send('Error: Unable to create new project. ' + err);
            }

            console.log('[proj_controller.create] project created : ' + projDoc.projName);
            //console.log(projDocs);

            postProjectCreate(req.user, req.org, projDoc)
                .finally(() => res.status(200).json(projDoc));
        });
    },
    clone: function(req, res) {
        projCloner.clone(req.project, req.user, req.org)
            .then(function(projDoc) {
                console.log('[proj_controller.clone] project cloned : ' + projDoc.projName);

                return postProjectCreate(req.user, req.org, projDoc)
                    .finally(() => res.status(200).json(projDoc));

            }).caught(function(err) {
                err = err.stack || err;
                console.error('[proj_controller.clone] ' + "Error in Importing. ", err);
                res.send(500, err);
            });
    },

    cloneToOrg: function(req, res) {
        var p = req.body,
            newOrg = null,
            projToMove = null,
            logPrefix = '[proj_controller: cloneToOrg ] ';

        console.log(logPrefix + 'start');
        orgModel.listByIdAsync(p.newOrg)
        .then(newOrgDocs => {
            newOrg = newOrgDocs;
            console.log(logPrefix + 'starting project clone');
            return projCloner.clone(req.project, req.user, newOrgDocs);
        })
        .then(projDocs => {
            projToMove = projDocs;
            console.log(logPrefix + 'project cloning half done');
            console.log(logPrefix + 'starting postProjectCreate');
            return postProjectCreate(req.user, newOrg, projDocs);
        })
        .then(() => {
            console.log(logPrefix + 'postProjectCreate finished');
            console.log(logPrefix + 'project cloned to ' + newOrg.orgName + ' successfully.');
            res.status(200).send(projToMove);
        })
        .catch(function(err) {
            console.log(logPrefix + 'error in cloning project to ' + newOrg.orgName + '.');
            res.status(500).send(err);
        });

    },

    readDoc: function(req, res) {
        var ignore_update_for_emails = ['admin@mappr.io'];
        //update user activity
        req.user.lastSignedIn.projId = req.project._id;

        if(!_.contains(ignore_update_for_emails, req.user.email)) {
            // Update read activity in project
            req.project.lastViewed.userRef = req.user._id;
            req.project.lastViewed.date = Date.now();

            var orgProj = _.find(req.org.projects, 'ref', req.project._id.toHexString());
            if(orgProj) {
                orgProj.lastViewed.userRef = req.user._id;
                orgProj.lastViewed.date = Date.now();
            }
            else {
                console.warn(logPrefix + ': readDoc] orgProj not found for proj org ref - ' + req.project.org.ref);
            }
        }
        else {
            console.warn('[projController.readDoc: ] ignoring lastViewed update for user - ' + req.user.email);
        }

        req.org.save()
        .then(() => console.log('Org project updated'))
        .catch(err => {
            console.log('Could not update org project');
            console.error(err);
        });

        req.user.save(function(err) {
            if (err) {
                console.warn("Unable to save last sign in project from user:", err);
            } //not critical data : ignore
            res.status(200).json(req.project);
        });
    },

    updateDoc: function(req, res) {
        var projValsToUpdate = ['projName', 'descr', 'picture', 'tags', 'snapshots'];
        // var logPrefix = '[projController.updateDoc: ] ';
        var proj = req.project,
            user = req.user,
            org = req.org;
        // assign values
        _.assign(proj, _.pick(req.body, projValsToUpdate), (oldVal, newVal) => newVal != null ? newVal : oldVal);

        proj.save(function(err, project) {
            if (err) {
                console.error('Project update failed:', err);
                return res.status(404).send('[projectUpdateErr]:' + err);
            }
            res.status(200);
            if ('projName' in req.body) {
                userModel.updateProjNameAsync(user, proj.id, project.projName)
                    .then(() => orgModel.updateProjNameAsync(org, proj.id, project.projName))
                    .catch((err) => console.warn("[projectUpdateErr]: Unable to update user or org: ", err))
                    .finally(() => res.json(project)); // send the project regardless of the save issues
            } else {
                res.json(project);
            }
        });
    },

    updateProjSettings: function(req, res) {
        var logPrefix = '[projController.updateProjSettings: ] ';

        var p = req.body;
        // Send complete settings from client
        console.log('Old Project Settings - ', req.project.settings);
        req.project.settings = p.updatedSettings;

        req.project.save(function(err, project) {
            if (err) {
                console.error(logPrefix + 'Project settings could not be updated');
                console.error(logPrefix + 'Project Id - ' + req.project._id);
                res.status(500).send(err);
            } else {
                console.log(logPrefix + 'Project settings updated');
                console.log(project.settings);
                res.status(200).json(req.project.settings);
            }
        });
    },

    deleteDoc: function(req, res) {
        var projectId = req.params.projectId;
        var allDel = projDeleter.delete(projectId, req.user, req.org, true);
        allDel.finally(() => res.status(200).send(projectId));
    },

    reIndexProjForES: function(req, res){
        console.log(req.params.pid);
        if(!req.params.pid) {
            res.status(400).json({result: "need project id to perform reindexing"});
        }

        projModel.listById(req.params.pid, function(err, docs) {
            if(err) {
                return res.status(404).send("Error: project not found: ", err);
            }
            if (!docs || !docs._id) {
                console.log(logPrefix + 'Project [id: ' + req.params.pid + '] not found!');
                res.status(404).send("Error: Project not found");
            } else {
                console.log(logPrefix + 'Project [id: ' + req.project._id + '] found!');
                var proj = docs;
                if (proj.dataset && proj.dataset.ref) {
                    var dsId = proj.dataset.ref;
                    DSModel.readDataset(dsId)
                        .then(function(dataset) {
                            elasticSearchService.storeDataSet(dataset.id, dataset.attrDescriptors, dataset.datapoints, function(err) {
                                if (err) {
                                    console.warn(logPrefix + "reIndexDataset : error storing data to elasticsearch", err);
                                    return res.status(400).json(err.stack || err);
                                }
                                console.log(logPrefix + "reIndexDataset : successfully stored data to elasticsearch");
                                res.status(200).json({
                                    datasetId: dsId,
                                    result: "successfully index dataset"
                                });
                            });
                        });
                } else {
                    res.status(400).json({
                        result: "unable to locate project dataset"
                    });
                }
            }
        });
    }

	// reIndexCurrProjForES: function(req, res) {
	// 	var proj = req.project;
	// 	if (proj.dataset && proj.dataset.ref) {
	// 		var dsId = proj.dataset.ref;
	// 		DSModel.readDataset(dsId)
	// 			.then(function(dataset) {
	// 				elasticSearchService.storeDataSet(dataset.id, dataset.attrDescriptors, dataset.datapoints, function(err, result) {
	// 					if (err) {
	// 						console.warn(logPrefix + "reIndexDataset : error storing data to elasticsearch", err);
	// 						return res.status(400).json(err.stack || err);
	// 					}
	// 					console.log(logPrefix + "reIndexDataset : successfully stored data to elasticsearch");
	// 					res.status(200).json({
	// 						datasetId: dsId,
	// 						result: "successfully index dataset"
	// 					});
	// 				});
	// 			});
	// 	} else {
	// 		res.status(400).json({
	// 			result: "unable to locate project dataset"
	// 		});
	// 	}
	// }
};
