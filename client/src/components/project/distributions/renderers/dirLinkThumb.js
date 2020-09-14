angular.module('common')
.directive('dirLinkThumb', ['embedlyService',
function(embedlyService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{server_prefix}#{view_path}/components/project/distributions/renderers/linkThumb.html',

        scope: {
            url: '=',
            description: '@',
            maxWidth: '@'
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
    function postLinkFn(scope, element) {
        scope.link = {
            url: scope.url,
            description: scope.description
        };

        //reassign because if changes in parent then will reset
        var maxWidth = scope.maxWidth;
        if(!maxWidth) {
            maxWidth = element.parent().width();
        }
        maxWidth = parseFloat(maxWidth);

        //embedly types: photo, video, rich, link, error
        embedlyService.embed(scope.link.url, maxWidth)
            .success(function(results) {
                scope.link.embedlyJson = results;
            }).error(function() {
                //just show link
            });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);