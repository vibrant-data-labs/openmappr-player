angular.module('mappr')
.controller('RecipeConfig_RPCtrl', ['$scope', 'recipeService', '$uibModal',
function($scope, recipeService, $uibModal){
    'use strict';

    // Child of RecipeRightPanelCtrl

    /*************************************
    ********* CLASSES ********************
    **************************************/
    ///
    /// Phase VM
    /// each phase is a set of tasks to be completed, like store Urls, gen many networks
    ///
    function PhaseVM(phase_type, cfg, onClick) {
        this.phase_type = phase_type;
        this.onClick = onClick || _.noop;
        this.cfg = cfg || {};

        // Whenever recipe is updated, phaseVM is rebuilt. so any additional data is thrown away.
        // except anything in .locals, which is kept.
        this.locals = {};
        this.uploads = []; // used only by data source file upload, also kept across rebuilds

        // these are updated by the service itself. watched in the associated scope directives
        this.run_begin = false;
        this.run_finished = false;
        this.run_failed = false;
        this.failureData = null;

        this.tasks = []; // tasks which have to be completed
        this.taskCompletions = {}; // a map of taskId -> percentage completion
        this.finalCompletion = 0;
    }


    /*************************************
    ************ Local Data **************
    **************************************/
    // A map of phase name -> phase functions required to initialise recipe VM
    var recipeVMPhaseFnMap = {
        data_source: gen_dataSource_vm,
        etl_gen    : gen_etl_vm,
        dataset_gen: gen_datasetGen_vm,
        dataset_post_proc: gen_datasetPostProc_vm,
        network_gen: gen_networkGen_vm,
        project_gen: gen_projectGen_vm,
        snapshot_gen: gen_snapshotGen_vm,
        layout_gen: gen_layoutGen_vm,
        player_gen: gen_playerGen_vm
    };


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$watch('vm', function(vm) {
        if(!vm) return;
        init();
    });


    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {
        $scope.vm.loadPhases(recipeVMPhaseFnMap);
    }

    function gen_dataSource_vm(recipe, recipeVM) {
        var cfg = recipe.data_ingest;
        return new PhaseVM('data_ingest', cfg,
            function() {
                openDatasourceModal(recipeVM);
            });
    }

    function gen_etl_vm(recipe, recipeVM) {
        var cfg = recipe.etl_gen;
        return new PhaseVM('etl_gen', cfg,
            function() {
                openETLModal(recipeVM);
            });
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

    function gen_playerGen_vm(recipe, recipeVM) {
        var cfg = recipe.player_gen;
        return new PhaseVM('player_gen', cfg,
            function() {
                openPlayerModal(recipeVM);
            });
    }

    //
    // Phase specific stuff. primarily, which modal to open
    //
    function openDatasourceModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_datasource.html",
            controller: 'recipeDatasourceModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });
        mi.result.then(function(data) {
            if(data.uploaded_data) {
                console.log("UPload Result: ", data.uploaded_data);
                vm.runConfig.uploadId = data.uploaded_data.uploadId;
                var uploads = vm.phases.data_source.uploads;
                uploads.push(data.uploaded_data);
            } else {
                data.recipeVM.onUpdate(true);
                init();
            }
        });
    }

    function openETLModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_etl_gen.html",
            controller: 'recipeETLModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
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
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
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
        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
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
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
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
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
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

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
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

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
        });
    }

    function openPlayerModal(vm) {
        var mi = $uibModal.open({
            templateUrl: "#{server_prefix}#{view_path}/components/dashboard/recipes/phase_modals/modal_player_gen.html",
            controller: 'recipePlayerModalCtrl',
            size: 'lg',
            resolve: {
                recipeVM: _.constant(vm)
            }
        });

        mi.result.then(function(vm) {
            //save the vm
            console.log('updated recipeVM: ', vm);
            vm.onUpdate(true);
            init();
        });
    }


}
]);
