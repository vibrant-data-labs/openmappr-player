'use strict';
/**
 * ETLParser Mixin
 * for ETL, This has to :
 * 1) make sure the url is valid
 * 2) skip unecessary processing of data, if has already been processed
 * 3) execute importer script on it to generate the paraquet file
 * 4) run the ETL on the paraquet file to generate entityInfo / simMat
 * 5) Combine entityInfo / simMat to generate network data
 * 6) Process network data into a dataset
 *
 * NOTES
 * - To skip processing, generated paraquet file is tagged with the last-modified-date of source file.
 *   This tag is checked to find out if re-import has to take place again.
 * - Bucket for data is mappr-user-ETLs/{orgId}/
 */

var _            = require('lodash'),
    url          = require('url'),
    Promise      = require('bluebird');

var etlModel = require('../etl/etl_model'),
    UploadAPI = require('../services/UploadAPI'),
    SR = require('../etl/script_runner');

var PHASE_NAME = 'etl_gen';
var ETLBucket = "mappr-user-datasources";
// mixed into RecipeEngine. 'this' refers to that object
function ETLRunnerMixin () {
    this.isETLEnabled = function() {
        return this.recipe.etl_gen.enabled;
    },
    /**
     * loads up ETL, parses them int a list. stores the list onto `this`
     * @return {[ParsedDataSrc]} [returns ParsedDataSrc object]
     */
    this.gen_etl = function(reporter) {
        var cfg = this.recipe.etl_gen,
            // src url is specified in data_ingest
            srcUrl = this.recipe.data_ingest.srcUrl,
            logPrefix = "[etl_gen]";

        if(!cfg.enabled) return null;
        reporter.setPhase(PHASE_NAME);

        var urlInfo = url.parse(srcUrl);

        console.log(logPrefix, "running ETL on file:", urlInfo.href);


        var script = etlModel.get(cfg.scriptName),
            filterSpec = cfg.filterSpec,
            genDemoGraphics = cfg.genDemographics,
            entity = cfg.entity,
            colValFiltersEnabled = cfg.colValFiltersEnabled,
            colValFilters = cfg.colValFilters,
            partName = cfg.partName,
            isParquet = cfg.isParquet;

        var orgId = this.org.id.toString(),
            recipeId = this.recipe._id.toString(),
            runId = this.run._id.toString(),
            fileName = _.last(urlInfo.path.split('/')),
            destWorkBookKey = `${orgId}/etl-data/run-${runId}/${fileName}-Network.xls`;

        // check if filtering is enabled, if yes, then use filteredParquetPath
        var filteredParquetPath = null;
        if(filtersApplied(cfg)) {
            filteredParquetPath = `${orgId}/filtered-parquet/${recipeId}/run-${runId}/${fileName}-filtered-parquet`;
        }
        console.log(logPrefix, "filteredParquetPath:", filteredParquetPath);

        // 1st we check whether there is an equivalent parquet script for this data source already generated.
        // if yes, then we use that as source, otherwise generate the file 1st

        if(!isParquet) {
            var parquetP = get_parquet_filepath(orgId, urlInfo);
            parquetP = parquetP.then(filePath => {
                if(filePath) {
                    console.log(logPrefix, "parquet file already generated, so skipping..");
                    return filePath;
                }
                return gen_parquet_file(reporter.forItem('gen_parquet'), urlInfo,
                    build_parquet_key(orgId, urlInfo), script);
            });
        } else {
            var parquetP = Promise.resolve(urlInfo.href);
        }

        var initArgs = {
            dataName : fileName,
            filteredParquetPath : filteredParquetPath,
            destEntityInfoPath : `etl-results/${orgId}/${recipeId}/${fileName}/entityInfo.csv`,
            destSimMatKey : `etl-results/${orgId}/${recipeId}/${fileName}/simMat.pickle2`,
            demographics : genDemoGraphics == false ? false : true,
            filterSpec : filterSpec,
            entity : entity,
            colValFiltersEnabled : colValFiltersEnabled,
            colValFilters : colValFilters,
            partName : partName
        };
        // now we run the entity Extraction script
        var onETL = parquetP.then(parquetFileKey => {
            if(!isParquet) {
                initArgs.srcFilePath = `/mnt/${ETLBucket}/${parquetFileKey}`;
            } else {
                initArgs.srcFilePath = srcUrl;
            }
            return gen_network(reporter.forItem('etl_entity_extract'), urlInfo, initArgs, script);
        });

        // finally generate network
        var netgenArgs = {
            fileName,
            entityInfoKey : initArgs.destEntityInfoPath + '/part-00000',
            simMatKey : initArgs.destSimMatKey,
            destWorkBookKey,
            recipeId
        };
        var itemReporter = reporter.forItem('etl_netgen');
        itemReporter.emitPhaseItemProg({
            taskCompletion : 1,
            msg : `${logPrefix} network generation started.`
        });
        var pingFn = incrUpdate(itemReporter, logPrefix, 'network_gen', 2);
        var onNetgen = onETL.then(function() {
            console.log(logPrefix, "[netgen]", "running netgen");
            return SR.runNetworkGenFromSimMat(netgenArgs.fileName,
                netgenArgs.entityInfoKey, netgenArgs.simMatKey,
                netgenArgs.destWorkBookKey, netgenArgs.recipeId, pingFn);
        })
        // return the url form where the file has to be downloaded
        .then(function() {
            var bucketAndKey = getBucketAndKey(urlInfo);
            var sourceUrl = filteredParquetPath ? `/mnt/${ETLBucket}/${filteredParquetPath}` : initArgs.srcFilePath;
            console.log(logPrefix, '[sourceUrl] sourceUrl', sourceUrl);
            return {
                sourceUrl : sourceUrl,
                networkUrl : `s3://${ETLBucket}/${destWorkBookKey}`,
                bucket : bucketAndKey.bucket,
                key : bucketAndKey.key,
                entity : entity
            };
        })
        .tap(srcPath => console.log(logPrefix, "[netgen]", "finished netgen. network written at:", srcPath))
        .tap(srcPath => {
            itemReporter.emitPhaseItemProg({
                taskCompletion : 100,
                msg : `${logPrefix} netgen finished. written to ${srcPath}`
            });
        });

        return onNetgen;
    };
}
function build_parquet_key(orgId, urlInfo) {
    var parquetPrefix = 'parquet_files';
    var bucketAndKey = getBucketAndKey(urlInfo);
    var parquetFilePath = `${parquetPrefix}/${orgId}/${bucketAndKey.key}-parquet`;
    return parquetFilePath;
}

