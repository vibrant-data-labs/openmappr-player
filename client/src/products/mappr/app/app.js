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

    angular.module('dataIngestion', []);
    angular.module('errorLogger', []);

    angular.module('mappr', [
        'dataIngestion',
        'errorLogger'
    ]);

    angular.module('common', []);

    angular.module('hcApp', [
        'common',
        'mappr',
        'ngTouch',
        'ngAnimate',
        'ngRoute',
        'ngSanitize',
        'ngCookies',
        'textAngular',
        'nemLogging',
        'leaflet-directive',
        'ui.bootstrap',
        'ui.bootstrap.tpls',
        'ui.slider',
        'ui.sortable',
        'angular-loading-bar',
        'duScroll',
        'infinite-scroll',
        'ng.deviceDetector',
        'ngFileUpload',
        'analytics.mixpanel',
        'vs-repeat',
        'angular-intro'
    ])

        .config(['$routeProvider', '$locationProvider', '$httpProvider', 'USER_ROLES', function ($routeProvider, $locationProvider, $httpProvider, USER_ROLES) {

            //public pages
            $routeProvider.when('/',                                    {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/user/signin/signin.html',                    access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            // $routeProvider.when('/home',                                {templateUrl:   '#{server_prefix}#{view_path}/partials/home.html',                      access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            // $routeProvider.when('/about',                               {templateUrl:   '#{server_prefix}#{view_path}/partials/about.html',                     access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            //public signup signin accept-invite etc
            // $routeProvider.when('/signup',                              {templateUrl:   '#{server_prefix}#{view_path}/partials/signup.html',                    access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/signin',                              {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/user/signin/signin.html',                    access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/signup-org',                          {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/user/org_signup/signupOrg.html',           access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/signin-org',                          {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/user/org_signin/signinOrg.html',           access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/reset_password',                      {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/user/reset_pswd/resetPassword.html',       access: [USER_ROLES.anon]});
            //user dash
            // $routeProvider.when('/user',                                {templateUrl:   '#{server_prefix}#{view_path}/partials/user.html',                      access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/user-projects',                       {templateUrl:   '#{server_prefix}#{view_path}/components/dashboard/mapps/project_list/projectlist.html',     access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/user-projects-old',                   {templateUrl:   '#{server_prefix}#{view_path}/components/dashboard/mapps/project_list/projectlist_old.html', access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/user-profile',                        {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/user/profile/profile.html',         access: [USER_ROLES.user, USER_ROLES.owner, USER_ROLES.admin]});
            // $routeProvider.when('/user-timeline',                       {templateUrl:   '#{server_prefix}#{view_path}/partials/dashboard/timeline.html',        access: [USER_ROLES.user, USER_ROLES.admin]});
            // $routeProvider.when('/user-orgs',                           {templateUrl:   '#{server_prefix}#{view_path}/partials/dashboard/orgs.html',            access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/user-surveys',                        {templateUrl:   '#{server_prefix}#{view_path}/components/dashboard/dashboard/mapps.html',      access: [USER_ROLES.user, USER_ROLES.admin]});
            //recipes
            $routeProvider.when('/recipes',                             {templateUrl:   '#{server_prefix}#{view_path}/components/dashboard/recipes/recipe_listing.html',     access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/recipes/:recipeid/viewer',              {templateUrl:   '#{server_prefix}#{view_path}/components/dashboard/recipes/recipe_viewer.html',      access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/recipes/:recipeid',                   {templateUrl:   '#{server_prefix}#{view_path}/components/dashboard/recipes/recipe_panel.html',      access: [USER_ROLES.user, USER_ROLES.admin]});
            //project
            $routeProvider.when('/projects/:pid',                       {templateUrl:   '#{server_prefix}#{view_path}/components/project/project.html',                   access: [USER_ROLES.user, USER_ROLES.admin]});
            $routeProvider.when('/projects/:pid/:vnum',                 {templateUrl:   '#{server_prefix}#{view_path}/components/project/project.html',                   access: [USER_ROLES.user, USER_ROLES.admin]});
            //player
            // $routeProvider.when('/p/:urlStr',                           {templateUrl:   '#{server_prefix}#{view_path}/partials/player.html',                    access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            // $routeProvider.when('/play/:urlStr',                        {templateUrl:   '#{server_prefix}#{view_path}/partials/player.html',                    access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            //mappr-admin
            $routeProvider.when('/admin',                               {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/admin/adminDash.html',            access: [USER_ROLES.admin]});
            // org-admin
            $routeProvider.when('/owner',                               {templateUrl:   '#{server_prefix}#{view_path}/components/user_mgmnt/admin/ownerDash.html' ,           access: [USER_ROLES.owner]});
            //pattern-library
            $routeProvider.when('/pattern-library',                     {templateUrl:   '#{server_prefix}#{view_path}/components/project/patternLibrary.html',                       access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            //404
            $routeProvider.when('/404',                                 {templateUrl:   '#{server_prefix}#{view_path}/partials/404.html',                       access: [USER_ROLES.anon, USER_ROLES.user, USER_ROLES.admin]});
            //otherwise
            $routeProvider.otherwise(                                   {redirectTo:    '/user-projects'});


            $locationProvider.html5Mode({
                enabled: true,
                requireBase: false
            });

            //initialize get if not there
            if (!$httpProvider.defaults.headers.get) {
                $httpProvider.defaults.headers.get = {};
            }
            //disable IE ajax request caching
            $httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

        }])

        .config(function($sceDelegateProvider) {
            $sceDelegateProvider.resourceUrlWhitelist([
                // Allow same origin resource loads.
                'self',
                // Allow loading from our assets domain.
                'https://s3-us-west-2.amazonaws.com/new-mappr-builds/**',
                'http://d1vk2agkq7tezn.cloudfront.net/**'
            ]);
        })

        .config(['cfpLoadingBarProvider',
            function(cfpLoadingBarProvider) {
                cfpLoadingBarProvider.latencyThreshold = 100;
            }
        ])

    // .config(['$httpProvider',
    //     function($httpProvider) {
    //         $httpProvider.interceptors.push(function($q, $rootScope, $interval) {
    //             return {

    //                 responseError: function(response) {
    //                     console.log('INTERCEPTOR ERROR: ', response);
    //                     if(response && (response.status < 200 || response.status > 500)) {
    //                         $rootScope.appOffline = true;
    //                     }
    //                     return $q.reject(response);
    //                 }
    //             }
    //         });
    //     }
    // ])


        .config(function($animateProvider) {
            $animateProvider.classNameFilter(/^((?!(no-animate)).)*$/);
        })

    //Hack for logging all broadcast/emit messages
        .config(function($provide) {

            // Log only for non-production environments
            if(!_.contains(document.location.host.split('.'), 'mappr')) {
                $provide.decorator('$rootScope', function($delegate) {
                    var Scope = $delegate.constructor,
                        origBroadcast = Scope.prototype.$broadcast,
                        origEmit = Scope.prototype.$emit;

                    Scope.prototype.$broadcast = function(eventName, data) {
                        if(!eventStartsWith(eventName, 'cfpLoadingBar:') &&
                  !eventStartsWith(eventName, 'leafletDirectiveMap')) {
                            console.log('%c[EventLogger][' + eventName + '] event $broadcasted with data: ',"color:rebeccapurple", data);
                        }
                        return origBroadcast.apply(this, arguments);
                    };

                    Scope.prototype.$emit = function(eventName, data) {
                        if(!eventStartsWith(eventName, 'cfpLoadingBar:') &&
                  !eventStartsWith(eventName, 'leafletDirectiveMap')) {
                            console.log('%c[EventLogger][' + eventName + '] event $emitted with data: ',"color:rebeccapurple", data);
                        }
                        return origEmit.apply(this, arguments);
                    };

                    return $delegate;
                });
            }

            function eventStartsWith(e, substr) {
                return e && e.lastIndexOf && e.lastIndexOf(substr, 0) === 0;
            }

        })

        .run(['$rootScope', '$route', '$location', 'AuthService', 'AUTH_EVENTS', 'BROADCAST_MESSAGES',
            function($rootScope, $route, $location, AuthService, AUTH_EVENTS, BROADCAST_MESSAGES) {
                $rootScope.$on("$routeChangeStart", function(event, next, current) {
                    // console.debug('[app.run.onrouteChangeStart.start] --------------------------------------');
                    // console.log('[app.js] routechange %O', next.$$route);
                    $rootScope.error = null;

                    if(!next.$$route) return;

                    AuthService.isAuthorized(next.$$route.access)
                        .then(function(data) {
                            //console.log('[app.run.onrouteChangeStart] AuthService: user authorized to access ' + JSON.stringify(next));
                        },
                        function (err) {
                            if (AuthService.isLoggedIn()) {
                                // user is not allowed
                                event.preventDefault();
                                console.debug('[app.run.onrouteChangeStart] Not authorized to access page');
                                $rootScope.$broadcast(AUTH_EVENTS.notAuthorized);
                                if (AuthService.isAdmin())
                                    $location.path('/admin');
                                else
                                    $location.path('/user-projects');
                            } else {
                                // user is not logged in
                                console.debug('[app.run.onrouteChangeStart] Not logged in to access page');
                                $rootScope.$broadcast(AUTH_EVENTS.notAuthenticated);
                                $location.path('/');
                            }
                        });

                    // //If app has user details available from cookies, then redirect user to appropriate page
                    // if(next.$$route && next.$$route.templateUrl === '/partials/signin') {
                    //     event.preventDefault();
                    //     if(AuthService.user._id !== '') {
                    //         if(AuthService.isAdmin()) {
                    //             $location.path('/admin-dash');
                    //         }
                    //         else {
                    //             $location.path('/user-projects');
                    //         }
                    //     }
                    // }

                });

                $rootScope.$on('$locationChangeSuccess', function() {
                    $rootScope.previousChangedUrl = $location.path();
                });

                $rootScope.$watch(
                    function() {
                        return $location.path();
                    },
                    function(newLocn) {
                        if($rootScope.previousChangedUrl === newLocn) {
                            $rootScope.$broadcast(BROADCAST_MESSAGES.route.historyBtnUsed);
                        }
                    }
                );
            }
        ])

        .constant('AUTH_EVENTS', {
            loginSuccess:       'auth-login-success',
            loginFailed:        'auth-login-failed',
            logoutSuccess:      'auth-logout-success',
            sessionTimeout:     'auth-session-timeout',
            notAuthenticated:   'auth-not-authenticated',
            notAuthorized:      'auth-not-authorized'
        })

        .constant('USER_ROLES', {
            admin: 'admin', //mappr/super admin | bitMask : 4
            owner: 'owner',
            user: 'user',
            anon: 'anon'
        })

        .constant('BROADCAST_MESSAGES', {
            overNodes: 'overNodes',
            outNodes: 'outNodes',
            rightPanelExited: 'rightPanelExited',
            selectNodes: 'selectNodes',
            tempSelectNodes: 'tempSelectNodes',
            selectStage: 'selectStage',
            openDIModal: 'openDIModal',
            dataMerged: 'dataMerged',
            search: 'search',
            searchAttrToggled: 'searchAttrToggled',
            searchFailure: 'searchFailure',
            openMediaModal: 'openMediaModal',

            user: {
                loggedIn: 'user:loggedIn',
                loggedOut: 'user:loggedOut',
            },

            org: {
                loaded: 'org:loaded'
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
                resized: 'stats:resized',
                attrSearched: 'stats:attrSearched'
            },

            // Info Panel
            ip: {
                nodeBrowser: {
                    refresh: 'nodeBrowser:refresh'
                }
            },

            // Data Ingestion related
            di: {
                dataEnhanced: 'dataEnhanced'
            },

            route: {
                historyBtnUsed: 'route:backForwardUsed'
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
                loaded: 'datagraph:loaded',
                empty : 'datagraph: empty',
                nodeAttrsUpdated: 'datagraph:nodeAttrsUpdated',
                linkAttrsUpdated: 'datagraph:linkAttrsUpdated'
            },
            network :{
                changed : 'network:changed',
                loaded : 'network:loaded',
                created: 'network:created',
                initPanel: 'network:initPanel',
                updated: 'network:updated',
                deleted: 'network:deleted'
            },

            renderGraph: {
                removed:'renderGraph:removed',
                loaded : 'renderGraph:loaded',
                changed : 'renderGraph:changed',
                tween : 'renderGraph:tween',
            },

            geoZoom: {
                reset: 'geozoom:zoomReset'
            },

            layout: {
                loaded : 'layout:loaded',
                changed: 'layout:changed',
                resetSelection: 'layout:resetSelection',
                dataGraphLoaded: 'layoutCtrl:dataGraphLoaded',
                mapprSettingsUpdated: 'layoutCtrl:mapprSettingsUpdated',
                mapprSettingsChanged: 'layoutCtrl:mapprSettingsChanged',
                layoutsLoaded: 'layout:layoutsLoaded',
                //move to service
                layoutModelChanged: 'layout:layoutModelChanged',
                layoutSorted: 'layout:layoutSorted',
                rowAttrsUpdated: 'layout:rowAttrsUpdated',
                compareIdsUpdated: 'layout:compareIdsUpdated',
                listColSizesUpdated: 'layout:listColSizesUpdated',
                attrClicked: 'layout:attrClicked'

            },

            minNav: {
                enabled: 'minNav:enabled'
            },

            player: {
                load: 'player:load',
                added: 'player:added',
                updated: 'player:updated',
                snapshotChanged: 'player:snapshotChanged'
            },

            project: {
                load: 'project:load',
                loadStart: 'project:loadStart',
                loadFailed: 'project:loadFailed',
                changeTheme: 'project:changeTheme',
                selectionBakedIntoDS: 'project:selectionBakedIntoDS',
                dpCatNamesChanged: 'project:dpCatNamesChanged'
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
                clickNode: 'grid.clickNode'
            },

            list: {
                clickNode: 'list.clickNode'
            },

            snapshot: {
                creating: 'snapshot:creating',
                loaded: 'snapshot:loaded',
                changed: 'snapshot:changed',
                added: 'snapshot:added',
                removed: 'snapshot:removed',
                updated: 'snapshot:updated' //Only used to update snaps info for publisher & snapshot panel
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
            },

            netgen: {
                started: 'netgen:started',
                finished: 'netgen:finished',
                failed: 'netgen:failed'
            },

            subnet: {
                started: 'subnet:started',
                finished: 'subnet:finished',
                failed: 'subnet:failed'
            },

            dataGroup: {
                added: 'dataGroups:added',
                datapointsAdded: 'dataGroups:datapointsAdded',
                inverted: 'dataGroups:inverted',
                datapointsRemoved: 'dataGroups:datapointsRemoved',
                nameUpdated: 'dataGroups:nameUpdated',
                datapointsReplaced: 'dataGroups:datapointsReplaced',
                deleted: 'dataGroups:deleted',
                visibilityToggled: 'dataGroups:visibilityToggled'
            },

            layoutPanel: {
                layoutCreated: 'layoutPanel:layoutCreated'
            }
        });

    // DEV TOOLS
    if(document.location.host.split('.')[0] !== 'mappr') {

    // HOW TO USE:
    // 1) Assign 'id' to element you want to investigate eg. id="ab"
    // 2) Open console
    // 3) To get all watchers: getWatchers('#ab')
    //    To get watches count map: getUniqWatcherCountMap('#ab')

        window.getWatchers = function getWatchers(root) {
            root = angular.element(root || document.documentElement);
            var watcherCount = 0;

            function getElemWatchers(element) {
                var isolateWatchers = getWatchersFromScope(element.data().$isolateScope);
                var scopeWatchers = getWatchersFromScope(element.data().$scope);
                var watchers = scopeWatchers.concat(isolateWatchers);
                angular.forEach(element.children(), function (childElement) {
                    watchers = watchers.concat(getElemWatchers(angular.element(childElement)));
                });
                return watchers;
            }

            function getWatchersFromScope(scope) {
                if (scope) {
                    return scope.$$watchers || [];
                } else {
                    return [];
                }
            }

            return getElemWatchers(root);
        };

        window.getUniqWatcherCountMap = function(root) {
            var watchersColl = getWatchers(root);
            var watchersMap = {};
            _.each(watchersColl, function(watch) {
                if(watchersMap[watch.exp] == null) {
                    watchersMap[watch.exp] = 0;
                }
                else {
                    watchersMap[watch.exp]++;
                }
            });
            return watchersMap;
        };
    }

}());
