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
            }

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

                    // if(e.keyCode == 82) {
                    //  // r - load 1st
                    //  $scope.setSnapActive($scope.player.snapshots[0]);
                    // }
                });
            }

        }
    ]);
