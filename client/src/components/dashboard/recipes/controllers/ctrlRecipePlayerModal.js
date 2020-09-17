angular.module('mappr')
.controller('recipePlayerModalCtrl', ['$scope', '$uibModalInstance','recipeService', 'orgFactory', 'uiService', 'recipeVM',
function($scope, $uibModalInstance, recipeService, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipePlayerModalCtrl: ] ";
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
    $scope.saveSettings = saveSettings;

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

    function saveSettings() {
        var player_gen = tempRecipe.player_gen;
        if(!player_gen.isDisabled
          && player_gen.isPrivate
          && !player_gen.directAccess
          && !player_gen.access_token) {
            return uiService.logError('Please set access token for player');
        }

        //save recipeVM and close modal
        recipeVM.recipe = _.cloneDeep(tempRecipe);
        $scope.$close(recipeVM);
    }

}]);
