'use strict';
/**
 * DataSourceParser Mixin
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
 * - Bucket for data is mappr-user-datasources/{orgId}/
 */

var _            = require('lodash'),
    util         = require('util'),
    url          = require('url'),
    fs           = require('fs'),
    request      = require('request'),
    mm           = require('micromatch'),
    isGlob       = require('is-glob'),
    Promise      = require('bluebird');

var NetworkDataCache     = require("../services/NetworkDataCache"),
    UploadAPI = require('../services/UploadAPI'),
    dataUtils = require('../utils/dataUtils'),
    generateShortUID6 = require('../services/UIDUtils').generateShortUID6;

var RecipeEngineError      = require('./recipe_errors').RecipeEngineError,
    DataSourceInvalidError = require('./recipe_errors').DataSourceInvalidError,
    VALIDATION_FAILED      = require('./recipe_errors').VALIDATION_FAILED;

function ParsedDataSrc (dataset, networks, urlInfo) {
    this.dsid = "dsid-" + generateShortUID6(); // primarily used for phase reporting
    this.dataset = dataset;
    if(!_.isEmpty(networks) && !_.isEmpty(_.get(networks[0], 'links'))) {
        this.networks = networks;
    } else {
        this.networks = null;
    }
    this.urlInfo = urlInfo;
    this.name = urlInfo ? urlInfo.path : dataset.sourceInfo.sourceURL;
}

var PHASE_NAME = 'data_ingest';

