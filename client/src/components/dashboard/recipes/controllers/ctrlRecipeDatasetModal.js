angular.module('mappr')
.controller('recipeDatasetModalCtrl', ['$scope', '$uibModalInstance','recipeService', 'orgFactory', 'uiService', 'recipeVM', 'dataGraph',
function($scope, $uibModalInstance, recipeService, orgFactory, uiService, recipeVM, dataGraph) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeDatasetModal: ] ";
    var tempRecipe = _.cloneDeep(recipeVM.recipe);

    var optTemplate = {
        key: 'datasetDescr',
        title: 'Data Source',
        type: 'attr-select',
        id: null,
        attrType: null
    };

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */
    $scope.recipe = tempRecipe;
    console.log(logPrefix + 'tempRecipe: ', tempRecipe);
    $scope.nodeAttrs = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, 'columns'));
    console.log(logPrefix + 'nodeAttrs: ', $scope.nodeAttrs);
    $scope.attrTypes = dataGraph.getNodeAttrTypes();
    console.log(logPrefix + 'attrTypes: ', $scope.attrTypes);
    $scope.datasetOpts = [];

    /**
    * Scope methods
    */
    $scope.addAttrDesc = addAttrDesc;
    $scope.removeAttrDesc = removeAttrDesc;
    $scope.saveAttrDesc = saveAttrDesc;

    $scope.checkIfAttrExists = function(attr) {
        return _.find($scope.nodeAttrs, {id: attr.id}) || !attr.id || recipeVM.phases.data_source.uploads.length === 0;
    };

    $scope.getNodeAttrs = function() { return $scope.nodeAttrs; };

    $scope.closeModal = function() { $uibModalInstance.dismiss('cancel'); };

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    //for each attribute in dataset_gen, create an option
    _.each(tempRecipe.dataset_gen.attr_desc, function(attr, ind) {
        var opt = _.clone(optTemplate);
        opt.key = opt.key + String(ind);
        opt.id = attr.id;
        opt.attrType = attr.attrType;
        $scope.datasetOpts.push(opt);
    });

    /*************************************
    ********* Core Functions *************
    **************************************/
    function addAttrDesc() {
        var opt = _.clone(optTemplate);
        opt.key = opt.key + String($scope.datasetOpts.length);
        $scope.datasetOpts.push(opt);
    }

    function removeAttrDesc(ind) {
        $scope.datasetOpts.splice(ind, 1);
    }

    function saveAttrDesc() {
        //add attributes to recipeVM
        //clear any previous
        tempRecipe.dataset_gen.attr_desc = [];
        console.log('datasetOpts: ', $scope.datasetOpts);
        _.each($scope.datasetOpts, function(opt) {
            var attr = _.find($scope.nodeAttrs, {id:opt.id});
            var attrDesc;
            if(attr) {
                attrDesc = {
                    attrType: attr.attrType,
                    id: attr.id
                };
            } else {
                attrDesc = {
                    id: opt.id,
                    attrType: opt.attrType
                };
            }
            tempRecipe.dataset_gen.attr_desc.push(attrDesc);
        });

        //save recipeVM and close modal
        recipeVM.recipe = _.cloneDeep(tempRecipe);
        $scope.$close(recipeVM);


    }

}
]);
