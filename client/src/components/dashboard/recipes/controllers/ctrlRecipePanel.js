angular.module('mappr')
    .controller('RecipePanelCtrl', ['$scope', '$q', '$timeout', '$routeParams', '$uibModal', 'orgFactory', 'recipeService', 'uiService',
        function($scope, $q, $timeout, $routeParams, $uibModal, orgFactory, recipeService, uiService) {
            'use strict';

            /*************************************
    ********* CLASSES ********************
    **************************************/

            // Recipe ViewModel
            function RecipeVM(recipe, orgId) {
                this._id = null;
                this.recipe = recipe;
                this.orgId = orgId;
                this.messages = [];
                this.recipeRuns = [];
                this.runConfig = {}; // the config to use for the run
                this.phases = {};
                this.runsLoaded = false;

                this.exec_started = false;
                this.exec_finished = false;
                this.exec_failed = false;
                this.failureData = null;

                this.latestMsg = null;

                this.init();
            }
            RecipeVM.prototype.init = function() {
                this._id = this.recipe._id;
                this.code = JSON.stringify(_.deepOmit(this.recipe, '_id'), null, 4);
                this.isNew = !this.recipe._id;
                this.tempName = this.recipe.name;
                this.latestMsg = null;
                this.exec_failed = false;
                this.failureData = null;
            };
            RecipeVM.prototype.loadPhases = function(phaseFnMap) {
                var phasesToLoad = ["data_source",
                    "dataset_gen",
                    "etl_gen",
                    "dataset_post_proc",
                    "network_gen",
                    "project_gen",
                    "snapshot_gen",
                    "layout_gen",
                    "player_gen"];

                _.each(phasesToLoad, function(phase) {
                    var oldPhase = this.phases[phase];

                    // for post_proc, only build phase if it is asked from in dataset_gen
                    if (phase !== 'dataset_post_proc' ||
                _.get(this.recipe, "dataset_gen.post_process.length"))
                    {
                        this.phases[phase] = phaseFnMap[phase](this.recipe, this);
                        if(oldPhase) {
                            this.phases[phase].locals = oldPhase.locals;
                            // for data_source, copy uploads as well.
                            if(phase == 'data_source') {
                                this.phases[phase].uploads = oldPhase.uploads;
                            }
                        }
                    }
                }.bind(this));

                // this.phases.data_source = phaseFnMap.gen_dataSource_vm(this.recipe, this);
                // this.phases.dataset_gen = phaseFnMap.gen_datasetGen_vm(this.recipe, this);
                // if (_.get(this.recipe, "dataset_gen.post_process.length")) {
                //     this.phases.dataset_post_proc = phaseFnMap.gen_datasetPostProc_vm(this.recipe, this);
                // }
                // this.phases.network_gen = phaseFnMap.gen_networkGen_vm(this.recipe, this);
                // this.phases.project_gen = phaseFnMap.gen_projectGen_vm(this.recipe, this);
                // this.phases.snapshot_gen = phaseFnMap.gen_snapshotGen_vm(this.recipe, this);
                // this.phases.layout_gen = phaseFnMap.gen_layoutGen_vm(this.recipe, this);
                // this.phases.player_gen = phaseFnMap.gen_playerGen_vm(this.recipe, this);
            };
            RecipeVM.prototype.getJSONRepr = function() {
                var obj = null;
                try {
                    obj = JSON.parse(this.code);
                } catch (e) {
                    this.send_err(e.toString());
                }
                return obj;
            };
            RecipeVM.prototype.parseConfig = function() {
                this.msg_reset();
                var obj = this.getJSONRepr();
                this.send_info('Parsing user given config...');
                if (!obj) {
                    var err = "Unable to parse the config properly. It is not a valid json object";
                    this.send_err(err);
                    return console.error(err);
                }
                this.send_info('Parsing Successful.');
                return obj;
            };
            RecipeVM.prototype.onCreate = function() {
                var self = this;
                this.msg_reset();
                var obj = this.parseConfig();

                // create a new recipe
                this.send_info('Creating recipe...');
                return recipeService.createNew(this.orgId, obj)
                    .then(function(recipe) {
                        self.send_info('Creation Successful. Switching to update mode');
                        self.recipe = recipe;
                        self.init();
                    })
                    .catch(function(e) {
                        self.send_err('Unable to create. Got error:');
                        self.send_err(e.toString());
                    });
            };
            RecipeVM.prototype.onUpdate = function(recipeObjUpdated) {
                var self = this;
                this.msg_reset();

                //if object updated, then just pass object, else, parse this.code
                var obj = recipeObjUpdated ? this.recipe : this.parseConfig();

                // create a new recipe
                this.send_info('updating recipe...');


                // //can't figure out why uploads are being removed on update?? so saving and reapplying
                // var uploads = _.cloneDeep(self.phases.data_source.uploads);

                // create a new recipe
                return recipeService.update(this.orgId, this._id, obj)
                    .then(function(recipe) {
                        self.send_info('Update Successful');
                        self.recipe = recipe;
                        self.init();
                        //have to pass it back because it gets lost when saved (but not sure why)
                        // self.phases.data_source.uploads = uploads;
                        uiService.log('Recipe Updated!');
                    })
                    .catch(function(e) {
                        self.send_err('Unable to update. Got error:');
                        self.send_err(e.toString());
                        uiService.log('Error Updating Recipe!');
                    });
            };
            // open the recipe application modal
            RecipeVM.prototype.onGenerate = function() {
                $uibModal.open({
                    templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/recipe_gen_modal.html",
                    controller: 'recipeGenModalCtrl',
                    size: 'lg',
                    resolve: {
                        recipe: _.constant(this.recipe)
                    }
                });
            };
            RecipeVM.prototype.loadRuns = function() {
                var self = this;
                return recipeService.getRecipeRuns(this.orgId, this._id)
                    .then(function(runs) {
                        // setup log loading. logs are large objects
                        _.each(runs, function(run) {
                            run.isLogLoaded = false;
                            run.isLogLoading = false;
                            run.loadLogs = function() {
                                run.isLogLoading = true;
                                run.showLogs = true;
                                recipeService.getRecipeRunLogs(self.orgId, self._id, run._id)
                                    .then(function(logs) {
                                        run.logs = logs;
                                        run.isLogLoaded = true;
                                        run.isLogLoading = false;
                                        _.each(logs, function(log) {
                                            log.formattedDate = window.moment(log.createdAt).local().format('hh:mm:ss a');
                                        });
                                    });
                            };
                            run.hideLogs = function() {
                                run.showLogs = false;
                            };
                            run.toggleLogs = function() {
                                if(run.showLogs) {
                                    run.hideLogs();
                                } else {
                                    run.loadLogs();
                                }

                            };
                        });
                        return runs;
                    })
                    .then(function(runs) {
                        self.recipeRuns = runs;
                        self.runsLoaded = true;
                        // $scope.selectedRun = _.last(self.recipeRuns);
                    });
            };

            RecipeVM.prototype.msg_reset = function() {
                this.messages.length = 0;
            };
            RecipeVM.prototype.send_err = function(msg) {
                this.messages.push({
                    msgType: 'error',
                    msg: msg
                });
            };
            RecipeVM.prototype.send_info = function(msg) {
                this.messages.push({
                    msgType: 'info',
                    msg: msg
                });
            };
            RecipeVM.prototype.executeRecipe = function() {
                return executeRecipe(this);
            };
            RecipeVM.prototype.saveRecipeName = function() {
                this.recipe.name = this.tempName;
                this.onUpdate(true);
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var recipeId = $routeParams.recipeid;
            var recipes = recipeService.getCurrOrgRecipesUnsafe();
            var currRecipe = _.find(recipes, '_id', recipeId);



            /*************************************
    ********* Scope Bindings *************
    **************************************/
            /**
    *  Scope data
    */
            $scope.vm = null;
            $scope.initRecipe = initRecipe;
            $scope.selectedRun = null;

            /**
    * Scope methods
    */



            /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

            ///
            /// Progress updation functions
            ///
            $scope.$on('recipe:loadRunInfo', function(e, data) {
                e.stopPropagation();
                $scope.selectedRun = data.run;
                if(_.get($scope, 'selectedRun.isRunning')) {
                    processRecipeRun($scope.vm, $scope.selectedRun);
                }
                $scope.$broadcast('recipe:runInfoChanged', data);
                // $scope.$broadcast('recipe:loadRunInfo');
            });

            // start listening to vm_updates
            $scope.$on('vm_update', function(event, data) {
                if(!$scope.vm) { return; }
                var vm = $scope.vm;
                if(data.recipeId === vm._id) {
                    update_recipeVM(vm, data.condensedRun);
                }
            });

            $scope.$on('update_phases', function(event, data) {
                if(!$scope.vm) { return; }
                var vm = $scope.vm;
                // console.log("phase:",data.progData.phase, ", TaskId: ", _.get(data.progData, "itemId", "no item Id"), ", taskCompletion:", data.progData.taskCompletion);
                if(data.recipeId === vm._id) {
                    if(data.evtType === "running") {
                        update_phases(vm, data.progData);
                    } else if(data.evtType === "failed") {
                        handleError(vm, data.progData);
                    }
                }
            });

            /*************************************
    ********* Initialise *****************
    **************************************/
            initRecipe(currRecipe);


            /*************************************
    ********* Core Functions *************
    **************************************/

            // initialize vm with last run config, and subscribe to
            // receive updates
            function processRecipeRun (recipeVM, run) {
                recipeVM.exec_started = true;
                recipeVM.exec_failed = false;

                _.forOwn(recipeVM.phases, function(phasevm) {
                    var hasBegun = _.find(run.phasesBegun, 'phase', phasevm.phase_type);
                    if(hasBegun) {
                        phasevm.run_begin = true;
                    }
                    hasBegun = _.find(run.phasesEnd, 'phase', phasevm.phase_type);
                    if(hasBegun) {
                        phasevm.run_finished = true;
                    }
                });

                recipeService.watchRecipeRun(recipeVM, run.taskId, _.noop)
                    .then(postRun(recipeVM), postRunFail(recipeVM));
                return recipeVM;
            }

            // update the whole VM with the run data. Useful when user switches between recipes
            function update_recipeVM(recipeVM, condensedRun) {
                recipeVM.exec_started = condensedRun.isRunning;
                recipeVM.exec_finished = !condensedRun.isRunning;
                recipeVM.exec_failed = !condensedRun.isRunning && !condensedRun.isSuccessful;

                _.forOwn(recipeVM.phases, function(phasevm) {
                    var hasBegun = _.find(condensedRun.phasesBegun, 'phase', phasevm.phase_type);
                    if(hasBegun) {
                        phasevm.run_begin = true;
                    }
                    var hasEnded = _.find(condensedRun.phasesEnd, 'phase', phasevm.phase_type);
                    if(hasEnded) {
                        phasevm.run_finished = true;
                    }
                });
            }
            // setup phase mgmt
            // for now, three phases
            // data_ingest, dataset_gen, network_gen
            function update_phases(recipeVM, data) {
                if (data.evt_type != "progress") {
                    return;
                }

                var str_arr = data.phase.split(':');
                var phase = str_arr[0],
                    status = str_arr[1];

                var phasevm = _.find(recipeVM.phases, "phase_type", phase);

                if (!phasevm) {
                    return console.log("[RecipeService] Phase not found: ", data.phase);
                }
                recipeVM.latestMsg = data.msg;

                if (status === "begin") {
                    console.log("Began phase: ", phase);
                    phasevm.run_begin = true;
                } else if (status === "end") {
                    console.log("Ended phase: ", phase);
                    phasevm.run_finished = true;
                } else if (status === 'progress') {
                    phasevm.finalCompletion = calcFinalCompletion(phasevm, data);
                    console.log("Progress: ", data.taskCompletion, data.msg);
                } else {
                    console.warn("bizzare status of phase", status);
                }
            }
            function calcFinalCompletion(phasevm, data) {
                var tasks = phasevm.tasks,
                    taskCompletions = phasevm.taskCompletions,
                    itemId = data.itemId;

                if (!_.contains(tasks, itemId)) {
                    tasks.push(itemId);
                }
                taskCompletions[itemId] = data.taskCompletion || 0;

                return _.sum(_.values(taskCompletions)) / _.size(tasks);
            }

            function handleError(recipeVM, errorData) {
                if (errorData.name !== "RecipeEngineError") {
                    console.warn("Non engine error: ", errorData);
                }

                var phase = errorData.phase;
                var phasevm = _.find(recipeVM.phases, "phase_type", phase);
                if (!phasevm) {
                    console.warn("Phase not found: ", phase, errorData);
                }
                phasevm.run_failed = true;
                phasevm.failureData = errorData;
            }

            //
            // Recipe Execution specific stuff
            //
            function executeRecipe(vm) {
                vm.exec_started = true;
                vm.exec_failed = false;
                vm.failureData = null;
                var runObj = recipeService.runRecipe(vm, vm.runConfig);

                runObj.then(postRun(vm), postRunFail(vm));
                return runObj;
            }

            function postRun (vm) {
                // reset the state everywhere
                return function(results) {
                    console.log("Recipe Run successful: ", results);
                    vm.loadRuns();
                    $timeout(function() {
                        vm.init();
                    }, 2000);
                };
            }
            function postRunFail (vm) {
                return function(err) {
                    console.log("Run Failed: ", err);
                    vm.exec_failed = true;
                    vm.failureData = err.result;
                    vm.latestMsg = null;
                };
            }

            function initRecipe(recipe) {
                $scope.selectedRun = null;

                return orgFactory.currOrg()
                    .then(function(org) {
                        return buildRecipeVM(org._id, recipe);
                    })
                    .then(function(recipeVM) {
                        $scope.vm = recipeVM;
                        console.log("recipeVM loaded->", recipeVM._id);
                        if ($scope.vm._id) {
                            $scope.vm.loadRuns()
                                .then(function() {
                                    var runs = $scope.vm.recipeRuns;
                                    if(_.get(_.last(runs), 'isRunning')) {
                                        // if it is running, update VM with the progress status
                                        $scope.selectedRun = _.last(runs);
                                        processRecipeRun($scope.vm, $scope.selectedRun);
                                    }
                                });
                        }
                    });
            }

            function buildRecipeVM(orgId, recipe) {
                if (recipe) {
                    return new RecipeVM(recipe, orgId);
                } else {
                    if (recipeId === 'new') {
                        return $q.resolve(new RecipeVM(recipeService.getDefaultRecipe(), orgId));
                    } else if (recipeId) {
                        return recipeService.get(orgId, recipeId)
                            .then(function(recipe) {
                                return new RecipeVM(recipe, orgId);
                            });
                    } else {
                        throw new Error("Unable to initialize controller");
                    }
                }
            }
        }
    ]);
