angular.module('mappr')
.controller('recipeDatasetPostModalCtrl', ['$scope', '$uibModalInstance', '$q', '$timeout', 'recipeService', 'orgFactory', 'uiService', 'recipeVM',
function($scope, $uibModalInstance, $q, $timeout, recipeService, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[recipeDatasetPostModalCtrl: ] ";
    var tempRecipe = _.cloneDeep(recipeVM.recipe);

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */
    $scope.recipe = tempRecipe;
    console.log(logPrefix + 'tempRecipe: ', tempRecipe);
    $scope.nodeAttrList = _.intersection.apply(_, _.map(recipeVM.phases.data_source.uploads, 'columns'));
    console.log(logPrefix + 'nodeAttrs: ', $scope.nodeAttrList);

    $scope.mapProcessor = {
        mainBtnText: 'next',
        disableBtn: true,
        status: {
            failure: false,
            dataSourceSelected: false,
            errorType: '',
            errorMsg: ''
        },
        persistingMessages: [],

        //Empty promiseable function. If overwritten by child controllers, must return a promise
        childProcess: function() {
            var defer = $q.defer();

            $timeout(function() { defer.resolve(); }, 0);
            return defer.promise;
        },

        emptyRejectFunc: function() { return $q.reject(); },

        stopProcess: function() { return $q.reject(); },

        enableMainBtn: function() {
            this.disableBtn = false;
        },

        disableMainBtn: function() {
            this.disableBtn = true;
        },

        showError: function(errorType ,errorMsg, persist) {
            // this.status.failure = true;
            // this.status.errorType = errorType;
            // this.status.errorMsg = errorMsg;
            this.persistingMessages.push(uiService.log(errorType, persist));
        },

        clearPersistingMessages: function() {
            _.each(this.persistingMessages, function(msgHandler) {
                if(_.isFunction(msgHandler.close)) {
                    msgHandler.close();
                }
                else {
                    console.warn('Ui message has no method close');
                }
            });
        },

        clearError: function() {
            this.status.failure = false;
            this.status.errorType = '';
            this.status.errorMsg = '';
        }
    };

    /**
    * Scope methods
    */
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
}
]);
