angular.module('common')
.directive('dirFocusNode', ['$timeout',
function ($timeout) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'EA',
        templateUrl: '#{player_prefix_index}/components/project/overlays/focusNode.html',
        // template:'<svg id="focus-node"></svg>',
        scope: {
            node: "=",
            imgAttr: "=",
            label: "@",
            start: "=",
            end: "=",
            finish: "&",
            duration: "@",
            mouseClick: "&",
            mouseLeave: "&",
            mouseLeaveBuffer: '=?'
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
        var fillColorAttr, strokeColorAttr;

        var nodeElem = $(element).find('.focus-node');
        var circleElem = nodeElem.find('.circle');

        // animate if start var changes
        scope.$watch('start', function() {
            fillColorAttr = scope.node.colorStr;
            if(scope.node.color) {
                strokeColorAttr = window.mappr.utils.darkenColor(scope.node.color);
            } else {
                strokeColorAttr = fillColorAttr;
            }
            runAnimation();
        }, true);

        //if buffer not defined, set at 0
        if(scope.mouseLeave && !scope.mouseLeaveBuffer) {
            scope.mouseLeaveBuffer = 0;
        }

        if(scope.mouseClick) {
            nodeElem.on('click', function() {
                scope.mouseClick();
            });
        }

        //static styles
        scope.nodeCircleStyle = {
            borderColor:strokeColorAttr,
            backgroundColor: fillColorAttr
        };


        scope.getNodeCircleStyle = function() {
            var obj = {
                borderColor:strokeColorAttr,
                backgroundColor: fillColorAttr
            };
            console.log('imgAttr: ', scope.imgAttr);
            var img = scope.node.attr[scope.imgAttr];
            if(img) {
                obj.backgroundImage = 'url('+img+')';
            }
            return obj;

        };

        scope.labelStyle = {
            color: fillColorAttr
        };

        //animation
        function runAnimation() {

            var initialScale = scope.start.size*2/150;
            var finalScale = scope.end.size*2/150;
            var finalTranslateX = scope.end.x - scope.start.x;
            var finalTranslateY = scope.end.y - scope.start.y;

            //sizing via jquery so can easily animate
            if(scope.start.x && scope.start.y) {
              nodeElem.css({
                  top:scope.start.y,
                  left: scope.start.x,
                  transitionDuration: scope.duration+'ms'
              });
            }

            circleElem.css({
                transform: 'scale3d('+initialScale+','+initialScale+',1)',
                transitionDuration: scope.duration+'ms'
            });

            $timeout(function() {
                nodeElem.css({
                    transform: 'translate3d('+finalTranslateX+'px, '+finalTranslateY+'px, 0)'
                });
                circleElem.css({
                    transform: 'scale3d('+finalScale+','+finalScale+',1)'
                });
            });

            //clear any previous hovers
            $(window).off('mousemove.nodePop');

            $timeout(function() {
                scope.finish();

                //mouseLeave
                var off = nodeElem.offset();
                var x2 = off.left, y2 = off.top;
                $(window).on('mousemove.nodePop', function(e) {
                    //get distance from center of node pop
                    var x1 = e.pageX, y1 = e.pageY;
                    var delta = Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) );

                    if(scope.mouseLeave && delta > scope.end.size + parseInt(scope.mouseLeaveBuffer)) {
                        $timeout(function() {
                            $(window).off('mousemove.nodePop');
                            scope.mouseLeave();
                        });
                    }
                });
            }, parseFloat(scope.duration));
        }
    }



    /*************************************
    ************ Local Functions *********
    **************************************/



    return dirDefn;
}
]);
