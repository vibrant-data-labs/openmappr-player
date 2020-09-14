angular.module('common')
.directive('dirSelectAll', [function() {
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
    function postLinkFn(scope, element) {
        var srcEvent = null;

        element
        .mousedown(function (event) {
            srcEvent = event;
        })
        .mouseup(function (event) {
            var delta = srcEvent ? Math.abs(event.clientX - srcEvent.clientX) + Math.abs(event.clientY - srcEvent.clientY) : 0;

            var threshold = 2;
            if (delta <= threshold) {
                try {
                    // ios likes this but windows-chrome does not on number fields
                    $(this)[0].selectionStart = 0;
                    $(this)[0].selectionEnd = 1000;
                } catch (e) {
                    // windows-chrome likes this
                    $(this).select();
                }
            }
        });
    }

    return dirDefn;
}
]);