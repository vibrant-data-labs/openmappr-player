'use strict';
/**
 * Script Runner
 * Manages 2 types of scripts.
 * 1) data import script: This one extracts and sanitizes user data which is written out as a paraquet file.
 *     suffix: -import.py
 * 2) etl script : Run the ETL process on the paraquet data and generates entityInfo and SimMat
 *     suffix: -etl.py
 *
 * NOTES
 * 1) Data is stored in S3 in mappr-user-datasources/{orgId}/
 * /processed-data -> contains all paraquet files
 * /etl-results -> contains the result of running etl on data
 * 2) Scripts are stored in ./scripts folder
 *
 * FUTURE:
 * 1) Scripts are stored in S3, then cached locally
 * 2) UI to open script for modification by user
 *
 * How script is run
 * There are three phases to run the script
 * 1) build a context which manages all the shared data
 * 2) Setup all the variables in the context like what file to process and so on
 * 3) Run the script, which stores the result in S3
 */

var _    = require('lodash'),
    util = require('util'),
    fs = require('fs'),
    EventEmitter = require('events'),
    request = require('request'),
    AppConfig = require('../services/AppConfig'),
    Promise = require('bluebird');

var NetworkDataCache     = require("../services/NetworkDataCache"),
    AthenaAPI = require('../services/AthenaAPI');

var logPrefix = "[etl/script_runner]";
var SHOW_ATHENA_LOGS = true;

var EtlConfig = _.get(AppConfig.get(), 'etl');

// Global variables
var AUTH_HEADER =  EtlConfig.AUTH_HEADER,
    DATABRICKS_URL = EtlConfig.DATABRICKS_URL,
    CLUSTER_ID = EtlConfig.CLUSTER_ID,
    //access keys for s3 work
    ACCESS_KEY = _.get(AppConfig.get(), 'uploadS3.client_config.s3Options.accessKeyId'),
    SECRET_KEY = _.get(AppConfig.get(), 'uploadS3.client_config.s3Options.secretAccessKey'),
    TEMP_BUCKET = EtlConfig.TEMP_BUCKET,
    ETL_BUCKET = EtlConfig.ETL_BUCKET;

if(ACCESS_KEY.length < 5) throw new Error('Unable to load ACCESS_KEY from config');
if(SECRET_KEY.length < 5) throw new Error('Unable to load SECRET_KEY from config');

var myReq = request.defaults({
    baseUrl : DATABRICKS_URL,
    headers : {
        "Authorization" : AUTH_HEADER
    },
    gzip: true,
    json: true
});

var getAsync = Promise.promisify(myReq.get, {multiArgs: true}),
    postAsync = Promise.promisify(myReq.post, {multiArgs: true});

// common files
var run_importer_filePath = "etl-scripts/run_importer.py";
fs.accessSync(run_importer_filePath, fs.R_OK);

var extract_users = "etl-scripts/extract_users.py";

function set_cluster() {
    // set the cluster Id with a cluster that exists
    return getAsync('/clusters/list')
        .spread((res, body) => {
            if(!body[0]) throw new Error("Unable to load clusters");
            CLUSTER_ID = body[0].id;
            console.log(logPrefix,"Setting id clusterId to:", CLUSTER_ID);
        });
}


function extractUsersForEntities(eventStream, entityCol, entityList, srcParquetFile, destCSVFile) {
    var initArgs = {
        srcParquetFile : srcParquetFile,
        destCSVFile : destCSVFile,
        entity_list : entityList,
        entity : entityCol
    };
    eventStream.emit('progress', {
        msg : 'starting entity extraction...'
    });
    var onExt = genContext()
        .then(function(contextId) {
            // apply init script
            var initArgsFile = genInitArgsScript(initArgs, 'extractUsers', '-extract-users.py')
                .then(function(filePath) {
                    return applyScripts(contextId, filePath);
                })
                // wait for it to finish
                .then((commandId) => waitForFinish(contextId, commandId, (pingCount) => {
                    eventStream.emit('progress', {
                        msg : `entity extraction in progress... (${pingCount})`
                    });
                }))
                .tap(function() {
                    console.log(logPrefix, "[extractUsersForEntities]", "init script done");
                });

            // apply the main script
            var postScriptRun = initArgsFile
                .then(() => applyScripts(contextId, extract_users))
                .then(commandId => waitForFinish(contextId, commandId))
                .tap(() => console.log(logPrefix, "[extractUsersForEntities]", "main script applied"))
                .tap(() => console.log(logPrefix, "[extractUsersForEntities]", "export entities finished"));

            return postScriptRun.finally(() => deleteContext(contextId));
        });
    return onExt;
}

