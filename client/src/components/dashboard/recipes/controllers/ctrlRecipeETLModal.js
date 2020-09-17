angular.module('mappr')
.controller('recipeETLModalCtrl', ['$scope','$http', '$uibModalInstance','recipeService', 'orgFactory', 'uiService', 'recipeVM',
function($scope, $http, $uibModalInstance, recipeService, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ********* CLASSES ********************
    **************************************/
    function FilterVM(colId, predicate) {
        this.colId = colId;
        this.predicate = predicate;
    }

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeETLModal]";
    // var tempRecipe = _.cloneDeep(recipeVM.recipe);
    var config = _.cloneDeep(recipeVM.recipe.etl_gen);
    var scriptNameOpts = ["Transaction Processor", "Transaction Processor parquet"];
    var entityOpts = ['merchant', 'brand'];

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.config = config;
    $scope.scriptNameOpts = scriptNameOpts;
    $scope.entityOpts = entityOpts;
    // cols in data. should be loaded from datasource
    $scope.dataCols = ['merchant',
        'userID',
        'orderDate',
        'orderID',
        'itemID',
        'quantity',
        'spend',
        'projWt',
        'brand',
        'category',
        'state',
        'zipCode',
        'gender',
        'birthYrMo',
        'ethnicity',
        'education',
        'hhIncome',
        'NumAdults',
        'NumPPL',
        'Marital'
    ];

    $scope.valueFilters = [];

    /**
    * Scope methods
    */
    $scope.loadScript = loadScript;
    $scope.setEntity = setEntity;
    $scope.save = save;

    $scope.addFilter = function() {
        $scope.valueFilters.push(new FilterVM('',''));
    };

    $scope.removeFilter = function(idx) {
        $scope.valueFilters.splice(idx, 1);
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
    loadValueFilters($scope.valueFilters, _.get(config, 'filterSpec.filterByColValues', {}));


    /*************************************
    ********* Core Functions *************
    **************************************/

    // pulls info for given script
    function loadScript(scriptName) {
        console.log(logPrefix, "Loading info for script: ", scriptName);
        // $http.get('/api/recipe_engine/scripts/' + scriptName);
    }

    function setEntity(entityName) {
        console.log(logPrefix, "Setting entity to:", entityName);
    }

    function loadValueFilters(valueFilters, filterByColValues) {
        _.forOwn(filterByColValues, function(predicate, col) {
            valueFilters.push(new FilterVM(col, predicate));
        });
    }

    function save() {
        if(_.get(config, 'filterSpec.rowFilter', null) && _.trim(config.filterSpec.rowFilter).length === 0) {
            _.set(config, 'filterSpec.rowFilter', null);
        }
        _.set(config, 'filterSpec.filterByColValues', {});
        _.each($scope.valueFilters, function(filtervm) {
            if(filtervm.predicate && _.trim(filtervm.predicate).length > 0) {
                _.set(config, 'filterSpec.filterByColValues.' + filtervm.colId, filtervm.predicate);
            }
        });
        //save recipeVM and close modal
        recipeVM.recipe.etl_gen = _.cloneDeep(config);
        $scope.$close(recipeVM);

    }

}
]);
