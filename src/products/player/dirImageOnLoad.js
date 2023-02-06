angular.module('player')
.directive('imageonload', function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element, attrs) {
        element.bind('load', function() {
            //call the function that was passed
            scope.$apply(attrs.imageonload);
        });
    }

    return dirDefn;
});