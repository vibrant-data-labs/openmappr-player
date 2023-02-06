/*
* Directive for creating orbiting buttons that scroll container to corresponding content
* ATTRS:
* color-str: color of orbit ring
* scroll-container: div that scrolls
* scroll-data-id: "data-" attribute used as an id for finding div to scroll to
*/
angular.module('common')
.directive('dirScrollOverlayAnchors', ['$timeout', 'snapshotService', 'dataGraph',
function ($timeout, snapshotService, dataGraph) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
        templateUrl: '#{player_prefix_index}/components/project/overlays/scrollOverlayAnchors.html',
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
    function postLinkFn(scope, element, attrs) {
        scope.nodeColorStr = attrs.colorStr;

        //defines buffer where button is considered active
        var activeBtnBuffer = 25;
        //scrolling element
        var $scrollContainer = $(attrs.scrollContainer);


        var anchoredAttrs = snapshotService.getAnchoredAttrIds();
        scope.anchorAttrs = _.filter(dataGraph.getNodeAttrs(), function(attr) {
            return _.indexOf(anchoredAttrs, attr.id) !== -1 && scope.focusNode.attr[attr.id] && attr.visible;
        });
        if(attrs.showNeighbors !== 'false') {
            var node = scope.focusNode;
            var dataset = dataGraph.getRawDataUnsafe();

            //if no attributes, create array
            if(!scope.anchorAttrs) {
                scope.anchorAttrs = [];
            }

            // link vars
            var
                incomingEdgesIndex = dataset.edgeInIndex[node.id],
                outgoingEdgesIndex = dataset.edgeOutIndex[node.id],
                hasLinks = scope.hasLinks = _.size(incomingEdgesIndex) + _.size(outgoingEdgesIndex) > 0;
            //force neighbors if neighbors defined in parent controller (should always be this way)
            //TODO: Define neighbors in ctrlNodeOverlay so don't have to do above calculation
            if(hasLinks || attrs.forceNeighbors === 'true') {
                scope.anchorAttrs.push({
                    title: 'Neighbors',
                    id: 'Neighbors',
                    attrType: 'neighbors'
                });
            }
        }

        //animation to scale in orbit and buttons
        $timeout(function() {
            scope.activateOrbit = true;
        });

        //watch for neighbor node and if so, then scale out orbit
        scope.$watch('neighborNode', function() {
            if(scope.neighborNode) {
                scope.activateOrbit = false;
            }
        });

        //position circles in x y based on index
        scope.getAttrCircleStyle = function(attr) {
            //get position of related attr div within scroll
            var $attrDiv = $scrollContainer.find("["+attrs.scrollDataId+"='" + attr.id + "']");
            if(attr.id !== 'Neighbors') {
                $attrDiv = $attrDiv.find('.detailbox-card');
            }
            //check if div loaded yet
            if($attrDiv.length == 0) {
                return;
            }
            var off = $(window).height()/2 - Math.min($(window).height()/2, $attrDiv.height()/2);
            var attrRat = ($attrDiv.position().top - off)/$scrollContainer[0].scrollHeight;
            var pos = resolveToPoint(attrRat*360, $(element).find('.scroll-overlay-anchors').width());
            var obj = {
                left:pos.mX,
                top:pos.mY
            };
            if(isActiveBtn(attr.id)) {
                obj.color = attrs.colorStr;
                obj.borderColor = attrs.colorStr;
            }
            return obj;
        };

        //when scrolling, spin orbit to correct icon
        $scrollContainer.on('scroll', function() {
            $timeout(function() {
                _.noop();
            });
        });


        scope.getAttrIconClass = function(attr) {
            if(!attr.renderType || attr.renderType == 'default') {

                switch(attr.attrType) {
                case 'picture':
                    return 'fa fa-fw fa-photo';
                case 'video':
                    return 'fa fa-fw fa-film';
                case 'video_stream':
                    return 'fa fa-fw fa-film';
                case 'audio_stream':
                    return 'fa fa-fw fa-music';
                case 'media_link':
                    return 'fa fa-fw fa-film';
                case 'url':
                    return 'fa fa-fw fa-link';
                case 'neighbors':
                    return 'fa fa-fw fa-group';
                default:
                    return 'icon-quotes-left';
                }

            } else {
                switch(attr.renderType) {
                case 'densitybar':
                    return 'fa fa-fw fa-barcode';
                case 'piechart':
                    return 'fa fa-fw fa-pie-chart';
                case 'histogram':
                case 'barchart':
                case 'categorylist':
                    return 'fa fa-fw fa-bar-chart';
                case 'twitterfeed':
                    return 'fa fa-fw fa-twitter';
                case 'instagramfeed':
                    return 'fa fa-fw fa-instagram';
                case 'medialist':
                case 'media':
                    return 'fa fa-fw fa-film';
                case 'link':
                    return 'fa fa-fw fa-link';
                case 'date':
                case 'date-time':
                case 'time':
                    return 'fa fa-fw fa-calendar';
                case 'email':
                    return 'fa fa-fw fa-envelope-o';
                case 'lat,lng':
                    return 'fa fa-fw fa-location-arrow';
                case 'longtext':
                case 'quote':
                default:
                    return 'icon-quotes-left';
                }
            }
        };

        scope.setHoverColor = function($event) {
            $($event.currentTarget).css({
                color: attrs.colorStr,
                borderColor: attrs.colorStr
            });
        };

        scope.clearHoverColor = function($event, id) {
            if(isActiveBtn(id)) {
                return;
            }
            $($event.currentTarget).css({
                color: '',
                borderColor: ''
            });
        };


        //scroll to attr in scrolling div
        scope.scrollToAttr = function(attr) {
            //find element to scroll
            var $attrDiv = $scrollContainer.find("["+attrs.scrollDataId+"='" + attr.id + "']");
            if(attr.id !== 'Neighbors') {
                $attrDiv = $attrDiv.find('.detailbox-card');
            }
            var off = $(window).height()/2 - Math.min($(window).height()/2, $attrDiv.height()/2) - 30;
            $scrollContainer.scrollToElement($attrDiv, off, 1000);
        };


        //convert to x and y using degree on circle and circle diameter
        function resolveToPoint(deg, diameter) {
            var rad = Math.PI * deg / 180;
            var r = diameter / 2;
            return {mX: r * Math.cos(rad), mY: r * Math.sin(rad)};
        }

        function isActiveBtn(id) {
            var $circ = element.find("[data-id='"+id+"']");
            var t = parseInt($circ.css('top'));
            var l = parseInt($circ.css('left'));
            if(l > 0 && t > -(activeBtnBuffer) && t < activeBtnBuffer) {
                return true;
            }
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
