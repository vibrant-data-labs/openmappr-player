angular.module('common')
.directive('dirMediaList', [function() {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/mediaList.html',

        scope: {
            jsonString: '=',
            maxWidth: '@',
            nodeColorStr: '@',
            renderWidth: '@',
            renderHeight: '@',
            isSmall: '@'
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
    function postLinkFn(scope, elem, attrs, renderCtrl) {
        // console.log('json string: ', scope.jsonString);
        //not sure how object is being passed, but checking for it
        if(typeof scope.jsonString == 'string') {
            try {
                scope.jsonMedia = JSON.parse(scope.jsonString);

                if(scope.jsonMedia.constructor !== Array) {
                    scope.jsonMedia = [scope.jsonMedia];
                }
            } catch(e) {
                console.log('[dirMediaEmbed]: error parsing json for media');
                //create json for error
                scope.jsonMedia = [
                    {
                        embed: "<h4 class='text-center'>Unable to parse media</h4>",
                        error: true
                    }
                ];
            }
        } else {
            scope.jsonMedia = [scope.jsonString];
        }

        // Hack - show only 1 value per node
        if(renderCtrl.isGridNode()) {
            scope.jsonMedia = [scope.jsonMedia[0]];
        }

        // scope.jsonMedia[0] = {
        //  url: "http://www.worldsurfleague.com",
        //  tags: ["something cool", "a place I would like to be right now"],
        //  description: "This is a description for a link. This is a description for a link. This is a description for a link. This is a description for a link. This is a description for a link. "
        // }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);