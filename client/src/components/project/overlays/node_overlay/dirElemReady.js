angular.module('common')
    .directive('dirElemReady', function ($parse, $timeout) {
        return {
            restrict: 'A',
            link: function ($scope, elem, attrs) {
                angular.element(elem).ready(function() {
                    $timeout(function() {
                        var func = $parse(attrs.dirElemReady);
                        $scope.$event = {target: elem};
                        func($scope); 
                    });
                });
            }
        }
    })