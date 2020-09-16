(function() {
    'use strict';

    // IE timestamp fix
    function ieFix () {
        var ua = window.navigator.userAgent;
        var msie = ua.indexOf('MSIE ');
        if(!console.timeStamp) {
            console.log('console.timeStamp not found, adding a noop func');
            console.timeStamp = function noop (args) {
            };

        }
    }
    ieFix();

    angular.module('player');
    angular.module('common', ['chieffancypants.loadingBar']);

    angular.module('hcApp', [
        'common',
        'player',
        'ngTouch',
        'ngAnimate',
        'ngRoute',
        'ngSanitize',
        'ngCookies',
        'ui.bootstrap',
        'ui.bootstrap.tpls',
        // 'textAngular',
        'nemLogging',
        'leaflet-directive',
        'ui.slider',
        // 'ui.sortable',
        'angular-loading-bar',
        // 'angularFileUpload',
        'duScroll',
        // 'infinite-scroll',
        // 'mgo-angular-wizard',
        'ng.deviceDetector',
        'ngAudio',
        'angular-google-analytics',
        'analytics.mixpanel',
        'vs-repeat',
        'angular-intro'
    ])

        .config(['$routeProvider', '$locationProvider', '$httpProvider', function ($routeProvider, $locationProvider, $httpProvider) {


            //player
            $routeProvider.when('/',                           {templateUrl:   '#{server_prefix}#{view_path}/player/player.html'});
            // $routeProvider.when('/play/:urlStr',                        {templateUrl:   '#{server_prefix}#{view_path}/player/player.html'});
            // $routeProvider.when('/play/:urlStr/compare',                 {templateUrl:   '#{server_prefix}#{view_path}/player/player.html'});
            // $routeProvider.when('/play/:urlStr/select',                 {templateUrl:   '#{server_prefix}#{view_path}/player/player.html'});

            // $routeProvider.when('/play/auth/:urlStr',                   {templateUrl:   '#{server_prefix}#{view_path}/player/playerBlank.html'});

            //404
            $routeProvider.when('/404',                                 {templateUrl:   '#{server_prefix}#{view_path}/partials/404'});
            //otherwise
            // $routeProvider.otherwise(                                   {redirectTo:    '/user-projects'});


            $locationProvider.html5Mode({
                enabled: true,
                requireBase: false
            });


            //initialize get if not there
            if (!$httpProvider.defaults.headers.get) {
                $httpProvider.defaults.headers.get = {};
            }
            //disable IE ajax request caching
            //$httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

        }])

        .config(function (AnalyticsProvider) {
            // Add configuration code as desired - see below
            AnalyticsProvider
                .setAccount('UA-70875599-1')
                .ignoreFirstPageLoad(true);
        })

        .config(['cfpLoadingBarProvider',
            function(cfpLoadingBarProvider) {
                cfpLoadingBarProvider.latencyThreshold = 100;
            }
        ])

        .config(function($sceDelegateProvider) {
            $sceDelegateProvider.resourceUrlWhitelist([
                // Allow same origin resource loads.
                'self',
                // Allow loading from our assets domain.
                'https://s3-us-west-2.amazonaws.com/new-mappr-builds/**',
                'http://d1vk2agkq7tezn.cloudfront.net/**'
            ]);
        })

    //Hack for logging all broadcast/emit messages
        .config(function($provide) {

            //Log only for non-production environments
            if(!_.contains(document.location.host.split('.'), 'mappr')) {
                $provide.decorator('$rootScope', function($delegate) {
                    var Scope = $delegate.constructor,
                        origBroadcast = Scope.prototype.$broadcast,
                        origEmit = Scope.prototype.$emit;

                    Scope.prototype.$broadcast = function(eventName, data) {
                        if(eventName && eventName.lastIndexOf && eventName.lastIndexOf('cfpLoadingBar:', 0) !== 0) {
                            console.log('[EventLogger][' + eventName + '] event $broadcasted with data: ', data);
                        }
                        return origBroadcast.apply(this, arguments);
                    };

                    Scope.prototype.$emit = function(eventName, data) {
                        if(eventName && eventName.lastIndexOf && eventName.lastIndexOf('cfpLoadingBar:', 0) !== 0) {
                            console.log('[EventLogger][' + eventName + '] event $emitted with data: ', data);
                        }
                        return origEmit.apply(this, arguments);
                    };

                    return $delegate;
                });
            }

        })

        .config(function($animateProvider) {
            $animateProvider.classNameFilter(/^((?!(no-animate)).)*$/);
        })

        .constant('BROADCAST_MESSAGES', {
            overNodes: 'overNodes',
            outNodes: 'outNodes',
            rightPanelExited: 'rightPanelExited',
            selectNodes: 'selectNodes',
            tempSelectNodes: 'tempSelectNodes',
            selectStage: 'selectStage',
            search: 'search',
            searchAttrToggled: 'searchAttrToggled',
            searchFailure: 'searchFailure',
            openMediaModal: 'openMediaModal',
            customData: 'customData',

            extUserOverlay: {
                open: 'extUserOverlay:open',
                close: 'extUserOverlay:close'
            },
            
            // Hover select subset features
            hss: {
                hover: 'hss:hover',
                select: 'hss:select',
                selectSingleNode: 'hss:selectSingleNode',
                subset: {
                    init: 'hss:subset:init',
                    changed: 'hss:subset:changed'
                }
            },

            // Filter Panel related
            fp: {
                initialSelection: {
                    changed: 'initialSelection:changed',
                    replace: 'initialSelection:replace'
                },
                currentSelection : {
                    changed: 'currentSelection:changed'
                },
                panel: {
                    rebuild: 'panel:rebuild'
                },
                filter: {
                    changed: 'filter:changed',
                    reset: 'filter:reset',
                    visibilityToggled: 'filter:visibilityToggled',
                    undo: 'filter:undo',
                    redo: 'filter:redo',
                    changFilterFromService: 'filter:changeFromService',
                    undoRedoStatus: 'filter:undoRedoStatus'
                },
                resized: 'resized'
            },

            // Info Panel
            ip: {
                nodeBrowser: {
                    refresh: 'nodeBrowser:refresh'
                }
            },

            appStatus: {
                online: 'appStatus:online'
            },

            attr: {
                typeChanged: 'attr:typeChanged',
                renderTypeChanged: 'attr:renderTypeChanged'
            },

            dataGraph: {
                edgeAdded: 'datagraph:edgeAdded',
                loaded: 'dataGraph:loaded'
            },
            network :{
                changed : 'network:changed',
                loaded : 'network:loaded'
            },
            renderGraph: {
                removed:'renderGraph:removed',
                loaded : 'renderGraph:loaded',
                changed : 'renderGraph:changed',
                tween : 'renderGraph:tween'
            },

            geoZoom: {
                reset: 'geozoom:zoomReset'
            },

            layout: {
                loaded : 'layout:loaded',
                changed: 'layout:changed',
                dataGraphLoaded: 'layoutCtrl:dataGraphLoaded',
                mapprSettingsUpdated: 'layoutCtrl:mapprSettingsUpdated',
                mapprSettingsChanged: 'layoutCtrl:mapprSettingsChanged',
                attrClicked: 'layout:attrClicked'
            },

            minNav: {
                enabled: 'minNav:enabled'
            },

            player: {
                loadStart: 'player:loadStart',
                load: 'player:load',
                loadFailure: 'player:loadFailure',
                added: 'player:added',
                snapshotChanged: 'player:snapshotChanged',
                timelineScrolled: 'player:timelineScrolled',
                interacted: 'player:interacted'
            },

            project: {
                load: 'project:load'
            },

            //Broadcasted from eventBridgeFactory.js
            sigma: {
                clickNode: 'sigma.clickNode',
                clickStage: 'sigma.clickStage',
                doubleClickNode: 'sigma.doubleClickNode',
                overNode: 'sigma.overNode',
                overNodes: 'sigma.overNodes',
                outNode: 'sigma.outNode',
                outNodes: 'sigma.outNodes',
                rendered: 'sigma.rendered',
                touchStart: 'sigma.touchStart',
                resize: 'sigma.resize'
            },

            grid: {
                clickNode: 'grid.clickNode',
                reset: 'grid:reset'
            },

            list: {
                clickNode: 'list.clickNode',
                reset: 'list:reset'
            },

            snapshot: {
                loaded: 'snapshot:loaded',
                changed: 'snapshot:changed',
                added: 'snapshot:added',
            },

            zoom: {
                start: 'zoom:start',
                end : 'zoom:end',
                reset: 'zoom:zoomReset'
            },

            nodeOverlay: {
                creating: 'nodeOverlay:creating',
                removing: 'nodeOverlay:removing',
                remove: 'nodeOverlay:remove',
                highlightText: 'nodeOverlay:highlightText'
            },

            selPanel: {
                refreshRenderer: 'selPanel:refreshRenderer'
            }
        })

        .constant('EMIT_MESSAGES', {

        });

}());
