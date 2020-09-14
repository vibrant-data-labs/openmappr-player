/*eslint-env node, es6 */
/*eslint no-undef:2*/
"use strict";
var 
    Promise         = require('bluebird'),
    _                = require('lodash'),
    fs               = require('fs'),
    mongoose         = require('mongoose'),
    ObjectID         = require('mongodb').ObjectID,
    streamifier = require("streamifier"),
    assert           = require('assert');

var DSModel = require("../server/datasys/datasys_model"),
    ProjModel = require("../server/project/proj_model"),
    OrgModel = require('../server/org/org_model'),
    UserModel = require('../server/user/user_model'),
    playerModel = require("../server/player/player_model.js"),
    deleteProject = require("../server/project/proj_deleter").delete,
    gfs = require('../server/schemas/gfs_schema.js'),
    AppConfig = require('../server/AppConfig');

var config = AppConfig.init()

Promise.longStackTraces();

mongoose.Promise = Promise;

// Connection URL
var url = _.get(config, 'mongo.connectionUrl');
mongoose.connect(url, { promiseLibrary : Promise });

mongoose.connection.once('open', function() {
    console.log("Connected to Mongo");
    // Promise.mapSeries([
    //     "56998c07a2390d272782a7d3",
    //     "56998d42a2390d272782a7ec",
    //     "563e2ceded6443ea14676698",
    //     "56ad1162ab0332be7590ad4f"], removeProject);
    
    var projs = [];

    // Promise.map(projs, loadDump).mapSeries(function (projObj) {
    //     return manualDeleter(projObj._id, projObj.owner.ref, projObj.org.ref, projObj.dataset.ref, _.map(projObj, "networks.ref"));
    // })
    // .then(function () {
    //     console.log("=========== Manual deleter finished ============");
    // });
    
    // clean monitor 360 fucked up project
    // var projObj = require("../monitor360-fucked-up-proj.js");
    // var dataset = JSON.parse(fs.readFileSync("fucked-up-proj-ds.json", "utf8"));
    // console.log(_.omit(dataset, "datapoints"));
    // var writestream = gfs().createWriteStream({
    //     _id : ObjectID("56cba25868751df457b75dad"),
    //     filename: 'dataset_' + dataset.id,
    //     mode : 'w',
    //     metadata : {
    //         entityRef : ObjectID("56b90cc440647ccc39cec752")
    //     }
    // });
    // console.log('[DSModel.saveDataset] writing Dataset to GridStore.....');
    // var data = JSON.stringify(dataset);
    // streamifier.createReadStream(data).pipe(writestream);

    // writestream.on('close', function(file) {
    //     console.log('[DSModel.saveDataset] writing Dataset to GridStore.....Done');
    // });
    // writestream.on('error', function(err) { console.error("Error in saving datA: ", err); });
    
    // DSModel.readDataset("56b90cc440647ccc39cec752")
    // .then(function(dataset) {
    //     return fs.writeFileSync("fucked-up-proj-ds.json", JSON.stringify(dataset));
    // })
    // .then(res => console.log("All Done:", res))
    // .catch(err => console.error("Error in process", err));

    // console.log("Project Obj:", projObj);
    // var snapNWIds = _.map(projObj.snapshots, "networkId");

    // console.log(`Snapshot network Ids: ${snapNWIds}`);
    // console.log(`allGenNWIds network Ids: ${projObj.allGenNWIds}`);
    // console.log("Length of network Ids:", _.map(projObj.networks, "ref").length);

    // var networkIds = _.difference(_.map(projObj.networks, "ref"), projObj.allGenNWIds, snapNWIds);

    // console.log("Length of network Ids:", networkIds.length);

    // ProjModel.listByIdAsync(projObj._id)
    // .then(function (proj) {
    //     proj.networks = projObj.networks.filter(nw => networkIds.indexOf(nw.ref) < 0);
    //     // console.log("Final network list: ", proj.networks);
    //     proj.save();
    // });

    // manualDeleter(projObj._id, projObj.owner.ref, projObj.org.ref, projObj.dataset.ref, networkIds)
    // .then(function () {
    //     console.log("=========== Manual deleter finished ============");
    // });

    // ProjModel.listByIdAsync("56997d43a2390d272782a696")
    // .then(function (proj) {
    //     console.log(proj);
    //     // return [proj, UserModel.listByIdAsync(proj.owner.ref), OrgModel.listByIdAsync(proj.org.ref)];
    // });
    // Promise.join(
    //     UserModel.listByIdAsync('5567dd6be5776d7622b53179'),
    //     OrgModel.listByIdAsync("5582fda231a010ee43bc3d14"),
    //     function (user, org) {
    //     console.log("Found User:", user.email);
    //     console.log("Found Org:", org.orgName);
    //     return deleteProject("56967691f82da28a6d23787e", user, org);
    // })
    // .catch(function (err) {
    //     console.error(err);
    // });
    
});

function loadDump(projId) {
    return JSON.parse(fs.readFileSync("project-dump-" + projId + '.json', "utf8"));
}


