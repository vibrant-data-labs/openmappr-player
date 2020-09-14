angular.module('mappr')
.controller('UserProfileCtrl', ['$scope', '$location', 'AuthService', 'userFactory', 'uiService',
function($scope, $location, AuthService, userFactory, uiService) {
    'use strict';


    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlResetPswd: ] ';

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.profileUI = {
        changePassword : false
    };

    $scope.authObj = {
        currPassword: '',
        newPassword: '',
        newPasswordConfirm: ''
    };

    /**
    * Scope methods
    */
    $scope.updatePassword = updatePassword;
    $scope.saveChanges = saveChanges;



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    init();

    /*************************************
    ********* Core Functions *************
    **************************************/

    function saveChanges() {
        userFactory.updateCurrUser($scope.userVM)
        .then(function(data) {
            $scope.userVM = _.cloneDeep(data);
            console.log(logPrefix + 'user updated successfully');
            uiService.log('Profile successfully updated!');
        })
        .catch(function(err) {
            var origUser = userFactory.currUserUnsafe();
            $scope.userVM = _.cloneDeep(origUser);
            console.error(logPrefix + 'errror in updating profile', err);
            uiService.logError(err.data);
        });
    }

    function updatePassword() {
        if(!$scope.authObj.currPassword || !$scope.authObj.newPassword || !$scope.authObj.newPasswordConfirm) {
            return uiService.logError('Please enter all password fields');
        }
        if($scope.authObj.currPassword === $scope.authObj.newPassword) {
            $scope.authObj.currPassword = '';
            $scope.authObj.newPassword = '';
            $scope.authObj.newPasswordConfirm = '';
            return uiService.logError('Old and new password can\'t be same');
        }
        if($scope.authObj.newPassword !== $scope.authObj.newPasswordConfirm) {
            $scope.authObj.newPassword = '';
            $scope.authObj.newPasswordConfirm = '';
            return uiService.logError('New Password fields don\'t match');
        }

        userFactory.updatePassword($scope.authObj.currPassword, $scope.authObj.newPassword)
        .then(function(data) {
            $scope.profileUI.changePassword = false;
            $scope.userVM = _.cloneDeep(data);
            console.log(logPrefix + 'password changed successfully');
            uiService.log('Password successfully updated!');
        })
        .catch(function(err) {
            $scope.authObj = {
                currPassword: '',
                newPassword: '',
                newPasswordConfirm: ''
            };
            console.error(logPrefix + 'errror in updating password', err);
            uiService.logError(err.data);
        });
    }

    function init() {
        userFactory.currUser()
        .then(function(user) {
            $scope.userVM = _.cloneDeep(user);
        });
    }
}
]);