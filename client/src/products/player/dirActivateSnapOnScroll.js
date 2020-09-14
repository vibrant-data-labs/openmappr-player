angular.module('player')
.directive('dirHandleContextScroll', ['BROADCAST_MESSAGES', '$timeout', '$q',
function(BROADCAST_MESSAGES, $timeout, $q) {
    'use strict';

    /*************************************
    ******** Directive description *******
    **************************************/
    var dirDefn = {
        restrict: 'A',
        link: postLinkFn
    };

    /*************************************
    ******** Post Link Function *********
    **************************************/
    function postLinkFn(scope, element) {
        var autoScrollingSnapDescr = false;
        var manScrollingSnapDescr = false;

        /*
        * Initialise scroll position
        * Directive will execute only when timeline panel is shown
        */
        triggerTimelineScroll();

        /*
        * Auto Scroll to snapshot description on snapshot change
        */
        scope.$on(BROADCAST_MESSAGES.player.snapshotChanged, function onSnapshotChange_nodedetailCtrl() {
            console.debug("hearing broadcast message snapshotChanged");
            triggerTimelineScroll();
        });

        function triggerTimelineScroll() {
            $timeout(function() {
                scrollSnapDescr()
                .then(function() {
                    scope.$emit(BROADCAST_MESSAGES.player.timelineScrolled);
                });
            });

        }

        function scrollSnapDescr() {
            console.log('scrolling snap description: '+manScrollingSnapDescr);
            //only if player (may change)
            if(!scope.player || manScrollingSnapDescr) {
                //reset here so next time asked to scroll, will scroll if haven't manually scrolled
                manScrollingSnapDescr = false;
                return $q.when('noscroll');
            }

            var id = scope.snapInfo.activeSnap.id;
            var delay = 1000;
            autoScrollingSnapDescr = true;
            //figure out where to scroll to
            if($(".snap-descr[data-snap-id='" + id + "']").length == 1) {
                var $snapDiv = $(".snap-descr[data-snap-id='" + id + "']");
                var top = $snapDiv.position().top;
                var h = element.height()/2;
                var sc = top - h + 60 + element.scrollTop();

                window.requestAnimationFrame(function() {
                    element.animate({
                        scrollTop: sc
                    }, delay, function() {
                        autoScrollingSnapDescr = false;
                    });
                });
                return $timeout(_.noop, delay);
            }
            else {
                return $q.reject('unknownerror');
            }
        }


        /*
        * Activate snapshot on timeline user scroll
        */
        var debActivateSnap = _.debounce(activateSnap, 100);

        element.on('scroll', handleTimelineScroll);

        scope.$on('$destroy', function() {
            element.off('scroll', handleTimelineScroll);
        });

        function handleTimelineScroll() {
            if(autoScrollingSnapDescr) {
                console.info('[ContextPanelCtrl: ] Auto scrolled probably due to animation.');
                return;
            }
            //timeout so can cancel if still scrolling
            debActivateSnap();
        }

        function activateSnap() {
            //if autoscrolling then don't activate snap on scroll
            if(autoScrollingSnapDescr) {
                return;
            }
            //loop through snap-descr's and see which last one is 50% scrolled up
            var h = element.height()/2;
            var snapId;
            element.find('.snap-descr').each(function() {
                var top = $(this).position().top;
                // console.log('top: '+top);
                if(top > h) {
                    return false;
                }
                else {
                    snapId = $(this).data('snap-id');
                }
            });

            //set new snapshot
            if(snapId && snapId != scope.snapInfo.activeSnap.id) {
                //define as user scrolling (so won't autoscroll when switching)
                manScrollingSnapDescr = true;
                scope.setSnapActive(_.find(scope.player.snapshots, {'id':snapId}));
                scope.$apply();
            }
        }
    }

    return dirDefn;
}
]);