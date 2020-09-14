angular.module('mappr')
.controller('recipeListCtrl', ['$scope', '$route', '$routeParams','$location', '$uibModal', 'orgFactory', 'recipeService',
function($scope, $route, $routeParams, $location, $uibModal, orgFactory, recipeService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[recipeListCtrl]';


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.recipes = [];

    /**
    * Scope methods
    */
    $scope.cloneRecipe = cloneRecipe;
    $scope.deleteRecipe = deleteRecipe;
    $scope.toggleIsHidden = toggleIsHidden;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    orgFactory
        .currOrg()
        .then(function (org) {  return recipeService.getForOrg(org._id); })
        .then(function(list) {
            console.log(logPrefix, "Got recipes: ", list);

            list.push.apply($scope.recipes, _.reject(list, 'isHidden'));
            return list;
        });

    /*************************************
    ********* Core Functions *************
    **************************************/

    function cloneRecipe (recipe) {
        if(recipe) {
            recipeService.clone(recipe.org.ref, recipe._id)
            .then(function(recipe) {
                $scope.recipes.push(recipe);
            });
        }
    }

    function toggleIsHidden (recipe) {
        if(recipe) {
            recipeService.toggleIsHidden(recipe);
            $scope.recipes = _.reject($scope.recipes, 'isHidden');
        }
    }
    function deleteRecipe (recipe) {
        if(recipe) {
            recipeService.delete(recipe.org.ref, recipe._id);
            $scope.recipes = _.reject($scope.recipes, '_id', recipe._id);
        }
    }

}
]);
