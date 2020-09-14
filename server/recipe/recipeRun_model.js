'use strict';

var _       = require('lodash'),
    moment = require('moment'),
    EventEmitter = require('events'),
    Promise = require('bluebird');

var recipeRunDB    = require('../schemas/recipeRun_schema'),
    recipeRunLogDB = require('../schemas/recipeRunLog_schema'),
    networkStats   = require('../services/networkStats.js');

// var logPrefix = "[recipeRun_model]";

// can return null values.
function listById (id, callback) {
    return recipeRunDB.findById(id, function(err, doc){
        if(err) { return callback(err); }
        // console.log(logPrefix + '[listById]' + 'Success:', doc);
        callback(null, doc);
    });
}
function listByRecipeId (id, callback) {
    return recipeRunDB.find({'recipe.ref': id}, callback);
}

function removeByRecipeId (id, callback) {
    recipeRunLogDB.remove({'recipeRef' : id}).exec();
    return recipeRunDB.remove({'recipe.ref': id}, callback);
}

function loadLogs (runId, callback) {
    return recipeRunLogDB.find({'recipeRunRef' : runId}, callback);
}

function startNewRun (recipe, machine, taskId, callback) {
    console.log(`Storing a new run for recipe : ${recipe.id}`);


    var newRun = new recipeRunDB({
        name : `Run on ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`,
        recipe : { ref : recipe.id },
        org : { ref : recipe.org.ref },
        config : recipe.toObject(),
        taskId : taskId,
        isSuccessful : false,
        isRunning : true
    });
    newRun.save();

    /**
     * This class is basically used to sync save calls.
     * otherwise, it would write duplicates.
     * @type {EventEmitter}
     */
    var runEv = new EventEmitter(),
        evtQueue = [], isProcessing = false; // whether we are pulling items from the queue or not

    // store stuff in the queue
    function enqueue(evtName, data) {
        evtQueue.push({ evtName, data });
        if(!isProcessing) {
            isProcessing = true;
            runEv.emit("_proc_next_event"); // start queue
        }
    }

    machine.on('phase:result', data => enqueue('phase:result', data));
    machine.on('progress', data => enqueue('progress', data));
    machine.on('info', data => enqueue('info', data));
    machine.on('end', data => enqueue('end', data));
    machine.on('error', data => enqueue('error', data));
    machine.on(machine.VALIDATION_FAILED, data => enqueue(machine.VALIDATION_FAILED, data));


    // process queue. basically wait for data to be saved in mongo before moving to next item in queue
    // if no events in queue, then halt run
    runEv.on('_proc_next_event', function() {
        if(evtQueue.length > 0) {
            var data = evtQueue.shift(1);
            runEv.emit(data.evtName, data.data);
        } else {
            isProcessing = false;
        }
    });
    runEv.on('save_run', function() {
        newRun.modifiedAt = new Date();
        newRun.save()
        .then(function() {
            // console.log("Save Run:", newRun.isRunning);
            runEv.emit('_proc_next_event');
        });
        runEv.emit('run_updated', newRun);
    });


    runEv.on('phase:result', function processResult(data) {
        var phaseType = data.phase,
            result = data.result;
        switch(phaseType) {
        case 'etl_gen' : storeETLGenData(result); break;
        case 'data_ingest' : storeDataSourceData(result); break;
        case 'project_gen' : storeProjectGenData(result); break;
        case 'dataset_post_process' : storeDatasetGenData(result); break;
        case 'network_gen' : storeNetworkGenData(result, data.dataset); break;
        case 'snapshot_gen' : storeSnapshotGenData(result); break;
        case 'player_gen' : storePlayerGenData(result); break;
        default : console.warn("Unknown phase type: ", data);
        }
        runEv.emit('save_run');
    });

    runEv.on('progress', function processProgress(data) {
        storeProgress(data);
        storeLogs('progress', data);
        runEv.emit('save_run');
    });
    runEv.on('info', function(msg) {
        storeLogs('info', msg);
        runEv.emit('_proc_next_event');
    });
    runEv.on('end', function(status){
        // console.log(logPrefix, '[logstream ended] status:', status);
        storeLogs('end', 'run ended');
        newRun.isSuccessful = _.isString(status) ? status != 'FAILED' : true;
        newRun.isRunning = false;
        runEv.emit('save_run');
    });
    runEv.on('error', function(data) {
        storeLogs('error', data);
        newRun.isSuccessful = false;
        newRun.isRunning = false;
        sendEmailOnError(recipe, machine, newRun);
        // runEv.emit('save_run');
        runEv.emit('end', 'FAILED');
    });
    runEv.on(machine.VALIDATION_FAILED, function(msg) {
        storeLogs(machine.VALIDATION_FAILED, msg);
        newRun.isSuccessful = false;
        newRun.isRunning = false;
        sendEmailOnError(recipe, machine, newRun);
        runEv.emit('end', 'FAILED');
    });

    function storeETLGenData(etl_results) {
        newRun.etl_gen = etl_results;
    }

    function storeDataSourceData (dataSources) {
        _.each(dataSources, dataSource => {
            newRun.dataSources.push({
                sourceInfo : dataSource.dataset.sourceInfo,
                name : dataSource.name
            });
        });
    }
    function storeProjectGenData (project) {
        newRun.projects.push({
            ref : project.id,
            name : project.projName
        });
    }
    function storeDatasetGenData (dataset) {
        newRun.datasets.push({
            ref : dataset.id,
            stats : {
                numDatapoints : dataset.datapoints.length,
                numAttrDescriptors: dataset.attrDescriptors.length
            }
        });
    }
    function storeNetworkGenData (networks, dataset) {
        _.each(networks, function(network) {
            var updatedNw = networkStats.reworkNetwork(network, dataset);
            newRun.networks.push({
                ref : network.id,
                stats: {
                    linkingAttrs: updatedNw.linkingAttrs,
                    numNodes : updatedNw.nodes.length,
                    numLinks : updatedNw.links.length,
                    numClusters: updatedNw.clusters.length,
                    clusterInfos : _.map(updatedNw.clusters, function(cluster) {
                        return  {
                            id : cluster.id,
                            linkingAttrName : cluster.linkingAttrName,
                            numNodes : cluster.Nodes.length,
                            numBridgers : cluster.Bridgers.length,
                            numMostCentral : cluster.MostCentral.length
                        };
                    })
                }
            });
        });
    }
    function storeSnapshotGenData (snapIds) {
        _.map(snapIds, id => newRun.snapshotIds.push({id : id }));
    }
    function storePlayerGenData (player) {
        newRun.players.push(player);
    }
    function storeProgress (data) {
        var str_arr = data.phase.split(':');
        var phase = str_arr[0], status = str_arr[1];

        if(status === "begin") {
            newRun.phasesBegun.push({
                phase : phase,
                msg : data.msg
            });
        } else if(status === "end") {
            newRun.phasesEnd.push({
                phase : phase,
                msg : data.msg
            });
        } else if(status === 'progress') {
            // store completion info here if necessary
        } else {
            // Do something
        }
    }

    function storeLogs (type, logObj) {
        var isObj = logObj != null && !_.isString(logObj);

        var runLog = new recipeRunLogDB({
            recipeRef    : recipe.id,
            recipeRunRef : newRun.id,
            logType      : type,
            isJSON       : isObj,
            msg          : isObj ? JSON.stringify(logObj) : logObj
        });
        runLog.save();
    }

    if(callback) {
        callback(newRun);
    }

    return {run : newRun, runEventStream : runEv} ;
}