// all three are S3 urls
function runNetworkGenFromSimMat(fileName, entityInfoKey, simMatKey, destWorkBookKey, recipeId, pingFn) {
    // Athena runn config
    var algoDataDef = {
        "algo_name": "genNetworkFromSimMat",
        "options": {
            fileName : fileName,
            destWorkbookKey : destWorkBookKey,
            entityInfoKey : entityInfoKey,
            simMatKey : simMatKey
        },
        "recipeId": recipeId
    };
    algoDataDef.taskId =  "athena_etl_" + _.random(1,10000);
    console.log(logPrefix, "runNetworkGenFromSimMat", "starting algo with options:", algoDataDef);
    var athenaES = AthenaAPI.runEtl(algoDataDef);

    var promise = new Promise(function(resolve, reject) {
        var isDone = false;
        var finalPayload = null;
        athenaES.on('data', function _athenaDataStream(payload) {
            SHOW_ATHENA_LOGS && console.log(logPrefix,"runNetworkGenFromSimMat", `got data : ${util.inspect(payload)}`);
            pingFn && pingFn();
            if(payload.type === "create") {
                console.log(logPrefix, "runNetworkGenFromSimMat", "athena started processing");
            } else if(payload.type === 'update' && payload.status) {
                if(payload.status === 'completed') {
                    isDone = true;
                    finalPayload = payload;
                } else {
                    // progress info
                }
            }
            else if(payload.type === 'delete') {
                if(!isDone) {
                    reject(payload);
                }
            }
            else if(payload.type === 'error') {
                if(!isDone) {
                    reject(payload);
                }
            }
            else if(payload.type === 'notify') {
                console.warn(logPrefix, 'UNHANDLED CONDITION');
            }
            else {
                SHOW_ATHENA_LOGS && console.log(logPrefix,"runNetworkGenFromSimMat", `network gen job got invalid event: ${util.inspect(payload)}`);
            }
        })
        .on('error', function(err) {
            reject(err);
        })
        .on('end', function() {
            SHOW_ATHENA_LOGS && console.log(logPrefix, "runNetworkGenFromSimMat", `network gen job stream ended`);
            if(finalPayload) {
                resolve(finalPayload);
            } else {
                reject(new Error(`[runNetworkGenFromSimMat] network gen ended before job was finished`));
            }
        });
    });
    return promise;
}


function genContext() {
    return postAsync('/contexts/create', { form: {
        clusterId : CLUSTER_ID,
        language : "python"
    }}).spread(function(res, body) {
        console.log(logPrefix, "[genContext]", "got contextId: ", body.id);
        return body.id;
    });
}

