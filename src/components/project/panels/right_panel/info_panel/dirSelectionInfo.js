/**
* Selection Info panel
* Main component for when there's a selection(1 node || multiple nodes || cluster selection)
* Gets initialized when the info panel is open(i.e ng-if="info panel is open")
* Gets displayed in UI when there's a selection(i.e. ng-show="selection > 0")
*/


angular.module('common')
    .directive('dirSelectionInfo', ['dataGraph', '$rootScope', 'graphSelectionService', 'infoPanelService', 'AttrInfoService', 'linkService', 'graphHoverService', 'BROADCAST_MESSAGES', 'selectService', 'subsetService',
        function (dataGraph, $rootScope, graphSelectionService, infoPanelService, AttrInfoService, linkService, graphHoverService, BROADCAST_MESSAGES, selectService, subsetService) {
            'use strict';

            /*************************************
    ******** Directive description *******
    **************************************/
            var dirDefn = {
                restrict: 'AE',
                scope: true,
                templateUrl: '#{player_prefix_index}/components/project/panels/right_panel/info_panel/selectionInfo.html',
                link: function (scope, element, attrs) {
                    waitUntilLoaded().then(() => {
                        const root = ReactDOM.createRoot(element[0]);
                        root.render(React.createElement(MapprComponents.SelectionInfoContainer));

                        scope.$on('$destroy', () => {
                            root.unmount();
                        });
                    });
                },
                controller: ['$scope', ControllerFn]
            };

            /*************************************
    ************ Local Data **************
    **************************************/
            var logPrefix = '[dirSelectionInfo: ] ';


            /*************************************
    ******** Controller Function *********
    **************************************/
            function ControllerFn($scope) {
                var labelAttr = $scope.mapprSettings.labelAttr || 'DataPointLabel';
                var colorByGroupSortTitle = 'Group Color';

                this.persistSelection = function () {
                    $scope.selInfo.refreshSelInfo = false;
                };

                this.replaceSelection = function () {
                    $scope.selInfo.refreshSelInfo = true;
                };

                this.openNodeBrowserInSelMode = function () {
                    $scope.selInfo.selectionBrowsing = true;
                };

                $scope.selInfo = {
                    principalNode: null, //Node shown for node browser
                    group: null, //Selected group for single node sel, group sel & for network sel
                    labelAttr: labelAttr,
                    panelMode: null, //4 modes - node, cluster, selection, network
                    genericSelNodes: [], //Selection.length > 2 and not a defined group,
                    genericSelLinks: [],
                    nodeNeighbors: [], // Neighbor nodes of selected nodes
                    interactionType: null, //select or hover
                    refreshSelInfo: _.size(graphSelectionService.getSelectedNodes()) > 0 ? false : true, //If there was a previous selection in place, don't refresh selection info(on hover mostly) unless another selection made
                    selectionBrowsing: false, //Whether browsing through mixed selection(non-cluster)
                    nodeColorAttr: null,
                    nodeColorAttrTitle: null,
                    selectedGroups: [], //Nodes groups sorted in descending order for generic selection,
                    linkInfoAttrs: [], //Informational link attrs such as 'similarity'
                    sortTypes: [], //Collection of sort attr/types(numeric attrs & Label attr) - {id: 'OriginalLabel', title: 'Name'}
                    sortInfo: { // Sort info model used to sort node lists
                        sortType: labelAttr,
                        sortOrder: 'asc'
                    }
                };

                $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, initialise);
                $scope.$on(BROADCAST_MESSAGES.renderGraph.changed, initialise);

                if (dataGraph.getRawDataUnsafe() || _.keys($scope.mapprSettings).length > 0) {
                    initialise();
                }

                $scope.$on(BROADCAST_MESSAGES.hss.select, function (e, data) {
                    if (data.selectionCount > 1 && data.nodes.length == 1) {
                        return;
                    }

                    if (data.selectionCount > 0) {
                        $scope.hasSelection = true;
                        refresh(data.nodes);
                    }
                    $scope.selInfo.interactionType = 'select';
                    if ($scope.selInfo.selectionBrowsing) {
                        $scope.selInfo.panelMode = 'node';
                        var principalNodeIdx = _.findIndex($scope.selInfo.genericSelNodes, 'id', _.get(data, 'nodes[0].id'));
                        if (principalNodeIdx < 0) { throw new Error('principal Node not found in selected nodes list'); }
                        $scope.selInfo.principalNode = $scope.selInfo.genericSelNodes[principalNodeIdx];
                        if (data.nodes.length == 1) {
                            $scope.selInfo.nodeNeighbors = getNodeNeighbors(data.nodes);
                        }
                        initialise();
                        return;
                    }

                    if (!data.selectionCount) {
                        initialise();
                        $scope.hasSelection = false;
                    }
                });

                $rootScope.$on(BROADCAST_MESSAGES.fp.filter.reset, initialise);

                function initialise() {
                    var selNodes = selectService.getSelectedNodes();
                    // CHECKPOINT
                    if (!selNodes.length) selNodes = subsetService.subsetNodes && subsetService.subsetNodes.length ? subsetService.subsetNodes : dataGraph.getAllNodes();
                    $scope.groupsAndClusters = infoPanelService.getAllNodeGroups($scope.mapprSettings.nodeColorAttr);
                }

                function refresh(selNodes, selLinks) {
                    var panelMode = $scope.selInfo.panelMode = infoPanelService.getPanelMode(selNodes, $scope.mapprSettings.nodeColorAttr);
                    $scope.selInfo.genericSelNodes = _.clone(selNodes);
                    if (!selLinks) {
                        $scope.selInfo.genericSelLinks = dataGraph.getEdgesByNodes(selNodes);
                    } else {
                        $scope.selInfo.genericSelLinks = selLinks
                    }
                    $scope.selInfo.selectedGroups = [];
                    $scope.selInfo.linkInfoAttrIds = [];
                    $scope.selInfo.nodeColorAttr = $scope.mapprSettings.nodeColorAttr;
                    var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId($scope.mapprSettings.nodeColorAttr);
                    $scope.selInfo.nodeColorAttrTitle = attrInfo.attr.title;

                    $scope.selInfo.principalNode = _.first(selNodes);
                    $scope.selInfo.group = getGroupForNode($scope.selInfo.principalNode);
                    if (selectService.singleNode) {
                        $scope.selInfo.nodeNeighbors = getNodeNeighbors([selectService.singleNode]);
                    }
                    // Divide nodes into groups and sort them by archetypes
                    $scope.selInfo.selectedGroups = getGroupsForSelection(selNodes, $scope.mapprSettings.nodeColorAttr);
                    $scope.selInfo.genericSelNodes = _($scope.selInfo.selectedGroups)
                        .map('nodes')
                        .flatten()
                        .value();
                    $scope.selInfo.sortTypes = getSortTypesForSelectedNodes($scope.selInfo.labelAttr, $scope.selInfo.nodeColorAttr, $scope.selInfo.selectedGroups);
                    sortNodesInSelection();
                }

                function getGroupsForSelection(nodes, nodeColorAttr) {
                    var groupsIdx = _.groupBy(nodes, 'attr.' + nodeColorAttr);
                    var groups = [];
                    _.each(groupsIdx, function (groupNodes, groupName) {
                        var group = {
                            name: groupName,
                            attr: nodeColorAttr,
                            nodes: _.sortBy(groupNodes, 'attr.ClusterArchetype'),
                            colorStr: groupNodes[0].colorStr,
                            nodesCount: groupNodes.length
                        };
                        groups.push(group);
                    });

                    return _.sortBy(groups, 'nodesCount').reverse();
                }

                function getGroupForNode(node) {
                    var colorByAttr = $scope.mapprSettings.nodeColorAttr || 'Cluster';
                    var clusterAttrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId(colorByAttr);
                    var nodeCluster, numericDomain;
                    if (!clusterAttrInfo.isNumeric) {
                        nodeCluster = node.attr[colorByAttr];
                        if (clusterAttrInfo.isTag && _.isArray(nodeCluster)) {
                            nodeCluster = nodeCluster.join('|');
                        }
                        return _.find($scope.groupsAndClusters, { name: nodeCluster, type: 'cluster' });
                    }
                    else {
                        numericDomain = findClosestNumericBin(clusterAttrInfo.bounds, node.attr[colorByAttr]);
                        return _.find($scope.groupsAndClusters, { name: numericDomain, type: 'numericBin' });
                    }
                }

                function getNodeNeighbors(nodes) {
                    var nodeIds = _.map(nodes, 'id'),
                        labelAttr = $scope.mapprSettings.labelAttr,
                        imageAttr = $scope.mapprSettings.nodeImageAttr,
                        links = getNodesLinks(nodes, labelAttr, imageAttr),
                        linkInfoAttrs = dataGraph.getEdgeInfoAttrs();

                    var nodeNeighbors = _(infoPanelService.getNodesNeighbors(nodes))
                        .reject(function (nbr) { return nodeIds.indexOf(nbr.id) != -1; })
                        .uniq('id')
                        .map(addLinkInfo)
                        .value();

                    $scope.selInfo.linkInfoAttrs = linkInfoAttrs.slice();

                    console.log('All neighbors of selected nodes : ', nodeNeighbors);

                    function addLinkInfo(neighbor) {
                        //get link for neighbor
                        var link = _.find(links, function (link) {
                            return (link.isOutgoing && link.targetId == neighbor.id) || (link.isIncoming && link.sourceId == neighbor.id);
                        });
                        if (link) {
                            // neighbor.linkedByStr = "<div class='text-left h7'>Connected by: " + linkService.getLinkInfo(link) + '</div>';
                            _.each(linkInfoAttrs, function (attr) {
                                neighbor[attr.id] = link.edgeInfo.attr[attr.id];
                            });
                            // neighbor.similarity = link.edgeInfo.attr.similarity;
                            neighbor.label = neighbor.attr[labelAttr || 'DataPointLabel'];
                        }
                        else { console.warn('link not found for neighbor: ' + neighbor.id); }
                        return neighbor;
                    }

                    return nodeNeighbors;
                }

                function sortNodesInSelection() {
                    var sortType = $scope.selInfo.sortInfo.sortType,
                        sortOrder = $scope.selInfo.sortInfo.sortOrder;
                    var sortByGroupColor = _.get(_.find($scope.selInfo.sortTypes, 'id', $scope.selInfo.sortInfo.sortType), 'title') === colorByGroupSortTitle;
                    if (sortByGroupColor) {
                        $scope.selInfo.genericSelNodes = _($scope.selInfo.selectedGroups)
                            .map('nodes')
                            .flatten()
                            .value();
                        if (sortOrder === 'asc') { $scope.selInfo.genericSelNodes.reverse(); }
                    } else {
                        // Separate nodes having no value for selected sort Attr
                        var nodesSplitArr = _.partition($scope.selInfo.genericSelNodes, function (node) {
                            return node.attr[sortType] != null;
                        });
                        var relevantNodes = nodesSplitArr[0],
                            remainingNodes = nodesSplitArr[1];
                        relevantNodes = _.sortBy(relevantNodes, 'attr.' + sortType);
                        if (sortOrder === 'desc') {
                            relevantNodes.reverse();
                        }
                        $scope.selInfo.genericSelNodes = relevantNodes.concat(remainingNodes);
                    }
                }

                function getSortTypesForSelectedNodes(labelAttr, nodeColorAttr, selectedGroups) {
                    var sortTypes = [];
                    var sortAttrs = _.filter(dataGraph.getNodeAttrs(), { isNumeric: true, visible: true });
                    sortTypes = _.map(sortAttrs, function (attr) {
                        return {
                            id: attr.id,
                            title: attr.title
                        };
                    });

                    sortTypes.unshift({
                        id: labelAttr,
                        title: 'Name'
                    });

                    // If more than 1 group and ColorBy attr not numeric, add sort by 'group color' option
                    if (_.isArray(selectedGroups)
                        && selectedGroups.length > 1
                        && !_.find(dataGraph.getNodeAttrs(), 'id', nodeColorAttr).isNumeric) {
                        sortTypes.unshift({
                            id: nodeColorAttr,
                            title: colorByGroupSortTitle
                        });
                    }
                    return sortTypes;
                }

                $rootScope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                    if (data.selectionCount == 0 && data.isSubsetted) {
                        $scope.currentExport = 'subset';
                    } else {
                        $scope.currentExport = data.filtersCount > 0 ? 'select' : 'all';
                    }
                });

                $scope.exportCurrentData = function () {
                    var currentExport = $scope.currentExport;
                    $rootScope.exportSelection(currentExport);
                }
            }



            /*************************************
            ******** Post Link Function *********
            **************************************/


            /*************************************
            ************ Local Functions *********
            **************************************/
            function getNodesLinks(nodes, labelAttr, imageAttr) {
                var links = [];
                console.log('building link info for: ', nodes);

                var graphData = dataGraph.getRawDataUnsafe();

                // link vars
                _.each(nodes, function (node) {
                    var incomingEdgesIndex = graphData.edgeInIndex[node.id];
                    var outgoingEdgesIndex = graphData.edgeOutIndex[node.id];
                    var hasLinks = _.size(incomingEdgesIndex) + _.size(outgoingEdgesIndex) > 0;
                    var nodeLinks = [];
                    if (hasLinks) {
                        nodeLinks = linkService.constructLinkInfo(node, incomingEdgesIndex, outgoingEdgesIndex, labelAttr, imageAttr);
                        links = links.concat(nodeLinks);
                    }
                });

                return links;
            }

            function findClosestNumericBin(bins, val) {
                if (val > bins.quantile_75 && val <= bins.max) { return 'max'; }
                else if (val > bins.quantile_50 && val <= bins.quantile_75) { return 'quantile_75'; }
                else if (val > bins.quantile_25 && val <= bins.quantile_50) { return 'quantile_50'; }
                else if (val > bins.min && val <= bins.quantile_25) { return 'quantile_25'; }
                else { return 'min'; }
            }



            return dirDefn;
        }
    ]);
