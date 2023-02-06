angular.module('player')
.controller('ContextPanelCtrl', ['$scope',
function($scope) {
    'use strict';

    $scope.getSnapDescrNavStyle = function() {
        return {
            width:Math.floor(100/$scope.player.snapshots.length)+'%'
        };
    };

}
]);