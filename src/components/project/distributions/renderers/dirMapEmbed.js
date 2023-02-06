angular.module('common')
.directive('dirMapEmbed', ['$sce', 'embedlyService',
function($sce, embedlyService) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        template: '<div ng-bind-html="embedSafe"></div>',

        scope: {
            latLng: '@'
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
        var url = "https://www.google.com/maps/place/"+scope.latLng;
        console.log('google maps url: ', url);
        var maxWidth = parseFloat(element.parent().width());

        embedlyService.embed(url, maxWidth)
            .success(function(results) {
                //if has embed
                if(results.html) {
                    scope.embedSafe = $sce.trustAsHtml(results.html);
                }
            }).error(function() {
                //couldn't create embed
            });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);