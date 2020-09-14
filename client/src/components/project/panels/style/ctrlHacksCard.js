angular.module('mappr')
.controller('HacksCardCtrl', ['$scope', '$q', '$http', 'dataService', 'dataGraph', 'graphSelectionService', 'projFactory', 'uiService',
function($scope, $q, $http, dataService, dataGraph, graphSelectionService, projFactory, uiService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[HacksCardCtrl]';

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */


    /**
    * Scope methods
    */
    $scope.exportUsersOfMerchants = exportUsersOfMerchants;
    $scope.exportClusterUsers = exportClusterUsers;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/


    // a hack for slice.
    // exports all user demographics of selected merchants to an s3 url.
    function exportUsersOfMerchants() {
        console.log("Running extract users script");
        // ensure the datasource contains the parquet file path.
        var ds = dataService.currDataSetUnsafe();
        if(!ds) { return; }
        console.log(logPrefix, ds.sourceInfo);
        if(ds.sourceInfo && ds.sourceInfo.sourceType !== 'ETL') {
            uiService.logWarning('dataset is not etl generated. Can\'t proceed with extraction');
            return console.warn(logPrefix, 'dataset is not etl generated. no users for you');
        }
        var srcUrl = ds.sourceInfo.sourceURL;

        // extract the entityList
        var selNodes = graphSelectionService.getSelectedNodes();
        var entityList = _.reduce(selNodes, function(acc, node) {
            var ent = node.attr['merchant'];
            if(ent && acc.indexOf(ent) === -1) { acc.push(ent); }
            return acc;
        }, []);

        if(entityList.length === 0) {
            return uiService.logWarning('select some nodes for user extraction');
        }
        var taskId = 'extract_entities_' + _.random(0, 100000, false).toString();
        var projectId = projFactory.currProjectUnsafe()._id;
        var modalObj = uiService.log('Extracting users of ' + entityList.join(', '), true);

        var ioCreate = $http.post('/api/jobs', {
            name: 'extract_entities',
            taskId: taskId
        });
        // the task to execute once monitoring is setup
        var onConnectFn = function() {
            return $http.post('/api/etl_scripts/extract_demo_for_entities', {
                entity : 'merchant',
                entityList : entityList,
                srcParquetFile : srcUrl,
                taskId: taskId,
                projectId : projectId
            })
            .then(function(resp) {
                return resp.data.result;
            });
        };
        uiService.logProgress(taskId, 'starting extraction...');
        var res = ioCreate.then(function() {
            return watchTask(taskId, onConnectFn);
        })
        .then(function(result) {
            console.log(logPrefix, 'Got result', result);
            uiService.logUrl('csv stored in s3. click here to download', result.s3signedUrl);
            return result;
        })
        .finally(function() {
            uiService.removeProgress(taskId);
            modalObj.close();
        });
        return res;
    }
    // for each cluster generates a file containg all the users belonging to individual clusters.
    function exportClusterUsers() {
        // ensure the datasource contains the parquet file path.
        var ds = dataService.currDataSetUnsafe();
        if(!ds) { return; }
        console.log(logPrefix, ds.sourceInfo);
        if(ds.sourceInfo && ds.sourceInfo.sourceType !== 'ETL') {
            uiService.logWarning('dataset is not etl generated. Can\'t proceed with extraction');
            return console.warn(logPrefix, 'dataset is not etl generated. no users for you');
        }
        var srcUrl = ds.sourceInfo.sourceURL;

        var clusterMerchants = _.mapValues(_.mapValues(dataGraph.partitionNodesByAttr('Cluster'), function(x) {
            return _.unique(_.map(x, 'attr.merchant'));
        }));
        var taskId = 'extract_cluster_users_' + _.random(0, 100000, false).toString();
        var projectId = projFactory.currProjectUnsafe()._id;
        var modalObj = uiService.log('Extracting users of ' + _.keys(clusterMerchants).length + ' clusters', true);

        var ioCreate = $http.post('/api/jobs', {
            name: 'extract_cluster_users',
            taskId: taskId
        });
        // the task to execute once monitoring is setup
        var onConnectFn = function() {
            return $http.post('/api/etl_scripts/extract_cluster_users_entities', {
                entity : 'merchant',
                entityMap : clusterMerchants,
                srcParquetFile : srcUrl,
                taskId: taskId,
                projectId : projectId
            })
            .then(function(resp) {
                return resp.data.result;
            });
        };
        uiService.logProgress(taskId, 'starting extraction...');
        var res = ioCreate.then(function() {
            return watchTask(taskId, onConnectFn);
        })
        .then(function(result) {
            console.log(logPrefix, 'Got result', result);
            uiService.logSuccess('cluster users stored in S3. in directory: ' + result.msg);
            return result;
        })
        .finally(function() {
            uiService.removeProgress(taskId);
            modalObj.close();
        });
        return res;

    }
    function watchTask(id, onConnectFn) {
        var defer = $q.defer();

        var taskChannel = window.io.connect(window.location.origin + "/" + id);

        taskChannel.on('connect', function() {
            console.log(new Date().toISOString().substr(11, 8) + logPrefix + 'Connected IO successfully');
            onConnectFn();
        });
        taskChannel.on('connect_error', function(err) {
            console.error(new Date().toISOString().substr(11, 8) + logPrefix + 'Failed to connect', err);
        });
        taskChannel.on('reconnecting', function(err) {
            console.error(new Date().toISOString().substr(11, 8) + logPrefix + 'reconnecting', err);
        });
        taskChannel.on(id, function(data) {
            var result = data;
            if (result) {
                if (result.status === 'completed') {
                    console.log(logPrefix, 'status: completed', result);
                    defer.resolve(result.result);
                } else if (result.status === 'failed') {
                    console.log(logPrefix, 'status: failed', result);
                    defer.reject(data);
                } else if (result.status === 'running' && result.completion) {
                    console.log(logPrefix, 'status: running', result);
                    defer.notify(result.completion);
                } else if (result.status === 'notification') {
                    console.log(logPrefix, 'status: notification', result);
                    uiService.logProgress(id, result.result.msg);
                }
            }
        });
        return defer.promise;
    }

}
]);
