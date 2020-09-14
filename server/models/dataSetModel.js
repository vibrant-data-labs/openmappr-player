'use strict';

var ObjectID = require('mongodb').ObjectID,
    Promise = require('bluebird'),
    assert = require('assert'),
    _ = require('lodash');

var db_old = require('../db_old.js');

// Only for non gfs files
function readDoc(id, callback) {
    console.log('[dataSetModel.readDoc] id:' + id);
    return db_old.dataSet().findOneAsync({_id:id})
        .tap(function() {
            console.log('[dataSetModel.readDoc] Success: ');
            //console.log(doc);
        }).nodeify(callback);
}

function readFromGFS (dataSetRef, callback) {
    return new Promise(function(resolve, reject) {
        var readstream = db_old.gfs().createReadStream({
            _id: dataSetRef
        });
        var dataString = [];
        readstream.on('data', function (chunk) {
            var part = chunk.toString();
            dataString.push(part);
            console.log('[DataSetAPI.readFromGFS] got %d bytes of data', chunk.length);
        });
        readstream.on('end', function(){
            var dataDocs = JSON.parse(dataString.join(''));
            resolve(dataDocs);
        });
        readstream.on('error', reject);
    }).nodeify(callback);
}

// User needs to manually remove it from project and org
function removeById (datasetId) {
    // remove from both dataset and gfs.
    return Promise.join(db_old.dataSet().removeAsync({ _id : datasetId}),
        Promise.fromNode(function(cb) { db_old.gfs().remove({_id : datasetId}, cb); }));
}


function validateDataSet (dataset) {
    assert(dataset.data.nodes, "Graph data should contain a nodes property");
    assert(dataset.data.edges, "Graph data should contain a edges property");
    assert(dataset.data.nodeAttrs, "Graph data should contain a nodeAttrs property");
    assert(dataset.data.edgeAttrs, "Graph data should contain a edgeAttrs property");
}

// Builds the dataset object
function buildDataSet (name, descr, picture, user, org, graphData) {
    name = name || 'dataset';
    descr = descr || '';

    var newDataSet = {
        _id : new ObjectID(),
        setName: name,
        descr: descr,
        picture: picture,
        org: {
            ref: org._id,
            orgName: org.orgName,
            picture: org.picture
        },
        owner: {
            ref: user._id,
            email: user.email,
            name: user.name,
            picture: user.picture
        },
        data: graphData,
        dateCreated : Date.now(),
        dateModified : Date.now()
    };
    validateDataSet(newDataSet);
    return newDataSet;
}
//
// Options object contains projectId and versionIndex
function updateDataSet (dataset, options) {
    assert(dataset._id, "Dataset to update should have a valid Id");
    console.log("[DataSetAPI.updateDataSet] updating existing dataset :", dataset._id);
    return insertDataSet(dataset, options);
}

// The file id and the dataset id are the same! yaay!
// Options object contains projectId and versionIndex
function insertDataSet (dataset, options) {
    // var projId = options.projectId,
    //     versionIndex = options.versionIndex;

    // var id = dataset._id || new ObjectID();

    // return new Promise(function(resolve, reject) {
    //     var writestream = db_old.gfs().createWriteStream({
    //         _id : id,
    //         filename: 'proj_' + projId + '_' + versionIndex,
    //         mode : 'w',
    //         chunkSize: 4096,
    //     });

    //     console.log('[DataSetAPI.buildDataSet] writing ReadableStreamBuffer');
    //     streamifier.createReadStream(JSON.stringify(dataset)).pipe(writestream);
    //     //writestream.write(JSON.stringify(dataset));
        
    //     writestream.on('close', function(file) { resolve(dataset);  });
    //     writestream.on('error', function(err) { reject(err); });
    // }).tap(function(dataset) {
    //     elasticSearchService.storeDataSet(dataset._id, dataset.data.nodes, function (err, result){
    //         if(err) {
    //             console.warn("[DataSetAPI.insertDataSet] : error storing data to elasticsearch", err);
    //         } else {
    //             console.log("[DataSetAPI.insertDataSet] : successfully stored data to elasticsearch");
    //         }
    //     });
    // });
}

