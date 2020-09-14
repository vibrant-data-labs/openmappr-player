'use strict';
/**
 * Recipe engine is an event driven machine.
 *
 * Algorithm
 * For 7 sequential phases, beginning with data import
 * DataImport generates a list of datasources.
 * For each datasource, the rest of the phases are run sequentially.
 */
// given recipe
// IS AN EVENT EMITTER
// error : error messages

var _ = require('lodash'),
    util = require('util'),
    EventEmitter = require('events'),
    Promise = require('bluebird');

var ProjModel = require('../project/proj_model'),
    DSModel = require("../datasys/datasys_model");

var Reporter = require('./recipe_reporter');

var ETLRunnerMixin = require('./gen_etl'),
    SnapshotGeneratorMixin = require('./gen_snapshot'),
    PlayerGeneratorMixin = require('./gen_player'),
    DataSourceImportMixin = require('./gen_datasource'),
    DatasetGeneratortMixin = require('./gen_dataset'),
    NetworkGeneratortMixin = require('./gen_networks');

var VALIDATION_FAILED = require('./recipe_errors').VALIDATION_FAILED;



function RecipeEngine(recipe, user, org, opts) {
    this.user = user;
    this.org = org;
    this.projects = [];
    this.parsedDataSrcs = [];
    this.recipe = recipe;

    // basically all the current for each run per data source are stored here
    this._runningArtifacts = [];
    // override def opts with given ones
    this.opts = _.extend({}, recipe.gen_opts, opts);
    console.log("[RecipeEngine] opts:", this.opts);
    EventEmitter.call(this);
}
ETLRunnerMixin.call(RecipeEngine.prototype);
DataSourceImportMixin.call(RecipeEngine.prototype);
DatasetGeneratortMixin.call(RecipeEngine.prototype);
NetworkGeneratortMixin.call(RecipeEngine.prototype);
SnapshotGeneratorMixin.call(RecipeEngine.prototype);
PlayerGeneratorMixin.call(RecipeEngine.prototype);
util.inherits(RecipeEngine, EventEmitter);

RecipeEngine.prototype.VALIDATION_FAILED = VALIDATION_FAILED;

/**
 * Primary generation point
 * @return {[type]} [description]
 */
