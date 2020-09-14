'use strict';
var
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var attrSpec = require("./common_schema_specs").attrSpec;

var NetworkRecord = new mongoose.Schema({
    projectId : {type: Schema.Types.ObjectId, index: true }, // can be network / dataset Id
    datasetId : {type: Schema.Types.ObjectId, index: true }, // can be network / dataset Id
    name : { type : String, default: "Network" },
    description : { type : String, default: "Network description" },

    nodeAttrDescriptors : [attrSpec],
    linkAttrDescriptors : [attrSpec],

    nodesFile : {type: Schema.Types.ObjectId},
    linksFile : {type: Schema.Types.ObjectId},

    networkInfo : {},
    clusterInfo :{},
    generatorInfo : {},

    // infos
    nNodes : { type: Number, min: 0 },
    nLinks : { type: Number, min: 0 },

    createdAt   : { type: Date, default: Date.now },
    modifiedAt : { type: Date, default: Date.now }
}, { minimize : false });

NetworkRecord.set('toJSON', { virtuals: true });
NetworkRecord.set('toObject', { virtuals: true });

var NetworkRecordDb = mongoose.model('NetworkRecord', NetworkRecord);

module.exports = NetworkRecordDb;