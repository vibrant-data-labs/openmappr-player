angular.module('mappr')
.controller('recipeDatasourceModalCtrl', ['$scope', 'Upload', '$q', '$uibModalInstance','recipeService', 'orgFactory', 'uiService', 'recipeVM',
function($scope, Upload, $q, $uibModalInstance, recipeService, orgFactory, uiService, recipeVM) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var tempRecipe = _.cloneDeep(recipeVM.recipe);


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */
    $scope.recipe = tempRecipe;


    /**
    * Scope methods
    */
    $scope.uploadArtifact = uploadArtifact;

    $scope.saveSettings = function() {

        //save recipeVM and close modal
        recipeVM.recipe = _.cloneDeep(tempRecipe);
        $scope.$close({recipeVM: recipeVM});
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

    //
    // controls the artifact upload modal.
    //
    function uploadArtifact(files) {

        if(!files) return; // watch init

        if(!Array.isArray(files)) {
            files = [files];
        }
        var file = files[0];
        // var defer = $q.defer();

        // $scope.$emit('artifact_upload:started', { promise : defer.promise });
        $scope.upload_file_started = true;
        orgFactory.currOrg().then(function (org) {
            Upload.upload({
                url: '/api/orgs/' + org._id + '/uploads?minimal=true',
                method: 'POST',
                file: file
            })
            .success(function(data) {
                // defer.resolve(data);
                uiService.showProgress('artifactDownload', 'Uploaded! ', 'success', 100);
                $scope.$close({uploaded_data: data});
            })
            .progress(function(evt) {
                console.log("Upload Status: ", evt);
                var prog = (evt.loaded*100/evt.total).toFixed(2);
                uiService.showProgress('artifactDownload', 'Uploading... ' + prog + '%', 'success', prog);
                // $scope.upload_file_status = evt;
                // defer.notify(evt);
            })
            .error(function(error) {
                console.log('[Excel Upload error: ]', error);
                uiService.logError('Could not upload file!');
                // defer.reject(error);
                $scope.$dismiss(error);
            });

        });
    }

}
]);
