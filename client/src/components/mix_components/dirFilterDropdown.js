angular.module('mappr')
.directive('dirFilterDropdown', ['$timeout',
function($timeout) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'E',
        scope: {
            defaultTitle: '=',
            showTriangle: '@',
            ngModel: '=',
            changeVal: '&',
            ddClass: '@',
            isRight: '@',
            leftMargin: '@',
            isButton: '=?',
            btnIconClass: '@',
            valsList: '=' //array of objects with at least 'title' and optionally 'icon' class(es)
        },
        require:'^?ngModel',
        templateUrl: '#{server_prefix}#{view_path}/components/mix_components/filter-dropdown.html',
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {
        scope.changeVal = scope.changeVal || _.noop;

        scope.checkUp = function() {
            var off = $(element).find('.toggle').offset();
            if(off) {
                console.log(off.top, $(window).height());
                scope.dropUp = $(window).height() - off.top < 200;
            }
        };

        scope.searchKey = '';

        scope.setVal = function(val) {
            if(scope.ngModel) {
                scope.ngModel = val;
            }
            $timeout(function() {
                scope.changeVal({
                    val: val
                });
            });
        };
    }
    return dirDefn;
}
]);
