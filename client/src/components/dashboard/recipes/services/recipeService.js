angular.module('mappr')
.service('recipeService', ['$q', '$http', '$rootScope',
function($q, $http, $rootScope) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getForOrg        = getForOrg;
    this.get              = get;
    this.update           = update;
    this.createNew        = createNew;
    this.clone            = clone;
    this.delete = deleteRecipe;
    this.getDefaultRecipe = getDefaultRecipe;
    this.runRecipe        = runRecipe;
    this.getProjects      = getProjects;
    this.getRecipeRuns    = getRecipeRuns;
    this.getRecipeRunLogs = getRecipeRunLogs;
    this.watchRecipeRun   = watchRecipeRun;
    this.importRecipeFromProject = importRecipeFromProject;
    this.toggleIsHidden   = toggleIsHidden;
    this.getCurrOrgRecipesUnsafe = function() { return recipes; };


    /*************************************
    ********* Local Data *****************
    **************************************/
    var recipeChannel = window.io.connect(window.location.origin + "/recipe_tracker"); // the namespace on which recipe_generation engine lives
    var recipes = [];



    /*************************************
    ********* Core Functions *************
    **************************************/

    function listUrl(orgId) {
        return '/api/orgs/' + orgId + '/recipes';
    }

    function getForOrg(orgId) {
        return $http.get(listUrl(orgId)).then(function(resp) {
            _.each(resp.data, function(run) {
                run.createdAt = new Date(run.createdAt);
                run.modifiedAt = new Date(run.modifiedAt);
            });
            recipes = _.clone(resp.data);
            return resp.data;
        });
    }

    function get(orgId, recipeId) {
        return $http.get(listUrl(orgId) + '/' + recipeId).then(function(resp) {
            return resp.data;
        });
    }

    function update(orgId, recipeId, recipeData) {
        return $http.post(listUrl(orgId) + '/' + recipeId, recipeData).then(function(resp) {
            return resp.data;
        });
    }

    function createNew(orgId, recipeData) {
        return $http.post(listUrl(orgId), recipeData).then(function(resp) {
            return resp.data;
        });
    }

    function clone(orgId, recipeId) {
        return $http.post(listUrl(orgId) + '/' + recipeId + '/clone', {}).then(function(resp) {
            return resp.data;
        });
    }
    function deleteRecipe(orgId, recipeId) {
        return $http.delete(listUrl(orgId) + '/' + recipeId).then(function(resp) {
            return resp.data;
        });
    }

    function getProjects(orgId, recipeId) {
        return $http.get(listUrl(orgId) + '/' + recipeId + '/projects').then(function(resp) {
            return resp.data;
        });
    }

    function getRecipeRuns(orgId, recipeId) {
        return $http.get(listUrl(orgId) + '/' + recipeId + '/runs').then(function(resp) {
            _.each(resp.data, function(run) {
                run.createdAt = new Date(run.createdAt);
                run.modifiedAt = new Date(run.modifiedAt);
            });
            return resp.data;
        });
    }

    function getRecipeRunLogs(orgId, recipeId, runId) {
        return $http.get(listUrl(orgId) + '/' + recipeId + '/runs/' + runId + '/logs').then(function(resp) {
            return resp.data;
        });
    }

    function importRecipeFromProject(orgId, projId) {
        return $http.get(listUrl(orgId) + '/projects/' + projId + '/import').then(function(resp) {
            return resp.data;
        });
    }

    // more top level funcs
    function toggleIsHidden(recipe) {
        recipe.isHidden = !recipe.isHidden;
        return update(recipe.org.ref, recipe._id, recipe);
    }

    /**
     * Generation system creates a task, then triggers a generation. Broadcasts progress events to $rootScope
     * @param  {object}     cfg extra config needed to generation. usually an 'uploadId' field is needed
     * @return {Promise}    Promise of generation. With notifications hooked in
     */
    function runRecipe( recipeVM, cfg) {
        var taskId = 'recipe_' + _.random(0, 100000, false).toString();
        // var ioCreate = $http.post('/api/jobs', {
        //     name: 'recipeJob',
        //     taskId: taskId
        // });
        cfg.taskId = taskId;
        // start the run once connection is established
        var onConnectFn = function() {
            return $http.post(listUrl(recipeVM.orgId) + '/' + recipeVM._id + '/projects', cfg)
                .then(function(respData) { return respData.data; })
                .then(function(recipeRunObj) {
                    console.log("[RecipeService.runRecipe] recipeRunObj", recipeRunObj);
                    return res;
                })
                .catch(function(err) {
                    console.log('[recipeService]Error in executing recipe : %O', err);
                    return $q.reject(err);
                });
        };
        var res = watchRecipeRun(recipeVM, taskId, onConnectFn)
            .then(function(data) {
                // generation successful
                console.log("[RecipeService.runRecipe] Generation successful! got data:", data);
                return data.result;
            });

        return res;
    }

    function watchRecipeRun (recipeVM, taskId, onConnectFn) {
        var recipeId = recipeVM._id;
        recipeChannel.emit('subscribe_task', {
            recipeId : recipeId,
            taskId : taskId
        });
        var defer = $q.defer();

        // wait for subscription before firing off engine
        recipeChannel.on('subscribed_task', function(data) {
            console.log("[RecipeService.runRecipe] subscribed_task data: ", data);
            if(data.taskId !== taskId) { return; }
            if(onConnectFn) { onConnectFn(); }
        });

        recipeChannel.on('completed', function(data) {
            defer.resolve(data);
        });

        recipeChannel.on('failed', function(data) {
            console.log(new Date().toISOString().substr(11, 8) + "[recipeService.Channel.FAILED]", data);
            // handleError(recipeVM, data.result);
            $rootScope.$apply(function() {
                $rootScope.$broadcast("update_phases", {
                    progData : data.result,
                    evtType : 'failed',
                    recipeId : recipeId
                });
            });
            defer.reject(data);
        });

        recipeChannel.on('running', function(data) {
            // console.log("Notify: ", data);
            // defer.notify(data);
            $rootScope.$apply(function() {
                $rootScope.$broadcast("update_phases", {
                    progData : data.result,
                    evtType : 'running',
                    recipeId : recipeId
                });
            });
            defer.notify(data.completion + ' | ' + data.result.msg);
        });

        recipeChannel.on('run_updated', function(condensedRun) {
            // console.log("run_updated: ", condensedRun);
            $rootScope.$apply(function() {
                $rootScope.$broadcast("vm_update", {
                    condensedRun : condensedRun.result,
                    evtType : 'run_updated',
                    recipeId : recipeId
                });
            });
        });

        recipeChannel.on('notification', function(data) {
            var msg = _.get(data, 'data.msg', _.get(data, 'data.message', data.result));
            // console.log(data.completion + ' | ', msg);
            defer.notify(data.completion + ' | ' + msg);
        });

        return defer.promise;
    }


    function getDefaultRecipe() {
        return {
            "name": "Default Recipe",
            "isGlobal": false,
            "isLinkedToProject": false,

            "gen_opts": {},

            "project_gen": {
                "generate": true,
                "reLinkPlayer": true
            },
            "data_ingest": {
                "srcType": "uploadedData"
            },
            "dataset_gen": {
                "attr_desc": [{
                    "id": "Attribute One",
                    "attrType": "string"
                }],
                "post_process": []
            },
            "network_gen": {
                "defNetworkName": "My first network",
                "networks": [{
                    "name": "Network 1",
                    "gen_algo": "athena_netgen",
                    "gen_def_layout": true,
                    "algo_config": {
                        "options": {
                            "questions": [{
                                "Question": "Attribute One",
                                "qAnalysisType": 5
                            }]
                        }
                    }
                }]
            },
            "snapshot_gen": {
                "genNetworkSnapshots": true,
                "defaultSnapConfig": {}
            },
            // in future
            "layout_gen": {
                "layouts": []
            },
            "player_gen": {}
        };
    }
}
]);
