angular.module('common')
.directive('dirPicture', ['$rootScope', '$sce', '$window', 'BROADCAST_MESSAGES',
function($rootScope, $sce, $window, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/picture.html',

        scope: {
            url: '=',
            // error:'=',
            height: '@',
            nodeColorStr: '@',
            // renderWidth: '@',
            // renderHeight: '@',
            isSmall: '@'
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirPicture: ] ';


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {

        //show embed in modal
        scope.activeImg = null;

        scope.$on(BROADCAST_MESSAGES.openMediaModal, function() {
            scope.setActiveImg(scope.url);
        });

        scope.setActiveImg = function(url) {
            scope.activeImg = $sce.trustAsHtml(scope.url);
            $rootScope.$broadcast(BROADCAST_MESSAGES.player.interacted);

        };

        scope.killActiveEmbed = function() {
            scope.activeImg = null;
        };

        scope.getSizeStyle = function() {
            return {
                display: 'block',
                width: 275,
                height: 275
            }
        };

        //reassign because if changes in parent then will reset
        // var renderWidth = scope.renderWidth;
        // if(scope.isSmall == 'true') {
        //     renderWidth = Math.round($window.innerWidth*.8);
        // } else {
        //     if(!renderWidth) {
        //         renderWidth = element.parent().width();
        //     }
        //     renderWidth = parseFloat(renderWidth);
        // }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
