'use strict';
/**
 * A Capped collection recording all the network gen queries sent to athena and their results
 * Stores 2000 records
 */
var
    mongoose     = require('mongoose'),
    Schema       = mongoose.Schema;


// We preserve last 3 networks generated. This is to counter the bizarre issue of data corruption

var AthenaOps = new mongoose.Schema({
    client_tubeId : String,
    athena_pid : String,
    beanstalk_job_id : String,

    algo_name : String,
    job_type : String,
    job_id : String,
    task_id : String,
    eventType : String,

    projectId : Schema.Types.ObjectId,
    datasetId : Schema.Types.ObjectId,
    networkId : Schema.Types.ObjectId,

    createdAt   : { type: Date, default: Date.now }
}, {
    capped : { size : 1000000, max : 1000 }
});

var AthenaOpsDb = mongoose.model('AthenaOps', AthenaOps);

module.exports = AthenaOpsDb;