function filtersApplied(cfg) {
    var filterSpec = cfg.filterSpec,
        colValFiltersEnabled = cfg.colValFiltersEnabled,
        colValFilters = cfg.colValFilters;
    var colFiltersApplied = false,
        genFiltersApplied = false;

    if(colValFiltersEnabled && colValFilters && _.keys(colValFilters).length > 0) {
        // check for non zero filters
        colFiltersApplied = _.any(_.values(colValFilters), val => _.trim(val).length > 0);
    }
    if(filterSpec) {
        var rowFilter = filterSpec.rowFilter && filterSpec.rowFilter.length > 0;
        var colFilters = _.any(_.values(filterSpec.filterByColValues || {}), val => _.trim(val).length > 0);
        genFiltersApplied = rowFilter || colFilters;
    }
    console.log('[filtersApplied]', 'colFiltersApplied:', colFiltersApplied);
    console.log('[filtersApplied]', 'genFiltersApplied:', genFiltersApplied);
    return colFiltersApplied || genFiltersApplied;
}

// returns the path of the parquet file of the source data
// if the file has already been generated, then returns path iff parquet file is newer
// than source file
// otherwise returns null
function get_parquet_filepath(orgId, urlInfo) {
    var parquetFilePath = build_parquet_key(orgId, urlInfo),
        bucketAndKey = getBucketAndKey(urlInfo);

    var srcTimestamp = getTimestamp(bucketAndKey.bucket, bucketAndKey.key),
        parquetTimestamp = getTimestamp(ETLBucket, parquetFilePath + '/_SUCCESS');

    return Promise.join(srcTimestamp, parquetTimestamp,
            (srcts, parts) => srcts < parts ? parquetFilePath : null)
        .catch(err => { console.warn(err); return null;});
}

function gen_parquet_file(itemReporter, urlInfo, parquetFileKey, etlScript) {
    var logPrefix = "[gen_parquet_file]";
    var initArgs = {
        srcFilePath : urlInfo.href,
        destParquetFilePath : `/mnt/${ETLBucket}/${parquetFileKey}`,
        delimiter : '\t'
    };
    console.log(logPrefix, "ETL options:", initArgs);

    itemReporter.emitPhaseItemProg({
        taskCompletion : 1,
        msg : `${logPrefix} Parquet file export started.`
    });
    var writeParquetP = SR.genContext()
        .then(function(contextId) {
            // apply init script
            console.log(logPrefix, "running common init script");
            var onInit = SR.genInitArgsScript(initArgs, 'gen_parquet', '-import-init.py')
                .then(filePath => SR.applyScripts(contextId, filePath))
                .then(commandId => SR.waitForFinish(contextId, commandId))
                .tap(function(result) {
                    console.log(logPrefix, "init script done");
                    console.log("Result of script: ", result);
                });
            itemReporter.emitPhaseItemProg({
                taskCompletion : 5,
                msg : `${logPrefix} Parquet file export initialized.`
            });

            // apply the scripts
            var scriptRuns = onInit
                .thenReturn(etlScript.paraquet_writer)
                .mapSeries(function(stageInfo) {
                    var proc_name = stageInfo[0],
                        scr_path = stageInfo[1];
                    console.log(logPrefix, "running script for stage:", proc_name,
                                'at path:', scr_path);
                    itemReporter.emitPhaseItemProg({
                        taskCompletion : 10,
                        msg : `${logPrefix} stage '${proc_name}' started`
                    });
                    var postPingFn = incrUpdate(itemReporter, logPrefix, proc_name, 11);
                    return SR.applyScripts(contextId, scr_path)
                        .then(commandId => SR.waitForFinish(contextId, commandId, postPingFn))
                        .tap(result => {
                            console.log(logPrefix, "stage finished", proc_name);
                            console.log("Result of script: ", result);
                        })
                        .tap(() => {
                            itemReporter.emitPhaseItemProg({
                                taskCompletion : 90,
                                msg : `${logPrefix} stage '${proc_name}' finished`
                            });
                        });
                });

            return scriptRuns.finally(() => SR.deleteContext(contextId));
        })
        .thenReturn(parquetFileKey)
        .tap(() => console.log(logPrefix, "finished"))
        .tap(() =>
            itemReporter.emitPhaseItemProg({
                taskCompletion : 100,
                msg : `${logPrefix} DataImport finished.`
            }));
    return writeParquetP;
}

