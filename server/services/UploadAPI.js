'use strict';
var Promise = require("bluebird"),
    s3 = require('s3');

var config = require("./AppConfig").get();

/**
 * Upload files to 3rd party
 *
 */
var s3Client = s3.createClient(config.uploadS3.client_config);

module.exports = {
    getClient: function() {
        return s3Client;
    },

    uploadDirToS3: function(dirPath, remotePlayerDir, setGzipHeaders) {
        var params = {
            localDir: dirPath,
            deleteRemoved: true, // default false, whether to remove s3 objects
            // that have no corresponding local file.

            s3Params: {
                Bucket: config.uploadS3.player_bucket,
                Prefix: remotePlayerDir
                    // other options supported by putObject, except Body and ContentLength.
                    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
            }
        };

        if (setGzipHeaders) {
            params.s3Params.ContentEncoding = 'gzip';
        }

        return new Promise(function(resolve, reject) {
            var uploader = s3Client.uploadDir(params);

            uploader.on('error', function(err) {
                console.error("upload failed:", err.stack);
                reject(err.stack);
            });

            uploader.on('progress', function() {
                console.log("s3 upload progress", uploader.progressAmount, uploader.progressTotal);
            });

            uploader.on('end', function() {
                console.log("done uploading");
                resolve();
            });
        });

    }
};