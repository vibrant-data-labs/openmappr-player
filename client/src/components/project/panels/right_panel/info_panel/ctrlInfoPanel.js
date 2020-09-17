/**
* Info Panel
 - InfoPanelCtrl is always active(Should be as light as possible)
 - Listens to graph interactions and updates panel header
 - Provides other utilites such as creating networks from selections, open data modal etc. via header

    Includes following componenets:
    - Network info(sel === 0)(initializes when no selection)
        - nw info + archs/bridgers
    - Selection Info(sel > 0)(initializes when infoPanel is open)
        - Node browser(1 node selection) + node attrs info
        - NodesList(>1 nodes selection) + groups info
        - Cluster Browser(all nodes of a cluster selected)
            -- NodesList
            -- NeighborClusters
*/
angular.module('common')
    .controller('InfoPanelCtrl', ['$scope', '$rootScope', 'graphSelectionService', 'dataGraph', 'networkService', 'FilterPanelService', 'AttrInfoService', 'projFactory', 'playerFactory', 'BROADCAST_MESSAGES', '$injector', '$uibModal', 'uiService', 'infoPanelService', 'selectService', 'subsetService',
        function ($scope, $rootScope, graphSelectionService, dataGraph, networkService, FilterPanelService, AttrInfoService, projFactory, playerFactory, BROADCAST_MESSAGES, $injector, $uibModal, uiService, infoPanelService, selectService, subsetService) {
            'use strict';

            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = '[ctrlInfoPanel: ] ';
            var selPersists = false;



            /*************************************
    ********* Scope Bindings *************
    **************************************/
            /**
    *  Scope data
    */

            $scope.ui = {
                graphInteracted: false,
                showAllAttrs: false,
                infoTitle: 'INFO',
                showInfoAttrs: $scope.mapprSettings.nodeFocusShow ? false : true,
                editNodesTitle: false,
                showSelectionSets: false,
                networkName: 'Network',
                interactionType: null,
                graphHover: null //If node(s) hovered, was hover triggered from graph?
            };

            $scope.generalInfo = {
                totalNodesCount: 0,
                nwAttrs: [],
                hideArchsBridgers: false
            };

            $scope.selInfo = {
                selNodesCount: 0,
                selPerc: 0,
                clusterVal: null,
                singleNodeInfo: {}
            };

            // Node groups selection info
            $scope.selGroupInfo = {
                group: '',
                nodes: [],
                selNodeIdx: 0
            };

            $scope.selectedGroup;

            /**
    * Scope methods
    */
            $scope.addNeighborsToSelection = addNeighborsToSelection;

            $scope.exportSelection = $rootScope.MAPP_EDITOR_OPEN ? exportSelectionFromApp : exportSelectionFromPlayer;
            $rootScope.exportSelection = $scope.exportSelection;

            $scope.hideDropdowns = function () {
                //hack to close dropdown
                $('.uib-dropdown-menu').css({ display: 'none' });
            };


            $scope.clearSelections = function () {
                graphSelectionService.clearSelections(true);
                $rootScope.$broadcast(BROADCAST_MESSAGES.cleanStage);
                $scope.$broadcast(BROADCAST_MESSAGES.renderGraph.changed);
                $scope.zoomInfo.zoomExtents();
                $scope.cancelOverlay(true);
                $scope.selectedGroup = undefined;
            };


            /*************************************
    ****** Event Listeners/Watches *******
    **************************************/
            $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, initialise);
            $scope.$on(BROADCAST_MESSAGES.renderGraph.changed, initialise);
            $scope.$on(BROADCAST_MESSAGES.network.updated, initialise);

            $scope.$on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, function () {
                refreshSelectionInfo(graphSelectionService.getSelectedNodes());
            });

            $scope.$on(BROADCAST_MESSAGES.overNodes, function (e, data) {
                if (selPersists) {
                    return console.warn(logPrefix + 'Selection in place, not refreshing info');
                }
                $scope.ui.interactionType = 'hover';
                $scope.ui.graphHover = data && data.graphHover != null ? data.graphHover : true;
                $scope.ui.graphInteracted = true;
                refreshSelectionInfo(data.nodes, data.neighbours);
            });

            $scope.$on(BROADCAST_MESSAGES.outNodes, function () {
                if (selPersists) {
                    return console.warn(logPrefix + 'Selection in place, not refreshing info');
                }
                $scope.ui.graphInteracted = false;
                refreshSelectionInfo([]);
            });

            $scope.$on(BROADCAST_MESSAGES.rightPanelExited, function () {
                if (selPersists) {
                    return console.warn(logPrefix + 'Selection in place, not refreshing info');
                }
                $scope.ui.graphInteracted = false;
                refreshSelectionInfo([]);
            });

            $scope.$on(BROADCAST_MESSAGES.selectNodes, function (e, data) {
                if (data.nodes.length > 0) {
                    selPersists = true;
                    $scope.ui.graphInteracted = true;
                }
                $scope.ui.interactionType = 'select';
                refreshSelectionInfo(data.nodes);
            });

            $scope.$on(BROADCAST_MESSAGES.selectStage, function () {
                selPersists = false;
                $scope.ui.graphInteracted = false;
                refreshSelectionInfo([]);
            });

            $scope.$on(BROADCAST_MESSAGES.fp.currentSelection.changed, function (e, data) {
                refreshSelectionInfo(data.nodes);
            });

            $scope.$on(BROADCAST_MESSAGES.hss.select, function (e, data) {
                refreshSelectionInfo(data.nodes);
            });

            $scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function (e, data) {
                refreshSelectionInfo(data.nodes);
            });

            $scope.$on(BROADCAST_MESSAGES.attr.typeChanged, function (e, modifiedAttr) {
                var changedAttr = _.find($scope.nodeInfoAttrs, 'id', modifiedAttr.id);
                if (!changedAttr) {
                    console.warn(logPrefix + 'type changed for not an info attr, ignoring info panel update');
                    return;
                }
                changedAttr.attrType = modifiedAttr.attrType;
                changedAttr.showRenderer = AttrInfoService.shouldRendererShowforSN(changedAttr.attrType, changedAttr.renderType);
            });

            $scope.$on(BROADCAST_MESSAGES.nodeOverlay.creating, function () {
                // $scope.panelUI.openPanel('filter');
            });

            $scope.$on(BROADCAST_MESSAGES.layout.attrClicked, function (event, data) {
                var infoObj = AttrInfoService.getNodeAttrInfoForRG();
                var attr = data.attr;
                if (!AttrInfoService.isDistrAttr(attr, infoObj.getForId(attr.id))) {
                    var ele = angular.element(document.getElementById('infoattr-' + attr.id.replace(/ /g, '_')));
                    var scrEle = angular.element(document.getElementById('info-panel-scroll'));
                    if (scrEle && _.get(ele, 'length', 0) > 0) {
                        scrEle.scrollToElementAnimated(ele);
                    }
                }
            });



            /*************************************
    ********* Initialise *****************
    **************************************/
            if (dataGraph.getRawDataUnsafe() || _.keys($scope.mapprSettings).length > 0) {
                initialise();
            }

            /**
    * // App specific controller stuff
    */
            if ($rootScope.MAPP_EDITOR_OPEN) {
                var SelectionSetService = $injector.get('SelectionSetService');
                $scope.ui.showSelectionSets = true;
                $scope.selectionSetVMs = SelectionSetService.getSelectionVMs();
                $scope.invertSelection = function () {
                    var currSelNodeIds = _.map(graphSelectionService.getSelectedNodes(), 'id');
                    var allNodeIds = _.map(dataGraph.getAllNodes(), 'id');
                    var invertedNodeIds = _.difference(allNodeIds, currSelNodeIds);
                    graphSelectionService.selectByIds(invertedNodeIds, 0);
                    FilterPanelService.rememberSelection(false);
                };

                $scope.createNewSelection = function () {
                    console.log(logPrefix + 'adding a new selection');
                    var newSelVM = SelectionSetService.addNewSelection(false);
                    newSelVM.create();
                };

                $scope.toggleNodeOverlay = function () {
                    if (!$scope.mapprSettings) throw new Error('mapprSettings not found');
                    $scope.mapprSettings.nodeFocusShow = !$scope.mapprSettings.nodeFocusShow;
                    $scope.ui.showInfoAttrs = $scope.mapprSettings.nodeFocusShow ? false : true;
                    console.log(logPrefix + 'node overlay toggled');
                    //show overlay
                    if ($scope.mapprSettings.nodeFocusShow) {
                        graphSelectionService.selectByIds([$scope.selInfo.singleNodeInfo.id]);
                    }
                    else {
                        // Close overlay if open
                        $rootScope.$broadcast(BROADCAST_MESSAGES.nodeOverlay.remove);
                    }
                };

            }



            /*************************************
    ********* Core Functions *************
    **************************************/

            function addNeighborsToSelection() {
                var nids = _.pluck(graphSelectionService.getSelectedNodeNeighbours(), 'id');
                graphSelectionService.selectByIds(nids, 0);
                FilterPanelService.rememberSelection(false);
            }

            function initialise() {
                $scope.generalInfo.totalNodesCount = dataGraph.getAllNodes().length;
                var currNw = networkService.getCurrentNetwork();
                $scope.generalInfo.nwAttrs = dataGraph.getNodeAttrTitlesForIds(networkService.getNetworkAttrs(currNw.id));
                $scope.generalInfo.hideArchsBridgers = !!currNw.networkInfo.hideArchsBridgers;
                var selNodes = graphSelectionService.getSelectedNodes();
                refreshSelectionInfo(selNodes);
            }

            function refreshSelectionInfo(selNodes) {
                var currNw = networkService.getCurrentNetwork();
                var panelMode = infoPanelService.getPanelMode(selNodes, $scope.mapprSettings.nodeColorAttr);
                resetSelectionInfo();
                $scope.selInfo.selNodesCount = selNodes.length;
                $scope.selInfo.selPerc = (($scope.selInfo.selNodesCount * 100) / $scope.generalInfo.totalNodesCount).toFixed(0);

                if (panelMode == 'network') {
                    $scope.ui.graphInteracted = false;
                    $scope.ui.infoTitle = 'Network';
                    $scope.ui.networkName = currNw.name;
                }
                else if (panelMode == 'node') {
                    $scope.ui.infoTitle = 'NODE';
                    var labelAttr = $scope.mapprSettings.labelAttr || 'DataPointLabel';
                    var selNode = selNodes[0];
                    $scope.selInfo.singleNodeInfo.label = selNode.attr[labelAttr];
                    $scope.selInfo.singleNodeInfo.id = selNode.id;
                    $scope.selInfo.clusterVal = selNode.attr.Cluster || '';
                    $scope.selInfo.colorStr = selNode.colorStr;
                    console.log('sel node: ', selNode);
                    console.log('sel info: ', $scope.selInfo);
                }
                else if (panelMode == 'selection') {
                    var clusterVal;
                    $scope.ui.infoTitle = 'SELECTION';
                }
                else if (panelMode == 'cluster') {
                    clusterVal = networkService.getSelectionClusterVal(selNodes, $scope.mapprSettings.nodeColorAttr);
                    $scope.selInfo.clusterVal = clusterVal;
                    $scope.selInfo.colorStr = selNodes[0].colorStr;
                    $scope.ui.infoTitle = 'CLUSTER';
                }

                // Hack
                if (!$scope.$$phase && !$rootScope.$$phase) {
                    $scope.$apply();
                }
            }

            function resetSelectionInfo() {
                $scope.ui.showInfoAttrs = $scope.mapprSettings.nodeFocusShow ? false : true;

                $scope.selInfo = {
                    selNodesCount: 0,
                    selPerc: 0,
                    clusterVal: null,
                    singleNodeInfo: {}
                };
            }

            function exportSelectionFromApp(downloadSelection, downloadNeighbours) {
                var currProject = projFactory.currProjectUnsafe();
                if (!currProject) throw new Error('No project');
                var currSelection = graphSelectionService.getSelectedNodesLinksIds(downloadNeighbours);
                var currentNetwork = networkService.getCurrentNetwork();
                var fileNamePrefix = $scope.selectionHeading
                    ? currentNetwork.name + ' - ' + $scope.selectionHeading
                    : null;

                var postObj = {
                    networkIds: [currentNetwork.id],
                    downloadFormat: 'xlsx',
                    fileNamePrefix: fileNamePrefix
                };

                if (downloadSelection) {
                    postObj.selectionData = {
                        nodeIds: currSelection.nodeIds,
                        linkIds: currSelection.linkIds
                    };
                }
                projFactory.downloadNetworksData(currProject.org.ref, currProject._id, postObj)
                    .then(function (result) {
                        _export(result, currProject.projName);
                    })
                    .catch(function (err) {
                        console.error(err);
                        uiService.logError('Some error occured while downloading, try again later!');
                    });
            }

            function exportSelectionFromPlayer(type) {
                var nodes = [];
                var links = [];
                if (type == 'all') {
                    nodes = dataGraph.getAllNodes();
                    links = dataGraph.getAllEdges();
                } else if (type == 'select') {
                    nodes = selectService.getSelectedNodes();
                    links = dataGraph.getEdgesByNodes(nodes);
                } else if (type == 'subset') {
                    nodes = subsetService.subsetNodes;
                    links = dataGraph.getEdgesByNodes(nodes);
                }

                var currentNetwork = networkService.getCurrentNetwork();
                var fileName = (function () {
                    var div = document.createElement("div");
                    div.innerHTML = $scope.headerTitle; // In player's CtrlApp. Is html string
                    return div.textContent || div.innerText || "Mappr";
                }());

                var postObj = {
                    networkId: currentNetwork.id,
                    downloadFormat: 'xlsx',
                    fileNamePrefix: type
                };

                postObj.selectionData = {
                    nodeIds: _.pluck(nodes, 'id'),
                    linkIds: _.pluck(links, 'id')
                };

                playerFactory.currPlayer()
                    .then(function (player) {
                        playerFactory.downloadSelection(player._id, postObj, function (result) {
                            _export(result, fileName);
                        });
                    });
            }

            function _export(data, fileName) {
                window.saveAs(new Blob([s2ab(data)], { type: "application/octet-stream" }), fileName + ".xlsx");

                function s2ab(s) {
                    var buf = new window.ArrayBuffer(s.length);
                    var view = new window.Uint8Array(buf);
                    for (var i = 0; i != s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
                    return buf;
                }
            }

        }
    ]);
