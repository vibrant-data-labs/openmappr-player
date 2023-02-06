//hides tooltip when scrolling container (mainly used for filter panel)
angular.module('common')
.directive('dirKillTooltipOnScroll', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {
        element.on('scroll', function() {
            $('.tooltip').hide();
        });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);