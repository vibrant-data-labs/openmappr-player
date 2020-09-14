angular.module('common')
    .directive('dirListLayout', ['$rootScope', '$window', '$timeout', '$interval', 'renderGraphfactory', 'dataGraph', 'AttrInfoService', 'nodeSelectionService', 'inputMgmtService', 'graphSelectionService', 'SelectionSetService', 'snapshotService', 'uiService', 'BROADCAST_MESSAGES',
        function ($rootScope, $window, $timeout, $interval, renderGraphfactory,dataGraph, AttrInfoService, nodeSelectionService, inputMgmtService, graphSelectionService, SelectionSetService, snapshotService, uiService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
            ******** Directive description *******
            **************************************/
            var dirDefn = {
                restrict: 'EA',
                templateUrl: '#{server_prefix}#{view_path}/components/project/layouts/list/listLayout.html',
                controller: ['$scope', '$element', '$timeout', '$rootScope', ControllerFn],
                scope: true,
                link: postLinkFn
            };

            /*************************************
            ************ Local Data **************
            **************************************/
            var logPrefix = '[dirListLayout: ] ';

            /*************************************
            ******** Controller Function *********
            **************************************/
            function ControllerFn($scope, $element, $timeout, $rootScope) {

                /*************************************
                ************ Local Data **************
                **************************************/
                // vars
                var manualSelection = false; // Flag to check whether selectNodes event came from distributions interactions or direct node selection.
                var renderCount = 30; // How much to load at once
                var listCompareIds = null; //ids of nodes pinned to top
                var allCategories = []; //total number of cats if sorted by cats
                var processSelection = true; //whether to apply selection to compareIds
                var oldNumSelected = 0;

                /*************************************
                ********* Scope Bindings *************
                **************************************/

                $scope.resizingWindow = false; //hack to not reload if only resizing (because no graph to resize) and ends up removing any unfilled columns
                $scope.renderLimit = renderCount;
                $scope.curNumRows = 0;
                $scope.allNodesRendered = false;
                $scope.selectedNodeIds = [];
                $scope.nodesObj = [];
                $scope.resetScrollPosition = _.noop;
                $scope.setPagination = _.noop;
                $scope.keepHover = false;
                $scope.hiddenCategories = [];
                $scope.isSortedByCategory = false; //whether sorting by a category or not
                $scope.anyCatsClosed = false;
                $scope.allCatsClosed = false;

                //column scrolling
                $scope.colWidth = 300;
                $scope.attrScroll = 0;
                $scope.showRightScroll = false;
                $scope.showLeftScroll = false;
                $scope.colSizes = [];

                //columns (attrs)
                $scope.nodeAttrs = [];
                $scope.listAttrs = [];
                $scope.colSizes = [];
                $scope.listSortAttrAr = [];
                $scope.columnAttrs = [];
                $scope.sortableColumnAttrs = [];
                $scope.columnModels = [];   //for holding models simply for setting active in filter dropdowns

                //for determining if layout changed
                $scope.layoutId = $scope.layout.id;
                $scope.totalNodesCount = dataGraph.getAllNodes().length;
                var snap = snapshotService.getCurrentSnapshot();
                processSelection = snap.processSelection;

                if (snap && processSelection && snap.layout.plotType == 'grid') {
                    listCompareIds = _.clone($scope.layout.listCompareIds) || [];
                    $scope.selectedNodeIds = _.clone($scope.layout.listCompareIds) || [];
                } else {
                    listCompareIds = _.map(graphSelectionService.getSelectedNodes(), 'id') || [];
                }

                $scope.attrTemp = {
                    title:'Choose Attribute',
                    id: 'chooseAttr'
                };

                /* TODO: --- IT'S TEMPORARY COMMENT --- */
                // $scope.appUi.layoutSort = _.find($scope.nodeAttrs, {id:$scope.listSortAttr});
                // $scope.listSortAttrName = $scope.appUi.layoutSort ? $scope.appUi.layoutSort.title : null;
                // $scope.reverseSort = $scope.layout.listSortReverse;
                // $scope.appUi.reverseSort = $scope.reverseSort;

                $scope.selectionVMs = SelectionSetService.getSelectionVMs();

                //ATTRIBUTE COLUMNS

                $scope.updateListAttrs = function(val, ind) {
                    if (val.action == 'delete') {
                        removeSort($scope.listAttrs[ind].id);
                        $scope.removeListAttr(ind);
                    } else if (val.action == 'sortAscending') {
                        //reassign ng-model because don't want it set to 'Sort Ascending'
                        $scope.columnModels[ind] = $scope.listAttrs[ind].title;
                        $scope.addSortAttr($scope.listAttrs[ind], 'asc');
                    } else if (val.action == 'sortDescending') {
                        $scope.columnModels[ind] = $scope.listAttrs[ind].title;
                        $scope.addSortAttr($scope.listAttrs[ind], 'desc');
                    } else if (val.action == 'removeSort') {
                        $scope.columnModels[ind] = $scope.listAttrs[ind].title;
                        removeSort($scope.listAttrs[ind].id);
                    } else {
                        $scope.listAttrs[ind] = val;
                        $scope.columnModels[ind] = val.title;
                        broadcastAttrUpdate();
                    }
                };

                $scope.getNodeAttrsList = function(ind) {
                    var attr = $scope.listAttrs[ind];

                    if (attr && _.find($scope.listSortAttrAr, {id: attr.id})) {
                        return $scope.sortedColumnAttrs;
                    } else if (attr && attr.attrType !== 'liststring' && attr.id !== 'chooseAttr') {
                        return $scope.sortableColumnAttrs;
                    } else {
                        return $scope.columnAttrs;
                    }
                };

                $scope.removeListAttr = function(ind) {
                    $scope.listAttrs.splice(ind, 1);
                    $scope.colSizes.splice(ind, 1);
                    $scope.columnModels.splice(ind, 1);

                    broadcastAttrUpdate();
                };

                //HOVERING

                //hovering of rows (needed to keep heart icon when showing group dropdowns)
                $scope.setHover = function(node) {
                    if ($scope.keepHover) {
                        return;
                    }

                    //for speed, only iterate over currently shown in lists
                    _.each($scope.sortedNodesObj, function(n) {
                        n.inHover = false;
                    });
                    _.each($scope.comparedItems, function(n) {
                        n.inHover = false;
                    });

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

                $scope.compareChange = function(node) {
                    //wait till after ng-model changes
                    manualSelection = true;
                    $timeout(function() {
                        if (node.isCompared) {
                            $scope.comparingNodes = true;
                        }

                        listCompareIds = _.map(_.filter($scope.sortedNodesObj, 'isCompared'), 'id');
                        $scope.selectedNodeIds = _.clone(listCompareIds);

                        selectNodesInGraph($scope.selectedNodeIds);
                        //hack for hiding tooltips
                        $('.list-attr-tooltip').remove();
                        refreshCollection();
                        showCompareNotification();
                        broadcastCompareUpdate();
                    });
                };

                //node style if hovering or not
                $scope.getNodeStyle = function(node) {
                    if (node.inHover || $scope.selectedNodeIds.indexOf(node.id) !== -1) {
                        return {
                            background: node.colorStr,
                            border: "3px solid " + node.darkColorStr,

                            /* TODO: --- IT'S TEMPORARY COMMENT --- */
                            // width: 30,
                            // height: 30,
                            // marginRight: 10,
                            // marginLeft: -5
                        };
                    } else {
                        return {
                            background: node.colorStr
                        };
                    }
                };

                //SORTING

                $scope.addSortAttr = function(val, direction) {
                    //find attr and set sorting else push to end of array
                    var ind = _.findIndex(_.map($scope.listSortAttrAr, 'val'), {'id': val.id});
                    if (ind !== -1) {
                        $scope.listSortAttrAr[ind].direction = direction;
                    } else {
                        $scope.listSortAttrAr.push({
                            id: val.id,
                            val: val,
                            direction: direction
                        });
                    }

                    $rootScope.$broadcast(BROADCAST_MESSAGES.layout.layoutSorted, {
                        attrAr: $scope.listSortAttrAr
                    });

                    setSortingByCategory();
                    refreshCollection();
                };

                //keep this in scope in case we move back to having sort in header
                $scope.removeSortAttr = function(ind) {
                    $scope.listSortAttrAr.splice(ind, 1);

                    $rootScope.$broadcast(BROADCAST_MESSAGES.layout.layoutSorted, {
                        attrAr: $scope.listSortAttrAr
                    });

                    setSortingByCategory();
                    refreshCollection();
                };

                //CATEGORIES

                $scope.toggleCategoryNodes = function(attrIdVal) {
                    var isCatHidden = false;

                    if ($scope.hiddenCategories.indexOf(attrIdVal) === -1) {
                        $scope.hiddenCategories.push(attrIdVal);
                        isCatHidden = true;
                    } else {
                        $scope.hiddenCategories.splice($scope.hiddenCategories.indexOf(attrIdVal), 1);
                    }
                    if (isCatHidden) {
                        $scope.sortedNodesObj = _.reject($scope.sortedNodesObj, function(node) {
                            return !node.isHeader && node.attr[$scope.listSortAttrAr[0].val.id] === attrIdVal;
                        });
                    } else {
                        //get all nodes that are hidden and add to sortedNodesObj in correct place
                        var hInd = _.findIndex($scope.sortedNodesObj, {isHeader: true, category: attrIdVal}) + 1; //index of header element
                        var nodes = _.filter($scope.nodesObj, function(node) {
                            return node.attr[$scope.listSortAttrAr[0].val.id] === attrIdVal;
                        });

                        $scope.sortedNodesObj = $scope.sortedNodesObj.slice(0, hInd).concat(nodes, $scope.sortedNodesObj.slice(hInd));
                    }

                    $scope.anyCatsClosed = $scope.hiddenCategories.length !== 0;
                    $scope.allCatsClosed = allCategories.length === $scope.hiddenCategories.length;
                    $scope.setPagination();
                };

                $scope.openAllCats = function() {
                    $scope.hiddenCategories = [];
                    $scope.anyCatsClosed = false;
                    $scope.allCatsClosed = false;
                    sortNodesObj();
                };

                $scope.closeAllCats = function() {
                    var openCats = _.difference(allCategories, $scope.hiddenCategories);

                    _.forEachRight(openCats, function(cat) {
                        $scope.toggleCategoryNodes(cat);
                    });
                };

                $scope.isCategoryHidden = function(attrIdVal) {
                    return $scope.hiddenCategories.indexOf(attrIdVal) !== -1;
                };

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

                        $scope.selectedNodeIds = [node.id];
                    }

                    selectNodesInGraph($scope.selectedNodeIds);

                    var $card = $('.list-layout .card[data-nodeid="'+node.id+'"]');
                    var off = $card.find('.node').offset();

                    node.gridSize = $card.find('.node .circle').height()/2;
                    node.gridX = off.left + node.gridSize;
                    node.gridY = off.top + node.gridSize;
                    node.color = node.color;

                    $rootScope.$broadcast(BROADCAST_MESSAGES.list.clickNode, {
                        node: node
                    });
                    $rootScope.$broadcast(BROADCAST_MESSAGES.player.interacted);
                };

                $scope.resetCollection = function() {
                    $scope.setHover();
                    $scope.hiddenCategories = [];

                    graphSelectionService.clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);
                    //deselect all nodes
                    refreshCollection();
                };

                $scope.getSortedText = function(attrId) {
                    var sort = _.find($scope.listSortAttrAr, {id: attrId});

                    if (!sort) {
                        return;
                    }

                    var ind = _.findIndex($scope.listSortAttrAr, {id: attrId}) + 1;
                    var dir = sort.direction == 'asc' ? 'Ascending' : 'Descending';

                    return "Sorted (" + ind + ") " + dir + " by";
                };

                $scope.clearSelection = function() {
                    listCompareIds = [];
                    $scope.layout.listCompareIds = [];
                    broadcastCompareUpdate();
                    graphSelectionService.clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);

                    $timeout(function() {
                        updateLayout($scope.layout);
                    });
                };

                /*************************************
                ****** Event Listeners/Watches *******
                **************************************/

                $scope.$on(BROADCAST_MESSAGES.selectNodes, function(e, data) {
                    if (manualSelection) {
                        manualSelection = false;
                        console.warn(logPrefix + 'selection manually made through grid, leaving collection intact');
                        return;
                    }

                    if (data.extendingSelection) {
                        listCompareIds = _.union(listCompareIds, data.nodeIds);
                        $scope.selectedNodeIds = _.union($scope.selectedNodeIds, data.nodeIds);
                    } else {
                        listCompareIds = _.clone(data.nodeIds);
                        $scope.selectedNodeIds = _.clone(data.nodeIds);
                    }

                    showCompareNotification();
                    refreshCollection();

                    // Event broadcasted outside digest
                    if (!$scope.$$phase && !$rootScope.$$phase) {
                        $scope.$apply();
                    }
                });

                $scope.$on(BROADCAST_MESSAGES.snapshot.changed, function(event, data) {
                    if (data.snapshot && data.snapshot.processSelection) {
                        processSelection = data.snapshot.processSelection;
                    }
                });

                $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, function(event, graph) {
                    //delay when constantly resizing
                    if ($scope.resizingWindow) {
                        $scope.resizingWindow = false;
                        return;
                    }

                    var layout = graph.layout;

                    if ($scope.layoutId !== layout.id) {
                        updateLayout(layout);
                        $scope.layoutId = layout.id;
                    }
                });

                $scope.$on(BROADCAST_MESSAGES.renderGraph.changed, function(event, graph) {
                    var layout = graph.layout;
                    updateLayout(layout);
                });

                $scope.$on(BROADCAST_MESSAGES.layout.changed, function(event, layout) {
                    if ($scope.layoutId !== layout.id) {
                        updateLayout(layout);
                        $scope.layoutId = layout.id;
                    }
                });

                $scope.$on(BROADCAST_MESSAGES.layout.resetSelection, function() {
                    $scope.resetCollection();
                });

                /*************************************
                ************ Initialise **************
                **************************************/

                //initialize columns
                initAttributeColumns($scope.layout)

                // //initially set whether using a category to sort (so can show headers)
                setSortingByCategory();
                //
                // // Build collection of all RG nodes
                refreshCollection();

                //need timeout if initially loaded app with list layout and info panel hasn't initialized yet
                $timeout(function() {
                    manualSelection = true;
                    selectNodesInGraph($scope.selectedNodeIds);
                }, 1000);

                /*************************************
                ********* Core Functions *************
                **************************************/

                function initAttributeColumns(layout) {
                    //for now, only allow strings, numbers and liststrings
                    $scope.nodeAttrs = _.filter(dataGraph.getNodeAttrs(), function(attr) {
                        return attr.attrType == 'string' || attr.attrType == 'liststring' || attr.attrType == 'float' || attr.attrType == 'integer' || attr.attrType == 'year' || attr.attrType == 'timestamp' || attr.attrType == 'picture' || attr.attrType == 'url';
                    });

                    $scope.columnAttrs = [{
                        title: 'Delete Column',
                        action: 'delete',
                        icon: 'fa fa-times'
                    }].concat($scope.nodeAttrs);

                    $scope.sortableColumnAttrs = [{
                        title: 'Sort Ascending',
                        action: 'sortAscending',
                        icon: 'fa fa-sort-amount-asc'
                    }, {
                        title: 'Sort Descending',
                        action: 'sortDescending',
                        icon: 'fa fa-sort-amount-desc'
                    }].concat($scope.columnAttrs);

                    $scope.sortedColumnAttrs = [{
                        title: 'Remove Sort',
                        action: 'removeSort',
                        icon: 'fa fa-times'
                    }].concat($scope.sortableColumnAttrs);

                    if (layout.listAttrs) {
                        $scope.listAttrs = unflattenAttrs($scope.nodeAttrs, layout.listAttrs);
                        $scope.colSizes = layout.listColSizes;
                    } else {
                        //add default list and sort by if not set (switched to new list view layout)
                        $scope.listAttrs = unflattenAttrs($scope.nodeAttrs, layout.listSortAttrAr);
                    }

                    //set for indicating active attribute in column dropdown
                    $scope.columnModels = _.map($scope.listAttrs, 'title');

                    //remove any not set columns in player view
                    if (!$rootScope.MAPP_EDITOR_OPEN) {
                        _.eachRight($scope.listAttrs, function(attr, index) {
                            if (!attr.attrType) {
                                $scope.listAttrs.splice(index, 1);
                                $scope.colSizes.splice(index, 1);
                            }
                        });
                    }

                    //set for deprecated values
                    if ($scope.listAttrs.length !== $scope.colSizes.length) {
                        _.each($scope.listAttrs, function(l, ind) {
                            if (!$scope.colSizes[ind]) {
                                $scope.colSizes.push($scope.colWidth);
                            }
                        });
                        $scope.colSizes.length = $scope.listAttrs.length;
                    }

                    $scope.listSortAttrAr = _.map(layout.listSortAttrAr, function(sortAttr, index) {
                        return {
                            id: sortAttr,
                            val: _.find($scope.nodeAttrs, {'id': sortAttr}),
                            direction: layout.listSortReverseAr && layout.listSortReverseAr[index] ? layout.listSortReverseAr[index] : 'asc'
                        };
                    });
                }

                function broadcastAttrUpdate() {
                    //remove if only have title (just placeholders)
                    // var layoutAttrs = _.filter($scope.listAttrs, 'id');
                    $rootScope.$broadcast(BROADCAST_MESSAGES.layout.rowAttrsUpdated, {
                        attrs: _.map($scope.listAttrs, 'id')
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

                function setSortingByCategory() {
                    var infoObj = AttrInfoService.getNodeAttrInfoForRG();

                    if ($scope.listSortAttrAr[0]) {
                        $scope.isSortedByCategory = AttrInfoService.isDistrAttr($scope.listSortAttrAr[0].val, infoObj.getForId($scope.listSortAttrAr[0].val.id)) && $scope.listSortAttrAr[0].val.attrType === 'string';
                    } else {
                        $scope.isSortedByCategory = false;
                    }

                    $scope.hiddenCategories = [];
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

                function updateLayout(layout) {
                    if (layout.plotType !== 'list') {
                        return;
                    }

                    allCategories = [];

                    $scope.selectedNodeIds = [];
                    $scope.nodesObj = [];
                    $scope.hiddenCategories = [];
                    $scope.isSortedByCategory = false; //whether sorting by a category or not
                    $scope.anyCatsClosed = false;
                    $scope.allCatsClosed = false;
                    $scope.colSizes = [];
                    $scope.nodeAttrs = [];
                    $scope.listAttrs = [];
                    $scope.colSizes = [];
                    $scope.listSortAttrAr = [];
                    $scope.columnAttrs = [];
                    $scope.sortableColumnAttrs = [];
                    $scope.columnModels = [];   //for holding models simply for setting active in filter dropdowns
                    $scope.comparingNodes = false;
                    //for determining if layout changed
                    $scope.layoutId = $scope.layout.id;
                    $scope.totalNodesCount = dataGraph.getAllNodes().length;

                    if (processSelection) {
                        listCompareIds = _.clone(layout.listCompareIds) || [];
                        $scope.selectedNodeIds = _.clone($scope.layout.listCompareIds) || [];
                    } else {
                        listCompareIds = _.map(graphSelectionService.getSelectedNodes(), 'id') || [];
                    }

                    processSelection = true;
                    $scope.selectionVMs = SelectionSetService.getSelectionVMs();

                    initAttributeColumns(layout);
                    setSortingByCategory();
                    refreshCollection();
                }

                function unflattenAttrs(nodeAttrs, layoutAttrs) {
                    var ar = [];

                    _.each(layoutAttrs, function (layAt) {
                        var at = _.find(nodeAttrs, {id: layAt});

                        if (at) {
                            ar.push(at);
                        } else if (layAt === 'chooseAttr') {
                            ar.push(_.clone($scope.attrTemp));
                        }
                    });

                    return ar;
                }

                function removeSort(id) {
                    var ind = _.findIndex($scope.listSortAttrAr, {id: id});
                    //keep this in scope in case we move back to having sort in header
                    $scope.removeSortAttr(ind);
                }

                function selectNodesInGraph(nodeIds) {
                    graphSelectionService.clearSelections();
                    graphSelectionService.runFuncInCtx(function() {
                        graphSelectionService.selectByIds(nodeIds, 0);
                    }, true, true);
                }

                function makeMultipleSelection(ev) {
                    return ev.shiftKey || ev.ctrlKey || ev.metaKey;
                }

                function refreshCollection() {
                    var length = $scope.selectedNodeIds.length;

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

                    oldNumSelected = $scope.selectedNodeIds.length;

                    var nodeObj, selectedAttr;
                    var nodes = renderGraphfactory.getGraph().nodes();

                    //build array of node obj with attrInfo for selected attr and node info needed
                    $scope.renderLimit = renderCount;
                    $scope.allNodesRendered = $scope.renderLimit >= nodes.length ? true : false;
                    // $scope.resetScrollPosition();

                    //$timeout necessary for the nodesObj to correctly update the grid (else leftover cards)
                    $timeout(function() {
                        $scope.comparingNodes = listCompareIds.length !== 0;
                        $scope.nodesObj = [];

                        _.each(nodes, function(n) {
                            nodeObj = {
                                id: n.id,
                                attr: n.attr,
                                colorStr: n.colorStr,
                                darkColorStr: mappr.utils.darkenColor(n.color),
                                color: n.color,
                                isSelected: false,
                                inHover: false,
                                isVisible: true,
                                // isCompared: listCompareIds.indexOf(n.id) !== -1,
                                isCompared: listCompareIds.indexOf(n.id) !== -1,
                                attrs: []
                            };

                            if (nodeObj.isCompared) {
                                $scope.comparingNodes = true;
                            }

                            $scope.nodesObj.push(nodeObj);
                        });

                        // listCompareIds = _.map(_.filter($scope.nodesObj, 'isCompared'), 'id');
                        // broadcastCompareUpdate();
                        //sort the node object and add headers
                        $scope.openAllCats();
                        $scope.curNumRows = Math.min($scope.renderLimit, $scope.nodesObj.length);

                    });
                }

                //create new array based on sort and add categorical headers if needed
                function sortNodesObj() {
                    allCategories = [];

                    //this should work but doesn't (bug in lodash: can't use function and multiple order keys)
                    // $scope.sortedNodesObj = _.sortByOrder($scope.nodesObj, function(node) {
                    //     return _.map($scope.listSortAttrAr, function(sortAttr, index) {
                    //         var at = "-" + node.attr[sortAttr.val.id] || '';
                    //         return at.toUpperCase();
                    //     });
                    // }, _.map($scope.listSortAttrAr, 'direction'));

                    var sortingAr = [];

                    _.each($scope.listSortAttrAr, function(sort, index) {
                        sortingAr.push(function(node) {
                            var atObj = $scope.listSortAttrAr[index].val;
                            var at = node.attr[atObj.id] || '';
                            var rT = atObj.renderType;
                            if (at !== '' && (rT === 'date' || rT === 'date-time' || rT === 'time')) {
                                at = new Date(at).getTime();
                            }
                            return (typeof at === 'string') ? at.toUpperCase() : at;
                        });
                    });

                    $scope.sortedNodesObj = _.sortByOrder($scope.nodesObj, sortingAr, _.map($scope.listSortAttrAr, 'direction'));

                    //add in headers to array if sorted by a category
                    if ($scope.isSortedByCategory) {
                        var prevCat, curCat;

                        _.forEachRight($scope.sortedNodesObj, function(node, i) {
                            if (i !== 0) {
                                prevCat = $scope.sortedNodesObj[i - 1].attr[$scope.listSortAttrAr[0].val.id];
                            }

                            curCat = node.attr[$scope.listSortAttrAr[0].val.id];

                            if (i === 0 || prevCat !== curCat) {
                                $scope.sortedNodesObj.splice(i, 0, {
                                    isHeader: true,
                                    category: curCat,
                                    colorStr: node.colorStr
                                });

                                allCategories.push(curCat);
                            }
                        });
                    }

                    $scope.setPagination();
                }
            }

            /*************************************
            ******** Post Link Function *********
            **************************************/

            function postLinkFn(scope, element, attrs, ctrl) {
                //initially get content width
                scope.virtualScroll = $(element).find('#virtual-scroll');
                scope.nodesDiv = scope.virtualScroll.find('.nodes');
                scope.contWidth = scope.nodesDiv.width();
                scope.showRightScroll = canScrollRight();
                scope.isAnimatingAttrs = false;
                scope.scrolled = false;

                var scrollingColumns = false;

                var paginationDeb = _.debounce(function() {
                    //trigger digest
                    $timeout(function() {
                        var cards = scope.nodesDiv.find('.card'),
                            firstNode = cards.filter(':first'),
                            lastNode = cards.filter(':last');

                        if (firstNode.length && scope.sortedNodesObj) {
                            var sortedCards = _.reject(scope.sortedNodesObj, 'isHeader');
                            var startInd = _.findIndex(sortedCards, {id:firstNode.data('nodeid')}) + 1;
                            var endInd = _.findIndex(sortedCards, {id:lastNode.data('nodeid')}) + 1;
                            scope.pagination = startInd + " to " + endInd + " of " + sortedCards.length + " ";
                        }
                    });
                }, 100);

                var scrollDeb = _.debounce(function() {
                    //trigger digest
                    $timeout(function() {
                        scope.isScrolling = false;
                    });
                }, 800);

                var resizeDeb = _.debounce(function() {
                    //trigger digest
                    $timeout(function() {
                        scope.showRightScroll = canScrollRight();
                        scope.contWidth = scope.nodesDiv.width();
                    });
                }, 100);

                scope.resetScrollPosition = function() {
                    scope.virtualScroll.animate({scrollTop: 0}, "slow");
                    scope.showRightScroll = canScrollRight();
                };

                scope.scrollColumns = function(isRight) {
                    // var length = $rootScope.MAPP_EDITOR_OPEN ? scope.listAttrs.length : _.filter(scope.listAttrs, 'attrType').length;
                    scope.isAnimatingAttrs = true;

                    //timeout to allow antimation class to be applied using isAnimatingAttrs
                    $timeout(function() {
                        scope.attrScroll = Math.min(0, isRight ? Math.max(getAttrRightScroll(), scope.contWidth - getColumnsWidth() - scope.colWidth) : Math.min(0, getAttrLeftScroll()));
                        scope.showLeftScroll = scope.attrScroll !== 0;
                        scope.showRightScroll = canScrollRight();
                    }, 1);
                };

                /* TODO: --- IT'S TEMPORARY COMMENT --- */
                //whether to render attribute (disabling because no real performance boost)
                // scope.inScrollingArea = function(index) {
                //     //see if outside of visible area
                //     if ((index + 1) * scope.colWidth + scope.attrScroll < 0 || (index - 1) * scope.colWidth + scope.attrScroll > scope.contWidth) {
                //         return false;
                //     }
                //     return true;
                // };

                scope.addColumn = function() {
                    scope.listAttrs.push(_.clone(scope.attrTemp));
                    scope.colSizes.push(scope.colWidth);
                    $timeout(function() {
                        if (canScrollRight()) {
                            scope.attrScroll = scope.contWidth - getColumnsWidth() - scope.colWidth;
                            scope.scrollColumns(true);
                        }
                    });
                };

                scope.setPagination = function() {
                    paginationDeb();
                };

                function getAttrRightScroll() {
                    var tot = 0;
                    _.each(scope.colSizes, function(size) {
                        tot -= size;
                        return tot >= scope.attrScroll;
                    });

                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // console.log('scrollRight: ', tot);
                    return tot;
                }

                function getAttrLeftScroll() {
                    var tot = 0;

                    //remove width of labels (1st column) from content width
                    var cW = scope.contWidth - scope.colWidth;

                    _.each(scope.colSizes, function(size) {
                        //TODO: not happy having to add the 5 to get this to work
                        if (tot - size > scope.attrScroll - cW + 5) {
                            tot -= size;
                        } else {
                            return false;
                        }
                    });

                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // console.log('scrollLeft: ', tot);
                    return tot + cW;
                }

                //
                function getColumnsWidth(addTo) {
                    var sum = _.reduce(scope.colSizes, function(s, n, k) {
                        return s + n;
                    });

                    return addTo ? sum + addTo : sum;
                }

                function canScrollRight() {
                    //see if should show right scroll arrow
                    // var length = $rootScope.MAPP_EDITOR_OPEN ? scope.listAttrs.length : _.filter(scope.listAttrs, 'attrType').length;
                    //add one for the node names
                    var itemWidth = getColumnsWidth(scope.colWidth);

                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // console.log('cont width to item width: ', scope.contWidth, itemWidth, scope.attrScroll);

                    if (scope.contWidth < itemWidth + scope.attrScroll) {
                        return true;
                    } else {
                        return false;
                    }
                }

                angular.element($window).bind('resize', function() {
                    scope.resizingWindow = true;
                    resizeDeb();
                });

                angular.element(scope.virtualScroll).bind("scroll", function(event) {
                    scope.isScrolling = true;

                    if ($(this).scrollTop() === 0) {
                        scope.scrolled = false;
                    } else {
                        scope.scrolled = true;
                    }

                    scope.isAnimatingAttrs = false;
                    scrollDeb();
                    scope.setPagination();
                    //hide any cells' tooltips (hack)
                    $('.list-attr-tooltip').remove();
                });

                //bind mousewheel to body so can imitate horizontal scroll
                function horizScroll(event, delta) {
                    if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
                        return;
                    }

                    //to stop chrome from triggering back button
                    event.preventDefault();
                    event.originalEvent.stopPropagation();

                    if (scrollingColumns) {
                        return;
                    }

                    if (event.deltaX > 5) {
                        $('.list-attr-tooltip').remove();
                        scope.scrollColumns(true);
                        scrollingColumns = true;
                        $timeout(function() {
                            scrollingColumns = false;
                        }, 100);
                    } else if (event.deltaX < -5) {
                        $('.list-attr-tooltip').remove();
                        scope.scrollColumns(false);
                        scrollingColumns = true;
                        $timeout(function() {
                            scrollingColumns = false;
                        }, 100);
                    }

                }

                angular.element(document).on('mousewheel', horizScroll);

                scope.$on('destroy', function() {
                    angular.element(document).off('mousewheel', horizScroll);
                });

                //wait before setting so attrs can render
                $timeout(function() {
                    scope.contWidth = scope.nodesDiv.width();
                });
            }

            /*************************************
            ************ Local Functions *********
            **************************************/

            return dirDefn;
        }
    ]);
