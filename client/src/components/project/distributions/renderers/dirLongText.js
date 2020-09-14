angular.module('common')
.directive('dirLongText', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{server_prefix}#{view_path}/components/project/distributions/renderers/longText.html',

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