function gen_network(itemReporter, urlInfo, initArgs, etlScript) {
    var logPrefix = "[etl_entity_extract]";
    console.log(logPrefix, "ETL options:", initArgs);
    var numSteps = 1 + etlScript.etl_scripts.length,
        incr = 99 / numSteps;

    itemReporter.emitPhaseItemProg({
        taskCompletion : 1,
        msg : `${logPrefix} ETL Extraction started. number of steps: ${numSteps}`
    });

    var postETL = SR.genContext()
        .then(function(contextId) {
            // apply init script
            var onInit = SR.genInitArgsScript(initArgs, 'dataImport', '-import-init.py')
                .then(filePath => SR.applyScripts(contextId, filePath))
                .then(commandId => SR.waitForFinish(contextId, commandId))
                .tap(function(result) {
                    console.log(logPrefix, "init script done");
                    console.log("Result of script: ", result);
                });
            itemReporter.emitPhaseItemProg({
                taskCompletion : 5,
                msg : `${logPrefix} ETL Extraction initialized.`
            });

            // apply the main scripts
            var scriptRuns = onInit
                .thenReturn(etlScript.etl_scripts)
                .tap(scripts => {
                    console.log(logPrefix, `phase has ${scripts.length} scripts`);
                })
                .mapSeries(function(stageInfo, idx) {
                    var proc_name = stageInfo[0], scr_path = stageInfo[1];
                    console.log(logPrefix, "running script for stage:", proc_name, 'at path:', scr_path);
                    itemReporter.emitPhaseItemProg({
                        taskCompletion : incr * (idx),
                        msg : `${logPrefix} stage '${proc_name}' started`
                    });
                    var postPingFn = incrUpdate(itemReporter, logPrefix, proc_name, incr * (idx));
                    return SR.applyScripts(contextId, scr_path)
                        .then(commandId => SR.waitForFinish(contextId, commandId, postPingFn))
                        .tap(result => {
                            console.log(logPrefix, "stage finished", proc_name);
                            console.log("Result of script: ", result);
                        })
                        .tap(() => {
                            itemReporter.emitPhaseItemProg({
                                taskCompletion : incr * (idx + 1),
                                msg : `${logPrefix} stage '${proc_name}' finished`
                            });
                        });
                });

            return scriptRuns.finally(() => SR.deleteContext(contextId));
        })
        .thenReturn(initArgs)
        .tap(() => console.log(logPrefix, "finished"));
    return postETL;
}

function getBucketAndKey(urlInfo) {
    var bucket = urlInfo.host,
        key = urlInfo.path.slice(1); // remove beginning '/' from path
    if(urlInfo.protocol == null && urlInfo.path.startsWith('/mnt')) {
        var splits = urlInfo.path.split('/');
        bucket = splits[2];
        key = splits.slice(3).join('/');
    }
    return {bucket, key};
}

function getTimestamp(bucket, key) {
    var s3 = UploadAPI.getClient();
    var s3Params = { Bucket : bucket, Prefix : key};
    return new Promise(function(resolve, reject) {
        var ee = s3.listObjects({s3Params}),
            hasEnded = false;
        ee.on('data', function(data) {
            hasEnded = true;
            if(data.Contents.length == 0) {
                return reject(new Error(`No file found for key: ${key} in bucket: ${bucket}`));
            }
            var timestamp = data.Contents[0].LastModified.getTime() / 1000;
            console.log('[ETLRunner][getTimestamp] for key:', data.Contents[0].Key, 'got timestamp:', timestamp);
            resolve(timestamp);
        });
        ee.on('end', () => hasEnded && reject(new Error(`[ETLRunner][getTimestamp] Stream ended without any data for key: ${key}`)));
        ee.on('error', err => reject(err));
    });
}

function incrUpdate(itemReporter, logPrefix, proc_name, initProgress) {
    var incr = 0;
    return (msg) => {
        incr = incr + 1.0;
        var waitStr = msg ? `(${msg})` : '';
        itemReporter.emitPhaseItemProg({
            taskCompletion : initProgress + incr,
            msg : `${logPrefix} stage '${proc_name}', waiting...${waitStr}`
        });
    };
}

module.exports = ETLRunnerMixin;
