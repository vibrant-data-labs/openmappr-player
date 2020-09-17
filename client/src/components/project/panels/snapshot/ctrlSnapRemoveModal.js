angular.module('mappr')
.controller('SnapRemoveModalCtrl', ['$scope', '$uibModalInstance', 'currSnap',
function($scope, $uibModalInstance, currSnap){
    'use strict';

    $scope.currSnapshot = _.clone(currSnap);

    $scope.deleteSnapshot = function() {
        $uibModalInstance.close({shouldDelete: true, id: currSnap.id});
    };

    $scope.cancelDelete = function() {
        $uibModalInstance.close({shouldDelete: false, id: currSnap.id});
    };

    $scope.closeModal = function() {
        $uibModalInstance.dismiss('cancel');
    };
}
]);