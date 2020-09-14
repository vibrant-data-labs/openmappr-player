'use strict';
/**
 * Network Generator Mixin
 *
 */

var _       = require('lodash'),
    util = require('util'),
    Promise = require('bluebird');

var ProjModel = require('../project/proj_model'),
    AthenaAPI = require('../services/AthenaAPI'),
    DSModel   = require("../datasys/datasys_model"),
    dataUtils = require('../utils/dataUtils');

var RecipeEngineError = require('./recipe_errors').RecipeEngineError,
    VALIDATION_FAILED = require('./recipe_errors').VALIDATION_FAILED;

var SHOW_ATHENA_LOGS = false;

var PHASE_NAME = 'network_gen';

// mixed into RecipeEngine. 'this' refers to that object
function NetworkGeneratorMixin () {

    this.gen_networks = function(scope, reporter) {
        var cfg = this.recipe.network_gen,
            self = this,
            project = scope.project,
            dataset = scope.dataset,
            loadedNetworks = scope.dataSource.networks;

        reporter.setPhase(PHASE_NAME);

        // counter of number of tasks to be completed for this generation. Helpful in reporting
        var taskNum = 0;

        // import any networks specified in datasource before moving on to generation of new networks
        var importedNws = Promise.resolve([]);
        if(loadedNetworks) {
            self.emit('info', `[gen_networks] Network Import started`);
            importedNws = Promise.map(loadedNetworks, networkData =>  DSModel.createNetwork(dataset, networkData))
                .map(network => dataUtils.sanitizeNetwork(network))
                .map(network   => {
                    network.name = cfg.defNetworkName || network.name;
                    return DSModel.saveNetwork(network, false, false);
                })
                .then(networks => ProjModel.addNetworksAsync(project, networks).thenReturn(networks))
                .map(network   => this._analyseNetwork(reporter.forItem(++taskNum), project.id, dataset.id, network))
                .map(payload => payload.result.networkId)
                .map(nwId    => this._runFD(reporter.forItem(++taskNum), project.id, dataset.id, nwId))
                .map(payload => payload.result.networkId)
                .tap(networkIds => self.emit("info", `[gen_networks] imported network Ids: ${util.inspect(networkIds)}`));
        }
        // generate the required networks, once imported onces have been processed
        var generatedNetworks = importedNws
            .then(() => cfg.networks)
            .map(function(networkCfg) {
                self.emit('info', `[gen_networks] Network Generation started for Network: ${networkCfg.name}`);
                if(networkCfg.gen_algo !== "athena_netgen") {
                    var err = new RecipeEngineError(PHASE_NAME, 'gen_networks', VALIDATION_FAILED, `only 'athena_netgen' supported for 'gen_algo'. given: ${networkCfg.gen_algo}`);
                    self.emit(VALIDATION_FAILED, err);
                    throw err;
                }
                return self._genSingleNetwork(reporter.forItem(++taskNum), networkCfg, project.id, dataset)
                .tap(() => self.emit('info', `[gen_networks] Network Generation finished for Network: ${networkCfg.name}`));
            })
            .map(payload => payload.result.networkId)
            .tap(networkIds => self.emit("info", `[gen_networks] generated network Ids: ${util.inspect(networkIds)}`));

        return Promise.join(importedNws, generatedNetworks, (importedNwIds, genNwIds) => importedNwIds.concat(genNwIds))
        .then(function (networkIds) {
            // reload project object
            return ProjModel.listByIdAsync(project.id)
                .then(function (project) {
                    scope.project = project;
                    return null;
                }).thenReturn(networkIds);
        });
    };

    this._genSingleNetwork = function(reporter, cfg, projectId, dataset) {
        var self = this;
        // Athena runn config
        var algoDataDef = {
            "algo_name": "links_FromAttributes",
            "options": {
                "analyseCurrentNetwork": false,
                "dataPointsToAnalyse": [],
                "questions": [],
                "aggregation": "",
                "headerID": "id",
                "minAnsweredFrac": 0.5,
                "linksPer": 3,
                "keepDisconnected": false,
                "keepQuestions": true,
                "weightByFreq": true,
                "fineClusters": false,
                "mergeClusters" : false
            },
            "projectId": projectId,
            "datasetId": dataset.id,
            "newNetworkName": cfg.name,
            "createNew": true
        };
        algoDataDef.taskId =  "athena_" + _.random(1,10000);
        _.assign(algoDataDef.options, cfg.algo_config.options);

        if(algoDataDef.options.questions.length === 0) {
            var err = new RecipeEngineError(PHASE_NAME, '_genSingleNetwork', VALIDATION_FAILED,  `Questions array is empty. Need to ask more questions`);
            this.emit(VALIDATION_FAILED, err);
            throw err;
        }
        // validate questions. attrIds should exist in the dataset
        var attrIds = dataset.attrDescriptors.map(attr => attr.id);
        _.each(algoDataDef.options.questions, function(ques) {
            var attrId = ques.Question;
            if(attrIds.indexOf(attrId) < 0) {
                var err = new RecipeEngineError(PHASE_NAME, '_genSingleNetwork', VALIDATION_FAILED,  `Question (attrId): '${attrId}' does not exist in the dataset. Existing attrs are: ${util.inspect(attrIds)}`);
                this.emit(VALIDATION_FAILED, err);
                throw err;
            }
        },this);


        var athenaES = AthenaAPI.runAlgo(algoDataDef);
        // hookup the events with the recipe Machine events
        var promise = new Promise(function(resolve, reject) {
            var isDone = false;
            var finalPayload = null;
            athenaES.on('data', function _athenaDataStream(payload) {
                SHOW_ATHENA_LOGS && self.emit('info', `[gen_single_network.${cfg.name}] got data : ${util.inspect(payload)}`);
                var err = null;
                if(payload.type === 'update' && payload.status) {
                    if(payload.status === 'completed') {
                        isDone = true;
                        self.emit('info', `[gen_single_network.${cfg.name}] network generated successfully`);
                        finalPayload = payload;
                    }
                }
                else if(payload.type === 'delete') {
                    if(!isDone) {
                        err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${cfg.name}] Network gen job got deleted before finishing: ${util.inspect(payload)}`);
                        self.emit('error', err);
                        reject(payload);
                    }
                }
                else if(payload.type === 'error') {
                    if(!isDone) {
                        err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${cfg.name}] Network gen job got errored out before finishing: ${util.inspect(payload)}`);
                        self.emit('error', err);
                        reject(payload);
                    }
                }
                else if(payload.type === 'notify') {
                    reporter.emitPhaseItemProg({
                        msg : payload.msg,
                        taskCompletion : payload.completion
                    });
                }
                else {
                    self.emit('info', `[gen_single_network.${cfg.name}] network gen job got invalid event: ${util.inspect(payload)}`);
                }
            })
            .on('error', function(err) {
                err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${cfg.name}] Network gen job got errored out before finishing: ${err.stack || util.inspect(err)}`);
                self.emit('info', err);
                reject(err);
            })
            .on('end', function() {
                self.emit('info', `[gen_single_network.${cfg.name}] network gen job stream ended`);
                if(finalPayload) {
                    resolve(finalPayload);
                } else {
                    var err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${cfg.name}] stream ended before finishing generation`);
                    reject(err);
                }
            });
        });
        return promise;
    };

    this._analyseNetwork = function (reporter, projectId, datasetId, network) {
        var self = this;
        var algoDataDef = {
            "taskId": "athena_" + _.random(1,10000),
            "algo_name": "network_properties",
            "options": null,
            "projectId": projectId.toString(),
            "datasetId": datasetId.toString(),
            "networkId": network.id.toString(),
            "newNetworkName": null,
            "createNew": false
        };

        var athenaES = AthenaAPI.runAlgo(algoDataDef);
        // hookup the events with the recipe Machine events
        var promise = new Promise(function(resolve, reject) {
            var isDone = false;
            var finalPayload = null;
            athenaES.on('data', function _athenaDataStream(payload) {
                SHOW_ATHENA_LOGS && self.emit('info', `[_analyseNetwork.${network.name}] got data : ${util.inspect(payload)}`);
                var err = null;
                if(payload.type === 'update' && payload.status) {
                    if(payload.status === 'completed') {
                        isDone = true;
                        self.emit('info', `[_analyseNetwork.${network.name}] network analysed successfully`);
                        finalPayload = payload;
                    }
                }
                else if(payload.type === 'delete') {
                    if(!isDone) {
                        err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${network.name}] Network analysis job got deleted before finishing: ${util.inspect(payload)}`);
                        self.emit('error', err);
                        reject(payload);
                    }
                }
                else if(payload.type === 'error') {
                    if(!isDone) {
                        err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${network.name}] Network analysis job got errored out before finishing: ${util.inspect(payload)}`);
                        self.emit('error', err);
                        reject(payload);
                    }
                }
                else if(payload.type === 'notify') {
                    reporter.emitPhaseItemProg({
                        msg : payload.msg,
                        taskCompletion : payload.completion
                    });
                }
                else {
                    self.emit('info', `[_analyseNetwork.${network.name}] network analysis job got invalid event: ${util.inspect(payload)}`);
                }
            })
            .on('error', function(err) {
                err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${network.name}] Network analysis job got errored out before finishing: ${err.stack || util.inspect(err)}`);
                self.emit('info', err);
                reject(err);
            })
            .on('end', function() {
                self.emit('info', `[_analyseNetwork.${network.name}] network analysis job stream ended`);
                if(finalPayload) {
                    resolve(finalPayload);
                } else {
                    var err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${network.name}] stream ended before finishing analysis`);
                    reject(err);
                }
            });
        });
        return promise;
    };
    this._runFD = function (reporter, projectId, datasetId, networkId) {
        var self = this;
        var algoDataDef = {
            "taskId": "athena_" + _.random(1,10000),
            "algo_name": "layout_clustered",
            "options": {
                "clumpiness": 0.0,
                "byAttribute": true,
                "clustering": 'Cluster',
                "layoutName": "Original",
                "maxSteps": 500
            },
            "projectId": projectId.toString(),
            "datasetId": datasetId.toString(),
            "networkId": networkId.toString(),
            "newNetworkName": null,
            "createNew": false
        };
        var athenaES = AthenaAPI.runAlgo(algoDataDef);
        // hookup the events with the recipe Machine events
        var promise = new Promise(function(resolve, reject) {
            var isDone = false;
            var finalPayload = null;
            athenaES.on('data', function _athenaDataStream(payload) {
                // SHOW_ATHENA_LOGS && self.emit('info', `[_runFD.${network.name}] got data : ${util.inspect(payload)}`);
                var err = null;
                if(payload.type === 'update' && payload.status) {
                    if(payload.status === 'completed') {
                        isDone = true;
                        self.emit('info', `[_runFD.${networkId}] network force directed layout done successfully`);
                        finalPayload = payload;
                    }
                }
                else if(payload.type === 'delete') {
                    if(!isDone) {
                        err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${networkId}] Force directed layout job got deleted before finishing: ${util.inspect(payload)}`);
                        self.emit('error', err);
                        reject(payload);
                    }
                }
                else if(payload.type === 'error') {
                    if(!isDone) {
                        err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${networkId}] Force directed layout job got errored out before finishing: ${util.inspect(payload)}`);
                        self.emit('error', err);
                        reject(payload);
                    }
                }
                else if(payload.type === 'notify') {
                    reporter.emitPhaseItemProg({
                        msg : payload.msg,
                        taskCompletion : payload.completion
                    });
                }
                else {
                    self.emit('info', `[_runFD.${networkId}] Force directed layout job got invalid event: ${util.inspect(payload)}`);
                }
            })
            .on('error', function(err) {
                err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${networkId}] Force directed layout job got errored out before finishing: ${err.stack || util.inspect(err)}`);
                self.emit('info', err);
                reject(err);
            })
            .on('end', function() {
                self.emit('info', `[_runFD.${networkId}] network analysis job stream ended`);
                if(finalPayload) {
                    resolve(finalPayload);
                } else {
                    var err = new RecipeEngineError(PHASE_NAME, '_athenaDataStream', 'ATHENA_ERROR',  `[${networkId}] stream ended before finishing Force directed layout`);
                    reject(err);
                }
            });
        });
        return promise;
    };
}
module.exports = NetworkGeneratorMixin;
