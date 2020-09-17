angular.module('mappr')
.controller('ResetPswdCtrl', ['$scope', '$location', 'AuthService', 'uiService',
function($scope, $location, AuthService, uiService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlResetPswd: ] ';
    var qParams = $location.search();

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.user = {
        email: qParams.email,
        expireToken: qParams.expire,
        newPswd: '',
        newPswdConfirm: ''
    };

    /**
    * Scope methods
    */
    $scope.resetPassword = resetPassword;




    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function resetPassword() {
        if(!$scope.user.newPswd) {
            uiService.logError('Please enter a password!');
            return;
        }
        if($scope.user.newPswd !== $scope.user.newPswdConfirm) {
            uiService.logError('Passwords don\'t match!');
            return;
        }

        AuthService.resetPassword({
            email: $scope.user.email,
            expireToken: $scope.user.expireToken,
            password: $scope.user.newPswd
        })
        .then(function() {
            console.log(logPrefix + 'password reset.');
            uiService.log('Your password has been successfully changed!', false, 4000);
            $location.url('/');
        })
        .catch(function(err) {
            console.log(logPrefix + 'error in resetting password.', err);
            uiService.log('Your password could not be changed!', false, 4000);
        });
    }

}
]);