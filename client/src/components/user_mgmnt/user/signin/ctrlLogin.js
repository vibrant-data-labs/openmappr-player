angular.module('mappr')
.controller('LoginCtrl', ['$rootScope', '$scope', '$location', '$routeParams', '$window', 'AUTH_EVENTS', 'AuthService', 'orgFactory', 'uiService',
function($rootScope, $scope, $location, $routeParams, $window, AUTH_EVENTS, AuthService, orgFactory, uiService) {
    'use strict';


    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlLogin: ] ';

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.hostOrg = {};
    $scope.orgId = $routeParams.orgId;
    $scope.token = $routeParams.token;
    $scope.register = {email: $routeParams.email};
    $scope.credentials = {email: $routeParams.email};
    $scope.ui = {
        showPswdResetPanel: false
    };
    $scope.reset = {
        email: ''
    };

    $scope.message = null; //error message

    //login
    $scope.auth = {
        login: auth_loginFn,
        resetPassword : auth_resetPasswordFn,

        signInViaLocal: function auth_signInViaLocal() {
            $window.location.href = '/signin';
        }
    };

    /**
    * Scope methods
    */
    $scope.getOrgDetails = getOrgDetails; //get org assets for rendering a custom signup for org-invites



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function getOrgDetails(){
        console.log('[ctrlLogin.getOrgDetails]');
        orgFactory.listPublicProfileById($scope.orgId, function(result){
            _.assign($scope.hostOrg, result);
            $scope.hostOrg.picture = $scope.hostOrg.picture || 'https://s3-us-west-1.amazonaws.com/mappr-misc/icons/vdat-blue-dot-logo.png';
            console.log($scope.hostOrg);
        });
    }

    function auth_loginFn() {
        $scope.message = '';

        if(!$scope.credentials.email || !$scope.credentials.password) {
            $scope.message = 'Please enter your email & password!';
            return;
        }

        AuthService.login({
            email: $scope.credentials.email,
            password: $scope.credentials.password,
            rememberme: true
        })
        .then(function(res) {
            $scope.message = '';
            console.log("[ctrlLogin.auth.login] ----------------");
            console.log(res);
            var path = '';
            switch(res.role.title) {
            case 'user':
                path = '/user-projects';
                break;
            case 'admin':
                path = 'admin';
                break;
            case 'orgadmin':
                path = 'org-admin';
                break;
            default:
                path = '/user-projects';

            }

            // $rootScope.$broadcast(BROADCAST_MESSAGES.user.loggedIn);
            $location.path(path);
        })
        .catch(function(err) {
            console.error(err);
            if (err.status === 401) {
                uiService.logError(err.data);
                $scope.message = 'Error logging in. Please check your username and password.';
            }
        });

    }

    function auth_resetPasswordFn() {
        if(!$scope.reset.email) {
            uiService.logError('Please enter your email!');
            return;
        }
        AuthService.startPswdReset({email: $scope.reset.email})
        .then(function() {
            $scope.ui.showPswdResetPanel = false;
            console.log(logPrefix + 'password reset email sent to user');
            uiService.log('You\'ll receive an email shortly to start the password reset process!', false, 4000);
        })
        .catch(function() {
            uiService.logError('Something terrible happened, please try after sometime!');
        });
    }


}
]);
