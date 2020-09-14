'use strict';
var _ = require('lodash'),
    Promise = require('bluebird'),
    projDB = require('../schemas/proj_schema');


// Default project settings for new projects
var defProjSettings = {
    theme: 'light',
    //STAGE
    backgroundColor: '#ffffff',//'rgb(255,255,255)',
    labelColor: '#000000',//colorStr([0, 0, 0]),
    labelOutlineColor : '#ffffff' //colorStr([255, 255, 255]),
};

var api = {
    listAll: function(callback) {
        return projDB.find({}, function(err, docs) {
            if (err) {
                callback(err, false);
            } else {
                console.log('[proj_model.listAll]' + docs.length);
                callback(null, docs);
            }
        });
    },

    listById: function(id, callback) {
        console.log('[proj_model.listById] id:' + id);
        return projDB.findById(id, function(err, doc) {
            if (err) {
                console.log('[proj_model.listById] Error: ' + err);
                callback(err, false);
            } else {
                if(!doc) {
                    console.log('[proj_model.listById] Not found Project for Id: ' + id);
                } else {
                    console.log('[proj_model.listById] Success: ' + doc.projName);
                }
                callback(null, doc);
            }
        });
    },
    getOrgId: function (id, callback) {
        console.log('[proj_model.getOrgId] id:' + id);
        return projDB.findById(id, "org", {lean : true}, function (err, doc) {
            if(err) {
                console.warn("[proj_model.getOrgId] Error:", err);
                return callback(err, null);
            }
            if(!doc || !_.get(doc, "org.ref")) {
                console.log("[proj_model.getOrgId] No Project found for Id: ", id, doc);
                callback(new Error(`[proj_model.getOrgId] No Project found for Id: ${id} ${doc}`), null);
            }
            callback(null, doc.org.ref);
        });
    },
    build : function(newProj, callback) {
        newProj.settings = defProjSettings;
        var instance = new projDB(newProj);

        //inject the owner data in proj.users.member[]
        //Design: members list is a complete list of current users with proj access.
        if(!_.any(instance.users.members, usr => usr.ref === newProj.owner.ref )) {
            instance.users.members.push({
                ref:            newProj.owner.ref,
                name:           newProj.owner.name,
                email:          newProj.owner.email,
                permission:     'isOwner',
                dateJoined:     Date.now()
            });
        }

        //timestamp creation
        instance.dateCreated = Date.now();
        instance.dateModified = Date.now();
        callback(null, instance);
    },
    add: function(newProj, callback) {
        this.build(newProj, function(err, instance){
            //timestamp creation
            instance.dateCreated = Date.now();
            instance.dateModified = Date.now();
            instance.lastViewed.date = Date.now();

            instance.save(function(err, result) {
                if (err) {
                    console.log('[proj_model.add] Database Error: could not add new project');
                    callback(err, false);
                } else {
                    console.log('[proj_model.add] Success saving project: ' + result.projName);
                    callback(null, result);
                }
            });
        });
    },

    updateById: function(id, updateParams, callback) {
        console.log('[proj_model.update] Updating project [id: ' + id + ']');
        console.log(updateParams);
        projDB.update({
            _id: id
        }, updateParams, {
            multi: false
        }, function(err, numberAffected, raw) {
            if (err) {
                console.log('[proj_model.update] Error updating : ' + err);
                callback(err, false);
            } else {
                console.log('[proj_model.update] The number of updated documents was %d', numberAffected);
                console.log('[proj_model.update] [id:' + id + ']  The raw response from Mongo was: ', raw);
                callback(null, 'Success: Project updated');
            }
        });
    },

    appendToParamById: function(id, param, dataToAppend, callback) {
        projDB.findOne({_id: id}, function(err, projDocs){
            if(err){
                callback(err, false);
            } else {
                if(projDocs[param] && (projDocs[param] instanceof Array)) {
                    projDocs[param].push(dataToAppend);
                    projDocs.save(function() {
                        console.log('[proj_model.add] appened Project [' + param + '] -> ' + projDocs[param]);
                        callback(null, projDocs);
                    });
                }

            }
        });
    },

    removeById: function(id, callback) {
        //remove dataset from all project versions
        projDB.remove({
            _id: id
        },
        function(err, result) {
            if (err) {
                console.log('[proj_model.RemoveById] Error:' + err);
                callback(err, false);
            } else {
                console.log('' + result + ' document(s) deleted');
                callback(null, '' + result + ' document(s) deleted');
            }
        });
    },

    listCollaborators: function(id, callback) {
        projDB.findById(id, 'mapprs', function(err, doc) {
            if (err) {
                console.log('[proj_model.listCollaborators] Error: ' + err);
                callback(err, null);
            } else {
                var collabList = [];
                collabList.push(doc.mapprs.map_owner.id);
                collabList.push(_.pluck(doc.mapprs.map_editors, 'id'));
                collabList.push(_.pluck(doc.mapprs.map_visitors, 'id'));
                callback(null, _.flatten(collabList));
            }
        });
    },

    listOwner: function(id, callback) {
        projDB.findById(id, 'mapprs', function(err, doc) {
            if (err) {
                console.log('[proj_model.listCollaborators] Error: ' + err);
                callback(err, false);
            } else {
                callback(null, doc.mapprs.map_owner.id);
            }
        });
    },
    updateSnapshot: function(projId, snap, callback) {
        projDB.update({
            _id: projId,
            'snapshots.id':snap.id
        }, {$set:{'snapshots.$':snap}}, { strict: false },
        function(err) {
            if (err) {
                console.log('[proj_model.updateSnapshot] Error updating : ' + err);
                callback(err);
            } else {
                callback(null, snap);
            }
        });
    },

    updateLastModified: function(projId, userRef, callback) {
        projDB.update({
            _id: projId
        },
        {$set: {
            'lastModified.userRef': userRef,
            'lastModified.date': Date.now()
        }},
        {multi: false},
        function(err) {
            if (err) {
                console.log('[proj_model.updateLastModified] Error updating : ' + err);
                callback(err);
            } else {
                callback(null, true);
            }
        });
    },

    updateDataset : function(proj, dataset, callback) {
        console.log("Updating project's datasetId with: ", dataset.id);
        proj.dataset.ref = dataset.id;
        proj.dataset.sourceInfo = dataset.sourceInfo;
        proj.save(callback);
    },
    addNetwork: function(proj, network, callback) {
        console.log("Adding new network to project's networks: ", network.id);
        proj.networks.push({
            ref : network.id
        });
        proj.save(callback);
    },
    addNetworks: function(proj, networks, callback) {
        _.each(networks, function(nw) {
            console.log("Adding new network to project's networks: ", nw.id);
            proj.networks.push({
                ref : nw.id
            });
        });
        proj.save(callback);
    },
    addNetworkIds: function(proj, networkIds, callback) {
        _.each(networkIds, function(nwid) {
            console.log("Adding new network to project's networks: ", nwid);
            proj.networks.push({
                ref : nwid
            });
        });
        proj.save(callback);
    },
    checkUserAccess: function(id, userId, callback){
        this.listCollaborators(id, function(err, collabList){
            var b = _.some(collabList, function(collab){console.log(collab); return (collab==userId);});
            if(!err && b){
                callback(null, true);
            } else {
                callback(null, false);
            }
        });
    }
};
module.exports = Promise.promisifyAll(api);
