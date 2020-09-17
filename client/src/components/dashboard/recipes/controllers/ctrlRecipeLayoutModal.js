angular.module('mappr')
.controller('recipeLayoutModalCtrl', ['$scope', '$uibModalInstance','recipeService', 'layoutConfig', 'orgFactory', 'uiService', 'recipeVM',
function($scope, $uibModalInstance, recipeService, layoutConfig, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeLayoutModalCtrl]";
    var tempRecipe = _.cloneDeep(recipeVM.recipe);


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.recipe = tempRecipe;
    console.log(logPrefix + 'tempRecipe: ', tempRecipe);
    $scope.nodeAttrs = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, 'columns'));
    //unsure about this
    $scope.edgeAttrs = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, function (up) {
        return up.networks[0].linkAttrDescriptors;
    }));

    /**
    * Scope methods
    */
    $scope.setCurrLayout = setCurrLayout;
    $scope.setLayoutType = setLayoutType;
    $scope.createLayout = createLayout;
    $scope.removeLayout = removeLayout;

    $scope.saveSettings = function saveSettings() {
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
    if(!tempRecipe.layout_gen) {
        tempRecipe.layout_gen = {};
    }
    if(!tempRecipe.layout_gen.layouts) {
        tempRecipe.layout_gen.layouts = [];
    }


    layoutConfig.getLayouts()
        .then(function (layouts) {
            $scope.layouts = layouts;
        });

    /*************************************
    ********* Core Functions *************
    **************************************/

    //
    // controls recipe's layout settings
    //

    function setCurrLayout(ind, layout) {
        $scope.currLayoutInd = ind;
        $scope.currLayout = layout;
    }

    function setLayoutType(layout) {
        $scope.currLayout.plotType = layout.plotType;
        // _.defaultsDeep($scope.currLayout, layout.options.primary);
        // _.defaultsDeep($scope.currLayout, layout.options.primary);
    }

    function createLayout() {
        var recipeLayouts = tempRecipe.layout_gen.layouts;
        recipeLayouts.push({
            name: '',
            plotType: 'original'
        });
        $scope.setCurrLayout(recipeLayouts.length - 1, recipeLayouts[recipeLayouts.length - 1]);
    }

    function removeLayout(ind) {
        if($scope.currLayoutInd == ind) {
            if(tempRecipe.layout_gen.layouts.length > 0) {
                $scope.currLayout = tempRecipe.layout_gen.layouts[0];
                $scope.currLayoutInd = 0;
            } else {
                $scope.currLayout = null;
                $scope.currLayoutInd = null;
            }
        }
        tempRecipe.layout_gen.layouts.splice(ind, 1);
    }

}
]);