// mixed into RecipeEngine. 'this' refers to that object
function DataSourceImportMixin () {
    /**
     * loads up datasource, parses them int a list. stores the list onto `this`
     * @return {[ParsedDataSrc]} [returns ParsedDataSrc object]
     */
    this.gen_dataSource = function(reporter) {
        var cfg = this.recipe.data_ingest,
            opts = this.opts,
            self = this;

        console.log('ETL url:', this.etlNetworkUrl);
        if(cfg.srcType === 'uploadedData') {
            this.emit('info', `loading uploaded data as a datasource. given: ${opts.uploadId}`);
            return NetworkDataCache.getNetworkDataFromCache(opts.uploadId)
            .then(data => [new ParsedDataSrc(data.dataset, data.networks, null)]);
        }
        reporter.setPhase(PHASE_NAME);

        var srcInfoFn = (urlInfo) => {
            return {
                sourceType : 's3',
                sourceURL : urlInfo.href,
                s3Bucket : urlInfo.host,
                s3Key : urlInfo.path.slice(1)
            };
        };

        // download from S3
        if(cfg.srcType === 'URL') {
            var urls = cfg.srcUrl;
            // if a single string is specified
            if(!_.isArray(cfg.srcUrl)) {
                urls = [cfg.srcUrl];
            }
            // an etl url, use that.
            if(_.get(this, "etl_results.networkUrl")) {
                urls = [_.get(this, "etl_results.networkUrl")];
                srcInfoFn = (urlInfo) => {
                    return {
                        sourceType : 'ETL',
                        sourceURL : self.etl_results.sourceUrl,
                        s3Bucket : self.etl_results.bucket,
                        s3Key : self.etl_results.key,
                        entity : self.etl_results.entity
                    };
                };
            }
            this.emit('info', `loading ${urls.length} dataSource(s). given: ${util.inspect(urls)}`);

            // if urls are globs, get a list of all files in the bucket which match this glob
            urls = Promise.reduce(urls.map(u => this.processUrl(u)), function (matchedUrls, urlInfo) {
                console.log("URL: ", urlInfo.href);
                if(isGlob(urlInfo.path)) {
                    console.log("Glob DECTECTED:", urlInfo.path);
                    return self.getMatchingFiles(urlInfo)
                        .then(urls => matchedUrls.concat(urls));
                } else {
                    console.log("Simple URL: ", urlInfo.path);
                    matchedUrls.push(urlInfo.href);
                    return matchedUrls;
                }
            },[]).bind(this);

            // validate and gen urlInfo obj
            return urls
                .map(srcUrl => this.processUrl(srcUrl))
                // for each url,
                .map(function (urlInfo, idx) {
                    // download to a file depending on protocol
                    var itemReporter = reporter.forItem(urlInfo.path);
                    return this.downloadFileOnUrl(itemReporter, urlInfo)
                        // generate datasource
                        .then(filePath => this.parseFile(filePath, srcInfoFn(urlInfo))
                        // gen info object
                        ).then(dsSrc => new ParsedDataSrc(dsSrc.dataset, dsSrc.networks, urlInfo))
                        .tap(function() {
                            itemReporter.emitPhaseItemProg({
                                taskCompletion : 100,
                                msg : `finished extracting source from : ${urlInfo.path}`
                            });
                        });
                });
        } else {
            var err = new RecipeEngineError(PHASE_NAME, 'gen_dataSource', 'NOT_SUPPORTED_SRC_TYPE', 'Source Type not supported. Given: ' + cfg.srcType);
            return Promise.reject(err);
        }
    };
    /**
     * individual url processing
     * @return {[type]}     [description]
     */
    this.processUrl = function (srcUrl) {
        // validation
        if(!_.isString(srcUrl) || srcUrl.length < 5) {
            var err = new DataSourceInvalidError(PHASE_NAME, 'processUrl', srcUrl);
            this.emit(VALIDATION_FAILED, err);
            return null;
        }
        var urlInfo = url.parse(srcUrl);
        return urlInfo;
    };

    /**
     * download file for given url. based on the protocol.
     * @param  {[type]} urlInfo [description]
     * @return {Promise[String]}         [filePath where downloaded file is stored]
     */
    this.downloadFileOnUrl = function (itemReporter, urlInfo) {
        var file = null;
        switch(urlInfo.protocol) {
        case 's3:' : file = this.downloadFromS3(itemReporter, urlInfo.host, urlInfo.path.slice(1)); break;
        case 'http:': file = this.downloadViaGET(itemReporter, urlInfo); break;
        default : throw new RecipeEngineError(PHASE_NAME, 'downloadFileOnUrl', 'NOT_SUPPORTED_PROTOCOL', `protocol not supported. given : ${urlInfo.protocol}`);
        }
        return file;
    };
    /**
     * S3 Downloader
     * @param  {[type]} bucket [description]
     * @param  {[type]} key    [description]
     * @return {[String]}      [filePath where downloaded file is stored]
     */
    this.downloadFromS3 = function (itemReporter, bucket, key) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var client = UploadAPI.getClient();
            var tempFile = NetworkDataCache.genTempFilePath('gen_recipe_s3/', key);
            var params = {
                localFile: tempFile,
                s3Params: {
                    Bucket: bucket,
                    Key: key
                // other options supported by getObject
                // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property
                }
            };
            self.emit('info',`[gen_dataSource][downloadFromS3] starting downloading file '${key}' to '${tempFile}'`);
            var downloader = client.downloadFile(params);
            downloader.on('error', err => {
                console.error("unable to download:", err);
                var e = new RecipeEngineError(PHASE_NAME, 'downloadFromS3', 'S3_DOWNLOAD_FAILED',err);
                self.emit('error',e);
                reject(e);
            });
            downloader.on('progress', () => {
                itemReporter.emitPhaseItemProg({
                    taskCompletion : (downloader.progressAmount / downloader.progressTotal) * 100,
                    msg : `[gen_dataSource][downloadFromS3] downloading file '${key}'. progress: ${downloader.progressAmount}. total : ${downloader.progressTotal}`
                });
                self.emit('info',`[gen_dataSource][downloadFromS3] downloading file '${key}'. progress: ${downloader.progressAmount}. total : ${downloader.progressTotal}`);
            });
            downloader.on('end', () => {
                itemReporter.emitPhaseItemProg({
                    taskCompletion : 100,
                    msg : `[gen_dataSource][downloadFromS3] download finished of ${key}`
                });
                self.emit('info',`[gen_dataSource][downloadFromS3] download finished of ${key}`);
                resolve(tempFile);
            });
            console.log("DOWNLOAD STARTED");
        });
    };
    this.downloadViaGET = function(itemReporter, urlInfo) {
        var self = this;
        var logPrefix = '[gen_dataSource][downloadViaGET]';
        var tempFile = NetworkDataCache.genTempFilePath('gen_recipe_get/', urlInfo.path.slice(1));
        return new Promise(function(resolve, reject) {
            self.emit('info',`${logPrefix} starting downloading file '${urlInfo.href}' to '${tempFile}'`);
            var progressAmount = 0, progressTotal = 1;
            NetworkDataCache.ensureDirectoryExistence(tempFile);
            var tempFileStream = fs.createWriteStream(tempFile);
            tempFileStream
                .on('open', function() {
                    console.log(logPrefix, "File open for writing");
                    request({url:urlInfo.href})
                        .on('error', function(err){
                            console.error("unable to download:", err);
                            var e = new RecipeEngineError(PHASE_NAME, 'downloadViaGET', 'GET_DOWNLOAD_FAILED',err);
                            self.emit('error',e);
                            reject(e);
                        })
                        .on('end', function(){
                            self.emit('info',`${logPrefix} file download finished`);
                            tempFileStream.close();
                        })
                        .on('response', function (data) {
                            progressTotal = data.headers['content-length'];
                            self.emit('info',`${logPrefix} file size of '${urlInfo.path}' is: '${progressTotal}'`);
                        })
                        .on('data', function(data) {
                            progressAmount += data.length;
                            itemReporter.emitPhaseItemProg({
                                taskCompletion : (progressAmount / progressTotal) * 100,
                                msg : `${logPrefix} downloading file '${urlInfo.path}'. progress: ${toMB(progressAmount)}. total : ${toMB(progressTotal)} Mb`
                            });
                            self.emit('info',`${logPrefix} downloading file '${urlInfo.path}'. progress: ${toMB(progressAmount)}. total : ${toMB(progressTotal)} Mb`);
                        })
                        .pipe(tempFileStream);
                })
                .on('close', function() {
                    if(progressTotal > 1) {
                        itemReporter.emitPhaseItemProg({
                            taskCompletion : 100,
                            msg : `${logPrefix} download finished of ${urlInfo.path}`
                        });
                        self.emit('info',`${logPrefix} download finished of ${urlInfo.path}`);
                        resolve(tempFile);
                    }
                });
        });
    };
    /**
     * Parses file into datasource.
     * @param  {[type]} filePath   [description]
     * @param  {[type]} sourceInfo [description]
     * @return {[Object]}          [DataSource object.]
     */
    this.parseFile = function (filePath, sourceInfo) {
        var self = this;
        return new Promise(function (resolve, reject) {
            //extract file-extension
            var nameArr = filePath.split('.');
            var ext = (nameArr[nameArr.length-1]).toUpperCase();

            //build parse func
            var parseFn = dataUtils.getFileParser(filePath);
            if(!parseFn) {
                var err = new RecipeEngineError(PHASE_NAME, 'parseFile', 'NOT_SUPPORTED_FILE', "Wrong file type! Can crunch GEXF, XLS, XLSX files only.");
                self.emit('error',`[gen_dataSource][parseFile] file parser not available for given extn. Cant generate dataset. Ext: ${ext}`);
                throw err;
            }
            self.emit('info',`[gen_dataSource][parseFile] started parsing file with ext: ${ext}`);
            parseFn(filePath)
            .then(result => {
                // set generator type correctly
                _.each(result.dataset.attrDescriptors, function(attrDescr) {
                    attrDescr.generatorType = sourceInfo.sourceURL;
                });
                _.assign(result.dataset.sourceInfo, sourceInfo);
                self.emit('info',`[gen_dataSource][parseFile] parsing successful!`);
                resolve(result);
            })
            .catch(err => {
                console.error('Unable to parse file', err);
                return reject(err);
            });
        });
    };

    this.getMatchingFiles = function (urlInfo) {
        var self = this;
        // can only glob s3 for now
        if(!urlInfo.protocol.startsWith('s3')) {
            var err = new DataSourceInvalidError(PHASE_NAME, 'getMatchingFiles', url);
            this.emit(VALIDATION_FAILED, urlInfo.href, "url isn't a s3 url. Cannot glob.");
            throw err;
        }
        var globInfo = mm.expand(urlInfo.path.slice(1));

        return new Promise(function __getMatchingFilesFromS3(resolve, reject) {
            var client = UploadAPI.getClient();
            var finder = client.listObjects({
                s3Params : {
                    Bucket : urlInfo.host,
                    Prefix : globInfo.tokens.base + '/'
                }
            });
            var finalUrls = [], s3Prefix = `s3://${urlInfo.host}/`;

            finder.on('data', function (awsData) {
                // console.log("[gen_dataSource][getMatchingFilesFromS3] Got data: ", awsData);
                var data = awsData.Contents;
                var keys = data.map(d => d.Key);
                self.emit('info', `[gen_dataSource][getMatchingFilesFromS3] got files : ${util.inspect(keys)}`);
                keys = mm(keys, globInfo.orig);
                self.emit('info', `[gen_dataSource][getMatchingFilesFromS3] matched files : ${util.inspect(keys)}`);
                // append to already discovered ones
                _.reduce(keys, function (urls, fileKey) {
                    urls.push(s3Prefix + fileKey);
                    return urls;
                }, finalUrls);
            });

            finder.on('error', function (err) {
                console.error("[gen_dataSource][getMatchingFilesFromS3] Unable to download:", err);
                var e = new RecipeEngineError(PHASE_NAME, 'getMatchingFilesFromS3', 'S3_DOWNLOAD_FAILED',err);
                self.emit('error',e);
                reject(e);
            });

            finder.on('end', function () {
                self.emit('info',`[gen_dataSource][getMatchingFilesFromS3] matching finished for patther ${urlInfo.href}`);
                resolve(finalUrls);
            });
        });
    };
    // returns the path of the built dataset
    // this.run_etl = function(itemReporter, urlInfo, cfg) {
    //     var scriptPath = etlModel.getFilePath(cfg.scriptName),
    //         etlScriptPath = etlModel.getFilePath(cfg.dataETLScriptName),
    //         etlOpts = cfg.etl_readOpts,
    //         filterSpec = cfg.etl_filterSpec,
    //         genDemoGraphics = cfg.etl_genDemographics,
    //         entity = cfg.etl_entity;
    //     // to run etl we need to do 2 things
    //     // 1) import data
    //     // 2) run the etl script
    //     var orgId = this.org.id.toString(),
    //         recipeId = this.recipe._id.toString(),
    //         datasourceBucket = "mappr-user-datasources",
    //         fileName = _.last(urlInfo.path.split('/'));

    //     var paraquetFilePath = `/mnt/${datasourceBucket}/${orgId}/processed-data/${_.last(urlInfo.path.split('/'))}`;
    //     var destWorkBookKey = `${orgId}/etl-data/${_.last(urlInfo.path.split('/'))}_Network.xls`;
    //     var dataInitArgs = {
    //         srcFilePath : urlInfo.href,
    //         destFilePath: paraquetFilePath,
    //         tab_sep : etlOpts.tab_sep
    //     };
    //     var etlInitArgs = {
    //         dataName : fileName,
    //         srcFilePath : paraquetFilePath,
    //         destEntityInfoPath : `etl-results/${orgId}/${fileName}/entityInfo.csv`,
    //         destSimMatKey : `etl-results/${orgId}/${fileName}/simMat.pickle2`
    //     };

    //     var netgenArgs = {
    //         fileName,
    //         entityInfoKey : etlInitArgs.destEntityInfoPath + '/part-00000',
    //         simMatKey : etlInitArgs.destSimMatKey,
    //         destWorkBookKey,
    //         recipeId
    //     };
    //     this.emit('info', `[gen_dataSource][run_etl] running ETL on url: ${urlInfo.href}`);
    //     itemReporter.emitPhaseItemProg({
    //         taskCompletion : 1,
    //         msg : `[gen_dataSource][run_etl] DataImport started with args : ${util.inspect(dataInitArgs)}`
    //     });
    //     return etlScriptRunner.runDataImportScript(importScriptPath, dataInitArgs)
    //         .tap(() =>
    //             itemReporter.emitPhaseItemProg({
    //                 taskCompletion : 33,
    //                 msg : `[gen_dataSource][run_etl] dataImport finished`
    //             }))
    //         .tap(() =>
    //             itemReporter.emitPhaseItemProg({
    //                 taskCompletion : 33,
    //                 msg : `[gen_dataSource][run_etl] ETLScript started with args : ${util.inspect(etlInitArgs)}`
    //             }))
    //         .then(function() {
    //             return etlScriptRunner.runETLScript(etlScriptPath, etlInitArgs);
    //         })
    //         .tap(() =>
    //             itemReporter.emitPhaseItemProg({
    //                 taskCompletion : 66,
    //                 msg : `[gen_dataSource][run_etl] ETLScript finished`
    //             }))
    //         .tap(() =>
    //             itemReporter.emitPhaseItemProg({
    //                 taskCompletion : 66,
    //                 msg : `[gen_dataSource][run_etl] NetworkFromSimmat started with args : ${util.inspect(netgenArgs)}`
    //             }))
    //         .then(function() {
    //             return etlScriptRunner.runNetworkGenFromSimMat(netgenArgs.fileName,
    //                 netgenArgs.entityInfoKey, netgenArgs.simMatKey,
    //                 netgenArgs.destWorkBookKey, netgenArgs.recipeId);
    //         })
    //         // return the url form where the file has to be downloaded
    //         .then(function() {
    //             return `s3://${datasourceBucket}/${destWorkBookKey}`;
    //         })
    //         .tap(url =>
    //             itemReporter.emitPhaseItemProg({
    //                 taskCompletion : 100,
    //                 msg : `[gen_dataSource][run_etl] NetworkFromSimmat finished. final Url: ${url}`
    //             }))
    //         .tap(url => this.emit('info', `[gen_dataSource][run_etl] Dest woorkbook url: ${url}`));

    // };
}

function toMB(x) { return x / 1048576; }//1048576 - bytes in  1Megabyte


module.exports = DataSourceImportMixin;