function buildNodeAttr (id, title, attrType, generatorType, generatorOptions, visible) {
    assert(id, "Node Attr needs id");
    return {
        id              : id,
        title           : title         != null ? title         : id,
        attrType        : attrType      != null ? attrType      : "string",
        generatorType   : generatorType != null ? generatorType : "internal",
        generatorOptions: generatorOptions != null ? generatorOptions : null,
        visible        : "boolean"  == typeof visible ? visible : true
    };
}

function buildNode (id, label, size, posX, posY, col) {
    return {
        id   : id,
        label: label    != null ? label : "node",
        size : size     != null ? size : 20,
        posX : posX     != null ? posX : _.random(10, 1000, false),
        posY : posY     != null ? posY : _.random(10, 1000, false),
        col  : col      != null ? col : {
            r    : _.random(0, 255, false),
            g    : _.random(0, 255, false),
            b    : _.random(0, 255, false)
        },
        attr : []
    };
}

function getDataSetByProject(project, vnum) {
    var dataSetRef = null,
        isDataChunked = false,
        datasetP = null;

    for (var i = project.versions.length - 1, foundIndex = -1; i >= 0; i--) {
        if(project.versions[i].num == parseInt(vnum)){
            dataSetRef = project.versions[i].dataSetRef;
            isDataChunked = project.versions[i].isDataChunked;
            foundIndex = i;
            break;
        }
    }

    if(foundIndex > -1){
        if(!isDataChunked){
            datasetP = readDoc(dataSetRef);
        }
        else {
            console.log('[DataSetAPI.getDataSetByProject] reading data file stream', dataSetRef);
            datasetP = readFromGFS(dataSetRef);
        }
    } else {
        datasetP = Promise.reject(new Error("Version index is negative"));
    }
    return datasetP;
}


function cloneDataset (user, org, projectId, versionIndex, dataSetRef, isDataChunked) {
    var logPrefix = "[dataIngestionController.cloneDataset] ";
    var onDatasetFetch = null;
    if(!isDataChunked){
        onDatasetFetch = readDoc(dataSetRef);
    } else {
        onDatasetFetch = readFromGFS(dataSetRef);
    }
    var datasetP = onDatasetFetch.then(function(dataset) {
        console.log(logPrefix + "Fetched data. Starting to clone");
        // depp clone without mongoIds
        // var clonedDS = _.cloneDeep(dataset, function(val, key) {
        //     return key === "_id" ? '' : undefined;
        // });
        var cloneDS = dataset;
        cloneDS._id = new ObjectID();
        cloneDS.dateCreated = Date.now();
        cloneDS.dateModified = Date.now();
        if(user) {
            cloneDS.owner = {
                ref: user._id,
                email: user.email,
                name: user.name,
                picture: user.picture
            };
        }
        if(org) {
            cloneDS.org = {
                ref: org._id,
                orgName: org.orgName,
                picture: org.picture
            };
        }
        return insertDataSet(cloneDS, {
            projectId : projectId,
            versionIndex : versionIndex
        });
    });
    datasetP.tap(function(dataset) { console.log(logPrefix + "Saved cloned data :", dataset._id); });
    return datasetP;
}


module.exports = {
    readDoc:            readDoc,
    readFromGFS         : readFromGFS,
    removeById          : removeById,
    buildDataSet        : buildDataSet,
    updateDataSet       : updateDataSet,
    cloneDataset        : cloneDataset,
    insertDataSet       : insertDataSet,
    buildNodeAttr       : buildNodeAttr,
    buildNode           : buildNode,
    getDataSetByProject : getDataSetByProject
};