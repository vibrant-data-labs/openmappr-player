angular.module('common')
.directive('dirLongText', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/longText.html',

        scope: {
            longText: '@',
            isSmall: '@'
        }
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



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);