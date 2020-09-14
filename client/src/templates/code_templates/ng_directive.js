angular.module('Modname')
.directive('name', ['Injectable1',
function (Injectable1) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        require: '?^SomeDirective',
        scope: {},
        template: '<div ng-include=" \'templatePath.html\' "></div>',
        controller: ['$scope', ControllerFn],
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/


    /*************************************
    ******** Controller Function *********
    **************************************/
    function ControllerFn($scope) {

    }



    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs) {

    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}]);