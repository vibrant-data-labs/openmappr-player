angular.module("mappr")
.controller("ElasticSearchCtrl", ["$scope", "$rootScope", "$timeout", "$q", "$http", "SelectionSetService", "AttrModifierService", "AttrInfoService", "AttrGeneratorService", "dataGraph", "dataService", "networkService", "projFactory", "BROADCAST_MESSAGES", "uiService",
function($scope, $rootScope, $timeout, $q, $http, SelectionSetService, AttrModifierService, AttrInfoService, AttrGeneratorService, dataGraph, dataService, networkService, projFactory, BROADCAST_MESSAGES, uiService) {
    "use strict";

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = "[ElasticSearchCtrl: ] ";

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.ui = {
        queryText : "",
        queryRunning: false
    };

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    $scope.mapProcessor.childProcess = runQueryOnServer;

    // disable modal's main button
    $scope.mapProcessor.disableMainBtn();
    init();

    /*************************************
    ********* Core Functions *************
    **************************************/

    function init() {}

    //generate and reload dataset
    function runQueryOnServer() {
        console.log(logPrefix, "Running Query On server " + $scope.ui.queryText);
        if($scope.ui.queryRunning) {
            console.warn('Only 1 request can be made at a time');
            return $q.reject('OngoingRequest');
        }
        $scope.ui.queryRunning = true;

        return $http.post(projFactory.currProjUrl() + "/di/import_es", {
            queryText : $scope.ui.queryText,
            options : {}
        },
        function postRun(respData) {
            console.log(logPrefix, "Query Successful. Got data: ", respData.data);
            $scope.ui.queryRunning = false;
            $scope.progressHandler.finishProcess('import_es');
            return respData.data;
        },
        function errorRun(err) {
            $scope.ui.queryRunning = false;
            uiService.logError(err.toLocaleString());
            $scope.mapProcessor.showError('Error in file parsing', err);
        },
        function progressFn(progress) {
            console.log(logPrefix, progress);
            // $scope.progressHandler.updateProgress('import_es', Math.floor(parseInt(progress, 10)));
        });
    }
}
]);
