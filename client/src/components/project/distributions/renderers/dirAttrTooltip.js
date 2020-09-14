angular.module('common')
.directive('dirAttrTooltip', ['$timeout', '$compile',
function($timeout, $compile) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        scope: {
            attrClass: '@',
            attr: '=',
            node: '='
        },
        link: postLinkFn
    };

    /*************************************
    ************ Local Data **************
    **************************************/

    var templateUrl = '#{server_prefix}#{view_path}/components/project/distributions/renderers/attrTooltip.html';
    //delay time for hover
    var hoverDelay = 1000;
    //timeout for hover delay
    var enterTO;


    /*************************************
    ******** Controller Function *********
    **************************************/


    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {

        //wait for element to render
        $timeout(function() {
            var $element = $(element);
            var $attr = $element.find('.' + scope.attrClass);
            var $tooltip;
            var largeImage = false;
            var imageWidth;
            var imageHeight;


            //load image and see if larger than row
            if(scope.attr.attrType == 'picture') {
                getMeta(scope.attr.value, function (width, height) {
                    if(height - 20 > $attr.get(0).clientHeight || width > $attr.get(0).clientWidth) {
                        imageWidth = width;
                        imageHeight = height;
                        largeImage = true;
                    }
                });
            }


            $element.on('mouseenter', function() {
                $('.list-attr-tooltip').remove();
                enterTO = $timeout(function() {
                    if($attr.get(0).scrollHeight > $attr.get(0).clientHeight || $attr.get(0).scrollWidth > $attr.get(0).clientWidth || largeImage) {
                        $tooltip = $("<div><div class='list-attr-tooltip' ng-include='\"" + templateUrl + "\"'></div></div>").appendTo('body');
                        //use opacity fade instead of hiding so can get dimensions
                        $tooltip.fadeTo(0, 0);
                        var toolTipScope = scope.$new(true);
                        angular.extend(toolTipScope, {'attr': scope.attr, 'chosenNodes': [scope.node]});
                        $compile($tooltip.contents())(toolTipScope);
                        //wait one cycle for compile
                        $timeout(function() {
                            positionTooltip($element, $tooltip.find('.list-attr-tooltip'), imageWidth, imageHeight);
                            $tooltip.fadeTo(300, 1);

                            $tooltip.on('mouseleave', function() {
                                $('.list-attr-tooltip').remove();
                            });
                        });
                    }
                }, hoverDelay);
            });


            $element.on('mouseleave', function() {
                if(enterTO) {
                    $timeout.cancel(enterTO);
                }
                if(imageWidth && $tooltip) {
                    //remove all tooltips
                    $('.list-attr-tooltip').remove();
                }

            });
        });
    }



    /*************************************
    ************ Local Functions *********
    **************************************/

    function getMeta(url, callback) {
        var img = new Image();
        img.addEventListener("load", function(){
            callback( this.naturalWidth, this.naturalHeight );
        });
        img.src = url;
    }

    //check if too tall or at bottom
    function positionTooltip($element, $tooltip, imageWidth, imageHeight) {
        //clear any css added
        $tooltip.css({
            top: '',
            left: '',
            bottom: ''
        });
        var off = $element.offset();
        var offTop = off.top;
        var offLeft = off.left;
        console.log('tt offset: ', off);
        if(offTop == 0 && offLeft == 0) {
            return false;
        }
        $tooltip.css({
            top: offTop,
            left: offLeft
        });
        if(offTop > $(window).height() - 300) {
            var bottom = $(window).height() - offTop - $element.height();
            $tooltip.css({
                top: 'auto',
                bottom: bottom
            });
            if($tooltip.height() > offTop + bottom - 10) {
                $tooltip.css({
                    top: 10
                });
            }
        } else if($tooltip.height() + offTop > $(window).height() - 10) {
            $tooltip.css({
                bottom: 10
            });
        }
        //if image, then center tooltip
        if(imageWidth) {
            $tooltip.css({
                marginLeft: ($element.width() - imageWidth) / 2,
                pointerEvents: 'none'
            });
        }
    }


    return dirDefn;
}
]);
