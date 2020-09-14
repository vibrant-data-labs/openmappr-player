angular.module('mappr')
.controller('RecipeRunInfo_RPCtrl', ['$scope',
function($scope){
    'use strict';
    // Child of RecipeRightPanelCtrl

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
    $scope.apiBaseUrl = document.location.origin + '/data_api/networks/';

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on('recipe:runInfoChanged', init);

    /*************************************
    ********* Initialise *****************
    **************************************/
    init();


    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {
        if(!$scope.vm.recipeRuns) throw new Error('Recipe runs not loaded yet, controller should not get initialised');
        $scope.recipeRuns = $scope.vm.recipeRuns;
        $scope.projectsForRun = _.get($scope, 'selectedRun.projects');
        $scope.networksForRun = _.get($scope, 'selectedRun.networks');
    }

}
]);
