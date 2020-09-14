angular.module('mappr')
.controller('RecipeLeftPanelCtrl', ['$scope',
function($scope){
    'use strict';
    // Child of RecipePanelCtrl

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.recipeRuns = [];
    $scope.newRunProgress = {
        currPhase: '',
        totalTasks: [],
        finishedTasks: []
    };

    /**
    * Scope methods
    */
    $scope.startNewRun = function() {
        $scope.newRunProgress = {
            currPhase: '',
            totalTasks: [],
            finishedTasks: []
        };
        return $scope.vm.executeRecipe();
    };

    $scope.loadRunInfo = function(run) {
        $scope.$emit('recipe:loadRunInfo', {run: run});
    };

    $scope.loadRecipeConfig = function() {
        $scope.$emit('recipe:loadRunInfo', {run: null});
    };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$watchCollection('vm.recipeRuns', function(runs) {
        if(!runs) return;
        init();
    });

    $scope.$on('update_phases', function(event, phaseData) {
        if(!$scope.vm) { return; }
        var vm = $scope.vm;
        if(phaseData.recipeId === vm._id && phaseData.evtType === "running") {
            var phases = _.values(vm.phases);
            $scope.newRunProgress.totalTasks = _.map(phases, 'phase_type');

            var data = phaseData.progData;
            var str_arr = data.phase.split(':');
            var phase = str_arr[0];

            $scope.newRunProgress.currPhase = phase;
            $scope.newRunProgress.finishedTasks = _.map(_.filter(phases, 'run_finished'), 'phase_type');
        }
    });

    /*************************************
    ********* Initialise *****************
    **************************************/
    init();


    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {
        $scope.recipeRuns = $scope.vm.recipeRuns;
    }
}
]);
