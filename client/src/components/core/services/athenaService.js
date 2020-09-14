/**
 * Network generation related algorithms
 */
angular.module('common')
.service('athenaService', ['$rootScope', '$q', '$http', 'dataService', 'networkService', '$routeParams', 'projFactory', 'BROADCAST_MESSAGES', 'uiService',
function($rootScope, $q, $http, dataService, networkService, $routeParams, projFactory, BROADCAST_MESSAGES, uiService) {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.algos = function() {
        return algos;
    };
    this.run_algorithm = preAlgoRun;
    this.fetchAlgos = fetchAlgos;
    this.getAlgoByName = getAlgoByName;
    this.generateNetworkProps = generateNetworkProps;
    this.generateClusterLayout = generateClusterLayout;
    this.computeNodeSim = computeNodeSim;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var logPrefix = '[athenaService]';
    // algos and their requirements
    var algos = null;


    /*************************************
    ********* Core Functions *************
    **************************************/

    /**
     * Asks athena server to run the algorithm with the given options
     */
    function run_algorithm(name, options, networkName, networkId) {
        return projFactory.currProject()
            .then(function() {
                var taskId = 'athena_' + _.random(0, 100000, false).toString();
                if (_.isEmpty(projFactory.currProjectUnsafe().dataset)) {
                    throw new Error('No dataset yet, can\'t generate networks');
                }
                var projectId = projFactory.currProjectUnsafe()._id;
                console.assert(projectId.length > 0, 'projectId must exist!');
                // create a channel to communicate the status
                var ioCreate = $http.post('/api/jobs', {
                    name: 'athenaJob',
                    taskId: taskId
                });
                ioCreate.error(function(data, status) {
                    console.log('[athenaService] Error in executing algorithm. data : %O, status : %s', data, status);
                });

                var onConnectFn = function() {
                    return $http.post('/athena/algo', {
                        taskId: taskId,
                        algo_name: name,
                        options: options,
                        projectId: projectId,
                        networkId: networkId,
                        newNetworkName: networkName,
                        createNew: networkId == null
                    }).catch(function(data, status) {
                        console.log('[athenaService] Error in executing algorithm. data : %O, status : %s', data, status);
                    });
                };
                var res = ioCreate
                    .then(function() {
                        return watchTask(taskId, onConnectFn);
                    })
                    .then(function(data) {
                        console.log('[athenaService]Called algorithm successfully. Got data : %O', data);
                        console.log('[athenaService]Athena Process id: %s', data.result);
                        $rootScope.$broadcast(BROADCAST_MESSAGES.network.created);
                        // load network
                        networkService.deCacheNetwork(data.networkId);
                        // var onLoadNW = networkService.fetchProjectNetwork(data.networkId);
                        return {
                            networkId: data.networkId,
                            data: data.data
                        };
                    }, function(err) {
                        console.error('SOMETHING BAD HAPPENED! :', err);
                        console.error(err.result);
                        return $q.reject(err.result);
                    });
                return res;
            });
    }

    function fetchAlgos() {
        if (!algos) {
            return $http.get('/athena/algos').then(function(data) {
                console.log('[athenaService]Got algorithms :%O', data);
                algos = data.data;
                return algos;
            }, function(err) {
                console.log('[athenaService]Error in fetching algorithm. error : %O', err);
                throw err;
            });
        } else {return $q.when(algos);}
    }

    function getAlgoByName(algoName) {
        if (!algos) {
            console.warn('No algos');
            throw new Error("Algos haven't been loaded!");
        }
        return _.find(algos, 'name', algoName);
    }

    function preAlgoRun(algo, runOptions, networkName, networkId) {
        console.log('athena run: ', algo.name, runOptions);

        //Check if all required parameters are fulfilled
        var reqParams = _.filter(algo.options, 'isRequired');
        var fulfillmentArray = _.map(reqParams, function(param) {
            return {
                key: param.title,
                val: runOptions[param.key],
                varType: param.value
            };
        });
        console.debug('reqParams', reqParams);
        console.debug('fulfillmentArray', fulfillmentArray);

        var allReqdParamsHaveVals = true;

        for (var i = fulfillmentArray.length - 1; i >= 0; i--) {
            if (typeof fulfillmentArray[i].val == 'undefined') {
                allReqdParamsHaveVals = false;
                uiService.logError('Required parameter [' + fulfillmentArray[i].key + '] is not set!');
                break;
            }
            //TODO: algo.options have expected type declared. match expected type against actual type to pass
            // } else if (typeof fulfillmentArray[i].val == fulfillmentArray[i].varType){
            //  allReqdParamsHaveVals = false;
            //  uiService.logError('Type Mismatch. [' + fulfillmentArray[i].key + '] must be a ' +fulfillmentArray[i].varType+'.');
            //  break;
            // }
        }

        //if all required params have legitimate values -> run algo
        if (allReqdParamsHaveVals) {
            return run_algorithm(algo.name, runOptions, networkName, networkId);
        } else {
            return $q.reject('Not all params have legitimate values');
        }
    }

    function watchTask(id, onConnectFn) {
        var defer = $q.defer(),
            progressMsg = '';

        var taskChannel = window.io.connect(window.location.origin + "/" + id);

        taskChannel.on('connect', function() {
            console.log(new Date().toISOString().substr(11, 8) + '[athenaService.Channel]' + 'Connected IO successfully');
            onConnectFn();
        });
        taskChannel.on('connect_error', function(err) {
            console.error(new Date().toISOString().substr(11, 8) + '[athenaService.Channel]' + 'Failed to connect', err);
        });
        taskChannel.on('reconnecting', function(err) {
            console.error(new Date().toISOString().substr(11, 8) + '[athenaService.Channel]' + 'reconnecting', err);
        });
        taskChannel.on(id, function(data) {
            var result = data;
            if (result) {
                if (result.result && result.result.msg) {
                    progressMsg = result.result.msg;
                }
                if (result.status === 'completed') {
                    console.log('[athenaService.Channel] status: completed', result);
                    uiService.showProgress(id, progressMsg, 'success', 110);
                    defer.resolve(result.result);
                } else if (result.status === 'failed') {
                    console.log('[athenaService.Channel] status: failed', result);
                    uiService.removeProgress(id);
                    defer.reject(data);
                } else if (result.status === 'running' && result.completion) {
                    console.log('[athenaService.Channel] status: running -> finished', result);
                    uiService.showProgress(id, progressMsg, 'success', 110);
                    defer.notify(result.completion);
                } else if (result.status === 'notification') {
                    console.log('[athenaService.Channel] status: notification', result.result.completion, result.result.msg);
                    uiService.showProgress(id, progressMsg, 'success', result.result.completion);
                }

            }
        });
        return defer.promise;
    }

    function generateNetworkProps(networkId, nAttr, fineClusters) {
        return fetchAlgos()
            .then(function() {
                return getAlgoByName('network_properties');
            })
            .then(function(algo) {
                return preAlgoRun(algo, nAttr ? {
                    nLinkingAttr: nAttr,
                    nodeAttrs: [],
                    fineClusters: fineClusters || false
                } : null, null, networkId);
            })
            .then(function(data) {
                console.log(logPrefix, 'Network properties generated for network: ' + networkId);
                return data;
            })
            .catch(function(err) {
                console.log(logPrefix, err);
                uiService.logError('Some problem occured while calculating properties!');
                return $q.reject(err);
            });
    }

    function generateClusterLayout(networkId) {
        var ops = {
            byAttribute: false,
            clumpiness: 0,
            clustering: "Original",
            layoutName: "Original",
            maxSteps: 1000
        };
        return fetchAlgos()
            .then(function() {
                return getAlgoByName('layout_clustered');
            })
            .then(function(algo) {
                return preAlgoRun(algo, ops, null, networkId);
            })
            .then(function(data) {
                console.log(logPrefix + 'Clustered layout generated for network: ' + networkId);
                return data;
            })
            .catch(function(err) {
                console.log(logPrefix, err);
                return $q.reject(err);
            });
    }

    function computeNodeSim(networkId, node) {
        return fetchAlgos()
            .then(function() {
                return getAlgoByName('compute_node_sim');
            })
            .then(function(algo) {
                return preAlgoRun(algo, {
                    headerID: 'id',
                    minAnsweredFrac: 0,
                    weightByFreq: true,
                    node: node
                }, null, networkId);
            })
            .then(function(data) {
                console.log(logPrefix + 'Node similarity computed for network : ' + networkId);
                networkService.fetchProjectNetwork(networkId);
                return data;
            })
            .catch(function(err) {
                console.log(logPrefix, err);
                uiService.logError('Some problem occured while computing node similarities');
                return $q.reject(err);
            });
    }

}
]);
