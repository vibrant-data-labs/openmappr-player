angular.module('common')
    .controller('SlidePanelCtrl', ['$scope', '$rootScope', '$timeout', '$interval', '$document', 'BROADCAST_MESSAGES',
        function($scope, $rootScope, $timeout, $interval, $document, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
             ************ Local Data **************
             **************************************/
            // var logPrefix = '[ctrlSlidePanel: ] ';
            var slideshowInt = null;
            var defaultSnapDuration = 10;
            var waitingForSoundLoad = false;
            var isTempPaused = false;
            // var hasCustomData = false;
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
            //  $scope.sound = null;
             $scope.oldDescriptionState = {};
             $scope.isDescriptionOpen = false;
             $scope.snapDescClass = '';

            /**
             * Scope methods
             */
             $scope.startPlaying = startPlaying;
             $scope.stopPlaying = stopPlaying;
             $scope.setSnapActive = setSnapActive; //Activates snapshot
             $scope.nextSnap = nextSnap;
             $scope.prevSnap = prevSnap;

            /*************************************
             ****** Event Listeners/Watches *******
             **************************************/
             $scope.$on(BROADCAST_MESSAGES.player.snapshotChanged, function(event, snap) {
               console.log('snap from broadcast: ', snap)
                 setSnapActive(snap, true)
             });
            //  $scope.$watch('sound', soundWatchFn);

             $rootScope.$on(BROADCAST_MESSAGES.sigma.clickStage, $scope.stopPlaying);
             $rootScope.$on(BROADCAST_MESSAGES.sigma.overNode, $scope.stopPlaying);
             $rootScope.$on(BROADCAST_MESSAGES.sigma.touchStart, $scope.stopPlaying);
             $rootScope.$on(BROADCAST_MESSAGES.player.interacted, $scope.stopPlaying);

            /*************************************
             ********* Initialise *****************
             **************************************/

            //  if($scope.snapInfo.snapsLoaded && !$scope.startedSlideshow && (!$scope.sound || $scope.sound.currentTime)) {
            //      checkForAudio();
            //  }

             if(!$scope.player.settings.snapDuration) {
                 $scope.player.settings.snapDuration = defaultSnapDuration;
             }

            $timeout(function() {
                initKeyboard();
            }, 100);

            /*************************************
             ********* Core Functions *************
             **************************************/


            function startPlaying() {
               if(!slideshowInt) {
                   if(!$scope.startedSlideshow) {
                       $scope.startedSlideshow = true;
                       $scope.isDescriptionClosed = false;
                   }
                   startSlideshow();
               }
               // if($scope.sound) {
               //  $scope.sound.play();
               // }
               $scope.isPlaying = true;
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

            function startSlideshow() {
                if($scope.isPlaying === false && $scope.snapInfo.curSnapInd === $scope.player.snapshots.length - 1) {
                    setSnapActive($scope.player.snapshots[0]);
                }
                slideshowInt = $interval(function() {

                    //get current index of active snap
                    var activeInd = _.findIndex($scope.player.snapshots, {'id': $scope.snapInfo.activeSnap.id});
                    // if($scope.sound && $scope.sound.currentTime) {
                    //     $scope.currentTime = activeInd*$scope.player.settings.snapDuration*1000 + $scope.sound.currentTime/($scope.sound.currentTime + $scope.sound.remaining)*$scope.player.settings.snapDuration*1000;
                    // } else {
                        $scope.currentTime += interval;
                    // }
                    //check if new snapshot should load
                    var curInd = Math.floor($scope.currentTime/($scope.player.settings.snapDuration*1000));
                    if(curInd == $scope.player.snapshots.length - 1) {
                        $scope.stopPlaying();
                    }
                    if(activeInd != curInd) {
                        $scope.setSnapActive($scope.player.snapshots[curInd]);
                    }
                }, interval);
            }

            // function checkForAudio() {
            //    //if audio pause timer and load audio
            //    if($scope.snapInfo.activeSnap.audio) {
            //        if($scope.isPlaying) {
            //            isTempPaused = true;
            //            $scope.stopPlaying();
            //        }
            //        waitingForSoundLoad = true;
            //        $scope.sound = ngAudio.load($scope.snapInfo.activeSnap.audio);
            //    }
            // }

            // function soundWatchFn() {
            //    $timeout(function() {
            //
            //        if(waitingForSoundLoad) {
            //            if(isTempPaused) {
            //                isTempPaused = false;
            //                $scope.startPlaying();
            //            }
            //            if(!$scope.sound || $scope.sound.error) {
            //                //maybe throw error saying sound couldn't load
            //            } else {
            //                $scope.sound.play();
            //                waitingForSoundLoad = false;
            //            }
            //        }
            //        // console.log('sound obj: ', $scope.sound);
            //    },5000);
            // }

            function nextSnap() {
                var curInd = $scope.snapInfo.curSnapInd + 1;
                var nextSnap = $scope.player.snapshots[curInd];
                if(nextSnap) {
                    $scope.setSnapActive(nextSnap, true);
                }
            }

            function prevSnap() {
                var curInd = $scope.snapInfo.curSnapInd - 1;
                var prevSnap = $scope.player.snapshots[curInd];
                if(prevSnap) {
                    $scope.setSnapActive(prevSnap, true);
                }
            }

            function setSnapActive(snap, stop){
                if(stop) {
                    $scope.stopPlaying();
                }
                $scope.snapInfo.curSnapInd = _.findIndex($scope.player.snapshots, {id: snap.id});
                // if($scope.sound) {
                //     $scope.sound.stop();
                //     $scope.sound = null;
                // }
                if(!snap) {
                    console.warn('no snapshot to load! given Id:' + snap.id);
                }

                // if(!snap.descr) {
                //     $scope.isDescriptionClosed = true;
                // }

                $scope.snapInfo.oldSnapId = $scope.snapInfo.activeSnap.id;
                //set up class for animating in snap desc
                var oldSnapInd = _.findIndex($scope.player.snapshots, {id: $scope.snapInfo.oldSnapId});
                var fromBottom = $scope.snapInfo.curSnapInd > oldSnapInd;
                $scope.snapDescClass = fromBottom ? 'animate-from-bottom' : 'animate-from-top' ;
                $timeout(function() {
                    $scope.snapInfo.activeSnap = snap;
                    switch (snap.type) {
                    case 'network':
                    default:
                        $scope.switchSnapshot(snap.id);
                    }

                    var snapInd = _.findIndex($scope.player.snapshots, {'id': $scope.snapInfo.activeSnap.id});
                    $scope.currentTime = $scope.player.settings.snapDuration*snapInd*1000;

                    //set old snap id
                    $scope.snapInfo.curSnapId = $scope.snapInfo.activeSnap.id;
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
