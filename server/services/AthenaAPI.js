'use strict';

var events       = require("events"),
    Promise      = require('bluebird'),
    fivebeans    = Promise.promisifyAll(require('fivebeans')),
    _            = require('lodash');

var UID = require('../services/UIDUtils.js');
var AthenaOps = require("../schemas/athenaOps_schema");

var config = require("./AppConfig").get();
var ATHENA_PIPE = config.athena.ATHENA_PIPE;
var CLIENT_PREFIX = config.athena.CLIENT_PREFIX;

var SHOW_ATHENA_LOGS = false;

var _initialized = false;
/**
 * stream based job mgmt for athena tasks
 * @type {EventEmitter}
 * Possible events
 * 'new_job' : a new athena job as been requested. arg1 : is an event emitter for that specific job. arg2 : job data
 * 'error.no_es' : received when there is no specific event emitter associated to the job id in the result package
 */
var athenaEventStream = new events.EventEmitter();
var clientId = CLIENT_PREFIX + UID.generateShortUID6();

var jobIdESMap = {}; // a map from job_id -> EventStream

function init (host, port) {
    if(_initialized) {
        return;
    }
    // setup receiver 1st
    var options = {
        id: clientId,
        host: host,
        port: port,
        handlers: {
            'athena_failed': new AthenaFailedHandler(),
            'athena_algo_listing' : new AthenaAlgoListingHandler(),
            'athena_algo': new AthenaAlgoHandler(),
            'etl_algo' : new ETLAlgoHandler()
        },
        ignoreDefault: true
    };
    var clientWorker = new fivebeans.worker(options);
    clientWorker.start([clientId]);

    // set up the client
    var client = new fivebeans.client(host, port);
    _setup_event_handlers(client, athenaEventStream);
    client
        .on('connect', function() {
            console.log("[AthenaAPI.init]Connected with beanstalkd. clientId: ", clientId);
            client.use(ATHENA_PIPE, _.noop);
        })
        .on('error', function(err) {
            _initialized = false;
            // connection failure
            athenaEventStream.emit('error', err);
        })
        .on('close', function() {
            // underlying connection has closed
            athenaEventStream.emit('close');
        })
        .connect();
    _initialized = true;
}

// athenaES is the primary was this job system works
function _setup_event_handlers (client, athenaES) {
    athenaES.on('new_job', function(jobES, athenaTask) {
        console.log("creating new job!", athenaTask);
        client.put(10, 0, athenaTask.ttr, JSON.stringify(athenaTask), function(err, jobid) {
            athenaTask.beanstalk_job_id = jobid;
            if(athenaTask.job_type == "athena_algo") logJobInit(athenaTask);
            jobIdESMap[athenaTask.job_id] = jobES;
        });
        jobES.on('end', function() {
            logJobEnd("end", athenaTask);
        });
        jobES.on("error", function(err) {
            logJobEnd("error", athenaTask, err);
        });
    });
    athenaES.on('error.no_es', function(err) {
        console.warn("Generic Error on AthenaES: ", err);
    });
    athenaES.on('error', function(err) {
        console.warn("Error on AthenaES: ", err);
    });
    athenaES.on('close', function() {
        console.log("AthenaES closed");
    });
}

function getAlgoList () {
    var jobES = new events.EventEmitter();
    athenaEventStream.emit('new_job', jobES, genAthenaTask('athena_algo_listing', 60, { x : 5}));

    var promise = new Promise(function(resolve, reject) {
        jobES.on('data', function(data) {
            // console.log("Got algo listing:", data);
            resolve(data);
        })
        .on('error', function(err) {
            console.error("Error in getAlgoList", err);
            reject(err);
        })
        .on('end', function() {
            // console.log("Stream ended:");
            // reject("stream ended");
        });
    });
    return promise;
}

function runAlgo (algoData) {
    var jobES = new events.EventEmitter();
    var taskData = genAthenaTask('athena_algo', 1200, algoData);
    athenaEventStream.emit('new_job', jobES, taskData);
    return jobES;
}
function runEtl (algoData) {
    var jobES = new events.EventEmitter();
    var taskData = genAthenaTask('etl_algo', 1200, algoData);
    athenaEventStream.emit('new_job', jobES, taskData);
    return jobES;
}

