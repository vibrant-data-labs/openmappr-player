// Receives
// 1) exportSelection function

angular.module('common')
.directive('dirExport', ['$rootScope', function($rootScope) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'E',
        scope: true,
        templateUrl: '#{server_prefix}#{view_path}/components/project/export/export.html',
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
        scope.ui = {
            menuOpen: false
        };
        scope.exportSelection = $rootScope.exportSelection;
    }

    /*************************************
    ************ Local Functions *********
    **************************************/

    return dirDefn;
}
]);