RecipeEngine.prototype.begin_gen = function(run, runEventStream) {
    var opts = this.opts;
    this.run = run;
    this.runES = runEventStream;

    var topReporter = new Reporter(this, {});

    var initP = new Promise.resolve(null).bind(this)
        .tap(() => this.emit('info', '[begin_gen] beginning generation'))
        .tap(() => topReporter.emitProg({
            completion: 5,
            phase: 'generation:begin',
            msg: '[begin_gen] beginning generation.'
        }));

    // if etl is enabled, then do it 1st.
    var onETLExec = null;
    if(this.isETLEnabled) {
        initP.tap(() => topReporter.emitProg({
            phase: 'etl_gen:begin',
            msg: '[begin_gen] etl gen beginning'
        }));
    }
    if(!opts.skipETLExecution && this.isETLEnabled) {
        onETLExec = initP.then(() => this.gen_etl(topReporter))
            .tap(etl_results => this.etl_results = etl_results);
    } else {
        this.emit('info', '[begin_gen] skipping ETL');
        this.etl_results = opts.etl_results;
        onETLExec = initP.then(() => opts.etl_results);
    }
    if(this.isETLEnabled) {
        onETLExec.tap(() => this.emit('phase:result', {
            phase: 'etl_gen',
            result: this.etl_results
        }));
        onETLExec
            .tap(() => topReporter.emitProg({
                completion: 10,
                phase: 'etl_gen:end',
                data: this.etl_results,
                msg: `[begin_gen] etl generation finished. Results: ${util.inspect(this.etl_results)}`
            }));
    }

    //
    // data source parsing phase
    //
    onETLExec.tap(() => topReporter.emitProg({
        phase: 'data_ingest:begin',
        msg: '[begin_gen] data source parsing beginning'
    }));

    var onDataSourceParsed = null;
    if (!opts.skipDataSourceParsing) {
        onDataSourceParsed = onETLExec
            .then(() => this.gen_dataSource(topReporter))
            // store all datasources on engine
            .tap(dsSrcs => this.parsedDataSrcs = dsSrcs);
    } else {
        this.emit('info', '[begin_gen] skipping data source parsing. Using source: ' + util.inspect(opts.parsedDataSrcs));
        this.parsedDataSrcs = opts.parsedDataSrcs;
        onDataSourceParsed = onETLExec.then(() => opts.parsedDataSrcs);
    }
    onDataSourceParsed.tap(() => this.emit('phase:result', {
        phase: 'data_ingest',
        result: this.parsedDataSrcs
    }));
    onDataSourceParsed
        .tap(() => topReporter.emitProg({
            completion: 20,
            phase: 'data_ingest:end',
            data: _.map(this.parsedDataSrcs, 'dsid'),
            msg: `[begin_gen] data source parsing finished. num sources found: ${this.parsedDataSrcs.length}`
        }));

    //
    //  for each data Source, generate a project
    //
    var completion = 10; // 10 for a single datasource. left is 75.
    var onProjectGenFinished = onDataSourceParsed
        .then(() => this.parsedDataSrcs)
        .tap(dataSrcs => completion = (70 / (dataSrcs.length * 5))) // 5 is the number of phases
        .tap(dataSrcs => this.emit('info', '[begin_gen] DataSources to be analyzed: ' + dataSrcs.length))
        .tap(dataSrcs => this.emit('info', '[begin_gen] completion ratio: ' + completion))
        .map(function forEachDataSource(dataSource, dsIdx) {
            var initGen = new Promise.resolve(null).bind(this);
            // a scope for each datasource :) to share data
            var scope = {
                dataSource: dataSource
            };
            var scopeReporter = new Reporter(this, scope);

            this.emit('info', `[forEachDataSource][${dsIdx}] Started analysis of DataSource: ` + _.get(dataSource, 'dataset.sourceInfo.sourceURL'));


            // project generation phase
            var onProjectGen = null;

            scopeReporter.emitProg({
                phase: 'project_gen:begin',
                msg: `[forEachDataSource][${dsIdx}] project generation beginning`
            });
            if (!opts.skipProjectGen) {
                onProjectGen = initGen.then(() => this.gen_project(scope, scopeReporter, dataSource))
                    .tap(proj => scope.project = proj)
                    .tap(proj => this.projects.push(proj))
                    .tap(proj => this.emit('info', `[forEachDataSource][${dsIdx}] basic project built. id: ${proj.id}`));
            } else {
                // TODO: Project skipping is dangerous! Find a better soln
                this.emit('info', `[forEachDataSource][${dsIdx}] skipping project generation. Using project: ${util.inspect(opts.project)}`);
                scope.project = opts.project;
                this.projects.push(opts.project);
                onProjectGen = initGen.then(() => opts.project);
            }

            onProjectGen.tap(proj => this.emit('phase:result', {
                phase: 'project_gen',
                result: scope.project
            }));


            onProjectGen.tap(() => scopeReporter.emitProg({
                completion: completion,
                phase: 'project_gen:end',
                msg: `[forEachDataSource][${dsIdx}] project Generation finished`
            }));

            onProjectGen.tap(() => scopeReporter.emitProg({
                phase: 'dataset_gen:begin',
                msg: `[forEachDataSource][${dsIdx}] dataset generation beginning`
            }));

            //
            // dataset generation phase
            //
            var onDatasetGen = null;
            if (!opts.skipDatasetGen) {
                onDatasetGen = onProjectGen
                    .then(function() {
                        return this.gen_dataset(scope, scopeReporter, scope.dataSource.dataset);
                    });
            } else {
                this.emit('info', `[forEachDataSource][${dsIdx}] skipping dataset generation. Using dataset: ${util.inspect(opts.dataset)}`);
                scope.dataset = opts.dataset;
                onDatasetGen = onProjectGen.then(() => opts.dataset);
            }

            onDatasetGen.tap(() => scopeReporter.emitProg({
                completion: completion,
                phase: 'dataset_gen:end',
                msg: `[forEachDataSource][${dsIdx}] dataset generation finished`
            }));

            //
            // POST PROCESS
            //
            onDatasetGen = onDatasetGen.tap(() => scopeReporter.emitProg({
                phase: 'dataset_post_process:begin',
                msg: `[forEachDataSource][${dsIdx}] dataset post processing beginning`
            }))
            .then(dataset => this.post_process_ds(scope, scopeReporter, dataset))
            .tap(() => scopeReporter.emitProg({
                phase: 'dataset_post_process:end',
                msg: `[forEachDataSource][${dsIdx}] dataset post processing finished`
            }))
            .tap(dataset => scope.dataset = dataset)
            .then((ds) => DSModel.saveDataset(ds, scope.project.id))
            .tap(() => this.emit('info', `[forEachDataSource][${dsIdx}] dataset saved`));

            onDatasetGen.tap(dataset => this.emit('phase:result', {
                phase: 'dataset_post_process',
                result: scope.dataset
            }));

            //
            // network generation phase
            //
            var onNetworkGen = null;
            onDatasetGen = onDatasetGen.tap(() => scopeReporter.emitProg({
                phase: 'network_gen:begin',
                msg: `[forEachDataSource][${dsIdx}] network generation beginning`
            }));

            if (!opts.skipNetworkGen) {
                onNetworkGen = onDatasetGen
                    .then(function() {
                        return this.gen_networks(scope, scopeReporter);
                    })
                    .tap(networkIds => scope.networkIds = networkIds);
            } else {
                this.emit('info', `[forEachDataSource][${dsIdx}] skipping networks generation. Using networkIds: ${util.inspect(opts.networkIds)}`);
                scope.networkIds = opts.networkIds;
                onNetworkGen = onDatasetGen.then(() => opts.networkIds);
            }
            onNetworkGen.tap(() => scopeReporter.emitProg({
                completion: completion,
                phase: 'network_gen:end',
                msg: `[forEachDataSource][${dsIdx}] network generation finished`
            }));

            //
            // Snapshot generation
            //
            onNetworkGen.tap(() => scopeReporter.emitProg({
                phase: 'snapshot_gen:begin',
                msg: `[forEachDataSource][${dsIdx}]  snapshot generation beginning`
            }));

            // read networks
            onNetworkGen = onNetworkGen.then(() =>
                Promise
                .map(scope.networkIds, nwid => DSModel.readNetwork(nwid))
                .tap(networks => scope.networks = networks)
            );

            onNetworkGen.tap(dataset => this.emit('phase:result', {
                phase: 'network_gen',
                result: scope.networks,
                dataset: scope.dataset
            }));

            // snapshot generation phase
            var onSnapshotGen = null;
            if (!opts.skipSnapshotGen) {
                onSnapshotGen = onNetworkGen
                    .then(function() {
                        return this.gen_snapshot(scope, scopeReporter);
                    });
            } else {
                this.emit('info', `[forEachDataSource][${dsIdx}] skipping snapshot generation.`);
                onSnapshotGen = onNetworkGen.thenReturn(scope.project);
            }
            onSnapshotGen.tap(() => scopeReporter.emitProg({
                completion: completion,
                phase: 'snapshot_gen:end',
                msg: `[forEachDataSource][${dsIdx}] snapshot generation finished`
            }));
            onSnapshotGen.tap(project => this.emit('phase:result', {
                phase: 'snapshot_gen',
                result: _.map(project.snapshots, "id"),
                dataset: scope.dataset
            }));

            //
            // player generation
            //
            onSnapshotGen.tap(() => scopeReporter.emitProg({
                phase: 'player_gen:begin',
                msg: `[forEachDataSource][${dsIdx}]  player generation beginning`
            }));
            var onPlayerGen = null;
            if(!opts.skipPlayerGen) {
                onPlayerGen = onSnapshotGen
                .then(() => this.gen_player(scope, scopeReporter))
                .tap(player => scope.player = player);
            } else {
                this.emit('info', `[forEachDataSource][${dsIdx}] skipping player generation.`);
                onPlayerGen = onSnapshotGen.thenReturn(null);
            }
            onPlayerGen.tap(() => scopeReporter.emitProg({
                completion: completion,
                phase: 'player_gen:end',
                msg: `[forEachDataSource][${dsIdx}] player generation finished`
            }));
            onPlayerGen.tap(player => this.emit('phase:result', {
                phase: 'player_gen',
                result: player,
                dataset: scope.dataset
            }));

            ///
            ///  finished all phases
            ///
            onPlayerGen.tap(() =>
                console.log(`[forEachDataSource][${dsIdx}] finished analysis of dataSource: ` + _.get(dataSource, 'dataset.sourceInfo.sourceURL'))
            );
            // finally store the finished scope in the engine
            onPlayerGen.tap(() => this._runningArtifacts.push(scope));

            onPlayerGen.catch(function cleanup(error) {
                console.log(`[forEachDataSource][${dsIdx}]  Error occured in generation. Cleaning up the system:`, error);
                return this.cleanup_project(scope)
                    .finally(function() {
                        if (scope.dataset) {
                            DSModel.removeDatasetById(scope.dataset.id);
                        }
                        if (scope.networks) {
                            _.each(scope.networkIds, DSModel.removeNetworkById.bind(DSModel));
                        }
                    });
            });

            return onPlayerGen.then(() => scope);
        });
    onProjectGenFinished
        .tap(() => this.emit('info', `[begin_gen] Finished analysis of all the datasources`))
        .tap(() => topReporter.emitProg({
            completion: 20,
            phase: 'generation:end',
            msg: '[begin_gen] Finished analysis of all the datasources'
        }))
        .tap(() => this.emit('end', this));
    onProjectGenFinished.catch(error => {
        console.log('Error in executing recipe:', error);
        this.emit('error', error);
        throw error;
    });
    return onProjectGenFinished;
};
//
// Project BUILDER
//
RecipeEngine.prototype.gen_project = function(scope, reporter, dataSource) {
    var cfg = this.recipe.project_gen,
        recipeName = this.recipe.name,
        user = this.user,
        org = this.org;

    var projName = 'generated: ' + (cfg.projectName || 'Project');
    // build project name
    if(this.etl_results && this.etl_results.key) {
        projName = recipeName + ' | ' +_.last(this.etl_results.key.split('/'));
    } else if (dataSource.urlInfo) {
        projName = recipeName + ' | ' + dataSource.urlInfo.host + '|' + dataSource.urlInfo.path.replace(/\//g, '_');
    } else {
        projName = recipeName + ' | ' + dataSource.name;
    }
    console.log("[gen_project]","PROJECT NAME:", projName);

    if (cfg.generate) {
        var proj = {
            projName: projName,
            org: {
                ref: org.id
            },
            owner: {
                ref: user.id
            },
            recipe: {
                ref: this.recipe._id
            }
        };
        return ProjModel.buildAsync(proj)
            .tap(proj => this._postProjectCreate(user, org, proj));
    }
    return Promise.reject('[gen_project] Unable to generate project. Given: ' + cfg);
};

// update user and org post project creation
RecipeEngine.prototype._postProjectCreate = function(user, org, projDoc) {
    var newProj = {
        ref: projDoc._id,
        projName: projDoc.projName,
        picture: projDoc.picture,
        owner: {
            ref: projDoc.owner.ref
        },
        members: projDoc.users.members,
        dateModified: projDoc.dateModified
    };

    //update org
    org.projects.push(newProj);

    return org.save()
        .catch(err => {
            this.emit('warning', '[RecipeEngine._postProjectCreate] Project created but could not update org\n' + err.stack);
            return Promise.reject(err);
        })
        .then(function() {
            user.projects.push({
                ref: projDoc._id,
                org: org._id,
                owner: projDoc.owner,
                permission: 'isOwner',
                projName: projDoc.projName,
                dateJoined: Date.now()
            });
            return user.save();
        })
        .catch(err => {
            this.emit('warning', '[RecipeEngine._postProjectCreate] Project created but could not update user (owner)\n' + err.stack);
            return Promise.reject(err);
        });
};
///
/// Cleanup funcs
///
RecipeEngine.prototype.cleanup_project = function(scope) {
    if (scope.project) {
        var projectId = scope.project.id;
        return ProjModel.removeByIdAsync(scope.project.id).bind(this)
            .then(function(temp1) {
                this.user.projects = _.filter(this.user.projects, pr => pr.ref !== projectId);
                this.user.markModified('projects');
                return this.user.save();
            })
            .then(function() {
                this.org.projects = _.filter(this.org.projects, pr => pr.ref !== projectId);
                this.org.markModified('projects');
                return this.org.save();
            });
    } else {
        console.warn("NO PROJECT GENERATED to clean up!");
        return Promise.resolve(null);
    }
};
module.exports = RecipeEngine;