function findUserSimilarity (algoData) {
    var jobES = new events.EventEmitter();
    algoData.taskId =  "athena_" + _.random(1,10000);
    var taskData = genAthenaTask('athena_algo', 1200, algoData);

    athenaEventStream.emit('new_job', jobES, taskData);

    var promise = new Promise(function(resolve, reject) {
        var isDone = false;
        jobES.on('data', function(payload) {
            console.log("Got Data: ", payload);
            if(payload.type === 'update' && payload.status) {
                if(payload.status === 'completed') {
                    isDone = true;
                    resolve(payload);
                }
                // var completion = typeof payload.completion != "number" ? parseInt(payload.completion,10) : payload.completion;
            }
            else if(payload.type === 'delete') {
                !isDone && reject(payload);
            }
            else if(payload.type === 'error') {
                !isDone && reject(payload);
            }
            // else if(payload.type === 'notify') {
            //  notify(id, payload);
            // }
            else {
                console.log("invalid event", payload);
            }
        })
        .on('error', function(err) {
            console.error("Error in findUserSimilarity", err);
            reject(err);
        })
        .on('end', function() {
            console.log("Stream ended:");
            reject("stream ended");
        });
    });
    return promise;
}

function genAthenaTask (job_type, ttr, payload) {
    var task = {
        'client_tubeId' : clientId,
        'job_type' : job_type,
        'job_id' : UID.generateShortUID4(),
        'ttr' : ttr || 1200,
        'data' : payload
    };
    return task;
}
////
/// Event handlers
///
function AthenaFailedHandler() {
    this.type = 'athena_failed';
}
AthenaFailedHandler.prototype.work = function(payload, callback) {
    console.log("Athena Failed: ", _.omit(payload, 'result'));
    console.log("Failure:", payload.result);
    // payload.result && console.log("Athena Error: ", payload.result);
    var es = jobIdESMap[payload.job_id];
    if(es != null) {
        es.emit('error', payload);
        delete jobIdESMap[payload.job_id];
    } else {
        console.log("Can't find EventStream. job_id: ", payload.job_id);
        athenaEventStream.emit('error.no_es', payload);
    }
    callback('success');
};
/// process listings
function AthenaAlgoListingHandler() {
    this.type = 'athena_algo_listing';
}
AthenaAlgoListingHandler.prototype.work = function(payload, callback) {
    // console.log("Athena athena_algo_listing: ", payload);
    // console.log("Job Id", payload.job_id);
    var es = jobIdESMap[payload.job_id];

    if(es != null) {
        es.emit('data', payload.listing);
        es.emit('end');
        delete jobIdESMap[payload.job_id];
    } else {
        console.log("Can't find EventStream. job_id: ", payload.job_id);
        athenaEventStream.emit('error.no_es', payload);
        throw new Error("No es found!"); // algo listing should always work!
    }
    callback('success');
};

/// process athena calls
function AthenaAlgoHandler() {
    this.type = 'athena_algo';
}
AthenaAlgoHandler.prototype.work = function(payload, callback) {
    SHOW_ATHENA_LOGS && console.log("AthenaAlgoHandler: Athena athena_algo: ", payload);
    // console.log("AthenaAlgoHandler: Job Id", payload.job_id);
    var es = jobIdESMap[payload.job_id];
    if(es != null) {
        es.emit('data', payload);
        if((payload.type === 'delete' || payload.type === 'error')) {
            es.emit('end');
            delete jobIdESMap[payload.job_id];
        }
    } else {
        console.log("AthenaAlgoHandler: Can't find EventStream. job_id: ", payload.job_id);
        athenaEventStream.emit('error.no_es', payload);
    }
    callback('success');
};

/// process ETL calls
function ETLAlgoHandler() {
    this.type = 'etl_algo';
}
ETLAlgoHandler.prototype.work = function(payload, callback) {
    SHOW_ATHENA_LOGS && console.log("ETLAlgoHandler: Athena etl_algo: ", payload);
    // console.log("ETLAlgoHandler: Job Id", payload.job_id);
    var es = jobIdESMap[payload.job_id];
    if(es != null) {
        es.emit('data', payload);
        if((payload.type === 'delete' || payload.type === 'error')) {
            es.emit('end');
            delete jobIdESMap[payload.job_id];
        }
    } else {
        console.log("ETLAlgoHandler: Can't find EventStream. job_id: ", payload.job_id);
        athenaEventStream.emit('error.no_es', payload);
    }
    callback('success');
};
function logJobInit (athenaTask) {
    // console.log("AthenaTask payload: ", athenaTask.data);
    if(athenaTask.job_type === "athena_algo_listing") return;

    var op = new AthenaOps({
        client_tubeId : clientId,
        beanstalk_job_id : athenaTask.beanstalk_job_id,

        algo_name : athenaTask.data.algo_name,
        job_type : athenaTask.job_type,
        job_id : athenaTask.job_id,
        task_id : athenaTask.data.taskId,
        eventType : "client:init",

        projectId : athenaTask.data.projectId,
        datasetId : athenaTask.data.datasetId || null,
        networkId : athenaTask.data.networkId || null
    });
    op.save();
}
function logJobEnd (status, athenaTask) {
}

module.exports = {
    init : init,
    getAlgoList : getAlgoList,
    findUserSimilarity : findUserSimilarity,
    runAlgo : runAlgo,
    runEtl : runEtl
};
