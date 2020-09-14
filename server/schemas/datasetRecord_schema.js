'use strict';
var
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var attrSpec = require("./common_schema_specs").attrSpec;

var DatasetRecord = new mongoose.Schema({
    projectId : {type: Schema.Types.ObjectId, index: true }, // can be network / dataset Id
    name : { type : String },

    attrDescriptors : [attrSpec],
    datapointsFile : {type: Schema.Types.ObjectId},
    sourceInfo : {},

    // infos
    nDatapoints : { type: Number, min: 0 },

    createdAt   : { type: Date, default: Date.now },
    modifiedAt : { type: Date, default: Date.now }
}, { minimize : false });

DatasetRecord.set('toJSON', { virtuals: true });
DatasetRecord.set('toObject', { virtuals: true });

var DatasetRecordDb = mongoose.model('DatasetRecord', DatasetRecord);

module.exports = DatasetRecordDb;