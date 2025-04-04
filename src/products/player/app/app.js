// IE timestamp fix
function ieFix() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf('MSIE ');
    if (!console.timeStamp) {
        console.log('console.timeStamp not found, adding a noop func');
        console.timeStamp = function noop(args) {
        };

    }
}

var arrowWidth = 30;

$.fn.resizeselect = function (settings) {
    return this.each(function () {

        $(this).change(function () {
            var $this = $(this);

            var styles = window.getComputedStyle($this[0]);
            // create test element
            var text = $this.find("option:selected").text();
            var $test = $("<span>")
                .html(text)
                .css('font-weight', styles.fontWeight)
                .css('font-size', styles.fontSize)
                .css('font-family', styles.fontFamily)
                .css('line-height', styles.lineHeight);

            // add to body, get width, and get out
            $test.appendTo('body');
            var width = $test.width();
            $test.remove();

            // set select width
            $this.width(width + arrowWidth);

            // run on start
        }).change();

    });
};

// run by default
$("select.resizeselect").resizeselect();

ieFix();

angular.module('player', []);
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
    'vs-repeat',
    'angular-intro'
])

    .config(['$routeProvider', '$locationProvider', '$httpProvider', function ($routeProvider, $locationProvider, $httpProvider) {

        $routeProvider.when('*', { templateUrl: '#{player_prefix_index}/player/player.html' });
        $routeProvider.otherwise({ templateUrl: '#{player_prefix_index}/player/player.html' });

        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false
        });
        //initialize get if not there
        if (!$httpProvider.defaults.headers.get) {
            $httpProvider.defaults.headers.get = {};
        }

        //disable cache
        $httpProvider.interceptors.push([function () {
            function endsWith(str, suffix) {
                return str.indexOf(suffix, str.length - suffix.length) !== -1;
            }

            return {
                request: function (config) {
                    if ((config.url.indexOf('partials/') == -1) || !endsWith(config.url, '.html')) return config;

                    config.url = config.url + '?c=' + (new Date()).getTime();

                    return config;
                }
            };
        }]);
        //disable IE ajax request caching
        //$httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

    }])
    .config(['cfpLoadingBarProvider',
        function (cfpLoadingBarProvider) {
            cfpLoadingBarProvider.latencyThreshold = 100;
        }
    ])

    .config(['$sceDelegateProvider', function ($sceDelegateProvider) {
        $sceDelegateProvider.resourceUrlWhitelist([
            // Allow same origin resource loads.
            'self',
            // Allow loading from our assets domain.
            'https://s3-us-west-2.amazonaws.com/new-mappr-builds/**',
            'http://d1vk2agkq7tezn.cloudfront.net/**',
            '#{player_prefix_index_source}/**'
        ]);
    }])

    .config(['$animateProvider', function ($animateProvider) {
        $animateProvider.classNameFilter(/^((?!(no-animate)).)*$/);
    }])

    .decorator("$xhrFactory", function($delegate, $rootScope) {
        'ngInject';
    
        return function(method, url) {
            var xhr = $delegate(method, url);
    
            xhr.setRequestHeader = (function(sup) {
                return function(header, value) {
                    if ((header === "__XHR__") && angular.isFunction(value))
                        value(this);
                    else
                        sup.apply(this, arguments);
                };
            })(xhr.setRequestHeader);
    
            return xhr;
        };
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
        searchClose: 'searchClose',

        data: {
            downloadProgress: 'data:downloadProgress'
        },

        geoSelector: {
            changed: 'geoSelector:changed'
        },

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
            currentSelection: {
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
                refresh: 'nodeBrowser:refresh',
                show: 'ip:show'
            },
            changed: 'ip:changed'
        },

        // Colored By
        cb: {
            changed: 'cb:changed'
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
        network: {
            changed: 'network:changed',
            loaded: 'network:loaded'
        },
        renderGraph: {
            removed: 'renderGraph:removed',
            loaded: 'renderGraph:loaded',
            changed: 'renderGraph:changed',
            tween: 'renderGraph:tween'
        },

        geoZoom: {
            reset: 'geozoom:zoomReset'
        },

        layout: {
            loaded: 'layout:loaded',
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
            end: 'zoom:end',
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
        },
        tabs: {
            changed: 'tabs:changed'
        },
        searchRequest: {
            init: 'searchRequest:init'
        },
        tutorial: {
            start: 'tutorial:start',
            started: 'tutorial:started',
            completed: 'tutorial:completed'
        }
    })

    .constant('EMIT_MESSAGES', {

    });

