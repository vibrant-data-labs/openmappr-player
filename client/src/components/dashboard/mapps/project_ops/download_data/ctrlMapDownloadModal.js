angular.module('mappr')
.controller('MapDownloadModalCtrl', ['$scope', '$uibModalInstance', 'projFactory', 'orgFactory', 'networkService', 'projectRef', 'uiService',
function($scope, $uibModalInstance, projFactory, orgFactory, networkService, projectRef, uiService) {

    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    // var logPrefix = '[ctrlMapDownloadModal: ] ';
    var currOrg;


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope variables
    */
    $scope.mappDataAvailable = false;
    $scope.statusMsg = 'Getting Mapp Data...';


    /**
    * Scope methods
    */
    $scope.downloadMapp = downloadMapp;

    $scope.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
    };

    /*************************************
    ********* Event Listeners ************
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    orgFactory.currOrg()
    .then(function(orgDoc) {
        currOrg = orgDoc;
        return projFactory.getProjectDoc(orgDoc._id, projectRef, 0);
    }).then(function(projDoc) {
        $scope.currProject = projDoc;
        return networkService.getNetworksByProject(currOrg._id, projectRef);
    }).then(function(networks) {
        $scope.customSelection = {
            networks: (function() {
                var tempNetworks = [];
                _.each(networks, function(netw) {
                    tempNetworks.push({
                        id: netw.id,
                        name: netw.name,
                        download: true
                    });
                });
                return tempNetworks;
            }()),
            downloadFormat: 'xlsx'
        };
        $scope.statusMsg = 'Select datasheets';
        $scope.mappDataAvailable = true;
    });


    /*************************************
    ********* Core Functions *************
    **************************************/

    function downloadMapp() {
        var postObj = {
            networkIds: _.pluck(_.filter($scope.customSelection.networks, 'download'), 'id'),
            downloadFormat: $scope.customSelection.downloadFormat || 'xlsx'
        };

        var progressCbk = function(prog) {
            console.log('Download progress: ' + prog + ' %');
            uiService.showProgress('mappDownload', 'Downloading... ' + prog + '%', 'success', prog);
        };

        projFactory.downloadNetworksData($scope.currProject.org.ref, $scope.currProject._id, postObj, progressCbk)
        .then(function(result) {
            if($scope.customSelection.downloadFormat === 'json') {
                window.saveAs(new Blob([JSON.stringify(result, null, "\t")],{type:"application/json"}), $scope.currProject.projName + ".json");
            }
            else {
                window.saveAs(new Blob([s2ab(result)],{type:"application/octet-stream"}), $scope.currProject.projName + ".xlsx");
            }
            $scope.closeModal();
        })
        .catch(function(err) {
            console.error(err);
            uiService.logError('Some error occured while downloading, try again later!');
        });

        function s2ab(s) {
            var buf = new window.ArrayBuffer(s.length);
            var view = new window.Uint8Array(buf);
            for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
            return buf;
        }
    }

}
]);