function removeProject(projId) {
    console.log(`Deleting project ${projId} ...`);

    return ProjModel.listByIdAsync(projId)
        .then(function (proj) {
            fs.writeFileSync("project-dump-" + projId + '.json',JSON.stringify(proj));
            return [proj, UserModel.listByIdAsync(proj.owner.ref), OrgModel.listByIdAsync(proj.org.ref)];
        }).spread(function (proj, user, org) {
            console.log("Found User:", user.email);
            console.log("Found Org:", org.orgName);
            return deleteProject(projId, user, org, true);
        })
        .then(function () {
            console.log(`Deleting project ${projId} ...done`);
            return true;
        })
        .catch(function (err) {
            console.error("Error in deleting Project", err);
            return Promise.reject(err);
        });
}
function manualDeleter(projectId, userId, orgId, datasetId, allGenNWIds) {
    var playerDelete = playerModel.listByProjectIdAsync(projectId)
        .then(player => playerModel.removeByIdAsync(player._id))
        .catch(function(error) {
            console.warn("Unable to delete player for the project: " + projectId, error);
            return null;
        });

    var onDSDeletion = DSModel.removeDatasetById(datasetId);
    var onNWDeletion = Promise.mapSeries(allGenNWIds, function(nw) {
        console.log("Deleting network :", nw);
        return DSModel.removeNetworkById(nw).reflect();
    });
    var onDataDeletion = Promise.join(onDSDeletion, onNWDeletion, function(res1, res2) {
        console.log("dataset and networks deleted");
        _.each(res2, function function_name(inspection) {
            if(!inspection.isFulfilled()) {
                console.warn("Network wasn't deleted with reason: ", inspection.reason());
            }
        })
    }).catch(function(err) {
        console.error("Error in deleting dataset:", err.stack || err);
    });
    
    
    Promise.join(
        UserModel.listByIdAsync(userId),
        OrgModel.listByIdAsync(orgId),
        function (user, org) {
        console.log("Found User:", user.email);
        console.log("Found Org:", org.orgName);

        user.projects = _.filter(user.projects, pr => pr.ref !== projectId);
        org.projects = _.filter(org.projects, pr => pr.ref !== projectId);
        console.log("Removing users / orgs from the project...");
        return Promise.join(user.save(), org.save(), _.constant(null));
    })
    .then(function () {
        console.log("Removing users / orgs from the project...done");
    })
    .catch(function(err) {
        console.error("Error in users / orgs:", err.stack || err);
    });
    return onDataDeletion;
}


// get all networks where num of snapshots < num of networks

// db.getCollection('projects').aggregate([
// {"$match" : { "networks.5": {"$exists" : true}}},
// { $project : {org : 1, owner : 1,projName : 1, networks : 1, snapshots : 1}},
// { $unwind : "$networks"},
// { $group : {
//     _id : '$_id',
//     numNetworks : { $sum : 1},
//     snapshots : {"$first" : "$snapshots"},
//     org : {"$first" : "$org"},
//     owner : {"$first" : "$owner"},    
//     projName : {"$first" : "$projName"}}},
// { $unwind : "$snapshots"},
// { $group : {
//     _id : '$_id',
//     numSnapshots : { $sum : 1},
//     projName : {"$first" : "$projName"},
//     org : {"$first" : "$org"},
//     owner : {"$first" : "$owner"},
//     numNetworks : {"$first" : "$numNetworks"}}},
// { $project : {org : 1, owner : 1, projName : 1, numNetworks : 1, numSnapshots : 1, isViral : { $cmp : ["$numNetworks", "$numSnapshots"]}}},
// { $match : { isViral : { $gt : 0 }}},
// { $sort : { numNetworks : -1}}
// ])

// db.getCollection('projects').aggregate([
// {"$match" : { "networks.5": {"$exists" : true}}},
// { $project : { dataset : 1, dateCreated : 1, dateModified : 1, org : 1, owner : 1, projName : 1, networks : 1, snapshots : 1}},
// { $unwind : "$snapshots"},
// { $group : {
//     _id : '$_id',
//     numSnapshots : { $sum : 1},
//     dataset : {"$first" : "$dataset"},
//     dateCreated : {"$first" : "$dateCreated"},
//     dateModified : {"$first" : "$dateModified"},
//     org : {"$first" : "$org"},
//     owner : {"$first" : "$owner"},
//     projName : {"$first" : "$projName"},
//     networks : {"$first" : "$networks"}}},
// { $unwind : "$networks"},
// { $group : {
//     _id : '$_id',
//     numNetworks : { $sum : 1},
//     dataset : {"$first" : "$dataset"},
//     dateCreated : {"$first" : "$dateCreated"},
//     dateModified : {"$first" : "$dateModified"},
//     org : {"$first" : "$org"},
//     owner : {"$first" : "$owner"},
//     numSnapshots : {"$first" : "$numSnapshots"},    
//     projName : {"$first" : "$projName"}}},
// { $project : { dataset : 1, dateCreated : 1, dateModified : 1, org : 1, owner : 1, projName : 1, numNetworks : 1, numSnapshots : 1, isViral : { $cmp : ["$numNetworks", "$numSnapshots"]}}}
// ])