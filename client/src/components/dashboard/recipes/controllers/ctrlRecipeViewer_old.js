angular.module('mappr')
.controller('recipeViewerCtrl', ['$scope', '$q', '$timeout', '$routeParams', '$uibModal', 'orgFactory', 'recipeService', 'uiService',
function($scope, $q, $timeout, $routeParams, $uibModal, orgFactory, recipeService, uiService) {
    'use strict';
    /**
     * There are 3 sections here. Primarly because the whole thing is a hack. Will organize later when a review of UI happens
     * 1st section is for recipeVM, which controls all kinds of modifications to the recipe stuff
     * 2nd Sections is phaseVM, which encapsulates phase specific behaviour, like what to open.
     * 3rd is Recipe execution section, which is where all the code which manages recipe execution recides.
     */

    $scope.vm = null;
    $scope.initRecipe = initRecipe;
    $scope.toggleViewTab = function toggleViewTab() {
        $scope.showArtifactTab = !$scope.showArtifactTab;
    };
    $scope.showArtifactTab = true;
    $scope.showRecipeCode = false;
    $scope.selectedRun = null;
    $scope.apiBaseUrl = document.location.origin + '/data_api/networks/';
    // $scope.getJSON = getJSON;

    // phase funcs
    $scope.openFileUploadModal = openFileUploadModal;

    console.log('[recipeViewerCtrl] scopeID:', $scope.$id);

    $scope.$on('recipe:infocus', function(event, data) {
        initRecipe(data.recipe);
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

    // if ($scope.recipeInFocus) {
    initRecipe($scope.recipeInFocus);
    // } else {
    //  // dedicated viewer page
    //  return orgFactory.currOrg()
    //      .then(function(org) {
    //          return initCtrl(org._id);
    //      })
    //      .then(function(recipe) {
    //          return initRecipe(recipe);
    //      });
    // }

    function initRecipe(recipe) {
        $scope.selectedRun = null;

        return orgFactory.currOrg()
            .then(function(org) {
                return initCtrl(org._id, recipe)
                    .then(function(recipeVM) {
                        $scope.vm = recipeVM;
                        console.log("recipeVM loaded->", recipeVM._id);
                        if ($scope.vm._id) {
                            $scope.vm.loadRuns()
                                .then(function() {
                                    $scope.selectedRun = _.last($scope.vm.recipeRuns);
                                    if(_.get($scope,"selectedRun.isRunning")) {
                                        // if it is running, update VM with the progress status
                                        processRecipeRun($scope.vm, $scope.selectedRun);
                                    }
                                    $scope.showArtifactTab = !!$scope.selectedRun;
                                });
                        }

                        // recipeService.getProjects(org._id, recipeVM.recipe._id)
                        // .then(function onLoadingProjects (projects) {
                        //  console.log( "recipe projs loaded->", projects);
                        //  recipeVM.recipe.projects = projects;
                        // });
                    });
            });
    }

    function initCtrl(orgId, recipe) {
        if (recipe) {
            return recipeService.get(orgId, recipe._id)
                .then(function(recipe) {
                    return new RecipeVM(recipe, orgId);
                });
        } else {
            var recipeId = $routeParams.recipeid;
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

    // function initRecipe (recipe){
    //  orgFactory.currOrg().then(function (org) {
    //      initCtrl(org._id, recipe);
    //  });
    // }
    //
    // function initCtrl (orgId, recipe) {
    //  if(recipe){
    //      recipeService.get(orgId, recipe._id).then(function(recipe) {
    //          $scope.vm = new RecipeVM(recipe, orgId);
    //      });
    //  } else {
    //      var recipeId = $routeParams.recipeid;
    //      if(recipeId === 'new') {
    //          $scope.vm = new RecipeVM(recipeService.getDefaultRecipe(), orgId);
    //      } else if(recipeId) {
    //          recipeService.get(orgId, recipeId).then(function(recipe) {
    //              $scope.vm = new RecipeVM(recipe, orgId);
    //          });
    //      }
    //  }
    // }

    ///
    /// Progress updation functions
    ///

    // initialize vm with last run config, and subscribe to
    // receive updates
    function processRecipeRun (recipeVM, run) {
        recipeVM.exec_started = true;
        recipeVM.exec_failed = false;

        _.forOwn(recipeVM.phases, function(phasevm, phase) {
            var hasBegun = _.find(run.phasesBegun, 'phase', phasevm.phase_type);
            if(hasBegun) {
                phasevm.run_begin = true;
            }
            var hasBegun = _.find(run.phasesEnd, 'phase', phasevm.phase_type);
            if(hasBegun) {
                phasevm.run_finished = true;
            }
        });

        recipeService.watchRecipeRun(recipeVM, run.taskId, _.noop)
        .then(postRun(recipeVM), postRunFail(recipeService));
        return recipeVM;
    }

    // update the whole VM with the run data. Useful when user switches between recipes
    function update_recipeVM(recipeVM, condensedRun) {
        recipeVM.exec_started = condensedRun.isRunning;
        recipeVM.exec_finished = !condensedRun.isRunning;
        recipeVM.exec_failed = !condensedRun.isRunning && !condensedRun.isSuccessful;

        _.forOwn(recipeVM.phases, function(phasevm, phase) {
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
    // Recipe ViewModel
    //
    function RecipeVM(recipe, orgId) {
        this._id = null;
        this.recipe = recipe;
        this.orgId = orgId;
        this.messages = [];
        this.recipeRuns = [];
        this.runConfig = {}; // the config to use for the run
        this.phases = {};

        this.exec_started = false;
        this.exec_finished = false;
        this.exec_failed = false;
        this.failureData = null;

        this.init();
    }
    RecipeVM.prototype.init = function() {
        this._id = this.recipe._id;
        this.code = JSON.stringify(_.deepOmit(this.recipe, '_id'), null, 4);
        this.isNew = !this.recipe._id;

        this.phases.data_source = gen_dataSource_vm(this.recipe, this);
        this.phases.dataset_gen = gen_datasetGen_vm(this.recipe, this);
        if (_.get(this.recipe, "dataset_gen.post_process.length")) {
            this.phases.dataset_post_proc = gen_datasetPostProc_vm(this.recipe, this);
        }
        this.phases.network_gen = gen_networkGen_vm(this.recipe, this);
        this.phases.project_gen = gen_projectGen_vm(this.recipe, this);
        this.phases.snapshot_gen = gen_snapshotGen_vm(this.recipe, this);
        this.phases.layout_gen = gen_layoutGen_vm(this.recipe, this);
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
        var self = this;
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

        // create a new recipe
        return recipeService.update(this.orgId, this._id, obj)
            .then(function(recipe) {
                self.send_info('Update Successful');
                self.recipe = recipe;
                self.init();
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
                // setup log loding. logs are large objects
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
                                    log.formattedDate = moment(log.createdAt).local().format('hh:mm:ss a');
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

                    }
                });
                return runs;
            })
            .then(function(runs) {
                self.recipeRuns = runs;
                $scope.selectedRun = _.last(self.recipeRuns);
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

    ///
    /// Phase VM
    /// each phase a a set of tasks to be completed, like store Urls, gen many networks
    ///
    function PhaseVM(phase_type, cfg, onClick) {
        this.phase_type = phase_type;
        this.onClick = onClick || _.noop;
        this.cfg = cfg || {};

        this.uploads = []; // used only by data source file upload

        // these are updated by the service itself. watched in the associated scope directives
        this.run_begin = false;
        this.run_finished = false;
        this.run_failed = false;
        this.failureData = null;

        this.tasks = []; // tasks which have to be completed
        this.taskCompletions = {}; // a map of taskId -> percentage completion
        this.finalCompletion = 0;
    }

    function gen_dataSource_vm(recipe, recipeVM) {
        var cfg = recipe.data_ingest;
        if (cfg.srcType === 'uploadedData') {
            return new PhaseVM('data_ingest', cfg,
                function() {
                    openFileUploadModal(recipeVM);
                });
        } else {
            return new PhaseVM('data_ingest', cfg);
        }
    }

    function gen_datasetGen_vm(recipe, recipeVM) {
        var cfg = recipe.dataset_gen;
        return new PhaseVM('dataset_gen', cfg,
            function() {
                openDatasetModal(recipeVM);
            });
    }

    function gen_datasetPostProc_vm(recipe, recipeVM) {
        var cfg = _.get(recipe, "dataset_gen.post_process");
        return new PhaseVM('dataset_post_process', cfg,
            function() {
                openDatasetPostModal(recipeVM);
            });
    }

    function gen_networkGen_vm(recipe, recipeVM) {
        var cfg = recipe.network_gen;
        return new PhaseVM('network_gen', cfg,
            function() {
                openNetworkModal(recipeVM);
            });
    }

    function gen_projectGen_vm(recipe, recipeVM) {
        var cfg = recipe.project_gen;
        return new PhaseVM('project_gen', cfg,
            function() {
                openProjectModal(recipeVM);
            });
    }

    function gen_snapshotGen_vm(recipe, recipeVM) {
        var cfg = recipe.snapshot_gen;
        return new PhaseVM('snapshot_gen', cfg,
            function() {
                console.log('recipeVM: ', recipeVM);
                openSnapshotModal(recipeVM);
            });
    }

    function gen_layoutGen_vm(recipe, recipeVM) {
        var cfg = recipe.layout_gen;
        return new PhaseVM('layout_gen', cfg,
            function() {
                openLayoutModal(recipeVM);
            });
    }

    //
    // Phase specific stuff. primarily, which modal to open
    //
    function openFileUploadModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/file_upload.html",
            controller: 'artifactUploadCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });
        mi.result.then(function(uploaded_data) {
            console.log("UPload Result: ", uploaded_data);
            vm.runConfig.uploadId = uploaded_data.uploadId;
            var uploads = vm.phases.data_source.uploads;
            uploads.push(uploaded_data);
        });
    }

    function openDatasetModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_dataset_gen.html",
            controller: 'recipeDatasetModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm)
            vm.onUpdate(true);
        });
    }


    function openDatasetPostModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_dataset_post_proc.html",
            controller: 'recipeDatasetPostModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });
    }

    function openNetworkModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_network_gen.html",
            controller: 'recipeNetworkModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm)
            vm.onUpdate(true);
        });
    }

    function openProjectModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_project_gen.html",
            controller: 'recipeProjectModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm)
            vm.onUpdate(true);
        });
    }

    function openSnapshotModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_snap_gen.html",
            controller: 'recipeSnapshotModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });

        mi.result.then(function(vmNew) {
            //save the vm
            console.log('updated recipeVM: ', vmNew)
            vm.onUpdate(true);
        });
    }

    function openLayoutModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_layout_gen.html",
            controller: 'recipeLayoutModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });
    }

    //
    // Recipe Execution specific stuff
    //
    function executeRecipe(vm) {
        vm.exec_started = true;
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
        };
    }
    }
]);
