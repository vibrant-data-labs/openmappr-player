'use strict';

var _       = require('lodash'),
    util = require('util'),
    Promise = require('bluebird');

var recipeDB = require('../schemas/recipe_schema'),
    projectDB = require('../schemas/proj_schema'),
    etlModel = require('../etl/etl_model');

// var logPrefix = "[recipe_model]";

// can return null values.
function listById (id, callback) {
    return recipeDB.findById(id, function(err, doc){
        if(err) { return callback(err); }
        // console.log(logPrefix + '[listById]' + 'Success:', doc);
        callback(null, doc);
    });
}

function listGlobals (callback) {
    return recipeDB.find({isGlobal : true }, function(err, docs){
        if(err) { return callback(err); }
        callback(null, docs);
    });
}

function getGenProjects (id, callback) {
    console.log("Finding recipes for ID:", id);
    projectDB.find({'recipe.ref' : id}, callback);
}

function listByOrg (orgId, callback) {
    recipeDB.find({ '$or' : [{'isGlobal' : true }, { 'org.ref' : orgId }]}, function(err, docs){
        if(err) { return callback(err); }
        callback(null, docs);
    });
}

function _validate (recipeDoc, callback) {
    if(recipeDoc.isLinkedToProject) {
        if(_.get(recipeDoc, 'org.ref', null) == null) {
            return callback(new Error("org.ref is empty for a linked Project"));
        }
        if(_.get(recipeDoc, 'project.ref', null) == null) {
            return callback(new Error("project.ref is empty for a linked Project"));
        }
        if(recipeDoc.isGlobal) {
            return callback(new Error("isGlobal is true for a linked Project"));
        }
    }
    //
    // data ingest validation
    if(recipeDoc.data_ingest.srcType === "URL") {
        var srcUrl = recipeDoc.data_ingest.srcUrl;
        if(_.isArray(srcUrl) && srcUrl.length === 0) {
            return callback(new Error("data_ingest.srcUrl is an Empty array . Given" + util.inspect(srcUrl)));
        }
        if(_.isString(srcUrl) && srcUrl.length < 5) {
            return callback(new Error("data_ingest.srcUrl is not given or is invalid . Given" + util.inspect(srcUrl)));
        }
        if(recipeDoc.data_ingest.enableETL) {
            var dataImportScriptName = recipeDoc.data_ingest.dataImportScriptName,
                dataETLScriptName = recipeDoc.data_ingest.dataETLScriptName;
            // etl has been enabled, check if scripts are valid or not
            if(!etlModel.existsSync(dataImportScriptName)) {
                return callback(new Error("data_ingest.dataImportScriptName is not readable by recipe engine. Given:" + util.inspect(dataImportScriptName)));
            }
            if(!etlModel.existsSync(dataETLScriptName)) {
                return callback(new Error("data_ingest.dataETLScriptName is not readable by recipe engine. Given:" + util.inspect(dataETLScriptName)));
            }
        }
    }
    //
    // dataset gen validation
    //

    // alchemy Config validation
    var post_process = _.get(recipeDoc,'dataset_gen.post_process');
    _.each(_.filter(post_process, 'algoType', 'alchemy'), function validateAlchemyConfig (alchemyConfigObj) {
        var alchemyConfig = alchemyConfigObj.config;
        if(alchemyConfig) {
            console.log("CONFIG OBJECT:", alchemyConfig);
            // validate query attr
            if(!alchemyConfig.queryAttrId || alchemyConfig.queryAttrId.length === 0) {
                return callback(new Error("Alchemy requires a single attributeId to analyse. nothing given"));
            }
            // validate config
            if(alchemyConfig.selectedAlgos.length === 0) {
                return callback(new Error("Alchemy config post process has no field to generated. Specify atleast one or remove the process"));
            }
            if(alchemyConfig.selectedAlgos.length > 4) {
                return callback(new Error("Alchemy config . selectedAlgos has too many algos. Valid values are 'keywords', 'concepts', 'entities' and 'sentiment'. Specify atleast one of them"));
            }
            // check for correct algos
            var algos = alchemyConfig.selectedAlgos;
            if(_.isObject(alchemyConfig.selectedAlgos[0])) {
                algos = _.map(alchemyConfig.selectedAlgos, 'algo');
            }
            algos = algos.map(x => x.toLowerCase());
            var leftAlgos = _.difference(algos, ['keywords', 'concepts', 'entities', 'sentiment']);
            if(leftAlgos.length > 0) {
                return callback(new Error("Alchemy config . selectedAlgos has invalid algos. Valid values are 'keywords', 'concepts', 'entities' and 'sentiment'. Extra: " + util.inspect(leftAlgos)));
            }

            // lowercase algos and set them
            if(_.isObject(alchemyConfig.selectedAlgos[0])) {
                alchemyConfig.selectedAlgos.forEach(x => x.algo = x.algo.toLowerCase());
            } else {
                alchemyConfig.selectedAlgos = alchemyConfig.selectedAlgos.map(x => x.toLowerCase());
            }
            // check for relevance
            if(!alchemyConfig.relevance) {
                alchemyConfig.relevance = 0.4;
            }
            // clamp betwene 0-1
            alchemyConfig.relevance = Math.min(Math.max(0.1,alchemyConfig.relevance),1);
        }
    });
    // snapshot validation
    // Snapshots for now can define custom mappr settings
    _.each(recipeDoc.snapshot_gen.snapshots, function snapDecrValidations(snapDecr, idx) {
        // if it exists and is not a number or the index is greater than num of networks to be generated
        // -1 is the networkId of the imported network read from the file
        if(snapDecr.networkIdx &&
            (!_.isNumber(snapDecr.networkIdx) ||
                snapDecr.networkIdx >= _.get(recipeDoc, "network_gen.networks.length", -1))
            ) {
            return callback(new Error(`Snapshot config. SnapDecr[${idx}] has invalid networkIdx. found: ${snapDecr.networkIdx} ${typeof snapDecr.networkIdx}`));
        }
    });

    // player validation
    if(recipeDoc.player_gen) {
        if(recipeDoc.player_gen.isPrivate &&
            (!recipeDoc.player_gen.access_token || recipeDoc.player_gen.access_token.length == 0)) { // access token should be there

            return callback(new Error("Alchemy config . player_gen has isPrivate as 'true' but no access token given. " + recipeDoc.player_gen.access_token));
        }
    }
    return callback(null, recipeDoc);
}

