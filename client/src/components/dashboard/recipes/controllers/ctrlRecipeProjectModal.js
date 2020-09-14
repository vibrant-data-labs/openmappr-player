angular.module('mappr')
.controller('recipeProjectModalCtrl', ['$scope', '$uibModalInstance','recipeService', 'orgFactory', 'uiService', 'recipeVM',
function($scope, $uibModalInstance, recipeService, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeProjectModalCtrl: ] ";
    var tempRecipe = _.cloneDeep(recipeVM.recipe);

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.recipe = tempRecipe;
    console.log(logPrefix + 'tempRecipe: ', tempRecipe);

    /**
    * Scope methods
    */
    $scope.saveSettings = function() {

        //save recipeVM and close modal
        recipeVM.recipe = _.cloneDeep(tempRecipe);
        $scope.$close(recipeVM);
    };

    $scope.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
    };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

}]);
