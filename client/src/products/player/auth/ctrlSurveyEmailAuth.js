angular.module('player')
.controller('UserEmailAuthCtrl', ['$scope', '$uibModalInstance',
function($scope, $uibModalInstance){
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.userEmail = '';
    $scope.errorMsg = '';

    /**
    * Scope methods
    */
    $scope.saveUserEmail = function() {
        if(!$scope.userEmail) {
            $scope.errorMsg = 'Please enter a valid email!';
            return;
        }
        $uibModalInstance.close($scope.userEmail);
    };



    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/




}]);