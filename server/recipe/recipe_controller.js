'use strict';

var _ = require('lodash'),
    Promise = require('bluebird'),
    recipeEngine = require('./recipeEngine'),
    recipeModel = require("./recipe_model.js"),
    recipeRunModel = require("./recipeRun_model.js"),
    recipeImporter = require("./recipe_importer.js"),
    ProjModel = require("../project/proj_model");

var projDeleter = require("../project/proj_deleter");
var RecipeTracker = require('../services/RecipeTracker');

var runningRecipesRuns = new Set();
var logPrefix = "[recipe_controller]";

function deepOmit (obj, keys) {
    if(_.isArray(obj)) {
        return _.map(obj, function(item) { return deepOmit(item, keys); });
    } else if(_.isObject(obj)) {
        return _.omit(_.mapValues(obj, function(val) {
            return _.isObject(val) ? deepOmit(val, keys) : val;
        }), keys);
    } else {
        return obj;
    }
}

module.exports = {
    listByOrg : function (req,res) {
        if(_.get(req, 'org.id') == null) {
            return res.status(400).send(new Error("No organization found"));
        }
        res.status(200).json(recipeModel.listByOrgAsync(req.org.id));
        // recipeModel.listByOrgAsync(req.org.id)
        // .then( docs => res.status(200).json(docs))
        // .catch(err => res.status(400).send(err.stack || err));
    },
    readDoc : function (req, res) {
        res.status(200).send(req.recipe);
    },
    updateDoc : function (req, res) {
        console.log('[recipe_controller.updateDoc] Got Body:', req.body);
        res.status(200)
        .json(recipeModel.updateConfigAsync(req.recipe, req.body));
    },
    deleteDoc : function (req, res) {
        var id = req.recipe.id;
        var data = recipeRunModel.removeByRecipeId(id)
        .then(() => recipeModel.getGenProjectsAsync(id))
        .tap(projs => console.log("Removing projects: ", _.map(projs, "_id")))
        .map(proj => projDeleter.delete(proj.id, req.user, req.org, false))
        .then(() => req.recipe.remove())
        .then(() => req.user.save())
        .then(() => req.org.save())
        .thenReturn(id);
        res.status(200).send(data);
    },
    create : function (req, res) {
        _.set(req.body, 'org.ref', req.org.id);
        var data = recipeModel.addAsync(req.body);
        res.status(200).json(data);
    },
    getGenProjects : function (req, res) {
        res.status(200).json(recipeModel.getGenProjectsAsync(req.recipe.id));
    },
    genProjects : function (req, res) {
        var uploadId = req.body.uploadId,
            taskId = req.body.taskId;
        if(req.recipe.data_ingest.srcType === 'uploadedData' && !uploadId) {
            return res.status(400).send(new Error('uploadId needed to generate project for now'));
        }

        var tmplObj = req.recipe.toObject();
        var engine = new recipeEngine(tmplObj, req.user, req.org, req.body);
        bindEventStreamToConsole(engine);
        var runResp = recipeRunModel.startNewRun(req.recipe, engine, taskId);
        var run = runResp.run,
            runEventStream = runResp.runEventStream;
        runningRecipesRuns.add(run.id.toString());
        runEventStream.on('end', () => runningRecipesRuns.delete(run.id.toString()));
        RecipeTracker.pipeRecipeEngineEvents(run, runEventStream, engine);
        engine.begin_gen(run, runEventStream);
        res.status(200).send(run);
    },
    cloneRecipe : function(req, res) {
        var recipeToClone = req.recipe;

        var cloneObj = deepOmit(recipeToClone.toJSON(),'_id');
        _.set(cloneObj, 'org.ref', req.org.id);
        delete cloneObj.createdAt;
        delete cloneObj.modifiedAt;
        var data = recipeModel.addAsync(cloneObj);
        res.status(200).json(data);
    },
    importRecipeFromProj: function(req, res) {

        recipeImporter.importFromProject(req.project)
        .then(recipe => {
            console.log('Recipe successfully imported from project ' + req.project._id);
            res.status(200).json(recipe);
        })
        .catch(err => {
            console.error('Error in importing recipe from project', err);
            res.status(500).send({});
        });

    },

    //
    // Recipe Run stuff
    //
    getRecipeRuns: function (req, res) {
        res.status(200).json(
            recipeRunModel
                .listByRecipeIdAsync(req.recipe.id)
                .map(fixProgressStatus)
                .map(buildRunObject));
    },
    getRecipeRunById: function(req, res) {
        var runId = req.params.run_id;
        if(!runId) {
            res.status(404).send("RecipeRun Id is invalid or wrong. Given: " + runId);
        }
        var run = recipeRunModel.listById(runId)
        .then(fixProgressStatus)
        .then(buildRunObject);
        res.status(200).json(run);
    },
    getRecipeRunLogs : function (req, res) {
        var runId = req.params.run_id;
        if(!runId) {
            res.status(404).send("RecipeRun Id is invalid or wrong. Given: " + runId);
        }
        return res.status(200).json(recipeRunModel.loadLogs(runId));
    }
};
function bindEventStreamToConsole (engine) {
    engine.on('info', msg => console.log(`[Engine.INFO]${msg}`));
    engine.on(engine.VALIDATION_FAILED, msg => console.log(logPrefix,"[Engine.VALIDATION_FAILED]", msg));
    engine.on('error', msg => console.log(logPrefix,"[Engine.ERROR]", msg));
}

/**
 * Run Object sent through the API.
 * Basically pulling out the name of the project, and other stuff goes in here.
 * this is dynamic because projects can be deleted or their name changed
 * @param  {MongooseModel} run run object
 * @return {Promise}     final baked object
 */
function buildRunObject (runM) {
    var run = runM.toJSON();
    var projectsP = Promise.map(run.projects, p => ProjModel.listByIdAsync(p.ref));
    return Promise.all(projectsP)
        .then(function(projects) {
            run.projects = _.compact(projects).map(p => { return {
                name : p.projName,
                ref : p.id
            };});
            return run;
        });
}
// sometimes the server shuts down before run is finished, this marks it as a failure.
function fixProgressStatus(runM) {
    console.log("Checking for errant run. isRunning:", runM.isRunning, "isSuccessful:", runM.isSuccessful);
    if(runM.isRunning && !runM.isSuccessful) {
        // still running, check to make sure
        if(!runningRecipesRuns.has(runM._id.toString())) {
            runM.isRunning = false;
            return runM.saveAsync()
            .tap(runM => console.log(logPrefix, 'Errant run thought it was still running. Fixed'));
        }
    }
    return runM;
}

