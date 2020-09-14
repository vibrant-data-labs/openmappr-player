angular.module('mappr')
.controller('SnapshotPanelCtrl',['$q', '$timeout', '$window', '$uibModal', '$scope', '$rootScope', 'orgFactory','projFactory', 'playerFactory','renderGraphfactory', 'snapshotService', 'layoutService', 'networkService', 'dataService', 'uiService', 'BROADCAST_MESSAGES',
function ($q, $timeout, $window, $uibModal, $scope, $rootScope, orgFactory, projFactory, playerFactory, renderGraphfactory, snapshotService, layoutService, networkService, dataService, uiService, BROADCAST_MESSAGES) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlSnapshotPanel: ] ';



    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.activeSnapId = '';

    // Snaps object with methods
    $scope.snapshots = {
        arr: null,
        currentSnap: null,
        deleteSnapInfo: null,
        isOpen: false,
        showLastSnap: false,

        open: function() {
            this.isOpen = true;
            //wait for animation
            $timeout(function() {
                if($scope.snapshots.showLastSnap) {
                    var $snapsScroller = $('#snapshots .snaps-scroller');
                    $snapsScroller.scrollLeft($snapsScroller[0].scrollWidth);
                }
                $(window).trigger('resize.snapshots');
            }, 2000);
        },

        close: function(e) {
            this.isOpen = false;

            $timeout(function() {
                $(e.currentTarget).trigger('mouseleave');
            });
        },

        getPanelClass: function() {
            if(this.isOpen) {
                return 'active';
            } else if(!this.isOpen && this.showLastSnap) {
                return 'hover-snap';
            } else if(this.arr && this.arr.length > 0) {
                return 'has-snaps';
            }
        },

        makeCurrent: function(snapId) {
            if(!snapId) throw new Error('Snap ID expected');
            var snap = _.find(this.arr, 'id', snapId);
            if(!snap) throw new Error('Snap not found in snapshots array');
            this.currentSnap = snap;
        },

        switchSnapshot: function(snap) {
            if(this.currentSnap && snap.networkId !== this.currentSnap.networkId) {
                // Networks being switched too
                var newNetwork = networkService.getNetworks()[snap.networkId];
                uiService.log('Switching to network: ' + newNetwork.name);
            }
            this.currentSnap = snap;
            $scope.switchSnapshot(snap.id); // Inherited from RenderGraphCtrl
        },
        getNumOfEnabledSnapshots: function(){
            if(_.isArray(this.arr) && this.arr.length > 0) {
                var sn = _.filter(this.arr, 'isEnabled');
                return sn.length;
            }
            else {
                console.warn(logPrefix + 'no snapshots yet in mapp');
                return 0;
            }
        },

        createSnapshot: function(snapObj){
            var self = this;
            snapshotService.createSnapshot(snapObj)
            .then(function(snap) {
                uiService.log('Snapshot created successfully!');
                self.switchSnapshot(snap);
            });
        },

        cloneSnapshot: function(snapId) {
            snapshotService.cloneSnapshot(snapId)
            .then(function() {
                uiService.log('Snapshot cloned successfully!');
            });
        },

        removeSnapshot: function(snapId) {
            var self = this,
                switchSnap = false,
                delSnapIdx;
            if(snapId == self.currentSnap.id) {
                switchSnap = true;
                delSnapIdx = _.findIndex(self.arr, {'id': snapId});
            }
            snapshotService.removeSnapshot(snapId)
            .then(function() {
                uiService.log('Snapshot removed successfully!');
                if(switchSnap && self.arr.length > 0) {
                    var snapToSwitch = self.arr[delSnapIdx];
                    if(snapToSwitch && snapToSwitch.type == 'network') {
                        self.switchSnapshot(snapToSwitch);
                    }
                    else {
                        // Search left for a network snapshot
                        for(var i = delSnapIdx - 1, n = 0; i >= n; i--) {
                            snapToSwitch = self.arr[i];
                            if(snapToSwitch && snapToSwitch.type == 'network') {
                                break;
                            }
                        }

                        if(snapToSwitch && snapToSwitch.type == 'network') {
                            self.switchSnapshot(snapToSwitch);
                        }
                        else {
                            // Search right for a network snapshot
                            for(i = delSnapIdx + 1, n = self.arr.length; i < n; i++) {
                                snapToSwitch = self.arr[i];
                                if(snapToSwitch && snapToSwitch.type == 'network') {
                                    break;
                                }
                            }
                            if(snapToSwitch && snapToSwitch.type == 'network') {
                                self.switchSnapshot(snapToSwitch);
                            }
                            else {
                                throw new Error('No network snapshot found to switch to after removing the snapshot.');
                            }
                        }
                    }
                }
            });
        },

        toggleSnapshotState: function(snap) {
            snap.isEnabled = !snap.isEnabled;
            this.saveSnapshot(snap);
        },

        saveSnapshot: function(snap) {
            snapshotService.updateSnapshot(snap, false) //2nd param - updateGraph
            .then(function() {
                uiService.log('Snapshot saved successfully!');
            });
        },

        updateSnapshot: function(snap) {
            snapshotService.updateSnapshot(snap, true)
            .then(function() {
                uiService.log('Snapshot Updated successfully!');
            });
        },

        updateSequence: function() {
            snapshotService.updateSequence()
            .then(function() {
                uiService.log('Snapshots reaarranged!');
            });
        },

        createSnap: function() {

            var newSnapshot = {
                snapName: '',
                descr: '',
                picture: '',
                embed: '',
                //network, image, embed, text
                type: 'network'
            };
            $rootScope.$broadcast(BROADCAST_MESSAGES.snapshot.creating);

            fireSnapEffect();

            // Autofill snap name & descr
            var suggestedSnap = snapshotService.suggestSnapObj();
            newSnapshot.snapName = suggestedSnap.snapName;
            newSnapshot.descr = suggestedSnap.descr;

            this.createSnapshot(newSnapshot);
            this.showLastSnap = true;
        },

        openSnapCreateModal: function() {
            var self = this;

            var modalInstance = $uibModal.open({
                size: 'lg',
                templateUrl : '#{server_prefix}#{view_path}/components/project/panels/snapshot/snapCreateModal.html',
                controller : 'SnapCreateModalCtrl',
                scope: $scope
                // resolve: {
                //  snapType: function() {
                //      return snapType;
                //  }
                // }
            });

            //Called when modal is closed
            modalInstance.result
            .then(
                function(data) {
                    console.debug('snap create modal data: ', data);
                    //create snapshot
                    self.createSnapshot(data);
                },
                function() {
                    console.warn("Modal dismissed at: " + new Date());
                }
            ).finally(function() {

            });
        },

        openSnapEditModal: function(snap) {
            var self = this;
            var modalInstance = $uibModal.open({
                size: 'lg',
                templateUrl : '#{server_prefix}#{view_path}/components/project/panels/snapshot/snapEditModal.html',
                controller : 'SnapEditModalCtrl',
                scope: $scope,
                resolve: {
                    currSnap: function() {
                        return snap;
                    }
                }
            });

            //Called when modal is closed
            modalInstance.result
            .then(
                function(data) {
                    console.debug('snap edit modal data: ', data);
                    if(_.isObject(data) && data.snap) {
                        //save edited snapshot data
                        self.saveSnapshot(data.snap);
                    }
                },
                function() {
                    console.warn("Modal dismissed at: " + new Date());
                }
            ).finally(function() {

            });
        },


        getDeleteSnapInfo: function(snap) {
            this.deleteSnapInfo = [
                {
                    name: 'Name:',
                    val: snap.snapName
                },
                {
                    name: 'Description:',
                    val: snap.descr
                }
            ];
        },

        deleteSnapshot: function(snap) {
            this.removeSnapshot(snap.id);
        },

        openSnapRemoveModal: function(snap) {
            var self = this;
            var modalInstance = $uibModal.open({
                templateUrl : '#{server_prefix}#{view_path}/components/project/panels/snapshot/snapRemoveModal.html',
                controller : 'SnapRemoveModalCtrl',
                scope: $scope,
                resolve: {
                    currSnap: function() {
                        return snap;
                    }
                }
            });

            //Called when modal is closed
            modalInstance.result
            .then(
                function(data) {
                    console.debug('snap edit modal data: ', data);
                    if(data.shouldDelete) {
                        self.removeSnapshot(data.id);
                    }
                },
                function() {
                    console.warn("Modal dismissed at: " + new Date());
                }
            ).finally(function() {

            });
        }
    };

    /**
    * Scope methods
    */
    $scope.overSnap = function(snap) {
        $timeout.cancel(snap.hoverTO);
        snap.hover = true;
    };

    $scope.outSnap = function(snap, isImmediate) {
        $timeout.cancel(snap.hoverTO);
        if(isImmediate) {
            snap.hover = false;
        } else {
            snap.hoverTO = $timeout(function() {
                snap.hover = false;
            }, 500);
        }
    };

    //allow snapshot panel to be dragged
    //not currently implemented
    $scope.dragInit = function() {
        //allow snapshot panel to be dragged
        $('#snapshots').draggable({
            containment: "document",
            axis: "y",
            handle: ".drag-handle"
        });
    };





    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.dataGraph.loaded, _initPanel); // Init snap bar

    //Event name is passed from directive attribute, so not including in BROADCAST_MESSAGES constants.
    $scope.$on('snapshots:renderComplete', function() {
        //console.log('[ctrlPublish] snapshots:renderComplete');
        //onFinishRender defined in dirUI
        //this is in place to make sure the snap dom is fully
        //rendered before the jquery stuff kicks in
        //jquery stuff to handle sorting scrolling
        sortableInit();
    });

    $scope.$on(BROADCAST_MESSAGES.snapshot.added, function(e, data) {
        if(_.isObject(data) && data.makeCurrent === true) {
            $scope.snapshots.makeCurrent(data.createdSnap.id);
        }
    });

    // If network name changed, update snapshots name & descr with new values
    $scope.$on(BROADCAST_MESSAGES.network.updated, function(e, data) {
        _.each(data.updatedNWSnapsMap, function(snapUpdates, snapId) {
            var snap = _.find($scope.snapshots.arr, 'id', snapId);
            if(!snap) {throw new Error('Snap not found');}
            snap.snapName = snapUpdates.name;
            snap.descr = snapUpdates.descr;
        });
    });



    /*************************************
    ********* Initialise *****************
    **************************************/

    /*************************************
    ********* Core Functions *************
    **************************************/

    function _initPanel() {
        snapshotService.getSnapshots()
        .then(function(snaps) {
            if(!_.isArray(snaps)) {
                throw new Error('Array expected for snapshots');
            }
            $scope.snapshots.arr = snaps;
            if(snaps.length > 0) {
                var currSnap = snapshotService.getCurrentSnapshot();
                if(currSnap) {
                    $scope.snapshots.currentSnap = currSnap;
                }
                else {
                    var x = $scope.$on(BROADCAST_MESSAGES.snapshot.loaded, function() {
                        x();
                        $scope.snapshots.currentSnap = snapshotService.getCurrentSnapshot();
                        if(!$scope.snapshots.currentSnap) throw new Error('No snapshot loaded.');
                    });
                }
            }
        });
    }

    function fireSnapEffect() {
        //in ctrlProject
        $scope.isTakingSnap = true;
        $timeout(function() {
            $scope.isTakingSnap = false;
        });
    }

    function sortableInit() {
        //jQuery elements to handle scrolling
        //whether sorting has been initialized or not
        var isSorting = false;

        //length of snapshots
        var snapsLength = 0;
        //distance left and right arrows should scroll snapshots (recalculated on initial resize)
        var scrollDistance = 400;
        var $publish, $snapsHolder, $snapsScroller, $scrollLeft,$scrollRight,$snaps;

        $publish = $('#snapshots');
        $snapsHolder = $publish.find('.snaps-container');
        $snapsScroller = $publish.find('.snaps-scroller');
        $scrollLeft = $publish.find('.left-scroll-grad');
        $scrollRight = $publish.find('.right-scroll-grad');
        $snaps = $publish.find('.snap');

        // console.group('snapshots loaded');
        // console.log('publish', $publish);
        // console.log('snapsScroller', $snapsScroller);
        // console.log('snaps', $snaps);
        // console.groupEnd();


        var checkScrollers = function() {
            if($scope.snapshots.arr.length === 0) {
                $scrollLeft.hide();
                $scrollRight.hide();
            } else {
                if($snapsScroller.scrollLeft() === 0) {
                    $scrollLeft.hide();
                } else {
                    $scrollLeft.show();
                }

                if($snapsScroller.scrollLeft() == $snapsScroller[0].scrollWidth - $snapsScroller.outerWidth()) {
                    $scrollRight.hide();
                } else {
                    $scrollRight.show();
                }
            }
        };

        //click events for scrollers
        $scrollLeft.on('click', function() {
            $snapsScroller.animate({
                scrollLeft:$snapsScroller.scrollLeft()-scrollDistance
            }, 800);
        });

        $scrollRight.on('click', function() {
            $snapsScroller.animate({
                scrollLeft:$snapsScroller.scrollLeft()+scrollDistance
            }, 800);
        });

        //scrolling
        $(window).off('resize.snapshots');
        $(window).on('resize.snapshots', function() {
            if($publish.width() > 0){

                //distance scrollers move snapshots
                scrollDistance = $snapsHolder.width()*0.8;

                //position scroll buttons
                $scrollLeft.css({
                    left:$snapsHolder.position().left-15
                });

                //if add a snapshot
                if($snaps.length > snapsLength) {
                    snapsLength = $snaps.length;
                    $snapsScroller.scrollLeft($snaps.length*$snaps.eq(0).outerWidth());
                }

                //show left arrow if can scroll
                checkScrollers();
            }

            // console.groupEnd();
        });
        $(window).trigger('resize.snapshots');

        // check whether to show scroll buttons
        $snapsScroller.on('scroll', function() {
            checkScrollers();
        });

        //sorting
        //destroy if not first sortable
        if(isSorting) {
            $snapsScroller.sortable('destroy');
        }
        isSorting = true;

        $snapsScroller.sortable({
            tolerance: 'pointer',
            scroll: true,
            forcePlaceholderSize: true,
            forceHelperSize: true,
            placeholder:'placeholder',
            appendTo: $('#snapshots'),
            beforeStop: function() {
            },
            stop: function() {
            //  if (ui.position.top < deleteTolerance) {
            //      console.debug("ui.position.top: "+ui.position.top)
            //      //delete snapshot
            //      console.log('deleting uid: '+ui.item.attr('data-uid'));
            //      $scope.snapshots.removeSnapshot(ui.item.attr('data-uid'));

            //      //TODO:
            //      //show modal before deleting
            //      // console.log('uid: '+ui.item.attr('data-uid'));
            //      // var snap = _.findWhere($scope.snapshots.arr, {id: ui.item.attr('data-uid')});
            //      // snap.isActive = true;
            //      // $scope.rightPanels.toggleSnapDetail(true);
            //      // $scope.snapshots.currentSnap = snap;
            //      // $scope.snapshots.deleteConfirm = true;
            //      // $scope.$apply();

            //  } else {
                    //update project with new sequence
                var newArr = [];
                $snapsScroller.find('li').each(function() {
                    newArr.push(_.find($scope.snapshots.arr, {id: $(this).attr('data-uid')}));
                });
                $scope.snapshots.arr.length = 0;
                _.each(newArr, function(snap) {
                    $scope.snapshots.arr.push(snap);
                });
                $scope.snapshots.updateSequence();
                // }
            }
        });
        $snapsHolder.disableSelection();
    }

}
]);