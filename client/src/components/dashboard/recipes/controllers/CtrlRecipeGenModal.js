angular.module('mappr')
.controller('recipeGenModalCtrl', ['$scope', '$uibModalInstance', 'recipe', 'recipeService',
function($scope, $uibModalInstance, recipe, recipeService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.modal_state = 'init'; // 'upload_file' / "generating"
    console.log('[recipeGenModalCtrl] recipe:', recipe);
    console.log('[recipeGenModalCtrl] scopeID:', $scope.$id);

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
    init();

    /*************************************
    ********* Core Functions *************
    **************************************/

    function init () {
        $scope.modal_state = 'init';
        if(recipe.data_ingest.srcType === "uploadedData") {
            upload_file();
        } else {
            generating({});
        }
    }

    function upload_file () {
        $scope.modal_state = 'upload_file';
        $scope.upload_file_started = false;
        $scope.upload_file_status = null;
        $scope.$on('artifact_upload:started', function(event, data) {
            console.log("[recipeGenModalCtrl][artifact_upload:started]", event, data);
            $scope.upload_file_started = true;
            $scope.upload_file_status = 'transferring file';

            data.promise
                .then(function(upload_result) {
                    generating({uploadId : upload_result.uploadId });
                }, function(failure) {
                    $scope.upload_file_status = String(failure);
                }, function(notify) {
                    $scope.upload_file_status = String(notify);
                });
        });
    }

    function generating (cfg) {
        $scope.modal_state = 'generating';
        $scope.gen_status = [];
        recipeService.generateProject(recipe.org.ref, recipe._id, cfg)
        .then(function(upload_result) {
            gen_success(upload_result);
        }, function(failure) {
            gen_failure(failure);
        }, function(notify) {
            $scope.gen_status.push(String(notify));
        });
    }
    function gen_success (result) {
        $scope.modal_state = 'gen_success';
        console.log("[recipeGenModalCtrl] Successful generation! Data: ", result);
        $scope.primary_message = 'Successful Generation!';
        $scope.projects = result.projects;
    }
    function gen_failure (result) {
        $scope.modal_state = 'gen_failure';
        console.log("[recipeGenModalCtrl] Failed generation! Error: ", result);
        $scope.primary_message = 'Failed Generation. error:';
        $scope.failure_error = JSON.stringify(result,null,4);
    }

}
]);
