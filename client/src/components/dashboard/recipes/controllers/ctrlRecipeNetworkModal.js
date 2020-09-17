angular.module('mappr')
.controller('recipeNetworkModalCtrl', ['$scope', '$uibModalInstance','recipeService', 'orgFactory', 'uiService', 'recipeVM',
function($scope, $uibModalInstance, recipeService, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeNetworkModalCtrl: ] ";
    var tempRecipe = _.cloneDeep(recipeVM.recipe);

    //templates for new networks and options

    var networkTemplate = {
        name: '',
        gen_algo: 'athena_netgen',
        algo_config: {
            options: {
                questions: []
            }
        },
        gen_def_layout: true
    };

    var networkQuestionTemplate = {
        "Question": "",
        "qAnalysisType": null
    };


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.recipe = tempRecipe;
    console.log(logPrefix + 'recipe: ', tempRecipe);
    $scope.nodeAttrs = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, 'columns'));
    console.log(logPrefix + 'nodeAttrs: ', $scope.nodeAttrs);

    $scope.nodeAttrOpt = {
        key: 'datasetDescr',
        title: 'Attribute Select',
        type: 'attr-select'
    };

    $scope.analysisTypeOptions = [
        {
            name: 'String or Boolean',
            value: 5
        },
        {
            name: 'List String',
            value: 3
        },
        {
            name: 'Other',
            value: -1
        }
    ];

    /**
    * Scope methods
    */
    $scope.addNetwork = function() {
        var net = _.cloneDeep(networkTemplate);
        tempRecipe.network_gen.networks.push(net);
    };

    $scope.addQuestion = function(ind) {
        var ques = _.cloneDeep(networkQuestionTemplate);
        tempRecipe.network_gen.networks[ind].algo_config.options.questions.push(ques);
    };

    $scope.removeNetwork = function(ind) {
        tempRecipe.network_gen.networks.splice(ind, 1);
    };

    $scope.removeQuestion = function(nInd, qInd) {
        tempRecipe.network_gen.networks[nInd].algo_config.options.questions.splice(qInd, 1);
    };

    $scope.saveSettings = function() {
        //save tempRecipeVM and close modal
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
