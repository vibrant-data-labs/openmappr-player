angular.module('dataIngestion')
.controller('ImportIOCtrl', ['$scope', 'importioService',
function($scope, importioService) {
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
    $scope.importioUrl = "";
    $scope.mapProcessor.mainBtnText = 'Import Data';

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    //Watch url length to set main button states
    $scope.$watch('importioUrl.length', function(len) {
        if(len > 0) {
            $scope.mapProcessor.enableMainBtn();
        } else {
            $scope.mapProcessor.disableMainBtn();
        }
    });

    /*************************************
    ********* Initialise *****************
    **************************************/
    //Inherited from DataIngestionDialogCtrl
    //Divide progress into parts and assign weightage
    $scope.progressHandler.addProcesses([
        {processType: 'dataImport', message: 'Importing Data'},
        {processType: 'savingData', message: 'Creating Map'}
    ]);

    $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;

    //Overwriting DataIngestionModalCtrl 'childProcess' method of 'mapProcessor'
    $scope.mapProcessor.childProcess = function() {
        $scope.progressHandler.showDummyProgress('dataImport');

        return importioService.importData($scope.importioUrl);
    };

    /*************************************
    ********* Core Functions *************
    **************************************/

}
]);