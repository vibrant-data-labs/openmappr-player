angular.module('player')
.controller('BottomTimelineCtrl', ['$scope', '$rootScope', '$timeout', '$interval', '$document', 'BROADCAST_MESSAGES', 'ngAudio',
function($scope, $rootScope, $timeout, $interval, $document, BROADCAST_MESSAGES, ngAudio) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var slideshowInt = null;
    var defaultSnapDuration = 10;
    var waitingForSoundLoad = false;
    var isTempPaused = false;
    var hasCustomData = false;
    var isFirstRender = true;
    var interval = 100; //slideshow interval



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.startedSlideshow = true; //used to make sure if reopen modal, won't start slideshow again
    $scope.totalTime = null;
    $scope.currentTime = 0;
    $scope.isPlaying = false;
    $scope.isDescriptionClosed = false;
    $scope.sound = null;
    $scope.oldDescriptionState = {};
    $scope.isDescriptionOpen = false;



    /**
    * Scope methods
    */
    $scope.startPlaying = startPlaying;
    $scope.stopPlaying = stopPlaying;
    $scope.getTimeBarStyle = getTimeBarStyle;
    $scope.getSnapStyle = getSnapStyle; //snapshot styling
    $scope.getSnapClass = getSnapClass;
    $scope.hasDescription = hasDescription; //if snap has a description
    $scope.getSnapIconClass = getSnapIconClass; //see if snap is different layout type than previous and if so, show icon
    $scope.getSnapIconStyle = getSnapIconStyle;
    $scope.setSnapActive = setSnapActive; //Activates snapshot
    $scope.closeSnapDescription = closeSnapDescription;
    $scope.openSnapDescription = openSnapDescription;

    $scope.resetForceClose = function() {
        $('#footer-menu .description').removeClass('force-closed');
    };






    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.player.snapshotChanged, onSnapChange);
    $scope.$watch('sound', soundWatchFn);

    $rootScope.$on(BROADCAST_MESSAGES.sigma.clickStage, $scope.stopPlaying);
    $rootScope.$on(BROADCAST_MESSAGES.sigma.overNode, $scope.stopPlaying);
    $rootScope.$on(BROADCAST_MESSAGES.sigma.touchStart, $scope.stopPlaying);
    $rootScope.$on(BROADCAST_MESSAGES.player.interacted, $scope.stopPlaying);

    $rootScope.$on(BROADCAST_MESSAGES.sigma.rendered, onSigmaRender); //initially, hold snapshot open for a bit before closing

    //hide descriptio on overlay
    $rootScope.$on(BROADCAST_MESSAGES.nodeOverlay.creating, function(){
        $scope.oldDescriptionState.isDescriptionClosed = $scope.isDescriptionClosed;
        $scope.isDescriptionClosed = true;
    });
    $rootScope.$on(BROADCAST_MESSAGES.nodeOverlay.removing, function(){
        $scope.isDescriptionClosed = $scope.oldDescriptionState.isDescriptionClosed;
    });







    /*************************************
    ********* Initialise *****************
    **************************************/
    console.log('loading bottom timeline ctrl');
    if($scope.snapInfo.snapsLoaded && !$scope.startedSlideshow && (!$scope.sound || $scope.sound.currentTime)) {
        checkForAudio();
        //$scope.startPlaying(true);

        //set active snap based on
    }
    // });

    //begin playing once loaded
    // $scope.$on(BROADCAST_MESSAGES.player.load, function() {
        //if snapDuration not set (legacy players, then use default)
    if(!$scope.player.settings.snapDuration) {
        $scope.player.settings.snapDuration = defaultSnapDuration;
    }

        //see if only one snapshot and no bottom timeline and update right panel bottom
        // if($scope.player.snapshots.length == 1 && (!$scope.player.settings.showSnapDescrs || !$scope.player.snapshots[0].descr)) {
        //  $scope.panelUI.eight(false, false, true);
        // }

    $timeout(function() {
        initKeyboard();
        // this doesn't work if first snap is disabled. Not sure why we need since active snap is set in ctrlApp.
        // if(!hasCustomData) {
        //     //default to setting first snap active
        //     $scope.setSnapActive($scope.player.snapshots[0]);
        // }
    }, 100);

    // });





    /*************************************
    ********* Core Functions *************
    **************************************/

    function onSnapChange() {
        var snapInd = _.findIndex($scope.player.snapshots, {'id': $scope.snapInfo.activeSnap.id});
        $scope.currentTime = $scope.player.settings.snapDuration*snapInd*1000;

        //set old snap id
        $scope.snapInfo.curSnapId = $scope.snapInfo.activeSnap.id;
        checkForAudio();

    }

    function startPlaying() {
        return;
        // if(!slideshowInt) {
        //     if(!$scope.startedSlideshow) {
        //         $scope.startedSlideshow = true;
        //         $scope.isDescriptionClosed = false;
        //     }
        //     startSlideshow();
        // }
        // // if($scope.sound) {
        // //  $scope.sound.play();
        // // }
        // $scope.isPlaying = true;
    }

    function stopPlaying() {
        if(slideshowInt) {
            $interval.cancel(slideshowInt);
            slideshowInt = null;
        }
        // if($scope.sound && isButton) {
        //  $scope.sound.pause();
        // }
        $scope.isPlaying = false;
    }

    function checkForAudio() {
        //if audio pause timer and load audio
        if($scope.snapInfo.activeSnap.audio) {
            if($scope.isPlaying) {
                isTempPaused = true;
                $scope.stopPlaying();
            }
            waitingForSoundLoad = true;
            $scope.sound = ngAudio.load($scope.snapInfo.activeSnap.audio);
        }
    }

    function soundWatchFn() {
        $timeout(function() {

            if(waitingForSoundLoad) {
                if(isTempPaused) {
                    isTempPaused = false;
                    $scope.startPlaying();
                }
                if(!$scope.sound || $scope.sound.error) {
                    //maybe throw error saying sound couldn't load
                } else {
                    $scope.sound.play();
                    waitingForSoundLoad = false;
                }
            }
            // console.log('sound obj: ', $scope.sound);
        },5000);
    }

    // function startSlideshow() {
    //     slideshowInt = $interval(function() {

    //         //get current index of active snap
    //         var activeInd = _.findIndex($scope.player.snapshots, {'id': $scope.snapInfo.activeSnap.id});
    //         if($scope.sound && $scope.sound.currentTime) {
    //             $scope.currentTime = activeInd*$scope.player.settings.snapDuration*1000 + $scope.sound.currentTime/($scope.sound.currentTime + $scope.sound.remaining)*$scope.player.settings.snapDuration*1000;
    //         } else {
    //             $scope.currentTime += interval;
    //         }
    //         //check if new snapshot should load
    //         var curSnapInd = Math.floor($scope.currentTime/($scope.player.settings.snapDuration*1000));
    //         if(curSnapInd == $scope.player.snapshots.length - 1) {
    //             $scope.stopPlaying();
    //         }
    //         if(activeInd != curSnapInd) {
    //             $scope.setSnapActive($scope.player.snapshots[curSnapInd]);
    //         }
    //     }, interval);
    // }

    function getTimeBarStyle() {
        var w = $('.snaps-bar').width();
        var ind = _.findIndex($scope.player.snapshots, 'id', $scope.snapInfo.activeSnap.id);
        var dur = $scope.player.settings.snapDuration;
        var maxW = w/($scope.player.snapshots.length - 1);
        var pos = ind*maxW;
        var mod = $scope.currentTime - dur*1000 * ind;
        w = Math.min(maxW, mod/(dur*1000)*maxW);
        return {
            marginLeft: pos,
            width: w
        };
    }

    function getSnapStyle(ind, highlightColor) {
        //get width of snap bar
        var w = $('.snaps-bar').width();
        var pos = ind*w/($scope.player.snapshots.length - 1);
        var obj = {
            left:pos
        };

        // console.log($scope.player.snapshots, $scope.snapInfo.activeSnap);
        if($scope.player.snapshots[ind].id == $scope.snapInfo.activeSnap.id) {
            obj.borderColor = highlightColor;
        }

        return obj;
    }

    function getSnapClass(ind) {
        var cls = '';
        // if(isPrevSnap(ind, activeSnap)) {
        if($scope.player.snapshots[ind].id == $scope.snapInfo.activeSnap.id) {
            cls += 'active';
        }
        var prevSnap = $scope.player.snapshots[ind - 1];
        var snap = $scope.player.snapshots[ind];
        // if(ind == 0 || snap.type != prevSnap.type || snap.layout.plotType != prevSnap.layout.plotType) {
            cls += ' large';
        // }
        return cls;
    }

    function hasDescription(snapId) {
        var snap = _.find($scope.player.snapshots, {id: snapId});
        if(!snap || !snap.descr) {
            return false;
        } else {
            return true;
        }
    }

    //whether snap is previous to current snap
    // function isPrevSnap(ind, activeSnap) {
    //     var activeInd = _.findIndex($scope.player.snapshots, {'id': activeSnap.id});
    //     if(activeInd >= ind) {
    //         return true;
    //     }
    //     return false;
    // }

    function getSnapIconClass(snap, ind) {
        var prevSnap = $scope.player.snapshots[ind - 1];
        // if(ind == 0 || snap.type != prevSnap.type || snap.layout.plotType != prevSnap.layout.plotType) {
            if(snap.type == 'image') {
                return 'fa fa-picture-o';
            } else {
                if(snap.layout.plotType == 'geo') {
                    return 'icon-earth';
                } else if(['scatterplot', 'clustered-scatterplot'].includes(snap.layout.plotType)) {
                    return 'icon-scatter';
                } else if(snap.layout.plotType == 'grid') {
                    return 'icon-grid-layout';
                } else if(snap.layout.plotType == 'list') {
                    return 'fa fa-align-justify';
                } else {
                    return 'icon-project';
                }
            }
        // }
    }


    function getSnapIconStyle(ind, highlightColor) {
        if($scope.player.snapshots[ind].id == $scope.snapInfo.activeSnap.id) {
            return {
                color: highlightColor
            };
        }
    }

    function setSnapActive(snap){
        console.log('setting snap active: ', snap);
        if($scope.sound) {
            $scope.sound.stop();
            $scope.sound = null;
        }
        if(!snap) {
            console.warn('no snapshot to load! given Id:' + snap.id);
        }

        if(!snap.descr) {
            $scope.isDescriptionClosed = true;
        }

        $scope.snapInfo.oldSnapId = $scope.snapInfo.activeSnap.id;
        //set snap id above and then run one cycle so that class for image/embed animation is set up correctly
        $timeout(function() {
            $scope.snapInfo.activeSnap = snap;
            switch (snap.type) {
            case 'image':
                $rootScope.$broadcast(BROADCAST_MESSAGES.player.snapshotChanged, snap);
                break;
            case 'embed':
                $rootScope.$broadcast(BROADCAST_MESSAGES.player.snapshotChanged, snap);
                break;
            case 'network':
            default:
                $rootScope.$broadcast(BROADCAST_MESSAGES.player.snapshotChanged, snap);
                $scope.switchSnapshot(snap.id);
            }
        });

    }

    function closeSnapDescription() {
        $scope.isDescriptionClosed = true;
        forceSnapDescriptionClose();
    }

    function openSnapDescription() {
        if($scope.isDescriptionClosed) {
            $scope.isDescriptionClosed = false;
        }
    }

    /*
    * force snap descr to close (even if hovering
    * (done so that can click close and it closes even though hovering on)
    */
    function forceSnapDescriptionClose() {
        $timeout(function() {
            $('#footer-menu .description').addClass('force-closed');
        });
    }

    function onSigmaRender() {
        if(isFirstRender) {
            isFirstRender = false;
        }
    }

    /*
    * keyboard triggers
    */
    function initKeyboard() {

        $document.bind('keyup', function(e) {
            var activeSnapIdx;
            if(e.keyCode == 37 || e.keyCode == 33) {
                // Left
                activeSnapIdx = _.findIndex($scope.player.snapshots, 'id', $scope.snapInfo.activeSnap.id);
                if(activeSnapIdx > 0) {
                    $scope.setSnapActive($scope.player.snapshots[activeSnapIdx-1]);
                }
            }
            if(e.keyCode == 39 || e.keyCode == 34) {
                // right
                activeSnapIdx = _.findIndex($scope.player.snapshots, 'id', $scope.snapInfo.activeSnap.id);
                if(activeSnapIdx < $scope.player.snapshots.length-1) {
                    $scope.setSnapActive($scope.player.snapshots[activeSnapIdx+1]);
                }
            }
            //space for pausing
            if(e.keyCode == 32) {
                if($scope.isPlaying) {
                    $scope.stopPlaying();
                } else {
                    $scope.startPlaying();
                }
            }

            //up and down for description
            if(e.keyCode == 38) {
                $timeout(function() {
                    $scope.openSnapDescription();
                });
            }

            if(e.keyCode == 40) {
                $timeout(function() {
                    $scope.closeSnapDescription();
                });
            }

            // if(e.keyCode == 82) {
            //  // r - load 1st
            //  $scope.setSnapActive($scope.player.snapshots[0]);
            // }
        });
    }

}
]);