function sendEmailOnError (recipe, machine, recipeRun) {
/*    recipeRunLogDB.find({"recipeRunRef" : recipeRun.id}).exec()
        .then(function(runLogs) {
            console.log("Number of logs: ", runLogs.length);
            //send email
            var transport = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: "support@vibrantdata.is",
                    pass: "vdat*su*1"
                }
            });
            var mailOptions = {
                from: "support@vibrantdata.is",
                to: 'aditya@mappr.io',
                subject: "Run Failed!",
                text: `${recipeRun.name} failed. Attached is the log file.`,
                attachments: [{
                    filename: "run_logs.json",
                    content : JSON.stringify({
                        recipeRef : recipe.id,
                        recipeRunRef: recipeRun.id,
                        logs : _.map(runLogs, function(log) {
                                    return {
                                        logType : log.logType,
                                        msg : log.isJSON ? JSON.parse(log.msg) : log.msg
                                    };
                                })
                    })
                }]
            };
            // console.log("MailOptions:", mailOptions);

            transport.sendMail(mailOptions, function(err, res) {
                if (err) {
                    return console.warn("unable to send emails", err);
                }
                console.log("Email sent successfully");
            });

        });*/
}

var api = {
    listById,
    listByRecipeId,
    removeByRecipeId,
    loadLogs,
    startNewRun
};
module.exports = Promise.promisifyAll(api);
