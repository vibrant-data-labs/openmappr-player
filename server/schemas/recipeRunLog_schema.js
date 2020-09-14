'use strict';
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


var RecipeRunLogSchema = new mongoose.Schema({
    recipeRef    : Schema.Types.ObjectId, // the ref to the recipe used to generate this run
    recipeRunRef : Schema.Types.ObjectId,
    logType      : String,
    createdAt    : {type: Date, default: Date.now },
    isJSON       : { type : Boolean, default : false },
    // is isJSON is true, then msg is stringified json object. otherwise, it is a string
    msg          : String
});


var RecipeRunLogSchemaDB = mongoose.model('RecipeRunLog', RecipeRunLogSchema);

module.exports = RecipeRunLogSchemaDB;
