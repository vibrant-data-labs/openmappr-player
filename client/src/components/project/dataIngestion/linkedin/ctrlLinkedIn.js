angular.module('dataIngestion')
.controller('LinkedInCtrl', ['$scope', 'linkedinService',
function($scope, linkedinService) {
    'use strict';

    // Two states
    // Authorize
    // Import data

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.currentState = "not_authorized";
    $scope.authorizeUser = _.noop;
    $scope.fields = _.map(linkedinService.getFields(),function(field) {
        return {
            name : field,
            isChecked : true
        };
    });

    $scope.mapProcessor.mainBtnText = 'Import Data';

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$watch('currentState', function(state) {
        if(state === "authorized") {
            $scope.mapProcessor.enableMainBtn();
        }
    });

    /*************************************
    ********* Initialise *****************
    **************************************/
    $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;

    //Inherited from DataIngestionDialogCtrl
    //Divide progress into parts and assign weightage
    $scope.progressHandler.addProcesses([
        {processType: 'dataImport', message: 'Importing Data'},
        {processType: 'savingData', message: 'Creating Map'}
    ]);

    //Overwriting DataIngestionModalCtrl 'childProcess' method of 'mapProcessor'
    $scope.mapProcessor.childProcess = function() {
        $scope.progressHandler.showDummyProgress('dataImport');

        return linkedinService.importData(_.pluck(_.filter($scope.fields, 'isChecked'), 'name'));
    };

    linkedinService.checkAuthValidity()
    .then(function(data) {
        console.log("[checkAuthValidity] Got data: %O", data);
        if(data.data.state === "expired") {
            $scope.authorizeUser = function() {
                var wndObj = window.open(data.data.url, "LinkedIn_Auth");
                if(!wndObj) {
                    console.error("[LinkedInCtrl] Unable to authorize user!");
                } else {
                    // Check if the new window has closed or not
                    var closePoller = window.setInterval(function() {
                        console.log("[WND_OBJ] Got Url: %s", wndObj.document.URL);
                        if(wndObj.document.URL &&
                            wndObj.document.URL.indexOf("/auth/linkedin/callback") !== -1) {
                            console.log("[LinkedInCtrl] Auth worked!");
                            window.clearInterval(closePoller);
                            $scope.$apply(function() {
                                $scope.currentState = "authorized";
                            });
                        } else if(wndObj.closed === true) {
                            window.clearInterval(closePoller);
                            console.log("[LinkedInCtrl] Auth worked via closed param!");
                            $scope.$apply(function() {
                                $scope.currentState = "authorized";
                            });
                        } else {
                            console.log("Waiting for Authentication to work");
                        }
                    }, 1000);
                }
            };
        } else {
            $scope.currentState = "authorized";
        }
    });

    /*************************************
    ********* Core Functions *************
    **************************************/

}
]);