// do some simple validation
function add (recipeDoc, callback) {
    _validate(recipeDoc, function onValidate(err, tmpl) {
        if(err) { return callback(err); }
        var doc = new recipeDB(tmpl);

        return doc.save(function(err, doc) {
            if(err) { return callback(err); }
            callback(null, doc);
        });
    });
}

function update (recipe, callback) {
    _validate(recipe, function onValidate(err, doc) {
        if(err) { return callback(err); }

        return doc.save(function(err, doc) {
            if(err) { return callback(err); }
            console.log("Saved recipe:", doc);
            callback(null, doc);
        });
    });
}
function updateConfig (recipe, changes, callback) {
    recipe.set('modifiedAt', Date.now());

    if(changes.name) recipe.name         = changes.name;
    if(changes.isGlobal != null) recipe.isGlobal = changes.isGlobal;
    if(changes.isLinkedToProject != null) recipe.isLinkedToProject = changes.isLinkedToProject;
    if(changes.isHidden != null) recipe.isHidden = changes.isHidden;

    if(changes.gen_opts) recipe.gen_opts         = changes.gen_opts;
    if(changes.etl_gen) recipe.etl_gen           = changes.etl_gen;
    if(changes.data_ingest) recipe.data_ingest   = changes.data_ingest;
    if(changes.project_gen) recipe.project_gen   = changes.project_gen;
    if(changes.dataset_gen) recipe.dataset_gen   = changes.dataset_gen;
    if(changes.network_gen) recipe.network_gen   = changes.network_gen;
    if(changes.layout_gen) recipe.layout_gen     = changes.layout_gen;
    if(changes.snapshot_gen) recipe.snapshot_gen = changes.snapshot_gen;
    if(changes.player_gen) recipe.player_gen     = changes.player_gen;
    update(recipe, callback);
}

var api = {
    listById,
    listGlobals,
    getGenProjects,
    listByOrg,
    add,
    update,
    updateConfig
};
module.exports = Promise.promisifyAll(api);
