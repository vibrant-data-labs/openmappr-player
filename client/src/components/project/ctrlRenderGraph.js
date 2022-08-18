//RenderCtrl sets up dataGraph and the current Snapshot
// if an attribute is changed, loads the new graph!
angular.module('common')
    .controller('renderGraphCtrl', ['$scope', '$rootScope', '$routeParams', '$q', '$timeout', '$location', 'leafletData', 'dataService', 'networkService', 'dataGraph', 'AttrInfoService', 'layoutService', 'snapshotService', 'orgFactory', 'projFactory', 'playerFactory', 'graphSelectionService', 'zoomService', 'SelectorService', 'BROADCAST_MESSAGES', 'selectService', 'subsetService',
        function ($scope, $rootScope, $routeParams, $q, $timeout, $location, leafletData, dataService, networkService, dataGraph, AttrInfoService, layoutService, snapshotService, orgFactory, projFactory, playerFactory, graphSelectionService, zoomService, SelectorService, BROADCAST_MESSAGES, selectService, subsetService) {
            'use strict';


            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = '[ctrlRenderGraph: ] ';

            var playerLoadInfo = {
                hasCustomData: false, // Has any custom data to load
                hasUserInfo: false, //Has user info - name, pic,
                showExtUserOverlay: false, //whether to show ext user overlay
                userName: '',
                userPicUrl: '',
                userDistrVals: [],
                snap: {}, // which snap to load
                shouldZoom: false,
                custerName: '',
                nodeIdsToSelect: [],    // Node Ids specified in Url as connections & clusters
                initialNodeIds: []  //node ids if showing extuser but also want to select initial node ids and minimize user overaly
            };

            var fullReset = false;
            var disableFullReset = _.debounce(function () {
                fullReset = false;
            }, 2000);

            /*************************************
    ********* Scope Bindings *************
    **************************************/
            /**
    *  Scope data
    */
            $scope.zoomInfo = {
                zoomIn: _.noop,
                zoomOut: _.noop
            };
            $scope.ui = {
                activeFilterCount: 0,
                subsetEnabled: false
            };
            $scope.showSearch = false;
            $scope.rawDataId = null;
            $scope.plotType = 'original';
            $scope.enableUndo = false;
            $scope.enableRedo = false;
            $scope.isShowShare = false;
            $scope.host = window.location.host;

            $scope.operations = {
                list: [],
                opened: true,
                isFirstOpened: true,
                togglePanel: function () {
                    if ($scope.operations.list.length > 1) {
                        $scope.operations.opened = !$scope.operations.opened;
                    }
                },
                toggleOperation: function (operation) {
                    $scope.operations.isFirstOpened = false;
                    operation.isOpened = !operation.isOpened;
                },
                last: function () {
                    if ($scope.operations.list.length) {
                        return $scope.operations.list[$scope.operations.list.length - 1];
                    }

                    return {};
                },
                isNumeric: function (attrInfo) {
                    const { attr } = attrInfo;
                    return attr.attrType == 'integer' ||
                        attr.attrType == 'float' ||
                        attr.attrType == 'boolean' ||
                        attr.attrType == 'year' ||
                        attr.attrType == 'timestamp';
                },
                formatTime(val) {
                    return moment(val * 1000).format('DD-MMM-YYYY');
                },
                filterArray: function (operation) {
                    if (!operation || !operation.filters) return [];
                    if (operation.filterArray) return operation.filterArray;
                    var result = [];

                    var keys = Object.keys(operation.filters);
                    keys.forEach(function (key) {
                        var filter = operation.filters[key];
                        if (!filter.isEnabled || !filter.selector) return;
                        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(filter.attrId);

                        var selector = filter.selector.stringify();

                        if ($scope.operations.isNumeric(attrInfo) && Array.isArray(selector)) {
                            selector.sort(function (a, b) {
                                return a.values[0] < b.values[0] ? -1 : 1;
                            });
                            selector = _.reduce(selector, function (acc, cv) {
                                if (acc.length == 0) {
                                    acc.push(cv);
                                    return acc;
                                }

                                var prevItem = acc[acc.length - 1];
                                var isEqual = function (a, b) {
                                    if (attrInfo.attr.attrType == 'year') {
                                        return _.first(b) == _.last(a);
                                    }

                                    if (attrInfo.attr.attrType == 'timestamp') {
                                        var { bins } = attrInfo;
                                        var binStart = bins.findIndex(function (x) { return x.max == _.last(a) });
                                        if (binStart > -1 && binStart < bins.length - 1) {
                                            var binEnd = bins[binStart + 1];
                                            if (binEnd.min == _.first(b)) return true;
                                        }

                                        return _.first(b) - _.last(a) < 86400; // difference less than day
                                    }

                                    return _.first(b) - _.last(a) < 0.009; // difference less than rounded value
                                };

                                if (isEqual(prevItem.values, cv.values)) {
                                    if (prevItem.values.length == 2) {
                                        prevItem.values[1] = _.last(cv.values);
                                    } else {
                                        prevItem.values.push(_.last(cv.values));
                                    }
                                } else {
                                    acc.push(cv);
                                }

                                return acc;
                            }, []);
                            _.each(selector, function (val) {
                                // year
                                if (val.values.length == 2 && val.values[0] === val.values[1]) {
                                    val.values = [val.values[0]]
                                    val.description = 'eq';
                                }

                                // numeric
                                if (val.values.length == 2) {
                                    if (val.values[0] == attrInfo.stats.min) {
                                        val.values = [val.values[1]];
                                        val.description = 'lt';
                                    }

                                    if (val.values[1] == attrInfo.stats.max) {
                                        val.values = [val.values[0]];
                                        val.description = 'ht';
                                    }
                                }
                            });
                        }

                        result.push({
                            attrInfo: attrInfo,
                            values: selector
                        });
                    });

                    operation.filterArray = result;
                    console.log("FILTERARRAY", result);
                    return operation.filterArray;
                }
            };

            $scope.value = {
                text: ''
            };
            /**
    * Scope methods
    */
            $scope.zoomInfo.zoomOut = zoomService.zoomOut;
            $scope.zoomInfo.zoomIn = zoomService.zoomIn;
            $scope.zoomInfo.zoomExtents = zoomExtents;
            $scope.zoomInfo.zoomReset = zoomService.zoomReset;
            $scope.switchSnapshot = switchSnapshot; //A function for children to switch between snapshots and networks

            $scope.selectedSearchValue = [];
            $scope.selectedSearchValueStr = null;
            $scope.isShowBreadcrumbs = true;

            $scope.selectedSnapshot = null;
            // #####
            $scope.isSnapshotSelectorOpen = false;

            $scope.getSelectedSnapshotTitle = function () {
                const snap = snapshotService.getCurrentSnapshot();
                if (snap) {
                    return snap.snapName;
                }

                return '';
            }

            $scope.openRightPanel = function() {
                $scope.$broadcast(BROADCAST_MESSAGES.ip.changed);
            }

            $scope.openProjectInfo = function () {
                selectService.unselect();
                $scope.$broadcast(BROADCAST_MESSAGES.ip.changed, true);
            }

            $scope.getSelectedSnapshot = function () {
                var currentSnapshot = snapshotService.getCurrentSnapshot();
                var title = currentSnapshot.snapName;
                var subtitle = currentSnapshot.subtitle;
                var desc = currentSnapshot.descr;

                return `<h3>${title}</h3>${subtitle ? '<h6>' + subtitle + '</h6>' : ''}${desc}`;
            }
            $scope.getCurrentProjectTitle = function () {
                return _.get($scope, '$parent.player.player.settings.projectLogoTitle') || '';
            }

            $scope.getCurrentLogoImage = function () {
                return _.get($scope, '$parent.player.player.settings.projectLogoImageUrl') || null;
            }

            $scope.isShowMoreBtn = true;

            $scope.toggleSharePanel = function () {
                $scope.isShowShare = !$scope.isShowShare;

                $scope.facebookLink = _.get($scope, '$parent.player.player.settings.socials.facebook')
                $scope.linkedinLink = _.get($scope, '$parent.player.player.settings.socials.linkedin')
                $scope.twitterLink = _.get($scope, '$parent.player.player.settings.socials.twitter')

                $scope.isShareLinks = $scope.facebookLink || $scope.linkedinLink || $scope.twitterLink;
            }

            
            $scope.copyClipboard = function () {
                navigator.clipboard.writeText($scope.host);
                $scope.isShowShare = false;
            }

            $scope.getSnapshots = function() {
                return $scope.player.snapshots.filter(x => x.isEnabled);
            }

            $scope.formatSnapshotTitle = function(snap) {
                if (snap.snapName.length > 72) {
                    return snap.snapName.substring(0, 72) + '...';
                }
                
                return snap.snapName;
            }

            $scope.formatSnapshotTooltip = function(snap) {
                if (snap.snapName.length <= 72) {
                    return '';
                }

                return snap.snapName;
            }

            $scope.toggleSnapshotSelector = function () {
                if (!$scope.isSnapshotSelectorOpen) {
                    setTimeout(() => {
                        let scroll = 0;
                        const elem = document.querySelector('.extra-container__content');
                        
                        if (elem) {
                            for (const item of elem.children) {
                                if (!$scope.selectedSnapshot || item.id === $scope.selectedSnapshot.snapName) {
                                    break;
                                }
                                scroll += item.offsetHeight;
                            }

                            elem.scroll({top: scroll, behavior: 'smooth'});
                        }
                    }, 100)
                }

                $scope.isSnapshotSelectorOpen = !$scope.isSnapshotSelectorOpen;
            }

            $scope.selectSnapshot = function(snap) {
                selectService.unselect();

                _.each($scope.player.snapshots, function(el) {
                    el.isCurrentSnap = false;
                });
                snap.isCurrentSnap = true;
                $scope.selectedSnapshot = snap;

                $scope.switchSnapshot(snap.id);
                $scope.isSnapshotSelectorOpen = !$scope.isSnapshotSelectorOpen;
            }

            $scope.openInfoPage = function () {
                $scope.$broadcast(BROADCAST_MESSAGES.ip.nodeBrowser.show);
            }
            // #####

            $scope.updatePlotType = function (plotType) {
                $scope.plotType = plotType || 'original';
            };

            $scope.resetFilters = function () {
                subsetService.unsubset();
                selectService.unselect();

                delete $scope.operations.list;
                $scope.operations.list = [];
                updateOperation('init');
                $scope.operations.opened = true;
                $scope.operations.isFirstOpened = true;
            };

            $scope.resetOperation = function () {
                var prevOperation = removeOperation();
                var operation = $scope.operations.last();

                if (prevOperation.type == 'subset') {
                    subsetService.unsubset();
                    if (operation.type == 'subset') {
                        // in this case the all previous operations are subset also
                        var operations = _.clone($scope.operations.list);
                        $scope.operations.list = $scope.operations.list.splice(0, 1);
                        var chain = Promise.resolve();
                        _.each(operations, function (op) {
                            if (op.type == 'init') return;
                            chain = chain.then(function () {
                                selectService.applyFilters(op.filters, op.searchText, op.searchAttr, $scope)
                            })
                                .then(function () {
                                    subsetService.subset();
                                });
                        });

                        operations = null;
                    }
                } else if (prevOperation.type == 'select') {
                    selectService.unselect();
                }
            }

            $scope.subsetFilters = function subsetFilters() {
                if ($scope.panelUI.currentPanelOpen === 'filter') {
                    subsetService.subset();
                } else {
                    $scope.panelUI.openPanel('filter');

                    setTimeout(() => {
                        subsetService.subset();
                    }, 500)
                }
            };

            $scope.undoFilters = function undoFilters() {
                $scope.$broadcast(BROADCAST_MESSAGES.fp.filter.undo);
            };

            $scope.redoFilters = function redoFilters() {
                $scope.$broadcast(BROADCAST_MESSAGES.fp.filter.redo);
            };

            $scope.searchToggle = function searchToggle() {
                $scope.showSearch = !$scope.showSearch;
            }

            $scope.toggleSearchDropdown = function toggleSearchDropdown() {
                $scope.searchDropdownVisible = !$scope.searchDropdownVisible;
            }

            $scope.isAttrSelected = function(attr) {
                return _.some($scope.selectedSearchValue, 'id', attr.id);
            }

            $scope.toggleSearchItem = function toggleSearchItem(value) {
                if (value) {
                    var item = _.find($scope.selectedSearchValue, 'id', value.id);
                    if (!item) {
                        $scope.selectedSearchValue.push(value);
                    } else {
                        _.remove($scope.selectedSearchValue, 'id', value.id);
                    }
                } else {
                    $scope.selectedSearchValue = [];
                    $scope.searchDropdownVisible = false;
                }
                $scope.selectedSearchValueStr = _.map($scope.selectedSearchValue, 'title').join(', ');
            }

            $scope.collapseBreadcrumbs = function() {
                $scope.isShowBreadcrumbs = !$scope.isShowBreadcrumbs;
            }

            $scope.handleToggleSearch = function(bool) {
                if (bool) {
                    const input = document.querySelector('.node-search__input');
                    input.focus();
                } else {
                    $scope.value.text = "";
                }
                $scope.showSearch = bool;
            }


            $scope.$on(BROADCAST_MESSAGES.hss.select, function (e, data) {

                $scope.ui.activeFilterCount = data.filtersCount + (data.isSubsetted ? 1 : 0) + (data.filtersCount == 0 && data.selectionCount > 0 ? 1 : 0);
                $scope.ui.subsetEnabled = data.selectionCount > 0;

                if (data.nodes.length == 1) {
                    $scope.showSearch = false;
                }

                if (!data.nodes.length && $scope.operations.last().type == 'select') {
                    removeOperation();
                } else if ($scope.operations.last().type == 'select') {
                    $scope.operations.last().filterArray = null;
                    updateOperation('select', true, data.searchText, data.searchAttr);
                } else {
                    updateOperation('select', false, data.searchText, data.searchAttr);
                }

                $scope.isShowShare = false;
            });

            $scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function (e, data) {
                if (data.subsetCount > 0) {
                    updateOperation('subset');
                }
            })

            $scope.$on(BROADCAST_MESSAGES.sigma.clickStage, function () {
                $scope.showSearch = false;
                $scope.isShowShare = false;
            });



            /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
            //ctrlProject broadcasts a project:load event on new project load
            $scope.$on(BROADCAST_MESSAGES.project.load, function (event, data) { onProjectOrPlayerLoad(event, data); });

            //ctrlPlayer broadcasts a player:load event on new player load
            $scope.$on(BROADCAST_MESSAGES.player.load, function (event, data) { onProjectOrPlayerLoad(event, data); });

            $scope.$on(BROADCAST_MESSAGES.network.changed, onNetworkChange);

            $scope.$on(BROADCAST_MESSAGES.fp.filter.undoRedoStatus, function (evt, undoRedoStatus) {
                $scope.enableUndo = undoRedoStatus.enableUndo;
                $scope.enableRedo = undoRedoStatus.enableRedo;
            });

            $scope.$on(BROADCAST_MESSAGES.fp.filter.reset, function handleReset() {
                $scope.enableUndo = false;
                $scope.enableRedo = false;
            });




            /*************************************
    ********* Initialise *****************
    **************************************/

            /*************************************
    ********* Core Functions *************
    **************************************/

            /// ZoomReset zooms to selection , and then a full reset.
            function zoomExtents() {
                var selectedNodes = selectService.getSelectedNodes();
                if (!selectedNodes || !selectedNodes.length && selectService.singleNode) {
                    selectedNodes = [selectService.singleNode];
                }
                var subsetNodes = subsetService.subsetNodes;
                var nodes = selectedNodes && selectedNodes.length ? selectedNodes : subsetNodes;
                if (nodes && nodes.length > 0 && !fullReset) {
                    disableFullReset.cancel();
                    zoomService.zoomToNodes(nodes);
                    fullReset = true;
                    disableFullReset();
                } else {
                    zoomService.zoomReset();
                }
            }

            function updateOperation(type, replace, searchText, searchAttr) {
                switch (type) {
                    case 'init': {
                        $scope.operations.list.push({
                            type: 'init',
                            totalNodes: dataGraph.getAllNodes().length,
                        });
                        break;
                    }
                    case 'select': {
                        var selectedNodes = selectService.getSelectedNodes();
                        if (!selectedNodes.length) break;

                        var totalNodes = subsetService.currentSubset().length || dataGraph.getAllNodes().length;
                        if (replace) {
                            _.last($scope.operations.list).nodesCount = selectedNodes.length;
                            _.last($scope.operations.list).totalNodes = totalNodes;
                            // Change search params, if they are in new operation
                            if (searchText && searchAttr) {
                                _.last($scope.operations.list).searchText = searchText;
                                _.last($scope.operations.list).searchAttr = searchAttr;
                            }
                        } else {
                            var operation = {
                                type: 'select',
                                filters: _.clone(selectService.filters),
                                searchText: searchText,
                                searchAttr: searchAttr,
                                nodesCount: selectedNodes.length,
                                isOpened: $scope.operations.list.length == 1 ? true : _.last($scope.operations.list).isOpened,
                                totalNodes: totalNodes
                            };
                            $scope.operations.list.push(operation);
                        }

                        break;
                    }
                    case 'subset': {
                        // As subset occurs only on selected nodes
                        var prevOperation = removeOperation(true);
                        var prevNodesCount = prevOperation.totalNodes;
                        var prevFilters = prevOperation.filters;
                        var prevSearchText = prevOperation.searchText;
                        var prevSearchAttr = prevOperation.searchAttr;

                        var operation = {
                            type: 'subset',
                            nodesCount: subsetService.currentSubset().length,
                            filters: prevFilters,
                            searchText: prevSearchText,
                            searchAttr: prevSearchAttr,
                            isOpened: prevOperation.isOpened,
                            totalNodes: prevNodesCount
                        };
                        $scope.operations.list.push(operation);
                        break;
                    }
                    default: throw new Error("Unknown operation");
                }

                //console.log("OPERATIONS", $scope.operations.filters($scope.operations.list.length -1));
            }

            function removeOperation(preserve) {
                return $scope.operations.list.pop();
            }

            function onNetworkChange(event, eventData) {
                dataGraph.clear();
                layoutService.invalidateCurrent();
                AttrInfoService.clearRenderGraphCaches();
                $scope.updatePlotType(_.get(eventData, 'snapshot.layout.plotType', 'original'));
                var data = loadSuccess(networkService.getCurrentNetwork());
                $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.loaded, data);
                $scope.$broadcast(BROADCAST_MESSAGES.snapshot.loaded, {
                    snapshot: eventData && eventData.snapshot ? eventData.snapshot : null
                });
            }

            /**
     * This function starts the rendering loop:
     * Steps
     * - Load the snapshot
     * - load the dataset
     * - generate layout
     * - generate rendergraph
     * - broadcast event : layout.loaded
     * @param  {event}
     * @param  {version Info data} // this is stupid
     * @return {nothing}
     */
            function onProjectOrPlayerLoad(event) {
                console.group('renderGraphCtrl.onProjectOrPlayerLoad');
                dataGraph.clear();
                layoutService.invalidateCurrent();
                selectService.unselect();
                snapshotService.clear();
                var snapIdP = null;
                $scope.updatePlotType('original');

                if (event.name === BROADCAST_MESSAGES.project.load) {
                    playerFactory.clear();
                    snapIdP = projFactory.currProject().then(loadProjectSnapshot);
                } else {
                    snapIdP = playerFactory.currPlayer(true).then(loadPlayerSnapshot);
                }
                // snapshots loaded or there were no snapshots.
                var rawDataP = dataService.currDataSet().then(function (dataSet) {
                    _.each(networkService.getNetworks(), AttrInfoService.loadInfoForNetwork, AttrInfoService);
                    return dataSet;
                }).catch(function (err) {
                    console.log('Error in empty Project!', err);
                    dataGraph.clear();
                    $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.loaded, null);
                    $scope.$broadcast(BROADCAST_MESSAGES.dataGraph.empty);
                    return $q.reject(err);
                });

                $q.all({ snapId: snapIdP, rawData: rawDataP })
                    .then(function (obj) {
                        var snapId = obj.snapId;
                        var snap = snapId != null ? snapshotService.getById(snapId) : null;
                        if (snapId) {
                            $scope.updatePlotType(snap.layout.plotType);
                            var onSigma = graphSelectionService.loadFromSnapshot(snapshotService.getById(snapId));
                            snapshotService.setCurrentSnapshot(snapId);
                            loadNetworkForSnapshot(snapId);

                            var x = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function () {
                                // Build connections obj
                                checkforCustomSelections();

                                // Check if OnSigma needs to be updated for player
                                if (event.name === BROADCAST_MESSAGES.player.load) {
                                    if (playerLoadInfo.hasUserInfo) {
                                        onSigma = _.noop;
                                        console.log('playerLoadInfo: ', playerLoadInfo);
                                        $scope.$emit(BROADCAST_MESSAGES.extUserOverlay.create, playerLoadInfo);

                                        $scope.$on(BROADCAST_MESSAGES.extUserOverlay.minimized, function () {
                                            graphSelectionService.selectByIds(playerLoadInfo.initialNodeIds, 0);
                                            $scope.zoomInfo.zoomExtents();
                                        });

                                        if (playerLoadInfo.initialNodeIds) {
                                            $timeout(function () {
                                                graphSelectionService.selectByIds(playerLoadInfo.initialNodeIds, 0);
                                                $scope.zoomInfo.zoomExtents();
                                            });
                                        }

                                        $scope.$on(BROADCAST_MESSAGES.extUserOverlay.close, function (e, data) {
                                            if (data && data.distrClick) {
                                                console.log(logPrefix + 'distribution click, dont show user connections');
                                                return;
                                            }
                                            if (data && data.switchedToNeighbour) {
                                                var x = $scope.$on(BROADCAST_MESSAGES.nodeOverlay.removing, function () {
                                                    x();
                                                    graphSelectionService.selectByIds(playerLoadInfo.nodeIdsToSelect, 0);
                                                });
                                            }
                                            else {
                                                graphSelectionService.selectByIds(playerLoadInfo.nodeIdsToSelect, 0);
                                            }
                                            $scope.zoomInfo.zoomExtents();
                                        });
                                    }
                                    else if (playerLoadInfo.hasCustomData) {
                                        if (playerLoadInfo.nodeIdsToSelect.length > 0) {
                                            onSigma = function () {
                                                console.log(logPrefix + 'ignoring snap selections, loading selections specified in URL');
                                                $timeout(function () {
                                                    graphSelectionService.selectByIds(playerLoadInfo.nodeIdsToSelect, 0); //zero degree selection
                                                });
                                                if (playerLoadInfo.shouldZoom) {
                                                    setTimeout(function () {
                                                        $scope.zoomInfo.zoomExtents();
                                                    }, 300);
                                                }
                                            };
                                        }
                                    }
                                }
                                onSigma();
                                x();
                            });

                        } else {
                            loadNetworkForSnapshot(null);
                        }
                        var data = loadSuccess(networkService.getCurrentNetwork());
                        $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.loaded, data);
                        console.log('triggering snapshost laoded');
                        $rootScope.$broadcast(BROADCAST_MESSAGES.snapshot.loaded, {
                            snapshot: snap,
                        });
                        console.groupEnd();

                        updateOperation('init');
                    });
            }

            /** Switches between snapshots of the project
    * - generates layout
    * - broadcasts : layout:changed
    * - selects nodes
    */
            function switchSnapshot(snapId) {
                console.log('Switching to snapshot with id: %O', snapId);
                var snap = snapshotService.getById(snapId),
                    onSigma = _.noop;
                if (!snap) {
                    console.warn('no snapshot to load! given Id:' + snapId);
                    return;
                }
                $scope.updatePlotType(snap.layout.plotType);
                layoutService.invalidateCurrent();
                snapshotService.setCurrentSnapshot(snap.id);
                var currentNWId = networkService.getCurrentNetwork().id;
                loadNetworkForSnapshot(snap.id);
                // regen Data when new network is being loaded
                if (currentNWId !== networkService.getCurrentNetwork().id) {
                    dataGraph.clear();
                    AttrInfoService.clearRenderGraphCaches();
                    var data = loadSuccess(networkService.getCurrentNetwork());
                    $rootScope.$broadcast(BROADCAST_MESSAGES.dataGraph.loaded, data);
                }
                $scope.$broadcast(BROADCAST_MESSAGES.snapshot.changed, {
                    snapshot: snap
                });
                // select nodes when render is complete
                if (snap.processSelection) {
                    onSigma = graphSelectionService.loadFromSnapshot(snap);
                }
                var x = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function () {
                    onSigma();
                    x();
                });
            }

            function loadSuccess(network) {
                console.group('renderGraphCtrl.loadSuccess');
                console.log('Merging Loading network :%O', network);
                var frag = dataGraph.mergeAndLoadNetwork(network);
                AttrInfoService.loadInfoForNetwork(network);
                $scope.rawDataId = frag.id;

                console.groupEnd();
                return frag;
            }

            function loadNetworkForSnapshot(snapId) {
                var currSnap = snapshotService.getById(snapId);
                var nwId = currSnap && currSnap.networkId ? currSnap.networkId : null;
                if (nwId != null && networkService.exist(nwId)) {
                    console.log("Loading snapshot network: ", nwId);
                    networkService.setCurrentNetwork(nwId);
                } else {
                    var defNwId = networkService.getDefault().id;
                    console.log("Loading a default network: ", defNwId);
                    networkService.setCurrentNetwork(defNwId);
                }
            }

            ///
            /// Setup Snapshots
            ///

            /**
     * Loads snapshots for project and creates a new one if none exist.
     */
            function loadProjectSnapshot(project, snapIdToSwitch) {
                console.group('ctrlRenderGraph.loadProjectSnapshot %O', project);
                var currSnapId = null;
                return snapshotService.loadSnapshots()
                    .then(function (snaps) {
                        if (snaps.length > 0) {
                            console.log('loading existing snapshot from snapshots: %O', snaps);
                            if (snapIdToSwitch && _.contains(_.pluck(snaps, 'id'), snapIdToSwitch)) {
                                currSnapId = snapIdToSwitch;
                                console.log(currSnapId);
                            } else {
                                console.log('No snapshot Id given to load, or snapId is invalid, so loading the 1st one.');
                                currSnapId = snapshotService.getLastViewedSnapId();
                                currSnapId = _.contains(_.pluck(snaps, 'id'), currSnapId) ? currSnapId : snaps[0].id;
                            }
                            console.groupEnd();
                            return currSnapId;
                        }
                        else {
                            console.log('No snapshots to load');
                            console.groupEnd();
                            return currSnapId;
                        }
                    }).catch(function (err) {
                        console.log('ctrlRenderGraph.loadProjectSnapshot', err);
                        return $q.reject(err);
                    });

            }

            function loadPlayerSnapshot(player) {
                console.group('ctrlRenderGraph.loadPlayerSnapshots', player);
                var currSnapId = null;
                return snapshotService.loadSnapshots(true)
                    .then(function (snaps) {
                        if (snaps.length > 0) {
                            console.log('loading existing snapshot from snapshots: %O', snaps);
                            decodePlayerLoadInfo(snaps);
                            currSnapId = playerLoadInfo.snap.id;
                            console.groupEnd();
                            return currSnapId;
                        }
                        else {
                            console.log('No snapshots to load');
                            console.groupEnd();
                            return currSnapId;
                        }
                    }).catch(function (err) {
                        console.log('ctrlRenderGraph.loadPlayerSnapshot', err);
                        return $q.reject(err);
                    });

            }

            function decodePlayerLoadInfo(snaps) {
                var pathSplitArr = $location.path().split('/');
                var urlSearchObj = $location.search();
                var viewPath = _.last(pathSplitArr);

                var snapNum = urlSearchObj.snapnum;
                var userName = urlSearchObj.uname;
                var userPicUrl = urlSearchObj.upic;

                playerLoadInfo.snap = snaps[0];

                if (pathSplitArr.length > 0 && (viewPath == 'select' || viewPath == 'compare')) {
                    if (viewPath == 'select') {
                        playerLoadInfo.hasCustomData = true;
                    }
                    else if (viewPath == 'compare') {
                        playerLoadInfo.hasUserInfo = true;
                    }
                }
                else {
                    console.info(logPrefix + 'no custom data specified, loading player normally');
                    return;
                }

                /**
        *  Build playerLoadInfo object
        */

                // Finds which snapshot to load
                if (snapNum && (+snapNum) % 1 === 0) {
                    if (+snapNum <= snaps.length) {
                        playerLoadInfo.snap = snaps[+snapNum - 1];
                        console.log(logPrefix + 'Snapshot num to load found in Url');
                    }
                    else {
                        console.error(logPrefix + 'snap number greater than snaps count');
                    }
                }
                if (urlSearchObj.zoom == true || urlSearchObj.zoom == 'true') {
                    playerLoadInfo.shouldZoom = true;
                }

                playerLoadInfo.userName = userName;
                playerLoadInfo.userPicUrl = userPicUrl;

            }

            // Build node Ids list if any and updates in playerLoadInfo
            function checkforCustomSelections() {
                // Find selections
                var urlSearchObj = $location.search();
                var nodeIds = [],
                    initialNodeIds = [], //if has user info and node ids
                    clusterVal,
                    distrVals = [],
                    clusterKey = 'Cluster';

                if (playerLoadInfo.hasUserInfo) {
                    playerLoadInfo.showExtUserOverlay = true;
                    nodeIds = urlSearchObj.uconn ? urlSearchObj.uconn.split('+') : []; // Individual node Ids specified
                    clusterVal = urlSearchObj.uclust ? urlSearchObj.uclust : ''; //Cluster vals
                    distrVals = urlSearchObj.udata ? urlSearchObj.udata.split('+') : []; // Choose an appropriate separator
                    //node ids and/or cluster ids to select initially
                    if (urlSearchObj.nids) {
                        initialNodeIds = urlSearchObj.nids ? urlSearchObj.nids.split('+') : []; // Individual node Ids specified
                        var clusterIds = urlSearchObj.cids ? urlSearchObj.cids.split('+') : []; //Cluster vals

                        _.each(clusterIds, function (cid) {
                            var selector = SelectorService.newSelector();
                            selector.ofCluster(clusterKey, cid, true); //Need to confirm the cluster attrib name
                            selector.selectfromDataGraph();
                            if (_.isArray(selector.nodeIds)) {
                                initialNodeIds = initialNodeIds.concat(selector.nodeIds);
                            }
                        });

                        playerLoadInfo.showExtUserOverlay = false;
                        playerLoadInfo.initialNodeIds = initialNodeIds;
                    }
                    // var nwAttrIds = _.map(networkService.getCurrentNetwork().nodeAttrDescriptors, 'id');
                    // var clustersIdx = nwAttrIds.indexOf('Cluster');
                    // var clusterKey = 'Cluster';
                    playerLoadInfo.clusterVal = clusterVal;
                    playerLoadInfo.userDistrVals = distrVals;
                }
                else if (playerLoadInfo.hasCustomData) {
                    nodeIds = urlSearchObj.nids ? urlSearchObj.nids.split('+') : []; // Individual node Ids specified
                    clusterIds = urlSearchObj.cids ? urlSearchObj.cids.split('+') : []; //Cluster vals

                    _.each(clusterIds, function (cid) {
                        var selector = SelectorService.newSelector();
                        selector.ofCluster(clusterKey, cid, true); //Need to confirm the cluster attrib name
                        selector.selectfromDataGraph();
                        if (_.isArray(selector.nodeIds)) {
                            nodeIds = nodeIds.concat(selector.nodeIds);
                        }
                    });

                }

                console.log(logPrefix + 'Node IDs list from selections found in URL: ', nodeIds);
                playerLoadInfo.nodeIdsToSelect = nodeIds;
                return nodeIds;
            }

        }
    ]);
