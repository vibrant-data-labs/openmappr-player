angular.module('common')
    .directive('dirGridLayout', ['$rootScope', '$timeout', '$window', 'renderGraphfactory', 'dataGraph', 'AttrInfoService', 'nodeSelectionService', 'inputMgmtService', 'graphSelectionService', 'selectService', 'subsetService', 'SelectionSetService', 'snapshotService', 'uiService', 'BROADCAST_MESSAGES',
        function ($rootScope, $timeout, $window, renderGraphfactory,dataGraph, AttrInfoService, nodeSelectionService, inputMgmtService, graphSelectionService, selectService, subsetService, SelectionSetService, snapshotService, uiService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
            ******** Directive description *******
            **************************************/
            var dirDefn = {
                restrict: 'EA',
                templateUrl: '#{server_prefix}#{view_path}/components/project/layouts/grid/gridLayout.html',
                scope: true,
                controller: ['$scope', '$timeout', '$rootScope', ControllerFn],
                link: postLinkFn
            };

            /*************************************
            ************ Local Data **************
            **************************************/
            var logPrefix = '[dirGridLayout: ] ';
            // used when coming out of
            var clickedGridNode = false;
            var cardWidth = 285;

            /*************************************
            ******** Controller Function *********
            **************************************/
            function ControllerFn($scope, $timeout, $rootScope) {
                // Initialise
                var manualSelection = false; // Flag to check whether selectNodes event came from distributions interactions or direct node selection.
                var renderCount = 50; // How much to load at once
                var listCompareIds;
                var processSelection = true;
                var oldNumSelected = 0;
                var prevSelectedNodeIds;

                $scope.isSubsetApplied = false;
                $scope.currentSubsetNodes = [];

                $scope.cardsInRow = 3;
                $scope.curNumCards = 0;
                $scope.allNodesRendered = false;
                $scope.selectedNodeIds = [];
                $scope.nodesObj = [];
                $scope.showAllNodes = true;
                $scope.resetScrollPosition = _.noop;
                $scope.setPagination = _.noop;
                $scope.refreshCollection = refreshCollection;
                $scope.nodeAttrs = dataGraph.getNodeAttrs();
                //This is the variable that will be changed in the layout dropdown
                $scope.gridAttr = $scope.layout.gridAttr;
                $scope.gridSortAttr = _.find($scope.nodeAttrs, {'id': $scope.layout.gridSortAttr});
                $scope.selectionVMs = SelectionSetService.getSelectionVMs();

                var snap = snapshotService.getCurrentSnapshot();

                processSelection = snap.processSelection;

                if (snap && processSelection && snap.layout.plotType == 'grid') {
                    listCompareIds = _.clone($scope.layout.listCompareIds) || [];
                    $scope.selectedNodeIds = _.clone(listCompareIds) || [];
                } else {
                    listCompareIds = _.map(selectService.getSelectedNodes(), 'id') || [];
                    $scope.selectedNodeIds = _.clone(listCompareIds) || [];
                }

                // Build collection of all RG nodes
                refreshCollection();

                //need timeout if initially loaded app with list layout and info panel hasn't initialized yet
                $timeout(function() {
                    manualSelection = true;
                    selectNodesInGraph($scope.selectedNodeIds);
                }, 1000);

                $scope.handleNodeClick = function(node, $event) {
                    manualSelection = true;

                    if (makeMultipleSelection($event)) {
                        if ($scope.selectedNodeIds.indexOf(node.id) > -1 ) {
                            // Node already exists in selection, remove it from selection
                            node.isSelected = false;
                            var nodeIdx = $scope.selectedNodeIds.indexOf(node.id);

                            if (nodeIdx > -1) {
                                $scope.selectedNodeIds.splice(nodeIdx, 1);
                            } else {
                                console.error(logPrefix + 'node to be deselected not found in selection');
                            }
                        } else {
                            // Node not in selection, Add it to selection
                            node.isSelected = true;
                            $scope.selectedNodeIds.push(node.id);
                        }
                    } else {
                        var selectedNodesCollection = _.filter($scope.nodesObj, function(nodeObj) {
                            return $scope.selectedNodeIds.indexOf(nodeObj.id) > -1;
                        });

                        _.each(selectedNodesCollection, function(nodeObj) {
                            nodeObj.isSelected = false;
                        });

                        node.isSelected = true;
                        $scope.selectedNodeIds = [node.id];
                    }

                    selectNodesInGraph($scope.selectedNodeIds);

                    var $card = $('.grid-layout .card[data-nodeid="'+node.id+'"]');
                    var off = $card.find('.node').offset();

                    node.gridSize = $card.find('.node .circle').height()/2;
                    node.gridX = off.left + node.gridSize;
                    node.gridY = off.top + node.gridSize;
                    node.color = node.color;

                    $rootScope.$broadcast(BROADCAST_MESSAGES.grid.clickNode, {
                        node: node
                    });
                    $rootScope.$broadcast(BROADCAST_MESSAGES.player.interacted);
                };

                /* TODO: --- IT'S TEMPORARY COMMENT --- */
                // $scope.clickStage = function() {
                //     var selNodes = graphSelectionService.getSelectedNodes();
                //     if (selNodes.length !== 0) {
                //         resetCollection();
                //
                //         _.each($scope.nodesObj, function(nodeObj) {
                //             nodeObj.isSelected = false;
                //         });
                //         $scope.selectedNodeIds = [];
                //     }
                // }

                //HOVERING

                //hovering of rows (needed to keep heart icon when showing group dropdowns)
                $scope.setHover = function(node) {
                    if ($scope.keepHover) {
                        return;
                    }

                    //for speed, only iterate over currently shown in lists
                    _.each($scope.nodesObj, function(n) {
                        n.inHover = false;
                    });

                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // _.each($scope.comparedItems, function(n) {
                    //     n.inHover = false;
                    // });

                    if (node) {
                        node.inHover = true;
                    }
                };

                $scope.maintainHover = function() {
                    $scope.keepHover = true;
                };

                $scope.clearMaintainHover = function() {
                    $scope.keepHover = false;
                    $scope.setHover();
                };

                $scope.toggleNodeInGroup = function(node, group) {
                    if (group.dpIDs.indexOf(node.id) == -1) {
                        group.addDatapoints([node.id]);
                    } else {
                        group.removeSelectedDPs([node.id]);
                    }
                };

                $scope.clickCard = function(node) {
                    // node.isCompared = true;
                    var $card = $('.grid-layout .card[data-nodeid="'+node.id+'"]');
                    var off = $card.find('.node').offset();

                    node.gridSize = $card.find('.node .circle').height();
                    node.gridX = off.left + node.gridSize - 375;
                    node.gridY = off.top + node.gridSize + 20;
                    node.color = node.color;

                    clickedGridNode = true;

                    selectService.selectSingleNode(node.id);
                }


                $scope.compareChange = function(node) {
                    //wait till after ng-model changes
                    $rootScope.$broadcast(BROADCAST_MESSAGES.player.interacted);
                    manualSelection = true;
                    $timeout(function() {
                        var nodeInObj = _.find($scope.nodesObj, {id: node.id});
                        nodeInObj.isCompared = node.isCompared;
                        var comparedNodes = _.filter($scope.nodesObj, 'isCompared');
                        listCompareIds = _.map(comparedNodes, 'id');

                        $scope.comparingNodes = comparedNodes.length !== 0;
                        $scope.selectedNodeIds = listCompareIds.slice();

                        addComparedNodes(comparedNodes);
                        selectNodesInGraph(listCompareIds);
                        broadcastCompareUpdate();
                    });
                };


                $scope.clearSelection = function() {
                    listCompareIds = [];
                    $scope.layout.listCompareIds = [];

                    selectNodesInGraph([]);
                    broadcastCompareUpdate();

                    graphSelectionService.clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);

                    $timeout(function() {
                        updateLayout($scope.layout);
                    });
                };

                $scope.$on(BROADCAST_MESSAGES.layout.resetSelection, function() {
                    resetCollection();
                });

                $rootScope.$on(BROADCAST_MESSAGES.hss.select, function(ev, data) {
                    var nodes = data.selectionCount == 1 ? data.nodes : selectService.getSelectedNodes();
                    var newNodeIds = _.map(nodes, function(node) {
                        return node.id;
                    });

                    listCompareIds = _.clone(newNodeIds);
                    $scope.selectedNodeIds = _.clone(newNodeIds);

                    console.log('refreshing collection from selectNodes');
                    refreshCollection();

                    if (data.nodes.length == 1) {
                        $rootScope.$broadcast(BROADCAST_MESSAGES.grid.clickNode, {
                            node: data.nodes[0]
                        });
                    }
                });

                $scope.$on(BROADCAST_MESSAGES.hss.subset.changed, function(ev, data) {
                    $scope.isSubsetApplied = false;
                    $scope.currentSubsetNodes = data.subsetCount ? data.nodes : [];
                });

                $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function(event, graph) {
                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // var layout = graph.layout;
                    // console.log('update layout from rendergraph')
                    // updateLayout(layout);
                });

                $scope.$on(BROADCAST_MESSAGES.layout.changed, function(event, layout) {
                    updateLayout(layout);
                });

                $rootScope.$on(BROADCAST_MESSAGES.snapshot.changed, function(event, data) {
                    if (data.snapshot && data.snapshot.processSelection) {
                        processSelection = data.snapshot.processSelection;
                    }
                });

                $scope.$on(BROADCAST_MESSAGES.nodeOverlay.removing, function(event, data) {
                    manualSelection = true;

                    if (clickedGridNode) {
                        selectNodesInGraph(prevSelectedNodeIds);
                        clickedGridNode = false;

                        /* TODO: --- IT'S TEMPORARY COMMENT --- */
                        // $timeout(function() {
                        //     selectNodesInGraph([]);
                        //     graphSelectionService.clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);
                        //     // showCompareNotification();
                        //     // broadcastCompareUpdate();
                        // })
                    }
                });

                function resetCollection() {
                    $scope.showAllNodes = true;
                    $scope.isSubsetApplied = false;
                    graphSelectionService.clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);

                    //deselect all nodes
                    console.log('refresh collection from reset')
                    refreshCollection();
                }

                function broadcastCompareUpdate() {
                    //don't broadcast to layout if in player
                    if (!$rootScope.MAPP_EDITOR_OPEN) {
                        return;
                    }

                    //have to wait for comparedItems to be updated in the dom
                    $timeout(function() {
                        $rootScope.$broadcast(BROADCAST_MESSAGES.layout.compareIdsUpdated, {
                            ids: listCompareIds
                        });
                    });
                }

                function showCompareNotification() {
                    //show addition or deletion
                    var length = listCompareIds.length;

                    if (oldNumSelected < length) {
                        var num = Number(length - oldNumSelected);
                        var str = num + ' node';
                        str += num > 1 ? 's' : '';
                        uiService.log(str + ' added to selection.');
                    } else if (oldNumSelected > length) {
                        var num = Number(oldNumSelected - length);
                        var str = num + ' node';
                        str += num > 1 ? 's' : '';
                        uiService.log(str + ' removed to selection.');
                    }
                }

                function updateLayout(layout) {
                    if (layout.plotType !== 'grid') {
                        return;
                    }

                    $scope.gridAttr = layout.gridAttr;
                    $scope.gridSortAttr = _.find($scope.nodeAttrs, {'id': layout.gridSortAttr});
                    $scope.totalNodesCount = dataGraph.getAllNodes().length;

                    if (processSelection) {
                        listCompareIds = _.clone(layout.listCompareIds) || [];
                        $scope.selectedNodeIds = _.clone($scope.layout.listCompareIds) || [];
                    } else {
                        listCompareIds = _.map(selectService.getSelectedNodes(), 'id') || [];
                    }

                    processSelection = true;

                    $scope.selectionVMs = SelectionSetService.getSelectionVMs();
                    console.log('refresh collection from updateLayout')
                    refreshCollection();
                }

                function selectNodesInGraph(nodeIds) {
                    // graphSelectionService.clearSelections();
                    // graphSelectionService.runFuncInCtx(function() {
                    //     graphSelectionService.selectByIds(nodeIds, 0);
                    // }, true, true);
                }

                function makeMultipleSelection(ev) {
                    return ev.shiftKey || ev.ctrlKey || ev.metaKey;
                }

                function refreshCollection() {
                    oldNumSelected = $scope.selectedNodeIds.length;

                    var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId($scope.gridAttr).attr;
                    var nodeObj, selectedAttr;

                    var nodes = [];
                    var currentSubsetNodes = $scope.currentSubsetNodes;

                    if (currentSubsetNodes.length) {
                        nodes = currentSubsetNodes;
                        $scope.isSubsetApplied = true;
                    } else {
                        nodes = renderGraphfactory.getGraph().nodes();
                        $scope.isSubsetApplied = false;
                    }

                    //build array of node obj with attrInfo for selected attr and node info needed
                    $scope.renderLimit = renderCount;
                    $scope.allNodesRendered = $scope.renderLimit >= nodes.length ? true : false;
                    // $scope.resetScrollPosition();

                    //$timeout necessary for the nodesObj to correctly update the grid (else leftover cards)
                    $timeout(function() {
                        $scope.nodesObj = [];
                        _.each(nodes, function(n) {
                            nodeObj = {
                                id: n.id,
                                attr: n.attr,
                                colorStr: n.colorStr,
                                color: n.color,
                                darkColorStr: n.color && mappr.utils.darkenColor(n.color),
                                // isSelected: n.isSelected,
                                isSelected: $scope.selectedNodeIds.indexOf(n.id) !== -1,  //may change, but don't want all nodes selected in collection
                                isCompared: listCompareIds.indexOf(n.id) !== -1,
                                inHover: n.inHover
                            };

                            selectedAttr = {
                                attrType: attrInfo.attrType,
                                id: attrInfo.id,
                                isStarred: attrInfo.isStarred,
                                renderType: attrInfo.renderType,
                                title: attrInfo.title,
                                visible: attrInfo.visible
                            };

                            //add value of node's attr in selectedAttr obj (needed for correctly rendering dir-attr-renderer)
                            if (n.attr[$scope.gridAttr]) {
                                selectedAttr.value = n.attr[$scope.gridAttr];
                            }

                            nodeObj.selectedAttr = selectedAttr;
                            $scope.nodesObj.push(nodeObj);
                        });

                        sortNodesObj();
                        $scope.curNumCards = Math.min($scope.renderLimit, $scope.nodesObj.length);
                    });
                }

                function sortNodesObj() {
                    if (!$scope.gridSortAttr) {
                        return;
                    }

                    var order = $scope.reverseSort ? 'desc' : 'asc';

                    //maybe remove
                    sortedNodes = _.filter($scope.nodesObj, function(node) {
                        return node.selectedAttr.value && node.selectedAttr.value !== '';
                    });

                    var sortedNodes = _.sortBy(sortedNodes, function(node) {
                        return node.attr[$scope.gridSortAttr.id].toLowerCase();
                    }, order);

                    $scope.sortedNodesObj = [];
                    var nAR;

                    _.each(sortedNodes, function(node, ind) {
                        if (ind % $scope.cardsInRow === 0) {
                            nAR = [];
                        }
                        nAR.push(node);
                        if (ind % $scope.cardsInRow === $scope.cardsInRow - 1 || ind === sortedNodes.length - 1) {
                            $scope.sortedNodesObj.push(nAR);
                        }
                    });

                    var comparedNodes = _.filter(sortedNodes, 'isCompared');
                    addComparedNodes(comparedNodes)
                    $scope.setPagination();
                }

                function addComparedNodes(comparedNodes) {
                    var order = $scope.reverseSort ? 'desc' : 'asc';

                    comparedNodes = _.sortBy(comparedNodes, function(node) {
                        return node.attr[$scope.gridSortAttr.id].toLowerCase();
                    }, order);

                    $scope.comparingNodes = comparedNodes.length > 0;
                    $scope.comparedNodesObj = [];

                    var nAR = [];

                    _.each(comparedNodes, function(node, ind) {
                        if (ind % $scope.cardsInRow === 0) {
                            nAR = [];
                        }

                        nAR.push(node);

                        if (ind % $scope.cardsInRow === $scope.cardsInRow - 1 || ind === comparedNodes.length - 1) {
                            $scope.comparedNodesObj.push(nAR);
                        }
                    });
                }

            }

            /*************************************
            ******** Post Link Function *********
            **************************************/
            function postLinkFn(scope, element) {
                var $gridLayoutDiv = $(element).find('.grid-layout');

                scope.scrolled = false;
                scope.cardsInRow = Math.max(1, Math.floor($gridLayoutDiv.width() / cardWidth));

                var paginationDeb = _.debounce(function() {
                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    //trigger digest
                    // $timeout(function() {
                    //     var cards = scope.nodesDiv.find('.card'),
                    //         firstNode = cards.filter(':first'),
                    //         lastNode = cards.filter(':last');
                    //     if (firstNode.length && scope.sortedNodesObj) {
                    //         var sortedCards = _.reject(scope.sortedNodesObj, 'isHeader');
                    //         var startInd = _.findIndex(sortedCards, {id:firstNode.data('nodeid')}) + 1;
                    //         var endInd = _.findIndex(sortedCards, {id:lastNode.data('nodeid')}) + 1;
                    //         scope.pagination = startInd + " to " + endInd + " of " + sortedCards.length + " ";
                    //     }
                    // });
                }, 100);

                scope.setPagination = function() {
                    paginationDeb();
                };

                scope.resetScrollPosition = function() {
                    $('#virtual-scroll').animate({scrollTop: 0}, "slow");
                };

                $('#virtual-scroll').on('scroll', function(event) {
                    if ($(this).scrollTop() === 0) {
                        scope.scrolled = false;
                    } else {
                        scope.scrolled = true;
                    }
                });

                angular.element($window).bind('resize', function() {
                    scope.cardsInRow = Math.max(1, Math.floor($gridLayoutDiv.width() / cardWidth));
                    scope.refreshCollection();
                });
            }

            /*************************************
            ************ Local Functions *********
            **************************************/

            return dirDefn;
        }
    ]);
