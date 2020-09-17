angular.module('mappr')
.controller('OrgSignupCtrl', ['$scope', '$location', '$window', 'orgFactory', 'AuthService' ,
function($scope, $location, $window, orgFactory, AuthService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlOrgSignup: ] ';
    var qParams = $location.search();



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.newUser = {
        email: qParams.email,
        pswd: '',
        first_name: qParams.first_name,
        last_name: qParams.last_name
    };

    $scope.orgId = qParams.oid;
    $scope.token = qParams.token;
    $scope.hostOrg = {};

    /**
    * Scope methods
    */
    $scope.addNewUserToOrg = addNewUserToOrg;
    $scope.validateUserError = validateUserError;
    $scope.validateUserDetails = validateUserDetails;




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    getOrgDetails();

    /*************************************
    ********* Core Functions *************
    **************************************/

    function validateUserDetails() {
        if(!$scope.newUser.pswd || $scope.newUser.pswd.length < 4 || $scope.newUser.pswdConfirm !== $scope.newUser.pswd) {
            return false;
        }
        else {
            return true;
        }
    }

    function validateUserError() {
        if($scope.newUser.pswdConfirm !== $scope.newUser.pswd && $scope.newUser.pswdConfirm && $scope.newUser.pswdConfirm.length > 0) {
            return 'Your confirmed password field does not match your password field. Please correct the error.';
        } else if($scope.newUser.pswdConfirm && $scope.newUser.pswd.length < 4 && $scope.newUser.pswdConfirm.length > 0) {
            return 'Your password needs to be at least 4 characters long.';
        }
    }

    function addNewUserToOrg() {
        var postObj = {
            email: $scope.newUser.email,
            password: $scope.newUser.pswd,
            first_name: $scope.newUser.first_name,
            last_name: $scope.newUser.last_name
        };

        console.log('ctrlOrgSignup');
        console.log(postObj);

        AuthService.register(postObj)
        .then(function(userDoc) {
            console.log('ctrlOrgSignup');
            console.log(userDoc);
            var postObj = {
                email: $scope.newUser.email,
                token: $scope.token,
                first_name: $scope.newUser.first_name,
                last_name: $scope.newUser.last_name
            };
            return orgFactory.addUserToOrg($scope.orgId, postObj);
        })
        .then(function(data) {
            $window.location.href = '/user-projects';
            console.log(logPrefix + 'user added to org', data);
        })
        .catch(function() {
            // Do something
        });
    }

    function getOrgDetails(){
        console.log(logPrefix + 'fetching org details');
        orgFactory.getOrgPublicDetails($scope.orgId)
        .then(function(result){
            _.assign($scope.hostOrg, result);
            $scope.hostOrg.picture = $scope.hostOrg.picture || 'https://s3-us-west-1.amazonaws.com/mappr-misc/icons/vdat-blue-dot-logo.png';
            console.log(logPrefix, $scope.hostOrg);
        })
        .catch(function(err) {
            console.error(logPrefix + 'could not get org details', err);
        });
    }

}
]);