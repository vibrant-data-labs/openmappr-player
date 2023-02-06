/**
* Generic utility to execute a function when the scroll reaches the bottom of the container on which this directive is applied
*/
angular.module('common')
.directive('dirInfiniteScroll', ['$timeout', '$rootScope',
function($timeout, $rootScope) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
        controller: ['$scope', ControllerFn],
        link: postLinkFn
    };

    /*************************************
    ******** Controller Function *********
    **************************************/
    function ControllerFn($scope) {
        this.safeApply = function(expr) {
            if($scope.$$phase || $rootScope.$$phase) {
                $scope.$eval(expr);
            }
            else {
                $scope.$apply(expr);
            }
        };
    }



    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs, ctrl) {
        var rawElem = element[0];
        var scrollDistance = +attrs.scrollDistance || 100;
        var throttledScrollHandler = _.throttle(scrollHandler, 100);

        element.on('scroll', throttledScrollHandler);

        function scrollHandler() {
            if (rawElem.scrollTop + rawElem.offsetHeight + scrollDistance >= rawElem.scrollHeight) {
                console.log(logPrefix + 'fetching more');
                ctrl.safeApply(attrs.dirInfiniteScroll);
            }
        }
    }


    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirInfiniteScroll: ] ';



    /*************************************
    ************ Local Functions *********
    **************************************/

    return dirDefn;
}
]);