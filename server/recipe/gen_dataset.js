'use strict';
/**
 * Dataset Generator Mixin
 *
 */

var _ = require('lodash'),
    assert = require('assert'),
    util = require('util'),
    Promise = require('bluebird');

var ProjModel = require('../project/proj_model'),
    DSModel = require("../datasys/datasys_model"),
    AlchemyAPI = require('../services/AlchemyAPI');

var RecipeEngineError = require('./recipe_errors').RecipeEngineError,
    VALIDATION_FAILED = require('./recipe_errors').VALIDATION_FAILED;

var DATASET_PHASE_NAME = 'dataset_gen';
var POST_PROC_PHASE_NAME = 'dataset_post_process';

// mixed into RecipeEngine. 'this' refers to that object
function DatasetGeneratorMixin() {
    this.gen_dataset = function(scope, reporter, parsed_dataset) {
        var dataset = parsed_dataset,
            err;

        var recipe = this.recipe,
            project = scope.project;
        // validate attr Descriptors, and fill in the blanks
        var attrDescrIdx = _.indexBy(dataset.attrDescriptors, 'id');
        var attrDescMetas = _.get(recipe, 'dataset_gen.attr_desc', null);

        reporter.setPhase(DATASET_PHASE_NAME);

        // make sure dataset has some attrs
        if (_.keys(attrDescrIdx).length === 0) {
            err = new RecipeEngineError(DATASET_PHASE_NAME, 'gen_dataset', 'INVALID_DATASET', 'dataset contains no keys! Dataset: ' + util.inspect(dataset));
            this.emit(VALIDATION_FAILED, err);
            throw err;
        }

        // only validate if attrDescMetas exists, and their length > 0
        if (_.isArray(attrDescMetas) && attrDescMetas.length > 0) {
            _.each(attrDescMetas, function(descr) {
                var err = null,
                    attrId = descr.id,
                    attr = attrDescrIdx[attrId];
                this.emit('info', `[gen_dataset] Processing attrId: ${descr.id}`);
                // check if attr is in dataset or not
                if (attr == null) {
                    if (descr.isRequired) {
                        err = new RecipeEngineError(DATASET_PHASE_NAME, 'gen_dataset', VALIDATION_FAILED, `${attrId} not found in the dataset. Contains: ${_.keys(attrDescrIdx)}`);
                        this.emit(VALIDATION_FAILED, err);
                        throw err;
                    }
                    // skip attrs not found in the dataset, which are not required
                    this.emit('info', `skipping optional attribute: ${descr.id}. Not found in datatset`);
                    return;
                }

                // validate attrType
                if (descr.attrType != null) {
                    if (descr.attrType !== attr.attrType) {
                        err = new RecipeEngineError(DATASET_PHASE_NAME, 'gen_dataset', VALIDATION_FAILED, `Attr Type: ${attr.attrType} for attrId: ${attrId} does not match that defined in the recipe. Needed to be: ${descr.attrType}`);
                        this.emit(VALIDATION_FAILED, err);
                        throw err;
                    }
                }
                // validate density
                if (descr.density != null) {
                    var attrDensity = _get_density(dataset.datapoints, attrId);
                    if (attrDensity < descr.density) {
                        err = new RecipeEngineError(DATASET_PHASE_NAME, 'gen_dataset', VALIDATION_FAILED, `Density less that needed for attrId: ${attrId}. Required: ${descr.density}. Found: ${attrDensity}`);
                        this.emit(VALIDATION_FAILED, err);
                        throw err;
                    }
                }
                _updateAttrDescr(descr, attr);
                this.emit('info', `[gen_dataset] Updated Attribute: ${attrId}`);
            }, this);
        } else {
            this.emit('info', `[gen_dataset] No attr Descriptor metas found. Skipping validations`);
        }
        var ds = DSModel.createDataset(project.id, "dataset", dataset.datapoints, dataset.attrDescriptors, dataset.sourceInfo, true);
        return ProjModel.updateDatasetAsync(project, ds).thenReturn(ds);
    };
    /**
     * Dataset post processing
     * @param {Object} config   configuration for the post processing step
     * @param  {Object} dataset the dataset to post process
     * @return {Promise(dataset)}        post processed ds
     */
    this.post_process_ds = function(scope, reporter, dataset) {
        var postProcessCfg = _.get(this.recipe, 'dataset_gen.post_process');
        reporter.setPhase(POST_PROC_PHASE_NAME);
        console.log("[post_process_ds] GOT CONFIG:", postProcessCfg);
        var self = this;
        if (postProcessCfg) {
            // make sure all steps do not modify the dataset ref
            return Promise.mapSeries(postProcessCfg, function(config) {
                self.emit('info', `[post_process_ds] Running post-processing step: ${config.algoType}`);
                // a closure so that it is each to attach post execution callbacks + set this
                var fn = function __run_post_process_step() {
                    switch (config.algoType) {
                    case 'alchemy':
                        var alchemyConfig = this.validateAlchemyConfig(config.config, dataset);
                        return this.run_alchemy(reporter, alchemyConfig, dataset);
                    default:
                        throw new Error("Post processing not defined for type:" + config.algoType);
                    }
                };
                return fn.call(self)
                    .tap(() => self.emit('info', `[post_process_ds] Finished post-processing step: ${config.algoType}`));
            }).then(function(manyDatasets) {
                return dataset;
            });
        } else {
            this.emit('info', `[post_process_ds] No post processing steps found. Skipping...`);
            return Promise.resolve(dataset);
        }
    };
    /**
     * Makes sure the alchemy config is valid and can run on the given dataset
     * @param  {Object} config  config object defined in the recipe
     * @param  {Object} dataset Processed dataset
     * @return {Object}         Normalized config object which is to be used by `run_alchemy`
     */
    this.validateAlchemyConfig = function(config, dataset) {
        var queryAttrId = config.queryAttrId,
            relevance = config.relevance;
        var queryAttrDescr = _.find(dataset.attrDescriptors, 'id', queryAttrId);
        var err = null;
        // make sure it exists
        if (!queryAttrDescr) {
            err = new RecipeEngineError(POST_PROC_PHASE_NAME, 'validateAlchemyConfig', VALIDATION_FAILED, `${queryAttrId} not found in the dataset. Can't run alchemy.`);
            this.emit(this.VALIDATION_FAILED, err);
            throw err;
        }
        // make sure it is a string
        if (queryAttrDescr.attrType != 'string') {
            err = new RecipeEngineError(POST_PROC_PHASE_NAME, 'validateAlchemyConfig', VALIDATION_FAILED, `${queryAttrId} is not a 'string'. Alchemy can only analyse strings. AttrType given : ${queryAttrDescr.attrType}.`);
            this.emit(this.VALIDATION_FAILED, err);
            throw err;
        }
        // normalize algos
        var selectedAlgos = config.selectedAlgos;
        if (_.isString(selectedAlgos[0])) {
            selectedAlgos = selectedAlgos.map(function(alchemyAlgo) {
                return {
                    algoName: alchemyAlgo,
                    newAttrTitle: `${queryAttrDescr.title}-${alchemyAlgo}`
                };
            });
        }
        return {
            queryAttrId,
            relevance,
            selectedAlgos,
            isNormalized: true
        };
    };
    // config is a normalized config returned by `validateAlchemyConfig`
    this.run_alchemy = function(reporter, config, dataset) {
        var err = null,
            self = this;
        if (!config.isNormalized) {
            err = new RecipeEngineError(POST_PROC_PHASE_NAME, 'run_alchemy', VALIDATION_FAILED, `Config object is not normalized. Please validate alchemy config and run.`);
            this.emit(this.VALIDATION_FAILED, err);
            throw err;
        }

        var selectedAlgos = config.selectedAlgos,
            queryAttrId = config.queryAttrId,
            relevance = config.relevance;

        var keywordAlgoObj = _.find(selectedAlgos, 'algoName', 'keywords');

        console.log('[run_alchemy] selectedAlgos:', selectedAlgos);
        // create attr Descriptors
        _.each(selectedAlgos, function(algo) {
            // add the new attr to dataset, Id is s_n_a_k_e_c_a_s_e
            var newAttrType;
            if (algo.algoName === 'sentiment') {
                newAttrType = 'float';
            } else {
                newAttrType = 'liststring';
            }
            var newAttr = new DSModel.AttrDescriptor(algo.newAttrTitle.replace(/\s/g, '_'), algo.newAttrTitle, newAttrType, 'Alchemy.' + algo.algoName, null, null, true);
            dataset.attrDescriptors.push(newAttr);
            algo.newAttrId = newAttr.id;

            if (algo.algoName === 'keywords') {
                assert(keywordAlgoObj, 'keywordAlgoObj should be correctly extracted');
                var ngramAttr = new DSModel.AttrDescriptor(newAttr.id + '-ngrams', newAttr.title + "-ngrams", 'liststring', 'Alchemy.' + algo.algoName, null, null, true);
                dataset.attrDescriptors.push(ngramAttr);
                algo.newAttrId_ngram = ngramAttr.id;
            }
        }, this);

        // run alchemy
        var nodesToProcess = _.filter(dataset.datapoints, function(datapoint) {
            var val = datapoint.attr[queryAttrId];
            return !!val && val.length > 4; // has to have some text
        });
        var algosToRun = _.map(selectedAlgos, 'algoName');

        var msgFormat = "Ignored : " + (dataset.datapoints.length - nodesToProcess.length) + ", Currently: %d" + " of " + nodesToProcess.length;
        //
        // start processing
        //
        reporter.emitPhaseItemProg({
            taskCompletion : 0,
            msg : `Starting processing of datapoints via alchemy. NumNodes : ${nodesToProcess.length}`
        });

        var itemsDone = 0;
        var onProcessingFinished = Promise.map(nodesToProcess, function(datapoint, dpIdx) {
            return AlchemyAPI.runAlchemyAlgo(datapoint.attr[queryAttrId], relevance, algosToRun).bind(self)
                .then(function postAnalysis(enhancedData) {
                    if (keywordAlgoObj) {
                        datapoint.attr[keywordAlgoObj.newAttrId_ngram] = enhancedData.keyword_ngrams;
                    }
                    _.each(selectedAlgos, function(selectedAlgo) {
                        datapoint.attr[selectedAlgo.newAttrId] = enhancedData[selectedAlgo.algoName];
                    });
                    return true;
                })
                // Catch errors and return resolved promise, because we want to pull in data whether
                // alchemy fails for a value or not.
                .catch(
                    function AlchemyAPIErr(err) {
                        return err.status === "ERROR";
                    },
                    function(err) {
                        console.log("Alchemy failed on datapoint: " + datapoint.id);
                        console.log(err);
                        return true;
                    })
                .tap(function() {
                    var pct = (++itemsDone / nodesToProcess.length) * 100;
                    reporter.emitPhaseItemProg({
                        taskCompletion : pct,
                        msg : `finished alchemy on dpId: ${dpIdx}`
                    });
                    this.emit('info', `[run_alchemy.postAnalysis] Processed ${util.format(msgFormat, (dpIdx + 1))}`);
                });
        });

        return onProcessingFinished.then(() => dataset);
    };
}


function _updateAttrDescr(templDescr, dsDescr) {
    var updateAttrDescr = _.mapValues(dsDescr, function(value, key) {
        var other = this.key;
        if (other == null) {
            return value;
        }
        // if title has been defined in the recipe, override existing title
        if (key === 'title' && other.length > 0) {
            return other;
        }
        if (_.isObject(value) && _.isObject(other)) {
            return _.defaults(value, other);
        }
        return other;
    }, dsDescr);
    // update into existing attribute object
    _.merge(dsDescr, updateAttrDescr);
    return updateAttrDescr;
}

function _get_density(datapoints, attrId) {
    var existanceCount = _.reduce(datapoints, function(count, dp) {
        var attr = dp.attr[attrId];
        count = attr != null ? count + 1 : count;
        return count;
    }, 0);
    return existanceCount / datapoints.length;
}
module.exports = DatasetGeneratorMixin;
