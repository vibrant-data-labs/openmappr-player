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
    .controller('InfoPanelCtrl', ['$scope', '$rootScope', 'graphSelectionService', 'dataGraph', 'networkService', 'FilterPanelService', 'AttrInfoService', 'projFactory', 'playerFactory', 'BROADCAST_MESSAGES', '$injector', '$uibModal', 'uiService', 'infoPanelService', 'selectService', 'subsetService', 'renderGraphfactory', 'snapshotService',
        function ($scope, $rootScope, graphSelectionService, dataGraph, networkService, FilterPanelService, AttrInfoService, projFactory, playerFactory, BROADCAST_MESSAGES, $injector, $uibModal, uiService, infoPanelService, selectService, subsetService, renderGraphfactory, snapshotService) {
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
            $rootScope.exportData = exportCsvDataFromPlayer;

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
                if (currNw && currNw.networkInfo) {
                    $scope.generalInfo.hideArchsBridgers = !!currNw.networkInfo.hideArchsBridgers;
                } else {
                    $scope.generalInfo.hideArchsBridgers = false;
                }
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
                    if (selNodes.length == 1) {
                        selectService.singleNode = selNode;
                    }
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
            }

            function exportSelectionFromPlayer(type) {
                var snapshot = snapshotService.getCurrentSnapshot();
                var filename = (snapshot ? snapshot.snapName : 'output') + '.svg';

                // In geo region mode, export the map with regions instead of sigma graph
                var isGeoRegionMode = snapshot && snapshot.layout.plotType === 'geo'
                    && $rootScope.geo && $rootScope.geo.level !== 'node';

                if (isGeoRegionMode) {
                    exportGeoAsSVG(filename);
                    return;
                }

                var sigObj_1 = renderGraphfactory.sig();
                sigObj_1.toSVG({ download: true, filename: filename, size: window.innerWidth });
            }

            function captureBaseTiles(map) {
                var container = map.getContainer();
                var containerRect = container.getBoundingClientRect();
                var width = Math.round(containerRect.width);
                var height = Math.round(containerRect.height);

                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');

                // Draw only base map tile images (not vector grid canvases)
                var tilePane = container.querySelector('.leaflet-tile-pane');
                if (!tilePane) return null;

                var imgs = tilePane.querySelectorAll('img');
                for (var i = 0; i < imgs.length; i++) {
                    var img = imgs[i];
                    if (!img.complete) continue;
                    if (img.style.visibility === 'hidden' || img.style.display === 'none') continue;

                    var tileRect = img.getBoundingClientRect();
                    try {
                        ctx.drawImage(img,
                            tileRect.left - containerRect.left,
                            tileRect.top - containerRect.top,
                            tileRect.width, tileRect.height);
                    } catch (e) {
                        console.warn('[geoExport] Could not draw base tile:', e);
                    }
                }

                return canvas.toDataURL('image/png');
            }

            function geoJsonToSvgPath(geometry, map) {
                var paths = [];

                function coordsToPoints(ring) {
                    return ring.map(function(coord) {
                        var pt = map.latLngToContainerPoint([coord[1], coord[0]]);
                        return pt.x + ',' + pt.y;
                    });
                }

                if (geometry.type === 'Polygon') {
                    // First ring is outer, rest are holes
                    var d = 'M' + coordsToPoints(geometry.coordinates[0]).join('L') + 'Z';
                    for (var h = 1; h < geometry.coordinates.length; h++) {
                        d += 'M' + coordsToPoints(geometry.coordinates[h]).join('L') + 'Z';
                    }
                    paths.push(d);
                } else if (geometry.type === 'MultiPolygon') {
                    for (var p = 0; p < geometry.coordinates.length; p++) {
                        var poly = geometry.coordinates[p];
                        var d = 'M' + coordsToPoints(poly[0]).join('L') + 'Z';
                        for (var h = 1; h < poly.length; h++) {
                            d += 'M' + coordsToPoints(poly[h]).join('L') + 'Z';
                        }
                        paths.push(d);
                    }
                }

                return paths;
            }

            function exportGeoAsSVG(filename) {
                var map = window.map;
                var tileGrid = window.tileGrid;
                var nodeData = window.tileNodeData;
                if (!map || !tileGrid) return;

                var container = map.getContainer();
                var containerRect = container.getBoundingClientRect();
                var width = Math.round(containerRect.width);
                var height = Math.round(containerRect.height);

                // Capture base map tiles as raster background
                var baseDataUrl = captureBaseTiles(map);

                // Build SVG
                var svgParts = [];
                svgParts.push('<?xml version="1.0" encoding="utf-8"?>');
                svgParts.push('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">');
                svgParts.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
                    'width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">');

                // Base map raster layer
                if (baseDataUrl) {
                    svgParts.push('<image width="' + width + '" height="' + height + '" href="' + baseDataUrl + '"/>');
                }

                // Region polygons as vector paths
                if (tileGrid._geoFeatures && nodeData) {
                    svgParts.push('<g id="regions" fill-rule="evenodd">');

                    var osmIds = Object.keys(tileGrid._geoFeatures);
                    for (var i = 0; i < osmIds.length; i++) {
                        var osmId = osmIds[i];
                        if (!(osmId in nodeData)) continue;

                        var color = nodeData[osmId].color;
                        var fragments = tileGrid._geoFeatures[osmId];

                        // Combine all tile fragments for this region into one path
                        var allPathData = [];
                        for (var f = 0; f < fragments.length; f++) {
                            var pathSegments = geoJsonToSvgPath(fragments[f].geometry, map);
                            allPathData = allPathData.concat(pathSegments);
                        }

                        if (allPathData.length > 0) {
                            svgParts.push('<path d="' + allPathData.join(' ') + '" fill="' + color + '" fill-opacity="0.8" stroke="' + color + '" stroke-opacity="0.8" stroke-width="1" stroke-linejoin="round"/>');
                        }
                    }

                    svgParts.push('</g>');
                }

                svgParts.push('</svg>');

                var output = svgParts.join('\n');

                // Trigger download
                var blob = new Blob([output], { type: 'image/svg+xml;charset=utf-8' });
                var anchor = document.createElement('a');
                anchor.setAttribute('href', URL.createObjectURL(blob));
                anchor.setAttribute('download', filename);
                var event = document.createEvent('MouseEvent');
                event.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                anchor.dispatchEvent(event);
                URL.revokeObjectURL(blob);
            }

            function exportCsvDataFromPlayer(type) {
                var nodes = [];
                // var links = [];
                if (type == 'all') {
                    nodes = dataGraph.getAllNodes();
                    // links = dataGraph.getAllEdges();
                } else if (type == 'select') {
                    nodes = selectService.getSelectedNodes();
                    // links = dataGraph.getEdgesByNodes(nodes);
                } else if (type == 'subset') {
                    nodes = subsetService.subsetNodes;
                    // links = dataGraph.getEdgesByNodes(nodes);
                }

                const ts = new Date().toISOString().split('T')[0];
                var fileName = `${document.title} - ${ts}`;

                try {
                    const csvData = [];
                    var rowHeader = []
                    var allProperties = {};

                    _.forEach(nodes, function (item) { // construct a map of all possible parameters
                        if (item.id) {
                            allProperties.id = '';
                        }
                        for (var key in item.attr) {
                            allProperties[key] = '';
                        }
                    });

                    for (var headerKey in allProperties) { // create first line "header" of CSV file
                        rowHeader.push(headerKey);
                    }

                    csvData.push(rowHeader);

                    nodes.forEach(function (item) {
                        const rowItem = [];
                        rowItem.push(item.id);
                        const resultMap = {};

                        for (let nodeAttrKey in item.attr) { // get parameters from item attribute
                            if (Array.isArray(item.attr[nodeAttrKey])) {
                                resultMap[nodeAttrKey] = item.attr[nodeAttrKey].join(', ');
                                continue;
                            }


                            resultMap[nodeAttrKey] = item.attr[nodeAttrKey];
                        }

                        for (let key in allProperties) { // prepare result but use all possible parameters instead of item parameters
                            if (key == 'id') {
                                continue;
                            }
                            if (resultMap[key] == 0) {
                                rowItem.push(0);
                                continue;
                            }

                            rowItem.push(resultMap[key] ? resultMap[key] : '');
                        }

                        csvData.push(rowItem);
                    });

                    const csvContent = csv_stringify_sync.stringify(csvData);
                    window.saveAs(new Blob([csvContent], { type: "text/plain;charset=utf-8" }), fileName + ".csv");
                } catch (e) {
                    console.warn(e);
                    throw e;
                }
            }

            function getLocalDecimalSeparator() {
                var n = 1.1;
                return n.toLocaleString().substring(1, 2);
            }

            function getLocalListSeparator() {
                if (getLocalDecimalSeparator() == ',') {
                    return ';';
                }
                return ',';
            }

            function isNumeric(str) {
                if (typeof str != "string") return false // we only process strings!  
                return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
                    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
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
