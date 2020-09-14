angular.module('common')
.directive('dirTextList', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{server_prefix}#{view_path}/components/project/distributions/renderers/textList.html',
        scope: {
            strings: '='
        },
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
    function postLinkFn(scope) {
        scope.maxStrings = 5;
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);