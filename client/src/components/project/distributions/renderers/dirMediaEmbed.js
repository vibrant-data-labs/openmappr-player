angular.module('common')
.directive('dirMediaEmbed', ['$sce', '$rootScope', '$window', 'embedlyService', 'BROADCAST_MESSAGES',
function($sce, $rootScope, $window, embedlyService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'AE',
        require: '?^dirAttrRenderer',
        templateUrl: '#{player_prefix_index}/components/project/distributions/renderers/mediaEmbed.html',

        scope: {
            url: '=',
            embed: '=',
            description: '=',
            tags: '=',
            error:'=',
            height: '@',
            nodeColorStr: '@',
            renderWidth: '@',
            renderHeight: '@',
            isSmall: '@',
            isPinned: '@',
            isPinnable: '=',
            pinMedia: '=',
            unpinMedia: '='
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[dirMediaEmbed: ] ';


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {
        //remove blank, null, undefined tags
        if(scope.tags) {
            scope.tags = _.without(scope.tags, '', null, undefined);
        }

        scope.media = {
            url: scope.url,
            embed: scope.embed,
            description: scope.description,
            tags: scope.tags,
            error: scope.error
        };

        //show embed in modal
        scope.activeEmbed = null;
        scope.activeImg = null;

        scope.$on(BROADCAST_MESSAGES.openMediaModal, function() {
            if(!scope.media.embedlyJson) {
                console.warn(logPrefix + 'embedlyJson not set');
                return;
            }
            if(_.contains(['video', 'photo', 'rich'], scope.media.embedlyJson.type)) {
                scope.setActiveEmbed(scope.media);
            }
            else if(scope.media.embedlyJson.type == 'link') {
                window.open(scope.media.embedlyJson.url, '_blank');
            }
        });

        scope.setActiveEmbed = function(media) {
            var json = media.embedlyJson;
            if(!json) {
                return;
            }
            if(json.html) {
                scope.activeEmbed = $sce.trustAsHtml(json.html);
            } else {
                scope.activeImg = $sce.trustAsHtml(json.url);
            }
            scope.activeTags = media.tags;
            scope.activeDescription = media.description;
            $rootScope.$broadcast(BROADCAST_MESSAGES.player.interacted);

        };

        scope.killActiveEmbed = function() {
            scope.activeEmbed = null;
            scope.activeImg = null;
        };

        //reassign because if changes in parent then will reset
        var renderWidth = scope.renderWidth;
        var autoPlay = false;
        if(scope.isSmall == 'true') {
            renderWidth = Math.round($window.innerWidth*.8);
            autoPlay = true;
        } else if (scope.isPinned === 'true') {
            autoPlay = true;
        } else {
            if(!renderWidth) {
                renderWidth = element.parent().width();
            }
            renderWidth = parseFloat(renderWidth);
        }
        //use to resize iframe if embedly fails and has embed
        function resizeIframeStringToWidth(iframeStr, width) {
            var $iframe = $(iframeStr);
            var rat = $iframe.attr('width')/$iframe.attr('height');
            $iframe.attr('width', width);
            var h = width/rat;
            if(scope.renderHeight) {
                h = Math.min(scope.renderHeight, h);
            }
            $iframe.attr('height', h);
            return $iframe.prop('outerHTML');
        }

        //if no url, use embed
        if(!scope.media.url) {
            scope.media.url = scope.media.embed;
        }


        //use embedly for all media including links
        //embedly types: photo, video, rich, link, error
        if(scope.media.error) {
            //treat as simple text
            scope.media.embedSafe = $sce.trustAsHtml(scope.media.embed);
        } else if(scope.media.url) {
            embedlyService.embed(scope.media.url, renderWidth, autoPlay)
                .success(function(results) {
                    scope.media.embedlyJson = results;
                    //if has embed
                    if(results.html) {
                        scope.media.embedSafe = $sce.trustAsHtml(resizeIframeStringToWidth(results.html, renderWidth));
                    }

                    //if is link, determine whether image is entire width or not
                    if(results.type == 'link' && results.thumbnail_width >= renderWidth) {
                        scope.media.fullWidth = true;
                    }
                })
                .error(function() {
                    // console.debug(logPrefix + 'embedly error: ', err, scope.media);
                    //see if has embed and error using embedly
                    if(scope.media.embed && scope.media.embed.indexOf('iframe') !== -1) {
                        //resize iframe embed
                        scope.media.embed = scope.media.embed.replace(/\\/g, '');
                        scope.media.embed = resizeIframeStringToWidth(scope.media.embed, renderWidth);
                        scope.media.embedSafe = $sce.trustAsHtml(scope.media.embed);
                    } else if(scope.media.url && scope.media.url.indexOf('iframe') !== -1) {
                        //embed code is in url not "embed" property
                        scope.media.url = scope.media.url.replace(/\\/g, '');
                        scope.media.embed = resizeIframeStringToWidth(scope.media.url, renderWidth);
                        scope.media.embedSafe = $sce.trustAsHtml(scope.media.embed);
                    } else {
                        //treat as simple text
                        // scope.media.embedSafe = $sce.trustAsHtml(scope.media.embed);
                    }
                });
        }
        //  else if(scope.media.embed && scope.media.embed.indexOf('iframe') !== -1) {
        //   //resize iframe embed
        //   scope.media.embed = scope.media.embed.replace(/\\/g, '');
        //   scope.media.embed = resizeIframeStringToWidth(scope.media.embed, renderWidth);
        //   console.debug('iframe embed: ', scope.media.embed)
        //   scope.media.embedSafe = $sce.trustAsHtml(scope.media.embed);
        //  }


        //abort embedly calls if overlay is cancelled
        // scope.$on(BROADCAST_MESSAGES.nodeOverlay.removing, function() {
        //  embedlyService.cancel();
        // });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