function deleteContext(contextId) {
    return postAsync('/contexts/destroy', { form: {
        clusterId : CLUSTER_ID,
        contextId : contextId
    }}).spread(function(res, body) {
        console.log(logPrefix, "[deleteContext]", "deleted contextId: ", contextId);
        return body;
    });
}
// returns the path to the script which when run on cluster, initializes the variables
function genInitArgsScript(initArgs, mode, suffix) {
    var tempFile = NetworkDataCache.genTempFilePath('etl_scripts-', suffix);

    var data = [];
    if(mode ==='extractUsers') {
        data.push(`srcParquetFile = "${initArgs.srcParquetFile}"`);
        data.push(`destCSVFile = "${initArgs.destCSVFile}"`);
        data.push(`entity_list = ["${initArgs.entity_list.join('", "')}"]`);
        data.push(`entity = "${initArgs.entity}"`);

    } else if(mode === "gen_parquet") {
        data.push(`srcFilePath="${initArgs.srcFilePath}"`);
        data.push(`destParquetFilePath="${initArgs.destParquetFilePath}"`);
        data.push(`delimiter="${initArgs.delimiter}"`);

    } else {
        data.push(`srcFilePath="${initArgs.srcFilePath}"`);
        data.push(`dataName="${initArgs.dataName}"`);
        data.push(`filteredParquetPath="${initArgs.filteredParquetPath != null ? initArgs.filteredParquetPath : 'None'}"`);
        data.push(`destEntityInfoPath="${initArgs.destEntityInfoPath}"`);
        data.push(`destSimMatKey="${initArgs.destSimMatKey}"`);

        data.push(`demographics=${initArgs.demographics ? "True" : "False"}`);

        var filterSpecJson = JSON.stringify(initArgs.filterSpec);
        data.push(`filterSpecJson="""${filterSpecJson}"""`);
        data.push(`entity='${initArgs.entity}'`);

        var colValFilters = initArgs.colValFilters;
        data.push(`colValFiltersEnabled = ${initArgs.colValFiltersEnabled ? "True" : "False"}`);
        data.push(`colValFilters = {}`);
        if(initArgs.colValFiltersEnabled && _.size(colValFilters) > 0) {
            _.forOwn(colValFilters, function(val, key) {
                if(key && _.trim(key).length > 0) {
                    data.push(`colValFilters['${key}']='${val}'`);
                }
            });
        }
        data.push(`partName="${initArgs.partName}"`);
        data.push(`entity="${initArgs.entity ? initArgs.entity : 'merchant'}"`);
    }

    // common data
    data.push(`ACCESS_KEY = "${ACCESS_KEY}"`);
    data.push(`SECRET_KEY = "${SECRET_KEY}"`);
    data.push(`AWS_BUCKET_NAME = "${TEMP_BUCKET}"`);
    data.push(`ETL_BUCKET = "${ETL_BUCKET}"`);
    data = data.join('\n');

    return Promise.fromCallback(function(cb) {
        fs.writeFile(tempFile, data, 'utf-8', cb);
    })
    .thenReturn(tempFile);
}

// executes the script on cluster
function applyScripts(contextId, filePath) {
    var formData = {
        language:"python",
        clusterId:CLUSTER_ID,
        command:fs.createReadStream(filePath),
        contextId:contextId
    };
    return postAsync({url : 'commands/execute', formData : formData })
        .spread(function(res, body) {
            console.log(logPrefix, "[applyScripts]", "got commandId: ", body.id);
            return body.id;
        });
}
// waits for the script to finish by polling the server
function waitForFinish(contextId, commandId, postPingFn) {
    var fsPinger = new EventEmitter();
    var pingCount = 0;

    var pingFn = function() {
        pingCount++;
        postPingFn && postPingFn(pingCount);
        console.log(logPrefix, "[waitForFinish]", `[${commandId}]`, "Ping number:",pingCount);
        return getAsync({
            url : "/commands/status",
            qs : {
                clusterId:CLUSTER_ID,
                commandId:commandId,
                contextId:contextId
            }
        });
    };

    return new Promise(function(resolve, reject) {
        fsPinger.on('ping', () => {
            var pingTime = pingCount < 1 ? 5000 : 16000;
            pingFn()
            .spread(function(res, body) {
                // console.log(logPrefix, "[waitForFinish]", "got Body: ", body);
                if(body.status == "Finished") {
                    if(body.results.resultType == 'error') {
                        console.log(logPrefix, "[waitForFinish]", `[${commandId}]`, "Error in executing command");
                        console.log(body.results.cause);
                        reject(new Error(JSON.stringify(body.results)));
                    } else {
                        console.log(logPrefix, "[waitForFinish]", `[${commandId}]`, "Command successful");
                        console.log(body.results.data);
                        resolve(body.results);
                    }
                } else if(body.status == "Cancelled" || body.status == "Cancelling") {
                    reject(new Error(JSON.stringify(body)));
                } else if(body.status == "Error") {
                    reject(new Error(JSON.stringify(body)));
                } else {
                    console.log(logPrefix, "[waitForFinish]", `[${commandId}]`,"Command is", body.status);
                    console.log(logPrefix, "[waitForFinish]", `[${commandId}]`,`pinging in ${pingTime / 1000} secs`);
                    // Running, Queued
                    setTimeout(() => { fsPinger.emit('ping'); }, pingTime);
                }
            });
        });
        fsPinger.emit('ping');
    });
}

var api = {
    set_cluster,
    extractUsersForEntities,
    runNetworkGenFromSimMat,
    genContext,
    deleteContext,
    genInitArgsScript,
    applyScripts,
    waitForFinish
};
module.exports = api;
