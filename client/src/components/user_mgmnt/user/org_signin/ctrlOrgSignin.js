angular.module('mappr')
.controller('OrgSigninCtrl', ['$scope', '$location', '$window', 'orgFactory', 'AuthService' ,
function($scope, $location, $window, orgFactory, AuthService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlOrgSignin: ] ';
    var qParams = $location.search();


    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.user = {
        email: qParams.email,
        pswd: ''
    };

    $scope.orgId = qParams.oid;
    $scope.token = qParams.token;

    $scope.hostOrg = {};

    /**
    * Scope methods
    */
    $scope.addExistingUserToOrg = addExistingUserToOrg;
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
        if(!$scope.user.pswd) {
            return false;
        }
        else {
            return true;
        }
    }

    function addExistingUserToOrg() {
        var postObj = {
            email: $scope.user.email,
            password: $scope.user.pswd
        };

        AuthService.login(postObj)
        .then(function() {
            var postObj = {
                email: $scope.user.email,
                token: $scope.token
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