angular.module('mappr')
.controller('SnapCreateModalCtrl', ['$scope', '$uibModalInstance', 'userFactory', 'snapshotService',
function($scope, $uibModalInstance, userFactory, snapshotService) {

    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlSnapCreateModal: ] ';
    var suggestedSnap = snapshotService.suggestSnapObj();

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.newSnapshot = {
        snapName: '',
        descr: '',
        picture: '',
        embed: '',
        //network, image, embed, text
        type: ''
    };

    $scope.snapCreationErr = '';
    $scope.newSnapshot.snapName = suggestedSnap.snapName;
    $scope.newSnapshot.descr = suggestedSnap.descr;

    /**
    * Scope methods
    */
    $scope.saveSnapshot = saveSnapshot;

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

    function saveSnapshot() {
        if(!$scope.newSnapshot.snapName) {
            console.log(logPrefix + ' snapshot name not entered, skipping snapshot creation');
            $scope.snapCreationErr = 'Please enter snapshot name!';
            return;
        }
        //determine snapshot type
        if($scope.newSnapshot.picture) {
            $scope.newSnapshot.type = 'image';
        } else if($scope.newSnapshot.embed) {
            $scope.newSnapshot.type = 'embed';
        } else if($scope.newSnapshot.text) {
            $scope.newSnapshot.type = 'text';
        } else {
            $scope.newSnapshot.type = 'network';
        }
        $uibModalInstance.close($scope.newSnapshot);
    }

}
]);