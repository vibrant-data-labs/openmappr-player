'use strict';
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


var RecipeRunSchema = new mongoose.Schema({
    name              : String,
    recipe            : { ref : Schema.Types.ObjectId }, // the ref to the recipe used to generate this run
    org               : { ref : Schema.Types.ObjectId },
    createdAt         : {type: Date, default: Date.now },
    modifiedAt        : { type : Date, default : Date.now},

    isSuccessful : { type : Boolean, default : true},
    isRunning : {type : Boolean, default : false},
    taskId : String, // the task which was used to start this run

    // config used for this run. basically, recipe object
    config : {},

    // phase Progress statuses
    phasesBegun:[{
        phase: String,
        msg : String
    }],
    phasesEnd : [{
        phase: String,
        msg : String
    }],

    //
    // artifacts generated
    //
    etl_gen: {
        etlNetworkUrl : String
    },
    dataSources: [{
        sourceInfo : {},
        name : String
    }],
    projects: [{
        ref : Schema.Types.ObjectId
    }],
    datasets : [{
        ref : Schema.Types.ObjectId,
        stats: {}
    }],
    networks : [{
        ref : Schema.Types.ObjectId,
        stats: {}
    }],
    snapshotIds : [{
        id : String
    }],
    players : [{}]
});


var RecipeRunSchemaDB = mongoose.model('RecipeRun', RecipeRunSchema);

module.exports = RecipeRunSchemaDB;
