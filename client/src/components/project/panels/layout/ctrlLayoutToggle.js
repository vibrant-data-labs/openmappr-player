angular.module('mappr')
.controller('LayoutToggleCtrl', ['$scope', '$rootScope', '$timeout', 'BROADCAST_MESSAGES',
function($scope, $rootScope, $timeout, BROADCAST_MESSAGES) {
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
    $scope.isSettingLayout = false;

    /**
    * Scope methods
    */
    $scope.changeLayout = function(layout) {
        // $rootScope.$broadcast(BROADCAST_MESSAGES.layout.changeLayout, {
        //  currentLayout: layout
        // });
        layout.makeCurrent();
        $scope.isSettingLayout = true;
    };

    $scope.openLayoutPanel = function(isSettingLayout) {
        if(!isSettingLayout) {
            isSettingLayout = $scope.isSettingLayout;
        }
        //cluster and original are somewhat the same so have to check if original so can open cluster panel
        if($scope.currentLayout && isSettingLayout && (_.get($scope.currentLayout, 'options.primary.length', 0) !== 0 || $scope.currentLayout.name == 'Original')) {
            $scope.isSettingLayout = false;
            if($scope.currentLayout.plotType !== 'list') {
                $scope.panelUI.openPanel('layout');
            }
            $scope.closeOverlay();
        }
    };



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $rootScope.$on(BROADCAST_MESSAGES.layout.layoutsLoaded, function(event, data) {
        // console.log('layouts: ', data.layouts);
        $scope.layouts = data.layouts;
    });

	$rootScope.$on(BROADCAST_MESSAGES.layout.layoutModelChanged, function(event, data) {
        //don't open first time or if original or list
        // if($scope.currentLayout && data.layout.plotType !== 'list' && data.layout.plotType != 'original' && $scope.isSettingLayout) {
        //     //var used if explicitly clicking layout toggle button (from change layout method above)
        //     $scope.isSettingLayout = false;
        //     $timeout(function() {
        //         $scope.openLayoutPanel();
        //     });
        // } else {
        //     $scope.panelUI.closePanels();
        // }
        var isFirst = !$scope.currentLayout;
        $scope.currentLayout = data.layout;
        if(!isFirst) {
            $scope.openLayoutPanel();
        }
    });

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/



}]);
