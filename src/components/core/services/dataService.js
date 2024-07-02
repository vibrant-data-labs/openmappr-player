/**
* Handles dataset operations
*/
angular.module('common')
    .service('dataService',['$http', '$q', '$rootScope', '$timeout', 'projFactory', 'AttrSanitizeService', 'extAPIService', 'BROADCAST_MESSAGES',
        function ($http, $q, $rootScope, $timeout, projFactory, AttrSanitizeService, extAPIService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
    *************** API ******************
    **************************************/
            this.clearDataSet = clearDataSet;
            this.fetchProjectDataSet= fetchProjectDataSet;
            this.fetchProjectDatasetLocally = fetchProjectDatasetLocally;
            this.loadDatasetFromS3= loadDatasetFromS3;
            this.updateAttrDescrs= extAPIService.processInQueue(updateAttrDescrs);
            this.updateAttrsScope= updateAttrsScope;
            this.getPlayerData= getPlayerData;
            this.currDataSet= getCurrDataset;
            this.currDataSetUnsafe= function() {    return currDataSet; };
            this.changeDataPointCatNames = extAPIService.processInQueue(changeDataPointCatNames);



            /*************************************
    ********* Local Data *****************
    **************************************/

            var currDataSet = null;
            var currDataSetDefer = $q.defer();



            /*************************************
    ********* Core Functions *************
    **************************************/
            function getDatasetUrl() {
                var proj = projFactory.currProjectUnsafe();

                var url = '/api/orgs/' + proj.org.ref + '/projects/' + proj._id + '/dataset';
                return url;
            }

            function clearDataSet() {
                currDataSet = null;
                currDataSetDefer.reject('data cleared');
                currDataSetDefer = $q.defer();
            }

            function fetchProjectDatasetLocally() {
                return $http.head(DATA_PATH + 'nodes.json')
                        .then(function(result) {
                            return +result.headers('content-length');
                        })
                        .then((contentLength) => $http.get(DATA_PATH + 'nodes.json', {
                    headers: {
                        __XHR__: function () {
                            return function (xhr) {
                                xhr.addEventListener("progress", function (event) {
                                    const progress = event.loaded / contentLength * 100;
                                    $rootScope.$broadcast(BROADCAST_MESSAGES.data.downloadProgress, {
                                        progress: progress > 100 ? 100 : progress
                                    });
                                });
                            };
                        }
                    }
                })
                    .then(
                        function(result) {
                            console.log("----------- getting project data locally");
                            return updateDataSet(result.data);
                        },
                        function(err) {
                            console.log("[dataService.fetchProjectDatasetLocally] Unable to fetch data:", err);
                            currDataSetDefer.reject(err);
                            return $q.reject(err);
                        }
                    ));
            }

            function fetchProjectDataSet(orgId, projId) {
                var url = '/api/orgs/' + orgId + '/projects/' + projId + '/dataset';
                return $http.get(url)
                    .then(
                        function(result){
                            console.log("----------- getting project data");
                            console.log("result", result);
                            return updateDataSet(result.data);
                        },
                        function(err) {
                            console.log("[dataService.getProjectData] Unable to fetch data:", err);
                            currDataSetDefer.reject(err);
                            return $q.reject(err);
                        }
                    );
            }

            function loadDatasetFromS3(playerUrl) {
                return $http.get(playerUrl + 'dataset.json')
                    .then(function(response) {
                        var data = response.data;
                        console.log('S3 dataset Obj- ', data);
                        return updateDataSet(data);
                    });
            }

            function updateAttrsScope(orgId, projId, postObj) {
                var url = '/api/orgs/' + orgId + '/projects/' + projId + '/changescope';
                return $http.post(url, postObj)
                    .then(function(result) {
                        return result.data;
                    }, function(err) {
                        return $q.reject(err);
                    });
            }

            function getPlayerData(playerId) {
                var url = '/api/players/' + playerId + '/data';
                return $http.get(url)
                    .then(function(result){
                        console.log("----------- getting player data");
                        console.log("result", result);
                        return updateDataSet(result.data);
                    });
            }

            function getCurrDataset(){
                if(currDataSet){
                    console.log('[dataSetService.currDataSet] cached result');
                    return $q.when(currDataSet);     // return cache
                } else {
                    console.log('[dataSetService.currDataSet] promise result');
                    return currDataSetDefer.promise; // wait for a resolution
                }
            }

            function updateDataSet(dataSet) {
                currDataSet = dataSet;
                currDataSetDefer.resolve(currDataSet);
                _.each(currDataSet.attrDescriptors, function(attrDesc) {
                    AttrSanitizeService.sanitizeAttr(attrDesc,currDataSet.datapoints);
                });

                // Generate attrs datapoint count
                var attrsMap = {};
                _.each(currDataSet.datapoints, function(dp) {
                    _.each(dp.attr, function(val, key) {
                        if(_.has(attrsMap, key)) {
                            attrsMap[key]++;
                        }
                        else {
                            attrsMap[key] = 1;
                        }
                    });
                });

                _.each(currDataSet.attrDescriptors, function(attrDesc) {
                    attrDesc.valuesCount = attrsMap[attrDesc.id];
                });
                console.log('[dataService.updateDataSet] currDataSet: ' + currDataSet.id);
                return currDataSet;
            }

            function changeDataPointCatNames(attrId, oldVal_newValMap) {
                _.each(currDataSet.datapoints, function(dp) {
                    if(dp.attr[attrId] != null) {
                        var oldVal = dp.attr[attrId];
                        dp.attr[attrId] = oldVal_newValMap[oldVal] != null ? oldVal_newValMap[oldVal] : oldVal;
                    }
                });

                var url = getDatasetUrl() + '/datapoints/update_attr_cat_names';
                return $http.post(url, {
                    attrId : attrId,
                    updationMap : oldVal_newValMap
                })
                    .then(function(respData) {
                        console.log("Updation successful.", respData.data);
                        return respData.data;
                    });
            }

            function updateAttrDescrs(orgId, projId, postObj) {
                var url = '/api/orgs/' + orgId + '/projects/' + projId + '/dataset/dsattrs';
                return $http.post(url, postObj)
                    .then(function(result) {
                        var changedAttrDescrs = postObj.changedAttrDescriptors;
                        if(_.isArray(changedAttrDescrs) && changedAttrDescrs.length > 0) {
                            _.each(changedAttrDescrs, function(attr) {
                                var baseAttr = _.find(currDataSet.attrDescriptors, 'id', attr.id);
                                if(baseAttr) {
                                    _.assign(baseAttr, _.pick(attr, ['attrType', 'visible', 'title', 'renderType']));
                                }
                            });
                        }
                        return result.data;
                    }, function(err) {
                        return $q.reject(err);
                    });
            }


        }]);
