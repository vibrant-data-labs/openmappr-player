'use strict';
var 
    mongoose     = require('mongoose'),
    Schema       = mongoose.Schema;


// We preserve last 3 networks generated. This is to counter the bizarre issue of data corruption

var DataMapping = new mongoose.Schema({
	entityRef   : { type : Schema.Types.ObjectId, index : true }, // the common id of the entity ()
	fileDataRef : { type : Schema.Types.ObjectId, index : true }, // the gridfs file id where it is stored
	opInfo      : {}, // operation which caused this creation to happen
	createdAt   : { type: Date, default: Date.now },
	isDeleted   : { type :Boolean, default : false }
});

var dataMappingDb = mongoose.model('DataMapping', DataMapping);

module.exports = dataMappingDb;