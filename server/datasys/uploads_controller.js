'use strict';
/**
 * Process and store data in the network Cache. Mostly used to feed recipes.
 * data is ideally owned by organization
 */

var _            = require('lodash');
var Promise      = require("bluebird"),
    fs               = require('fs'),
    request          = require('request');

var dataUtils        = require("../utils/dataUtils.js"),
    NetworkDataCache     = require("../services/NetworkDataCache.js");

function validateAndStoreData(req, res){
    var p = req.body,
        parentDir = './uploads_google/';
    // A promise containing [FileName, filePath, fileDirectory]
    console.log("Files:", req.files);
    console.log("req.files[0]:", req.files[0]);
    var filePathPromise = Promise.resolve([
            req.files && req.files[0].originalname || '',
            req.files && req.files[0].path || '',
            null]),
        sourceInfo = null;

    if(!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir);
    }

    // for google spreadsheet, save the data into a temp file
    if(p.fetchGoogleSpreadsheet === true) {
        filePathPromise = new Promise(function(resolve, reject) {
            var tmpDir = parentDir + 'raw-' + Math.round(Math.random()*Date.now()),
                tmpFile;

            fs.mkdirSync(tmpDir);
            tmpFile = fs.createWriteStream(tmpDir + '/' + p.title);
            request.get({url: p.exportUrl, qs: {access_token: p.accessToken}}).pipe(tmpFile);
            sourceInfo = {
                sourceType : "GOOGLE",
                sourceURL : p.exportUrl
            };

            tmpFile.on('finish', function() { resolve([p.title, tmpFile.path, tmpDir]);});
            tmpFile.on('error', function(err) {
                err.app_msg = "Problem saving google spreadsheet to local system";
                err.http_code = 500;
                reject([err]);
            });
        });
    }
    else if(p.fetchFromUrl === true) {
        filePathPromise = new Promise(function(resolve, reject) {
            var tmpDir = parentDir + 'raw-' + Math.round(Math.random()*Date.now()),
                tmpFile;

            fs.mkdirSync(tmpDir);
            tmpFile = fs.createWriteStream(tmpDir + '/' + p.title);
            request.get({url: p.exportUrl}).pipe(tmpFile);
            sourceInfo = {
                sourceType : "ThirdParty",
                sourceURL : p.exportUrl
            };

            tmpFile.on('finish', function() { resolve([p.title, tmpFile.path, tmpDir]);});
            tmpFile.on('error', function(err) {
                err.app_msg = "Problem importing file to local system";
                err.http_code = 500;
                reject([err]);
            });
        });
    }

    // Build temp Dataset from file
    filePathPromise.spread(function(fileName, filePath, fDir) {
        //extract file-extension
        var nameArr = fileName.split('.');
        var ext = (nameArr[nameArr.length-1]).toUpperCase();

        //build parse func
        var parseFn = dataUtils.getFileParser(fileName);
        sourceInfo = sourceInfo || {
            sourceType : ext,
            sourceURL : fileName
        };
        if(!parseFn) {
            var err = new Error("Wrong file type! Can crunch GEXF, XLS, XLSX files only.");
            err.http_code = 500;
            throw err;
        }
        return parseFn(filePath)
            .then(function(result) {
                fDir && NetworkDataCache.deleteFolderRecursive(fDir); // delete google temp file
                // set generator type correctly
                _.each(result.dataset.attrDescriptors, function(attrDescr) {
                    attrDescr.generatorType = fileName;
                });
                _.assign(result.dataset.sourceInfo, sourceInfo);
                return result;
            });
    }).then(function(tempData) { // File has been parsed, time to cache it
        return NetworkDataCache.cacheNetworkData(tempData).then(function(cacheId) {
            return {
                uploadId: cacheId,
                fileId: cacheId, //backwards compatibility
                columns: tempData.dataset.attrDescriptors,
                nodesCount: tempData.dataset.datapoints.length,
                edgesCount : tempData.networks.length > 0 ? tempData.networks[0].links.length : 0,
                nodesInfo: tempData.dataset.datapoints,
                sourceInfo : tempData.dataset.sourceInfo,
                networks: tempData.networks,
                removedReservedAttrs: tempData.removedReservedAttrs
            };
        });
    })
    .then(function(result) {
        res.status(200).send(result);
    }).caught(function(err) {
        console.log("Got error:", err.stack || err);
        var code = err.http_code || 500;
        var msg = err.stack || err.message || err.app_msg || "Something unexpected Happened";

        res.status(code).send(msg);

    });
}

function getData (req, res) {
    var uploadId = req.params.uploadid;
    if(!uploadId) {
        return res.status(400).send('No uploadId given.');
    }
    if(!NetworkDataCache.isKeyValid(uploadId)) {
        return res.status(400).send(`upload with Id does not exist with the system. Given key: ${uploadId}`);
    }
    NetworkDataCache.getNetworkDataFromCache(uploadId)
    .then( data => res.status(200).json(data))
    .catch(err => res.status(400).send(err.stack || err));
}

//API
module.exports = {
    validateAndStoreData,
    getData
};
