angular.module('dataIngestion')
.controller('LocalSheetsCtrl', ['$scope', '$interval', '$q', 'uiService', 'localSheetsService', 'dataService', 'networkService', 'mergeService',
function($scope, $interval, $q, uiService, localSheetsService, dataService, networkService, mergeService){
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
    $scope.uploadInfo = {
        importUrl: ''
    };

    $scope.mapProcessor.mainBtnText = $scope.diModalData.editMode ? 'Merge Maps' : 'Create Map';
    $scope.mapProcessor.stopProcess = $scope.mapProcessor.emptyRejectFunc;

    /**
    * Scope methods
    */
    $scope.importFromUrl = importFromUrl;
    $scope.uploadLocalFiles = uploadLocalFiles;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    //Inherited from DataIngestionDialogCtrl
    //Divide progress into parts and assign weightage
    $scope.progressHandler.addProcesses([
        {processType: 'upload', message: 'Uploading Data..'},
        {processType: 'crunchingNodes', message: 'Extracting Attributes..'},
        {processType: 'savingData', message: $scope.diModalData.editMode ? 'Merging Nodes..' : 'Creating Nodes..'}
    ]);

    /*************************************
    ********* Core Functions *************
    **************************************/

    function importFromUrl() {
        if($scope.uploadInfo.importUrl) {
            var fileName = _.last($scope.uploadInfo.importUrl.split('/'));
            $scope.progressHandler.addProcesses([
                {processType: 'upload', message: 'Importing File'},
                {processType: 'savingData', message: $scope.diModalData.editMode ? 'Merging Maps' : 'Creating Map'}
            ]);
            $scope.mapProcessor.clearPersistingMessages();
            $scope.progressHandler.showDummyProgress('upload');
            $scope.spreadSheetData.file = {
                name: fileName
            };

            localSheetsService.importFromUrl({
                fileType : 'someUrl',
                urlParams : [$scope.currOrg._id, $scope.currProject._id],
                uData : {
                    fetchFromUrl: true,
                    title: fileName,
                    exportUrl: $scope.uploadInfo.importUrl
                }
            }).then(function(data) {
                generateData(data);
                $scope.progressHandler.finishProcess('upload');
            }, function(error) {
                console.log(error);
                $scope.mapProcessor.showError('Error in file parsing', error);
            });
        }
    }

    function uploadLocalFiles(files) {
        if(!files) {return;}
        var intervalStarted = false; //Flag to prevent starting multiple instances of dummy progress handler
        if(!Array.isArray(files)) {
            files = [files];
        }
        $scope.spreadSheetData.file = files[0];

        if($scope.diModalData.editMode) {
            var dataset = dataService.currDataSetUnsafe();
            var currNetwork = networkService.getCurrentNetwork();
            $scope.spreadSheetData.mergeMachine = new mergeService.mergeMachine(dataset, currNetwork);
        }

        $scope.mapProcessor.clearPersistingMessages();
        $scope.progressHandler.updateProgress('upload', 0);

        localSheetsService.upload({
            fileType : 'localExcel',
            urlParams : [$scope.currOrg._id, $scope.currProject._id],
            uData : {},
            file : $scope.spreadSheetData['file']
        }).then(function(data) {
            generateData(data);
            $scope.progressHandler.finishProcess('crunchingNodes'); //Server returned data, thus server processing is also complete.
        }, function(error) {
            console.log(error);
            $scope.diModalData.reset();
            $scope.progressHandler.finishAllProcesses();
            $scope.progressHandler.resetAllProcesses();
            $scope.mapProcessor.showError('Error in file parsing', '', true);
            intervalStarted = false;
        }, function(progress) {
            //Progress for file upload
            $scope.progressHandler.updateProgress('upload', 100 * (progress.loaded / progress.total));

            //File upload is complete. Start dummy progress for parsing the data on server
            if(progress.loaded === progress.total && !intervalStarted) {
                intervalStarted = true;
                $scope.progressHandler.showDummyProgress('crunchingNodes');
            }
        });
    }


    function generateData(uploadData) {
        if(uploadData === null) {
            console.warn('Ignoring empty data');
            return;
        }
        console.log('Excel File Details ---> ', uploadData);
        if($scope.diModalData.editMode) {
            $scope.spreadSheetData.mergeData = uploadData;
        }
        else {
            $scope.spreadSheetData.createData.localColumns = uploadData.columns;
            $scope.spreadSheetData.createData.nodesInfo = uploadData.nodesInfo;
            $scope.spreadSheetData.createData.networks = uploadData.networks;
            $scope.spreadSheetData.createData.removedReservedAttrs = uploadData.removedReservedAttrs;
            $scope.diModalData.dataAvailable = true;
        }
        $scope.spreadSheetData.available = true;
        $scope.spreadSheetData.fileId = uploadData.fileId;
        $scope.spreadSheetData.nodesCount = uploadData.nodesCount;
        $scope.spreadSheetData.edgesCount = uploadData.edgesCount;
        $scope.mapProcessor.dataSourceSelected = true;
        $scope.mapProcessor.enableMainBtn();
    }

}
]);