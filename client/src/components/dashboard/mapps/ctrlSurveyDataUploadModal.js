angular.module('mappr')
.controller('surveyDataUploadModalCtrl', [ '$scope', '$uibModalInstance', 'Upload', 'orgFactory', 'surveyTemplateFactory', 'uiService',
function($scope, $uibModalInstance, Upload, orgFactory, surveyTemplateFactory, uiService) {
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
    $scope.progressShow = false;
    $scope.progressMaxVal = 100;
    $scope.progressVal = 0;

    /**
    * Scope methods
    */
    $scope.onFileSelect = onFileSelect;

    $scope.ok = function() {
        //$uibModalInstance.close($scope.selectedOrg);
        $uibModalInstance.close();
    };
    $scope.cancel = function() {
        $uibModalInstance.dismiss("cancel");
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

    function onFileSelect($files) {
        orgFactory.currOrg()
        .then(function(orgDoc){
            $scope.currOrg = orgDoc;
            return surveyTemplateFactory.currSurveyTemplate();
        })
        .then(function(templateDoc){
            $scope.currSurveyTemplate = templateDoc;
            console.log('template', templateDoc);
        })
        .then(function(){
            //$files: an array of files selected, each file has name, size, and type.
            for (var i = 0; i < $files.length; i++) {
                var file = $files[i];
                $scope.upload =
                Upload.upload({
                    url: '/api/orgs/'+$scope.currOrg._id+'/surveytemplates/'+$scope.currSurveyTemplate._id+'/xlsx',
                    method: 'POST',// or 'PUT',
                    // headers: {'header-key': 'header-value'},
                    // withCredentials: true,
                    data: {
                        myObj: $scope.myModelObj
                    },
                    file: file // or list of files: $files for html5 only
                    /* set the file formData name ('Content-Desposition'). Default is 'file' */
                    //fileFormDataName: myFile, //or a list of names for multiple files (html5).
                    /* customize how data is added to formData. See #40#issuecomment-28612000 for sample code */
                    //formDataAppender: function(formData, key, val){}
                }).progress(function(evt) {
                    $scope.progressMaxVal = evt.total;
                    $scope.progressVal = evt.loaded;
                    console.log('percent: ' + parseInt(100.0 * evt.loaded / evt.total));
                }).success(function(data) {
                    // file is uploaded successfully
                    $uibModalInstance.close(data);
                }).error(function(err){
                    $scope.response = err;
                    uiService.log(err);
                });
                //.then(success, error, progress);
                //.xhr(function(xhr){xhr.upload.addEventListener(...)})// access and attach any event listener to XMLHttpRequest.
            }
            /* alternative way of uploading, send the file binary with the file's content-type.
                Could be used to upload files to CouchDB, imgur, etc... html5 FileReader is needed.
                It could also be used to monitor the progress of a normal http post/put request with large data*/
            // $scope.upload = Upload.http({...})  see 88#issuecomment-31366487 for sample code.
        });
    }

}
]);