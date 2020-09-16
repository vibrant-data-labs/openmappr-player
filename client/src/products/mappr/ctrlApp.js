angular.module('mappr')
.controller('AppCtrl', ['$scope', '$routeParams', '$route', '$location', '$rootScope', '$interval', '$timeout', '$http', '$templateCache', '$window', '$document', '$q', 'USER_ROLES', 'AuthService', 'uiService', 'dataGraph', 'layoutService', 'graphSelectionService', 'inputMgmtService', 'BROADCAST_MESSAGES',
function($scope, $routeParams, $route, $location, $rootScope, $interval, $timeout, $http, $templateCache, $window, $document, $q, USER_ROLES, AuthService, uiService, dataGraph, layoutService, graphSelectionService, inputMgmtService, BROADCAST_MESSAGES) {

    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    //Monitor App connectivity
    var heartBeating, offlineMsgHandler;
    var beatTime = 10; //sec
    var appStatusMessages = {
        offline: 'Unable to reach Mappr!',
        online: 'and we are back..continue the good work.',
        reconnecting: 'Connecting in '
    };

    // Simple templates Prefetching
    var templatePaths = [
        '#{server_prefix}#{view_path}/partials/project.html',

        '#{server_prefix}#{view_path}/partials/project/athenapanel.html',
        '#{server_prefix}#{view_path}/partials/project/createMapModal.html',
        '#{server_prefix}#{view_path}/partials/common/summaryPanel.html',
        '#{server_prefix}#{view_path}/partials/project/layoutpanel.html',
        '#{server_prefix}#{view_path}/partials/project/playerEditor.html',
        '#{server_prefix}#{view_path}/partials/project/nodefocus.html',
        '#{server_prefix}#{view_path}/partials/project/snapshotpanel.html',
        '#{server_prefix}#{view_path}/partials/project/stylepanel.html',
        // '#{server_prefix}#{view_path}/partials/project/tagpanel.html',
        // '#{server_prefix}#{view_path}/partials/project/versions.html',

        '#{server_prefix}#{view_path}/partials/di/spreadsheets.html',

        // '#{server_prefix}#{view_path}/partials/legend/global.html',
        //'#{server_prefix}#{view_path}/partials/legend/nodecard.html',
        //'#{server_prefix}#{view_path}/partials/legend/selection.html',
        //'#{server_prefix}#{view_path}/partials/legend/aggAttrsCard.html',

        '#{server_prefix}#{view_path}/partials/attrs/attrModModal.html',
        '#{server_prefix}#{view_path}/partials/attrs/attrModSelection.html',

        //'#{server_prefix}#{view_path}/partials/templates/datasetModal.html',
        //'#{server_prefix}#{view_path}/partials/templates/networksModal.html',
        '#{server_prefix}#{view_path}/partials/templates/netgenModal.html',

        '#{server_prefix}#{view_path}/partials/renderers/renderTemplates.html'
    ];





    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $rootScope.MAPP_EDITOR_OPEN = true;
    $rootScope.appOffline = false;
    // UI

    	// UI
    	//may simplify
    	$scope.appUi = {
    		theme: null,
    		showResetBtn: false,
    		showListSortBtn: false,
    		nodeAttrs: null,
    		reverseSort: false,
    		layoutSort: null,
    		// sortLayout: function(val) {
    		// 	console.log('sorting layout: ', val);
    		// 	$scope.$broadcast(BROADCAST_MESSAGES.layout.layoutSorted, {
    		// 		attr: $scope.appUi.layoutSort,
    		// 		reverseSort: $scope.appUi.reverseSort
    		// 	});
    		// },
    		// toggleLayoutSortDirection: function() {
    		// 	$scope.appUi.reverseSort = !$scope.appUi.reverseSort;
    		// 	$scope.$broadcast(BROADCAST_MESSAGES.layout.layoutSorted, {
    		// 		attr: $scope.appUi.layoutSort,
    		// 		reverseSort: $scope.appUi.reverseSort
    		// 	});
    		// },
    		// resetSelection: function() {
    		// 	$scope.$broadcast(BROADCAST_MESSAGES.layout.resetSelection);
    		// }
    	};

    //USER
    $scope.currentUser = null;
    $scope.userRoles = USER_ROLES;

    // pinned media
    // stays in top right regardless of where you move in graph
    $scope.pinnedMedia = {
        isMediaPinned: false,
        nodeValue: null,
        nodeColorStr: null,
        pinMedia: function(value, color) {
            $scope.pinnedMedia.nodeValue = value;
            $scope.pinnedMedia.nodeColorStr = color;
            $scope.pinnedMedia.isMediaPinned = true;
        },
        unpinMedia :function() {
            $scope.pinnedMedia.isMediaPinned = false;
            $scope.pinnedMedia.nodeValue = null;
            $scope.pinnedMedia.nodeColorStr = null;
        }
    };



    /**
    * Scope methods
    */
    $scope.isAuthorized = AuthService.isAuthorized;

    $scope.setCurrentUser = function(user) {
        $scope.currentUser = user;
    };

    $scope.isAuthenticated = function() {
        return (AuthService.user._id !== '');
    };

    //UI

    $scope.requiresHeaderBar = function() {
        var path = $location.path(), keys = path.split('/');
        return checkKeys(keys, ['user', 'user-profile', 'user-projects', 'user-timeline', 'user-orgs', 'user-surveys', 'recipes']);
    };

    $scope.requiresNavBar = function() {
        var path = $location.path(), keys = path.split('/');
        return checkKeys(keys, ['user', 'user-profile', 'user-projects', 'user-timeline', 'user-orgs', 'user-surveys', 'projects', 'recipes']);
    };





    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    	$scope.$on(BROADCAST_MESSAGES.sigma.rendered, function(e, data) {
    		var currLayout = layoutService.getCurrentIfExists();
    		if(currLayout.plotType == 'grid' || currLayout.plotType == 'list') {
    			$scope.appUi.showResetBtn = true;
    		}
    		else {
    			$scope.appUi.showResetBtn = false;
    		}


    		if(currLayout.plotType == 'list') {
    			$scope.appUi.showListSortBtn = true;
    		} else {
    			$scope.appUi.showListSortBtn = false;
    		}
    		//for sorting in list and (eventually) grid
    		$scope.appUi.nodeAttrs = dataGraph.getNodeAttrs();

    		// $scope.panelUI.showRightPanel = true;
    		//
    		// if($scope.extUserInfo && $scope.extUserInfo.showExtUserOverlay === false) {
    		// 	$scope.$broadcast(BROADCAST_MESSAGES.extUserOverlay.minimized);
    		// 	console.log('broadcasting ext user overlay minimized');
    		// }
    	});
    /*************************************
    ********* Initialise *****************
    **************************************/
    // heartBeating = heartbeat();

    // if(document.readyState === 'complete') {
    //  startPrefetchingTemplates();
    // }
    // else {
    //  angular.element($window).on('load', startPrefetchingTemplates);
    // }





    /*************************************
    ********* Core Functions *************
    **************************************/

    function checkKeys(keys, exp) {
        for (var i = 0, l = checkKeys.length; i < l; i++) {
            if (_.contains(exp, keys[i])) { return true; }
        }
        return false;
    }

    function reconnect() {
        displayReconnectMsg();
        $timeout(function() {
            ping()
            .then(function() {
                beatTime = 10;
                offlineMsgHandler.close();
                heartBeating = heartbeat();
                uiService.log(appStatusMessages.online);

                AuthService.login('',
                    function() {
                        console.log("[ctrlLogin.auth.login] auto login after reconnecting ----------------");
                    },
                    function(err) {
                        console.log(err);
                        $rootScope.error = "Failed to login";
                    }
                );
            })
            .catch(function() {
                beatTime += 5;
                reconnect();
            });
        }, beatTime*1000);
    }

    function heartbeat() {
        return $interval(function() {
            ping()
            .then(function() {
                $rootScope.appOffline = false;
            })
            .catch(function() {
                offlineMsgHandler = uiService.logError(appStatusMessages.offline, true);
                $interval.cancel(heartBeating);
                heartBeating = null;
                $rootScope.appOffline = true;
                reconnect();
            });
        }, beatTime*1000);
    }

    function displayReconnectMsg() {
        var reconnectTime = beatTime;
        var logRef = null;
        var reconnInterval = setInterval(function() {
            reconnectTime--;
            if(reconnectTime < 1) {
                clearInterval(reconnInterval);
                logRef.close();
            }
            if(!logRef) {
                logRef = uiService.log(appStatusMessages.reconnecting + reconnectTime + 's...', true);
            }
            else {
                logRef.update('message', appStatusMessages.reconnecting + reconnectTime + 's...');
            }
        }, 1000);
    }

    function ping() {
        return $http.get('/heartbeat', {ignoreLoadingBar: true});
    }

    // function startPrefetchingTemplates() {
    //     // Start fetching when there aren't any ongoing $http requests
    //     httpBufferClear()
    //     .then(fetch);

    //     function httpBufferClear() {
    //         var defer = $q.defer();

    //         var intervalId = window.setInterval(function() {
    //             if(angular.isArray($http.pendingRequests)) {
    //                 if($http.pendingRequests.length === 0) {
    //                     clearInterval(intervalId);
    //                     $timeout(function() {
    //                         defer.resolve();
    //                     });
    //                 }
    //             }
    //             else {
    //                 console.error('Angular has removed internal property $http.pendingRequests');
    //                 $timeout(function() {
    //                     defer.resolve();
    //                 });
    //             }
    //         }, 300);

    //         return defer.promise;
    //     }

    //     function fetch() {
    //         var n = 0,
    //             url;

    //         //Load 6 at a time
    //         templatePaths.splice(0,6).forEach(function(url) {

    //             //if already loaded, return. also, if all 6 have been loaded, start next batch
    //             if($templateCache.get(url)) {
    //                 prefetchMoreIfAllLoaded();
    //                 return;
    //             }

    //             //Fetch template from server and store in cache
    //             $http.get(url, {
    //                 cache :$templateCache,
    //                 ignoreLoadingBar: true, //Don't show loading bar for background processes
    //             })
    //             .then(
    //                 function(data) {
    //                     // $templateCache.put(url, data);
    //                     console.log('[Templates Prefetching: ] ', url, ' loaded');
    //                     prefetchMoreIfAllLoaded();

    //                 }, function(error) {
    //                     console.log('[Templates Prefetching: ] ', url, ' failed');
    //                     prefetchMoreIfAllLoaded();
    //                 }
    //             );

    //         });

    //         function prefetchMoreIfAllLoaded() {
    //             (++n === 6) && (templatePaths.length > 0) && fetch();
    //         }

    //     }
    // }

}
]);
