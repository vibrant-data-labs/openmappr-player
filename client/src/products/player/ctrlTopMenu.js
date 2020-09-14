angular.module('player')
.controller('TopMenuCtrl', ['$scope', '$timeout', 'BROADCAST_MESSAGES',
function($scope, $timeout, BROADCAST_MESSAGES) {
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
    //top panel menu
    $scope.topMenu = [
        {
            icon: 'icon-graph',
            name: 'network',
            label: 'Snapshots',
            enabled: false,
            dropdown: true,
            menu: 'snaps'
        },
        {
            icon: 'fa fa-search',
            name: 'search',
            label: 'Search',
            enabled: false
        },
        {
            icon: 'icon-story',
            name: 'snapshot',
            label: 'Description',
            enabled: false
        }
    ];

    /**
    * Scope methods
    */
    $scope.topMenuCmd = topMenuCmd;

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, onRenderGraphLoad);

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function onRenderGraphLoad() {
        // initialize snapshot description panel (for scrolling)
        if(!$scope.player) {
            console.warn('Player not found, discarding ProjectLoad listener');
            return;
        }
        //initialize top menu buttons if needed
        _.find($scope.topMenu, {name:'search'}).enabled = $scope.player.settings.showSearch == true;
        _.find($scope.topMenu, {name: 'network'}).enabled = $scope.player.snapshots.length > 1;
        _.find($scope.topMenu, {name: 'snapshot'}).enabled = (($scope.player.settings.showSnapDescrs || $scope.player.settings.showTimeline) && $scope.player.settings.timelineType != 'bottom') == true;
        // _.find($scope.topMenu, {name: 'fullscreenEnter'}).enabled = isFullscreenEnabled() && !isFullscreen();
    }

    function topMenuCmd(name) {
        switch (name) {
        case 'network':
            //show various networks
            $scope.panels.showSnapsList = !$scope.panels.showSnapsList;
            console.debug("show snaps list: "+$scope.panels.showSnapsList);
            break;
        case 'search':
            //show search in legend title
            $scope.openPanel('search');
            break;
        case 'snapshot':
            $scope.openPanel('context');
            break;
        case 'fullscreenEnter':
            enterFullscreen();
            break;
        case 'fullscreenExit':
            exitFullscreen();
            break;
        default:

        }
    }

    function enterFullscreen() {
        var app = document.getElementById('app');

        if (app.requestFullscreen) {
            app.requestFullscreen();
        } else if (app.webkitRequestFullscreen) {
            app.webkitRequestFullscreen();
        } else if (app.mozRequestFullScreen) {
            app.mozRequestFullScreen();
        } else if (app.msRequestFullscreen) {
            app.msRequestFullscreen();
        }
        $timeout(function() {
            _.find($scope.topMenu, {name: 'fullscreenEnter'}).enabled = false;
            _.find($scope.topMenu, {name: 'fullscreenExit'}).enabled = true;
        });
    }

    function exitFullscreen() {
        // exit full-screen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        $timeout(function() {
            _.find($scope.topMenu, {name: 'fullscreenExit'}).enabled = false;
            _.find($scope.topMenu, {name: 'fullscreenEnter'}).enabled = true;
        });
    }

    // function isFullscreenEnabled() {
    //     return  document.fullscreenEnabled ||
    //             document.webkitFullscreenEnabled ||
    //             document.mozFullScreenEnabled ||
    //             document.msFullscreenEnabled;
    // }

    // function isFullscreen() {
    //     return  document.fullscreenElement ||
    //             document.webkitFullscreenElement ||
    //             document.mozFullScreenElement ||
    //             document.msFullscreenElement;
    // }

}
]);