'use strict';
var Promise      = require('bluebird'),
    util         = require('util'),
    EventEmitter = require('events'),
    _            = require('lodash');

var JobTracker = require('../services/JobTracker');
// var AthenaAPI = require('../services/AthenaAPI');

var SR = require('./script_runner');
var UploadAPI = require('../services/UploadAPI');
var logPrefix = "[etl_controller]";

module.exports = {
    // given a filterspec, apply that filter and generates a list of users save to S3
    slice_extract_users_for_entity : function (req, res) {
        // basically be given a list of merchants, and the datasource URL
        if(!req.body.entityList || req.body.entityList.length == 0) {
            return res.status(400).send('No entityList found in the body');
        }
        if(!req.body.srcParquetFile) {
            return res.status(400).send('No parquet url given. Filteration only happens on parquet files');
        }
        if(!req.body.projectId) {
            return res.status(400).send('No Project Id given.');
        }

        var taskId = req.body.taskId;
        var job = null;

        if(taskId && taskId.length > 0) {
            job = JobTracker.get(taskId);
            if(job == null) {
                return res.status(400)
                    .send(`No Task tracking available for taskId ${taskId}. create a new task if monitoring is required`);
            }
        } else {
            return res.status(400).json({
                error : 'Invalid or no name/taskId',
                errorString: util.inspect(req.body)
            });
        }

        var entityCol = req.body.entity,
            entityList = req.body.entityList,
            srcParquetFile = req.body.srcParquetFile,
            projectId = req.body.projectId;

        var destFileKey = `extracted-users/project-${projectId}/users-of-${entityList.length}-entities.csv`;
        var s3 = UploadAPI.getClient();
        var Key = `${destFileKey}/part-00000`;
        var bucket = 'mappr-slice';
        var result = {
            s3url : `s3://${bucket}/${Key}`,
            s3signedUrl : s3.s3.getSignedUrl('getObject', {Bucket :bucket, Key : Key})
        };
        console.log(logPrefix, "TASK ID:", taskId);
        console.log(logPrefix, "Running new extract-users with options:", {srcParquetFile, destFileKey, entityList, entityCol});

        var eventStream = new EventEmitter();
        var onDone = SR.extractUsersForEntities(eventStream, entityCol, entityList, srcParquetFile, `/mnt/${bucket}/${destFileKey}`)
            .then(() => {
                return result;
            });
        onDone.then(r => console.log(logPrefix, "extract entities finished:", r));
        JobTracker.waitOnPromise(job.id, onDone, eventStream);
        res.status(200).json({job, result});
    },
    extract_cluster_users_entities : function (req, res) {
        // basically be given a list of merchants, and the datasource URL
        if(!req.body.entityMap || _.size(req.body.entityMap) == 0) {
            return res.status(400).send('No entityMap found in the body');
        }
        if(!req.body.srcParquetFile) {
            return res.status(400).send('No parquet url given. Filteration only happens on parquet files');
        }
        if(!req.body.projectId) {
            return res.status(400).send('No Project Id given.');
        }

        var taskId = req.body.taskId;
        var job = null;

        if(taskId && taskId.length > 0) {
            job = JobTracker.get(taskId);
            if(job == null) {
                return res.status(400)
                    .send(`No Task tracking available for taskId ${taskId}. create a new task if monitoring is required`);
            }
        } else {
            return res.status(400).json({
                error : 'Invalid or no name/taskId',
                errorString: util.inspect(req.body)
            });
        }

        var entityCol = req.body.entity,
            entityMap = req.body.entityMap,
            srcParquetFile = req.body.srcParquetFile,
            projectId = req.body.projectId;

        var destFilePrefix = `extracted-users-clusters/project-${projectId}`;
        var s3 = UploadAPI.getClient();
        var bucket = 'mappr-slice';

        console.log(logPrefix, "TASK ID:", taskId);
        console.log(logPrefix, "Running new extract-cluster-users with options:", {srcParquetFile, destFilePrefix, entityCol});

        var eventStream = new EventEmitter();
        // run process for every file
        var onDone = Promise.map(_.keys(entityMap), function(clusterId) {
            var entityList = entityMap[clusterId];
            if(!entityList || entityList.length == 0) {
                console.log(logPrefix, `skipping cluster: ${clusterId}`);
                return null;
            }
            var key = `${destFilePrefix}/${clusterId}/users.csv`;
            var onDone = SR.extractUsersForEntities(eventStream, entityCol, entityList, srcParquetFile, `/mnt/${bucket}/${key}`)
                .then(() =>  key);
            onDone.then(r => console.log(logPrefix, "extract entities finished:", r));
            return onDone;
        });
        onDone = onDone.reduce((acc, srcKey) => {
            if(srcKey) {
                acc.push(srcKey);
            }
            return acc;
        },[]);
        onDone.tap(x => eventStream.emit('progress', {
            msg : `setting permissions for (${x.length}) cluster specific csv files..`
        }));
        onDone = onDone.map(srcKey => {
            if(!srcKey) return null;
            var csvKey = `${srcKey}/part-00000`;
            console.log(logPrefix, 'setting permission to "public-read" for key:', csvKey);
            return new Promise(function(resolve, reject) {
                s3.s3.putObjectAcl({
                    Bucket : bucket,
                    Key : csvKey,
                    ACL : 'public-read'
                }, function(err) {
                    if(err) {
                        console.error(logPrefix, err);
                        console.error(err, err.stack);
                        return reject(err);
                    }
                    console.log(logPrefix, 'permission set for key:', csvKey);
                    resolve(csvKey);
                });
            });
        });
        onDone = onDone.then(srcKeys => {
            return {
                srcKeys : srcKeys,
                msg : `All files stored in ${destFilePrefix}`
            };
        });
        onDone.tap(srcKeys => console.log(logPrefix, 'All done', srcKeys));
        JobTracker.waitOnPromise(job.id, onDone, eventStream);
        res.status(200).json({job, result : {msg : `All files stored in ${destFilePrefix}`}});
    }
};
