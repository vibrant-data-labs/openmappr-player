(function() {
    'use strict';

    var isPlayer = false;
    if(document.location.pathname.split('/')[1] == 'play') {
        isPlayer = true;
    }

    if(document.location.hostname !== 'app.mappr.io' || document.location.hostname !== 'staging.mappr.io') {
        console.warn('Ignoring errorLogger for local environments.');
        return;
    }

    angular.module('errorLogger')
    .config(function ($provide) {
        $provide.decorator("$exceptionHandler", ['$delegate', '$window',
            function($delegate, $window) {
                return function (exception, cause) {
                    if ($window.atatus) {
                        $window.atatus.notify(exception);
                    }
                    // (Optional) Pass the error through to the delegate
                    $delegate(exception, cause);
                };
            }
        ]);
    })
    .factory('errorHttpInterceptor', ['$q', '$window', function ($q, $window) {
        return {
            responseError: function responseError(rejection) {
                if ($window.atatus) {
                    var message = 'XHR Error: ' +
                                   rejection.config.method + ' ' +
                                   rejection.status + ' ' +
                                   rejection.config.url;
                    window.atatus.notify(new Error(message), {
                        config: rejection.config,
                        status: rejection.status
                    });
                }
                return $q.reject(rejection);
            }
        };
    }])
    .config(['$httpProvider', function($httpProvider) {
        $httpProvider.interceptors.push('errorHttpInterceptor');
    }]);

    if(isPlayer) {
        angular.module('errorLogger') //For Atatus
        .run(['playerFactory', function(playerFactory) {

            var ptPrefix = {
                playerId: 'pl-plid-',
                projectId: 'pl-pid-',
                buildVer: 'pl-ver-',
                datasetId: 'pl-did-'
            };

            playerFactory.currPlayer(true)
            .then(function(playerDoc) {
                setTags([
                    ptPrefix.playerId + playerDoc._id,
                    ptPrefix.projectId + playerDoc.project.ref,
                    ptPrefix.buildVer + playerDoc.buildVer,
                    ptPrefix.datasetId + playerDoc.dataset.ref
                ]);
            });

            function setTags(tags) {
                console.log('Setting Atatus tags: ', tags.join(', '));
                window.atatus.setTags(tags);
            }

        }]);
    }
    else {
        angular.module('errorLogger') //For Atatus
        .run(['$rootScope', '$location', '$q', 'projFactory', 'userFactory', 'orgFactory', function($rootScope, $location, $q, projFactory, userFactory, orgFactory) {

            // App tags prefixes
            var atPrefix = {
                userId: 'app-uid-',
                orgId: 'app-oid-',
                userName: 'app-uname-',
                userEmail: 'app-uemail-',
                projectId: 'app-pid-'
            };

            var appTags = {
                userId: '',
                orgId: '',
                userName: '',
                userEmail: '',
                projectId: ''
            };

            var dashBoardTags = ['userId', 'orgId', 'userName', 'userEmail'];
            var projectTags = dashBoardTags.concat(['projectId']);

            $rootScope.$on('$locationChangeSuccess', function() {
                var page = $location.path().split('/')[1];
                console.log('Page: ', page);
                switch(page) {
                case 'user-projects':
                    setDashboardTags()
                     .then(function() {
                         setTags(_.values(_.pick(appTags, dashBoardTags)));
                     });
                    break;
                case 'projects':
                    projFactory.currProject()
                     .then(function(projDoc) {
                         setDashboardTags()
                         .then(function() {
                             appTags.projectId = atPrefix.projectId + projDoc._id;
                             setTags(_.values(_.pick(appTags, projectTags)));
                         });
                     });
                    break;
                default:
                }
            });

            function setDashboardTags() {
                return $q.all([userFactory.currUser(), orgFactory.currOrg()])
                    .then(function(vals) {
                        var user = _.clone(vals[0]);
                        var org = vals[1];
                        appTags.userId = atPrefix.userId + user._id;
                        appTags.orgId = atPrefix.orgId + org._id;
                        appTags.userName = atPrefix.userName + user.name.replace(/ /, '-');
                        appTags.userEmail = atPrefix.userEmail + user.email;
                        return true;
                    });
            }

            function setTags(tags) {
                console.log('Setting Atatus tags: ', tags.join(', '));
                window.atatus.setTags(tags);
            }

        }]);
    }

}());