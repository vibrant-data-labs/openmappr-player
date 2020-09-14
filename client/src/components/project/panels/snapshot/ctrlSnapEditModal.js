angular.module('mappr')
.controller('SnapEditModalCtrl', ['$scope', '$uibModalInstance', 'userFactory', 'currSnap',
function($scope, $uibModalInstance, userFactory, currSnap) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    // var logPrefix = '[ctrlSnapEditModal: ] ';

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.currSnapshot = _.clone(currSnap);
    $scope.currSnapshot.type = $scope.currSnapshot.type || 'network';

    /**
    * Scope methods
    */
    $scope.saveSnapshot = function() {

        //NEEDS REVISION - TYPE INFERENCISNG
        //save type if changed
        // if($scope.currSnapshot.picture) {
        //  $scope.currSnapshot.type = 'image';
        // } else if($scope.currSnapshot.embed) {
        //  $scope.currSnapshot.type = 'embed';
        // } else if($scope.currSnapshot.text) {
        //  $scope.currSnapshot.type = 'text';
        // } else {
        //  $scope.currSnapshot.type = 'network';
        // }

        //$scope.currSnapshot.type = 'network';

        $uibModalInstance.close({
            snap: $scope.currSnapshot
        });
    };

    $scope.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.overrideSelectionOpts = [
        {
            value: false,
            label: 'No, this snapshot should not affect network selections.'
        },
        {
            value: true,
            label: 'Yes, and apply them when loading this snapshot.'
        }
    ];

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/


}
]);