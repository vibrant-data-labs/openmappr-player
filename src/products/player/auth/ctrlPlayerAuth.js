angular.module('player')
.controller('PlayerAuthModalCtrl', ['$scope', '$uibModalInstance', 'playerFactory',
function($scope, $uibModalInstance, playerFactory){
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
    $scope.playerAccessToken = '';
    $scope.playerAuthErr = '';

    /**
    * Scope methods
    */
    $scope.doAccessAuth = function() {
        playerFactory.getPlayer($scope.playerUrlStr + '?access_token=' + $scope.playerAccessToken)
        .then(function(data) {
            $uibModalInstance.close(data);
        }, function(err) {
            if(err.status == 403) {
                $scope.playerAccessToken = '';
                $scope.playerAuthErr = 'Please enter correct access token!';
            }
            console.log('[PlayerAuthModalCtrl: ] auth err', err);
        });
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