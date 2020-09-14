angular.module('player')
.controller('SnapshotSidePanelCtrl',['$q', '$timeout', '$scope', '$rootScope', 'snapshotService', 'BROADCAST_MESSAGES',
function ($q, $timeout, $scope, $rootScope, snapshotService, BROADCAST_MESSAGES) {
    'use strict';

    // Snaps object with methods
    $scope.snapshots = null;
    $scope.currentSnap = null;
    $scope.currentSnapIndex = 0;
    $scope.currentSnapPreview = null;
    $scope.isLongDescr = false;
    $scope.isMoreEnabled = false;

    $scope.setSnapActive = function(snap, index) {
        _.each($scope.player.snapshots, function(el) {
            el.isCurrentSnap = false;
        });
        snap.isCurrentSnap = true;

        $scope.currentSnapIndex = index;
        $scope.currentSnap = snap;
        $scope.isMoreEnabled = false;
        switch (snap.type) {
            case 'network':
            default:
                $scope.switchSnapshot(snap.id);
        }
    }

    $scope.onDescShow = function($event) {
        var elem = $($event.target[0]).find('div')[0];
        $scope.isLongDescr = elem.scrollHeight > 200;
    }

    $scope.toggleDescrHeight = function() {
        $scope.isMoreEnabled = !$scope.isMoreEnabled;
    }

    $scope.getDescHeight = function() {
        return {
            height: $scope.isMoreEnabled ? 'unset' : '200px'
        };
    }

    $scope.getLineWidth = function() {
        return {
            width: 100 * ($scope.currentSnapIndex + 1) / $scope.snapshots.length + '%'
        };
    }

    $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, initPanel);

    initPanel();

    function initPanel() {
        $scope.snapshots = $scope.player.snapshots;
        if($scope.snapshots.length > 0) {
            let activeSnapshotIdx = $scope.snapshots.findIndex(x => x.isCurrentSnap);
            $scope.currentSnap = activeSnapshotIdx > -1 ? $scope.snapshots[activeSnapshotIdx] : $scope.snapshots[0];
            $scope.currentSnapIndex = activeSnapshotIdx > -1 ? activeSnapshotIdx : 0;
            if ($scope.snapshots.length === 1) {
                $scope.isMoreEnabled = true;
            }
        }
    }
}
]);