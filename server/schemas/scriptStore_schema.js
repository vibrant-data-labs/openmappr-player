'use strict';
var 
    mongoose     = require('mongoose'),
    Schema       = mongoose.Schema;


// We preserve last 3 networks generated. This is to counter the bizarre issue of data corruption

var ScriptStore = new mongoose.Schema({
	orgRef     : { type : Schema.Types.ObjectId, index : true },
	projectRef : { type : Schema.Types.ObjectId, index : true },
	userRef    : { type : Schema.Types.ObjectId, index : true },
	
	name       : { type :String },
	scriptSrc  : String,
	lastUsedAt : { type: Date, default: Date.now },
});

var ScriptStoreDB = mongoose.model('ScriptStore', ScriptStore);

module.exports = ScriptStoreDB;