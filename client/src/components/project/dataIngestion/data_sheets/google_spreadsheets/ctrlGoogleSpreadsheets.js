angular.module('dataIngestion')
.controller('GoogleSpreadsheetCtrl', ['$scope', '$interval', '$timeout', 'googleSheetsService', 'dataService', 'networkService', 'mergeService',
function($scope, $interval, $timeout, googleSheetsService, dataService, networkService, mergeService) {
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
    $scope.showAuthorizeBtn = false;
    $scope.showRefreshBtn = false;
    $scope.mapProcessor.mainBtnText = $scope.diModalData.editMode ? 'Merge Maps' : 'Create Map';

    /**
    * Scope methods
    */
    $scope.mapProcessor.stopProcess = function() { return $timeout(); };
    $scope.refreshFiles = refreshFiles;
    $scope.uploadSpreadsheet = uploadSpreadsheet;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/


    /*************************************
    ********* Initialise *****************
    **************************************/
    //Inherited from DataIngestionDialogCtrl
    //Divide progress into parts and assign weightage
    $scope.progressHandler.addProcesses([
        {processType: 'remoteDownloadAndCrunching', message: 'Importing Data'},
        {processType: 'savingData', message: $scope.diModalData.editMode ? 'Merging Maps' : 'Creating Map'}
    ]);

    googleSheetsService.fetchFiles().then(
        displayFiles,

        function() {
            $scope.showAuthorizeBtn = true;

            $scope.handleAuthorize = function() {
                googleSheetsService.checkAuth(false).then(displayFiles);
            };
        }
    );

    /*************************************
    ********* Core Functions *************
    **************************************/

    function refreshFiles() {
        $scope.spreadsheets = [];
        googleSheetsService.checkAuth(false).then(displayFiles);
    }

    function uploadSpreadsheet(spreadsheet) {
        var accessToken = window.gapi.auth.getToken().access_token;
        spreadsheet['name'] = spreadsheet.title;

        $scope.progressHandler.showDummyProgress('remoteDownloadAndCrunching');

        if($scope.diModalData.editMode) {
            var dataset = dataService.currDataSetUnsafe();
            var currNetwork = networkService.getCurrentNetwork();
            $scope.spreadSheetData.mergeMachine = new mergeService.mergeMachine(dataset, currNetwork);
        }

        googleSheetsService.upload({
            fileType : 'googleSheet',
            urlParams : [$scope.currOrg._id, $scope.currProject._id],
            uData : {
                fetchGoogleSpreadsheet: true,
                accessToken: accessToken,
                title: spreadsheet.title,
                exportUrl: spreadsheet.downloadUrl
            }
        })
        .then(
            function(uploadData) {
                console.log('Google Spreadsheet details ---> ', uploadData);
                if($scope.diModalData.editMode) {
                    $scope.spreadSheetData.mergeData = uploadData;
                }
                else {
                    $scope.spreadSheetData.createData.localColumns = uploadData.columns;
                    $scope.spreadSheetData.createData.nodesInfo = uploadData.nodesInfo;
                    $scope.spreadSheetData.createData.networks = uploadData.networks;
                    $scope.spreadSheetData.createData.removedReservedAttrs = uploadData.removedReservedAttrs;
                    $scope.spreadSheetData.file = spreadsheet;
                    $scope.diModalData.dataAvailable = true;
                }
                $scope.spreadSheetData.available = true;
                $scope.progressHandler.finishProcess('remoteDownloadAndCrunching'); //Server returned data, thus server processing is also complete.
                $scope.spreadSheetData.fileId = uploadData.fileId;
                $scope.spreadSheetData.nodesCount = uploadData.nodesCount;
                $scope.spreadSheetData.edgesCount = uploadData.edgesCount;
                $scope.mapProcessor.dataSourceSelected = true;
                $scope.mapProcessor.enableMainBtn();
            },
            function(error) {
                $scope.mapProcessor.showError('Error in file parsing', error);
            }
        );

    }

    function displayFiles(files) {
        $scope.spreadsheets = files;
        $scope.showAuthorizeBtn = false;
        $scope.showRefreshBtn = true;
    }

}
]);