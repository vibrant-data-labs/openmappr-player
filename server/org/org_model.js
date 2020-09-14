'use strict';
var _       = require('lodash'),
    Promise = require('bluebird'),
    orgDB   = require('../schemas/org_schema'),
    CacheMaster = require('../services/CacheMaster');

var cache = CacheMaster.getForOrgs();


var api = {
    listAll: function(callback) {
        // console.log('[org_model.findAll]');
        return orgDB.find({}, function(err, docs) {
            if (err) {
                console.log('[org_model.listAll] Database Error');
                callback(err, false);
            } else {
                callback(null, docs);
            }
        });
    },
    cache : function() { return cache; },

    listById: function(id, callback) {
        cache.get(id)
        .then(function(o) {
            callback(null, o);
        })
        .catch(CacheMaster.ItemNotFound, function() {
            orgDB.findOne({
                _id: id
            }, function(err, docs) {
                if (err) {
                    console.log('[org_model.listById] Error: ' + err);
                    return callback(err, false);
                }
                if(!docs) {
                    console.log('[org_model.listById] On organization for found. id: ' + id);
                    return callback('[org_model.listById] On organization for found. id: ' + id, null);
                }
                console.log('[org_model.listById] Success: ', docs.id);
                cache.insert(docs.id, docs);
                callback(null, docs);
            });
        });
    },
    updateProjName: function(org, projRef, newName, callback) {
        cache.remove(org.id);
        var orgProj = _.find(org.projects, 'ref', String(projRef));
        if(orgProj) {
            orgProj.projName = newName;
            // Save org
            return org.save().asCallback(callback);
        } else {
            return Promise.resolve(org).asCallback(callback);
        }
    },

    listByOrgName: function(orgName, callback) {
        // console.log('[org_model.listByOrgName] find orgName: ' + orgName);
        return orgDB.findOne({
            'orgName': orgName.toLowerCase()
        }, function(err, docs) {
            if (err) {
                console.log('[org_model.listByOrgName] Error: ' + err);
                return callback(err);
            }
            if(!docs) {
                console.log('[org_model.listByOrgName] No organization found with name: ' + orgName);
                return callback(new Error('[org_model.listByOrgName] No organization found with name: ' + orgName));
            }

            console.log('[org_model.listByOrgName] ' + orgName + ' found');
            callback(null, docs);
        });
    },

    updateProjLastModified: function(orgId, projId, userRef, callback) {
        orgDB.update({
            _id: orgId,
            'projects.ref': projId
        },
        {$set: {
            'projects.$.lastModified.userRef': userRef,
            'projects.$.lastModified.date': Date.now()
        }},
        {multi: false},
        function(err) {
            if (err) {
                console.log('[proj_model.updateProjLastModified] Error updating : ' + err);
                callback(err);
            } else {
                callback(null, true);
            }
        });
    },

    listByUserId: function(id, callback) {
        console.log('[org_model.listByUser] User Id: ' + id);
        return orgDB.find({
            'users.members.id': id
        }, function(err, docs) {
            if (err) {
                console.log('[org_model.listByUser] Error: ',err);
                callback(err, false);
            } else if(!docs || docs.length === 0) {
                console.log('[org_model.listByUser] Email not found!');
                callback(null, []);
            } else {
                console.log('[org_model.listByUser] ' + docs.length + ' org[s] found');
                callback(null, docs);
            }
        });
    },

    removeById: function(id, callback) {
        cache.remove(id);
        this.listById(id, function(err) {
            if (err) {
                callback(err);
            } else {
                orgDB.remove({
                    _id: id
                },
                function(err, result) {
                    if (err) {
                        console.log('[OrgModel.RemoveById] Error:' + err);
                        callback(err, false);
                    } else {
                        console.log('' + result + ' document(s) deleted');
                        callback(null, result);
                    }
                });
            }
        });
    },

    add: function(newOrg, callback) {
        console.log('[org_model.add]' + JSON.stringify(newOrg));
        newOrg.orgName = newOrg.orgName.toLowerCase();
        this.listByOrgName(newOrg.orgName, function(err) {
            if (err) {
                new orgDB(newOrg).save(function(err, docs) {
                    if (err) {
                        console.log('[org_model.add] Database Error: could not add new org');
                        callback(err);
                    } else {
                        console.log('[org_model.add] Success: ');// + JSON.stringify(docs));
                        callback(null, docs);
                    }
                });
            } else {
                console.log('[org_model.add] Org Name already exists');
                callback('OrgAlreadyExists');
            }
        });
    }
};
module.exports = Promise.promisifyAll(api);
