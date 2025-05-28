/**
* Controller for authentication modal
*/
angular.module('common')
    .controller('authModalCtrl', ['$scope', 'authService',
        function ($scope, authService) {
            'use strict';

            $scope.password = '';
            $scope.error = false;

            $scope.checkPassword = function() {
                authService.checkPassword($scope.password)
                    .then(function(isValid) {
                        if (isValid) {
                            authService.authenticate();
                            window.location.reload();
                        } else {
                            $scope.error = true;
                            $scope.password = '';
                        }
                    });
            };

            $scope.onKeyPress = function($event) {
                if ($event.key === 'Enter') {
                    $scope.checkPassword();
                }
            };
        }
    ]); 