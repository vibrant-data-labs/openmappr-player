angular.module('common')
.controller('DataPresentationCtrl', ['$scope', '$rootScope','$timeout', '$q', 'uiService', 'AttrInfoService' ,'layoutService', 'snapshotService', 'networkService', 'nodeSelectionService','projFactory', 'renderGraphfactory', 'FilterPanelService', 'BROADCAST_MESSAGES', 'dataGraph', 'hoverService', 'selectService',
function($scope, $rootScope, $timeout, $q, uiService, AttrInfoService, layoutService, snapshotService, networkService, nodeSelectionService, projFactory, renderGraphfactory, FilterPanelService, BROADCAST_MESSAGES, dataGraph, hoverService, selectService) {
    'use strict';

    /*************************************
    ****** Local Data ******************
    **************************************/
    var logPrefix = '[ctrlDataPresentation: ] ';
    var clusterAttrs = ['Cluster', 'Clusters', 'Cluster1', 'Cluster2', 'Cluster3', 'Cluster4'];
    var switchingNetwork = false;
    var tempLegendSorting = false;
    var numShowDataGroups = 0;
    var numShowLinkGroups = 0;
    var ITEMS_TO_SHOW = 100;
    var ITEMS_TO_SHOW_INITIALLY = 20;
    var categoriesToHighlight = [];
    var highlightLegendCategoriesThrottled = _.throttle(highlightLegendCategories, 100);
    var tempColorChangesMap = {};
    var projSettings = projFactory.getProjectSettings();
    var defNodesTitle = 'Nodes';


    /*************************************
    ****** SCOPE Bindings ****************
    **************************************/
    // Scope data
    $scope.ui = {
        summaryToggleOpen: false,
        highlightingNodes: false,
        showAllNodes: false,
        showingLinks: false,
        dataGroupsViewCount: ITEMS_TO_SHOW_INITIALLY,
        linkGroupsViewCount: ITEMS_TO_SHOW_INITIALLY,
        showViewToggle: true
    };

    $scope.dataGroupsInfo = {
        colorNodesBy: null,
        colorEdgesBy: null,
        sortOp: '',
        sortReverse: false,
        hasArchetypesOrBridgers: false
    };


    /**
    * Scope functions *****
    */
    $scope.hoverNodesByIds = _.debounce(hoverNodesByIds, 100);
    $scope.selectNodesByIds = _.debounce(selectNodesByIds, 100);
    $scope.hoverNodeNeighborByIds = _.debounce(hoverNodeNeighborByIds, 100);
    $scope.selectNodeNeighborByIds = _.debounce(selectNodeNeighborByIds, 100);
    //needed to correctly fire window.event for shift clicking in grid and list
    $scope.selectNodesByAttrib = _.throttle(selectNodesByAttrib, 100);
    $scope.unhoverNodes = _.debounce(unhoverNodes, 100);
    $scope.hoverNodesByAttrib = _.debounce(hoverNodesByAttrib, 100);
    $scope.selectEdgesByAttrib = _.debounce(selectEdgesByAttrib, 100);

    $scope.clearSelections = _.throttle(clearSelections, 100);
    $scope.updateClusterInfo = updateClusterInfo;
    $scope.discardClusterInfoUpdates = discardClusterInfoUpdates;
    $scope.changeColor = changeColor;
    $scope.sortByFreq = sortByFreq;
    $scope.sortByAlpha = sortByAlpha;
    $scope.nodeSizeAttrs = layoutService.getNodeSizeAttrs();
    $scope.MAPP_EDITOR_OPEN = $rootScope.MAPP_EDITOR_OPEN;

    $scope.sizeByAttrUpdate = sizeByAttrUpdate;
    function sizeByAttrUpdate(){
        console.log(logPrefix + 'sizeBy: ', $scope.vm.nodeSizeAttr.id);
        $scope.mapprSettings.nodeSizeAttr =  $scope.vm.nodeSizeAttr.id;
    }

    $scope.vm = {
        nodeSizeAttr: null,
        nodesTitle: projSettings.nodesTitle || defNodesTitle
    };

    $scope.vm.nodeSizeAttr = _.find($scope.nodeSizeAttrs, 'id', $scope.mapprSettings.nodeSizeAttr);
    $scope.selectedNodes = [];

    $scope.colorByAttrUpdate = function colorByAttrUpdate(colorAttr){
        console.log(logPrefix + 'colorBy: ', $scope.dataGroupsInfo.colorNodesBy.id);
        $scope.dataGroupsInfo.colorNodesBy = colorAttr;
        $scope.mapprSettings.nodeColorAttr =  $scope.dataGroupsInfo.colorNodesBy.id;
    };

    $scope.colorByEdgeAttrUpdate = function colorByEdgeAttrUpdate(colorAttr) {
        console.log(logPrefix + 'edge colorBy: ', $scope.dataGroupsInfo.colorEdgesBy.id);
        $scope.dataGroupsInfo.colorEdgesBy = colorAttr;
        $scope.mapprSettings.edgeColorAttr =  $scope.dataGroupsInfo.colorEdgesBy.id;
    };

    $scope.loadMoreDataGroups = function() {
      console.log(logPrefix + 'loading more data groups: ', numShowDataGroups)
        numShowDataGroups++;
        $scope.ui.dataGroupsViewCount += numShowDataGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY;
    };

    $scope.loadMoreLinkGroups = function() {
        numShowLinkGroups++;
        $scope.ui.linkGroupsViewCount += numShowLinkGroups * ITEMS_TO_SHOW + ITEMS_TO_SHOW_INITIALLY;
    };



    /*************************************
    ****** Initialisation Logic **********
    **************************************/
    initialise();



    /*************************************
    ****** Event Listeners ***************
    **************************************/
    $scope.$on(BROADCAST_MESSAGES.network.changed, function() {
        switchingNetwork = true;
    });
    $scope.$on(BROADCAST_MESSAGES.layout.changed, initialise);
    $scope.$on(BROADCAST_MESSAGES.layout.mapprSettingsUpdated, function(event, data) {
        if(!data.regenGraph) { refreshDataGroups(event, data); }
    });
    $scope.$on(BROADCAST_MESSAGES.renderGraph.changed, initialise);
    $scope.$on(BROADCAST_MESSAGES.renderGraph.loaded, initialise);

    $scope.$on(BROADCAST_MESSAGES.overNodes, highlightLegendCategoriesThrottled);

    $scope.$on(BROADCAST_MESSAGES.outNodes, function() {
        outLegendCategories();
    });

    $scope.$on(BROADCAST_MESSAGES.dataGraph.nodeAttrsUpdated, function() {
        $scope.nodeColorAttrs = layoutService.getNodeColorAttrs();
    });

    $scope.$on(BROADCAST_MESSAGES.network.updated, function() {
        $scope.ui.showViewToggle = !_.get(networkService.getCurrentNetwork(), 'networkInfo.hideArchsBridgers');
    });



    /*************************************
    ****** Core Functions *************
    **************************************/

    function initialise() {
        if(_.any($scope.dataGroupVMs, 'editClusterName')) {
            console.info(logPrefix + 'legend in edit mode, skipping initialise.');
            return;
        }
        _.assign($scope.ui, {
            summaryToggleOpen: false,
            highlightingNodes: false,
            showViewToggle: !_.get(networkService.getCurrentNetwork(), 'networkInfo.hideArchsBridgers')
        });

        _.assign($scope.dataGroupsInfo, {
            colorNodesBy: null,
            colorEdgesBy: null,
            sortOp: '',
            sortReverse: false
        });

        if(switchingNetwork || !dataGraph.getRawDataUnsafe()) {
            var x = $scope.$on(BROADCAST_MESSAGES.sigma.rendered, function() {
                x();
                $scope.nodeColorAttrs = layoutService.getNodeColorAttrs();
                $scope.edgeColorAttrs = layoutService.getEdgeColorAttrs();
                refreshDataGroups();
                switchingNetwork = false;
            });
        }
        else {
            $scope.nodeColorAttrs = layoutService.getNodeColorAttrs();
            $scope.edgeColorAttrs = layoutService.getEdgeColorAttrs();
            refreshDataGroups();
        }
    }

    function refreshDataGroups() {
        if(!$scope.layout) {
            console.error('No layout, can\'t generate data groups!');
            return;
        }
        if(_.any($scope.dataGroupVMs, 'editClusterName')) {
            console.info(logPrefix + 'legend in edit mode, skipping regeneration.');
            return;
        }
        console.group(logPrefix + 'starting legend generation.');
        $scope.nodeColorAttrs = $scope.nodeColorAttrs.length > 0
            ? $scope.nodeColorAttrs
            : layoutService.getNodeColorAttrs();

        $scope.edgeColorAttrs = $scope.edgeColorAttrs.length > 0
            ? $scope.edgeColorAttrs
            : layoutService.getEdgeColorAttrs();

        $scope.dataGroupsInfo.sortOp = _.find($scope.dataGroupSortOptions, {'title': $scope.layout.setting('legendSortOption')});
        $scope.dataGroupsInfo.sortReverse = $scope.layout.setting('legendSortIsReverse');
        $scope.dataGroupsInfo.colorNodesBy = _.find($scope.nodeColorAttrs, 'id', $scope.mapprSettings.nodeColorAttr);
        $scope.dataGroupsInfo.colorEdgesBy = _.find($scope.edgeColorAttrs, 'id', $scope.mapprSettings.edgeColorAttr);
        console.assert($scope.dataGroupsInfo.colorNodesBy, "$scope.dataGroupsInfo.colorNodesBy can't be null");
        console.assert($scope.dataGroupsInfo.colorEdgesBy, "$scope.dataGroupsInfo.colorEdgesBy can't be null");
        triggerDGVMGeneration();

    }

    function triggerDGVMGeneration() {
        console.log(logPrefix + 'generating data groups');

        dataGraph.getRawData().then(function(graphData) {
            generateDataGroupVMs(graphData);
            generateDataGroupLinkVMs(graphData);
            if(clusterAttrs.indexOf($scope.mapprSettings.nodeColorAttr) > -1) {
                addClusterInfo($scope.dataGroupVMs);
            }
        });
        console.groupEnd();
    }

    // Constructor
    function ColorObject (name, num, color, originalTitle, descr, suggestion, count) {
        this.name = name;
        this.descr = descr;
        this.num = num; // count or the numeric value
        this.count = count; //count for numeric value
        this.color = {
            'color': color
        };
        this.colorval =  color;
        this.highlightOnNodeHover =  false;
        this.originalTitle = originalTitle;
        this.originalDescr = descr || '';
        this.origSuggestion = suggestion || '';
        this.showClusterEdit = false;
        this.editClusterName = false;
    }

    // Adds cluster info to color map
    function addClusterInfo(dataGroupVMs) {
        var clusterInfoValsMap = _.get(networkService.getCurrentNetwork(), 'clusterInfo', {});

        _.each(dataGroupVMs, function(colorVal) {
            var clusterVal = colorVal.originalTitle;
            colorVal.bridgers = [];
            colorVal.archetypes = [];

            var clusterValInfo = clusterInfoValsMap[clusterVal];
            if( clusterValInfo ) {
                if(_.isArray(clusterValInfo.topBridgerNodeIds)) {
                    $scope.dataGroupsInfo.hasArchetypesOrBridgers = true;
                    colorVal.bridgers = _.map(_.take(clusterValInfo.topBridgerNodeIds, 3), function(nodeId) {
                        return '' + nodeId;
                    });
                }
                if(_.isArray(clusterValInfo.topArchetypeNodeIds)) {
                    $scope.dataGroupsInfo.hasArchetypesOrBridgers = true;
                    colorVal.archetypes = _.map(_.take(clusterValInfo.topArchetypeNodeIds, 3), function(nodeId) {
                        return '' + nodeId;
                    });
                }

            }
        });
        return dataGroupVMs;
    }

    /**
     * colorMap generates colorMap data. It also limits the list size to 100.
     * @param  {[type]} graphData [description]
     * @return {[type]}           [description]
     */
    function generateDataGroupVMs(graphData) {
        console.log(logPrefix + 'Building colorMap');
        var layout = $scope.layout;
        var networkId = graphData.networkId;
        $scope.colorAttr = $scope.mapprSettings.nodeColorAttr;
        var attrInfo = AttrInfoService.getNodeAttrInfoForRG().getForId($scope.colorAttr);
        if(!attrInfo) { throw new Error('Couldn\'t get attrInfo for attr:', $scope.colorAttr); }

        $scope.isNodeColorNumeric = attrInfo.isNumeric;
        $scope.dataGroupVMs = [];
        var temp = null;
        var sortFunc = _.noop();

        var legendSortOp = $scope.layout.setting('legendSortOption');
        var legendSortIsReverse = $scope.layout.setting('legendSortIsReverse');
        if(tempLegendSorting) {
            // Sort legend while editing
            legendSortOp = $scope.dataGroupsInfo.sortOp.title;
            legendSortIsReverse = $scope.dataGroupsInfo.sortReverse;
        }

        switch(legendSortOp) {
        case 'frequency':
            if(legendSortIsReverse) {
                sortFunc = function(a, b) {
                    return b.num - a.num;
                };
            }
            else {
                sortFunc = function(a, b) {
                    return a.num - b.num;
                };
            }

            break;
        case 'alphabetic':
            if(legendSortIsReverse) {
                sortFunc = function(a, b) {
                    if(a.name.toLowerCase() > b.name.toLowerCase()) return -1;
                    if(a.name.toLowerCase() < b.name.toLowerCase()) return 1;
                    return 0;
                };
            }
            else {
                sortFunc = function(a, b) {
                    if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
                    if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
                    return 0;
                };
            }
            break;
        default:
            // Nothing
        }

        var key, name, count, col;

        if(attrInfo.isNumeric) {
            // console.log('bounds: ', attrInfo.bounds);
            temp = _.map(attrInfo.bounds, function(val, stat) {
                col = d3.rgb(layout.scalers.color(val)).toString();
                var descr = projFactory.getClusterDescr(networkId, attrInfo.attr.id, stat);
                var suggestion = projFactory.getClusterSuggestion(networkId, attrInfo.attr.id, stat);//begin changes for new title
                var nodes = dataGraph.getNodesByAttrib(attrInfo.attr.id, val);
                var graph = dataGraph.getRenderableGraph();
                var lowVal = Number.POSITIVE_INFINITY, highVal = Number.NEGATIVE_INFINITY;
                _.each(nodes, function(nId) {
                    var attrVal = graph.getNodeById(nId).attr[attrInfo.attr.id];
                    lowVal = Math.min(lowVal, attrVal);
                    highVal = Math.max(highVal, attrVal);
                });
                var bin = Number(highVal.toFixed(2)) + " - " + Number(lowVal.toFixed(2));
                if(nodes.length === 0) {
                    bin = 'NA';
                }
                return new ColorObject(stat + " (" + bin + ")" , val, col, stat, descr, suggestion, nodes.length);
                //end changes for new title
                // return new ColorObject(stat, val, col, stat, descr, suggestion);
            })
            .sort(function(a,b) {
                console.log('num: ', a.num, b.num);
                return b.num - a.num;
            });
            $scope.dataGroupVMs = temp;

            //color picker object
            $scope.colorPickerNodeArr = [];
            $scope.colorPickerNodeArr = colorPickerFromColorMap($scope.dataGroupVMs);
        }
        else if(attrInfo.isTag) {
            // for tags, we concatenate all tags and use them to color the group.
            temp = [];
            for (key in attrInfo.nodeValsFreq) {
                name = key;
                count = attrInfo.nodeValsFreq[key];
                col = d3.rgb(layout.scalers.color(key)).toString();
                // var descr = projFactory.getClusterDescr(networkId, attrInfo.attr.id, key);
                // var suggestion = projFactory.getClusterSuggestion(networkId, attrInfo.attr.id, key);
                temp.push(new ColorObject(name, count, col, key, null, null));
                // temp.push(new ColorObject(name, count, col, key, descr, suggestion));
            }
            $scope.dataGroupVMs = temp.sort(sortFunc);
            console.log('dataGroupVMs: ', $scope.dataGroupVMs);
        } else {
            temp = [];
            for (key in attrInfo.valuesCount) {
                name = key;
                count = attrInfo.valuesCount[key];
                col = d3.rgb(layout.scalers.color(key)).toString();
                var descr = projFactory.getClusterDescr(networkId, attrInfo.attr.id, key);
                var suggestion = projFactory.getClusterSuggestion(networkId, attrInfo.attr.id, key);
                temp.push(new ColorObject(name, count, col, key, descr, suggestion));
            }
            $scope.dataGroupVMs = temp.sort(sortFunc);
            console.log('dataGroupVMs: ', $scope.dataGroupVMs);
        }
    }

    function generateDataGroupLinkVMs() {
        console.group(logPrefix + 'Building edgeColorMap');
        var layout = $scope.layout;
        $scope.edgeColorAttr = $scope.mapprSettings.edgeColorAttr;
        var attrInfo = AttrInfoService.getLinkAttrInfoForRG().getForId($scope.edgeColorAttr);
        if(!attrInfo) throw new Error('Couldn\'t get attrInfo for attr:', $scope.colorAttr);

        $scope.isEdgeColorNumeric = attrInfo.isNumeric;
        $scope.dataGroupLinkVMs = [];
        var temp = [];
        if(attrInfo.isNumeric) {
            console.log('numeric');
            temp = _.map(attrInfo.bounds, function(val, stat) {
                var col = d3.rgb(layout.scalers.edgeColor(val)).toString();
                return new ColorObject(stat + ' ('+val+')', val, col, stat);
            }).sort(function(a,b) {
                return b.num - a.num;
            });
            $scope.dataGroupLinkVMs = temp;

            $scope.colorPickerEdgeArr = [];
            $scope.colorPickerEdgeArr = colorPickerFromColorMap($scope.dataGroupLinkVMs);
        } else {
            temp = [];
            for (var key in attrInfo.valuesCount) {
                var val = attrInfo.valuesCount[key];
                temp.push(new ColorObject(key, val, d3.rgb(layout.scalers.edgeColor(key)).toString(), key));
            }
            $scope.dataGroupLinkVMs = temp.sort(function(a,b) { return b.num - a.num;});
        }

        console.groupEnd($scope.dataGroupLinkVMs);
    }

    //convert dataGroupVMs to colorPicker object
    function colorPickerFromColorMap(colValMap) {
        var minCol = _.min(colValMap, 'num').colorval;
        var maxCol = _.max(colValMap, 'num').colorval;
        return [
            {
                name:'Min',
                col:minCol,
                value:0
            },
            {
                name:'Max',
                col:maxCol,
                value:1
            }
        ];
    }

    function hoverNodesByIds(nodeIds, $event) {
        hoverService.hoverNodes({ids: nodeIds});
    }

    function selectNodesByIds(nodeIds, $event) {
        selectService.selectNodes({ ids: nodeIds });
        FilterPanelService.rememberSelection(false);
    }

    function hoverNodeNeighborByIds(nodeIds, $event) {
        hoverService.hoverNodes({ids: nodeIds, withNeighbors: true});
    }

    function selectNodeNeighborByIds(nodeIds, $event) {
        selectService.selectNodes({ ids: nodeIds });
        //nodeSelectionService.selectNodeNeighborIdList(nodeIds, $event);
    }

    function selectNodesByAttrib(value, $event) {
        console.log('window.event: ', window.event);
        var attrId = getCurrAttrId();
        
        var found = $scope.selectedNodes.findIndex(attrib => attrib  === value);
        if (found < 0)
            $scope.selectedNodes.push(value);
        else {
            console.log(found, 8887);
            
            $scope.selectedNodes.splice(found, 1);
        }
        console.log($scope.selectedNodes, 888);
        selectService.selectNodes({ attr: attrId, value: value });
    }

    function clearSelections() {
        console.log('window.event: ', window.event);
        
        selectService.unselect();
    }

    function hoverNodesByAttrib(value, $event) {
        outLegendCategories();
        var attrId = getCurrAttrId();
        hoverService.hoverNodes({attr: attrId, value: value});
    }

    function unhoverNodes($event) {
        hoverService.unhover();
    }

    function selectEdgesByAttrib(value, $event) {
        var attrId = $scope.dataGroupsInfo.colorEdgesBy
            ? $scope.dataGroupsInfo.colorEdgesBy.id
            : null;
        if(!attrId) throw new Error('Couldn\'t get attr id to hover nodes by');
        nodeSelectionService.clearSelections();
        nodeSelectionService.selectEdgesByAttrib(attrId, value, $event);
    }

    function getCurrAttrId() {
        return $scope.dataGroupsInfo.colorNodesBy
            ? $scope.dataGroupsInfo.colorNodesBy.id
            : null;
    }

    function highlightLegendCategories(e, data) {
        // console.log(logPrefix, data.nodes);
        highlightLegendCategoriesThrottled.cancel();
        //force apply
        $timeout(function() {
            $scope.ui.highlightingNodes = true;
            categoriesToHighlight.length = 0;
            if(angular.isObject(data.nodes)) {
                _.each(data.nodes, function(node) {
                    var cat = node.attr[$scope.mapprSettings.nodeColorAttr] || '';
                    cat && categoriesToHighlight.push(cat);
                });

                var graphData = dataGraph.getRawDataUnsafe();
                var isNumericAttr = graphData && AttrInfoService.getNodeAttrInfoForRG().getForId($scope.mapprSettings.nodeColorAttr).isNumeric;

                _.each(categoriesToHighlight, function(cat) {
                    var catToFind = isNumericAttr ? findClosestNumericAttrVal(cat) : cat.toString();
                    if(catToFind) {
                        var mapCategory = _.find($scope.dataGroupVMs, function(colorval) {
                            return colorval.originalTitle.trim().toLowerCase() == catToFind.trim().toLowerCase();
                        });

                        if(mapCategory) {
                            mapCategory.highlightOnNodeHover = true;
                        }
                    }
                });
            }

        });

    }

    function findClosestNumericAttrVal(catNumColor) {
        if(!catNumColor) {
            throw new Error('Color value expected');
        }
        return _.reduce($scope.dataGroupVMs, function(prev, curr) {
            return Math.abs(curr.num - catNumColor) < Math.abs(prev.num - catNumColor) ? curr : prev;
        }).name;
    }

    // Updates cluster name, descr, suggestion & color
    function updateClusterInfo(clusterItem) {
        var changeClusterNameP = $q.when(null),
            changeClusterDescriptorsP = $q.when(null);

        if(clusterItem.name !== clusterItem.originalTitle) {
            changeClusterNameP = changeClusterName(clusterItem);
        }
        if(clusterItem.descr !== clusterItem.originalDescr
            || clusterItem.suggestion !== clusterItem.origSuggestion) {
            changeClusterDescriptorsP = changeClusterDescriptors(clusterItem);
        }

        $q.all([changeClusterNameP, changeClusterDescriptorsP])
        .then(function() {
            return changeClusterColor();
        })
        .then(function() {
            console.log(logPrefix + 'cluster ' + clusterItem.originalTitle + ' updated');
            uiService.logSuccess('Cluster Info Updated');
        })
        .catch(function(err) {
            console.error(logPrefix + 'some error while updating cluster ' + clusterItem.originalTitle, err);
            uiService.logError('Cluster Info could not be updated');
        });

    }

    function discardClusterInfoUpdates(clusterItem) {
        console.log(logPrefix + 'Canceling cluster name change');
        clusterItem.name = clusterItem.originalTitle;

        var map = $scope.mapprSettings.nodeUserColorMap[$scope.mapprSettings.nodeColorAttr];
        _.each(tempColorChangesMap, function(colorProp, key) {
            if(colorProp.fromMPSettings) {
                map[key] = colorProp.colorval;
            }
            else {
                delete map[key];
            }
        });
        tempColorChangesMap = {};
        refreshDataGroups();
    }

    function updateSnaps(snaps) {    }

    function sortByAlpha() {
        if($scope.mapprSettings.legendSortOption == 'alphabetic') {
            $scope.mapprSettings.legendSortIsReverse = !$scope.mapprSettings.legendSortIsReverse;
        }
        $scope.mapprSettings.legendSortOption = 'alphabetic';
        updateClusterSorting('alphabetic', $scope.mapprSettings.legendSortIsReverse, false)
        .then(function() {
            console.log(logPrefix + 'groups now sorted alphabeticcally');
            uiService.log('Data groups now sorted alphabetically for this snapshot');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in updating sort options', err);
            uiService.log('Sort option could not be updated');
        });
    }

    function sortByFreq( ) {
        if($scope.mapprSettings.legendSortOption == 'frequency') {
            $scope.mapprSettings.legendSortIsReverse = !$scope.mapprSettings.legendSortIsReverse;
        }
        $scope.mapprSettings.legendSortOption = 'frequency';
        updateClusterSorting('frequency', $scope.mapprSettings.legendSortIsReverse, false)
        .then(function() {
            console.log(logPrefix + 'groups now sorted by frequency');
            uiService.log('Data groups now sorted by frequency for this snapshot');
        })
        .catch(function(err) {
            console.error(logPrefix + 'error in updating sort options', err);
            uiService.log('Sort option could not be updated');
        });
    }

    function updateClusterSorting(sortOp, sortReverse, updateAll) {
        var snapsToUpdate = updateAll ? snapshotService.getSnapshotsUnsafe() : [snapshotService.getCurrentSnapshot()];
        _.each(snapsToUpdate, function(snapshot) {
            snapshot.layout.settings.legendSortOption = sortOp;
            snapshot.layout.settings.legendSortIsReverse = sortReverse;
        });
        return updateSnaps(snapsToUpdate);
    }

    function changeClusterColor() {
        tempColorChangesMap = {};
        var snapshot = snapshotService.getCurrentSnapshot();
        snapshot.layout.settings.nodeUserColorMap = $scope.layout.setting('nodeUserColorMap');
        return updateSnaps([snapshot]);
    }

    function changeClusterName(clusterItem) {
        var colorAttrId = $scope.dataGroupsInfo.colorNodesBy.id,
            oldVal = clusterItem.originalTitle,
            newVal = clusterItem.name,
            changeMap = {};

        console.log(logPrefix + "Update Text for Value: %s to: %s", oldVal, newVal);
        changeMap[oldVal] = newVal;

        return dataGraph.changeNodeCatNames(colorAttrId, changeMap)
        .then(function() {
            clusterItem.originalTitle = newVal;
            // update color mapping
            var map = $scope.mapprSettings.nodeUserColorMap[colorAttrId];
            if(map && map[oldVal] != null) {
                map[newVal] = map[oldVal];
                delete map[oldVal];
            }
            $scope.layout.setup(); // update all layouts
            renderGraphfactory.redrawGraph();
        }, function(err) {
            console.error(logPrefix + 'Cluster name not updated');
            console.log(logPrefix + 'Reverting to old val');
            clusterItem.name = clusterItem.originalTitle;
            throw err;
        });
    }

    function changeClusterDescriptors(clusterItem) {
        var networkId = networkService.getCurrentNetwork().id;
        var colorAttrId = $scope.dataGroupsInfo.colorNodesBy.id,
            oldDescrVal = clusterItem.originalDescr,
            newDescrVal = clusterItem.descr,
            oldSuggVal = clusterItem.origSuggestion,
            newSuggVal = clusterItem.suggestion,
            projSettings = projFactory.getProjectSettings();

        console.log(logPrefix + "Update Desc for Value: %s to: %s", oldDescrVal, newDescrVal);
        console.log(logPrefix + "Update Suggestion for Value: %s to: %s", oldSuggVal, newSuggVal);
        // clusterMeta.[networkId].[attrId].[attrVal].[Descr]
        _.set(projSettings, 'clusterMeta.' + networkId + '.' + colorAttrId + '.' + clusterItem.name + '.descr', newDescrVal);
        _.set(projSettings, 'clusterMeta.' + networkId + '.' + colorAttrId + '.' + clusterItem.name + '.suggestion', newSuggVal);

        return projFactory.updateProjectSettings(projSettings)
        .then(function() {
            clusterItem.originalDescr = newDescrVal;
            clusterItem.origSuggestion = newSuggVal;
        }, function(err) {
            console.error(logPrefix + 'Cluster descr not updated', err);
            console.log(logPrefix + 'Reverting to old val');
            clusterItem.descr = oldDescrVal;
            clusterItem.suggestion = oldSuggVal;
        });
    }

    function changeColor(l, col) {
        var colorAttr = $scope.mapprSettings.nodeColorAttr;
        $scope.mapprSettings.nodeUserColorMap[colorAttr] = $scope.mapprSettings.nodeUserColorMap[colorAttr] || {};
        var map = $scope.mapprSettings.nodeUserColorMap[colorAttr];
        console.log(logPrefix + 'Got color map: %O', map);
        console.log(logPrefix + 'assigning color', col);
        if(!_.has(tempColorChangesMap, l.originalTitle)) {
            if(_.has(map, l.originalTitle)) {
                tempColorChangesMap[l.originalTitle] = {
                    colorval: map[l.originalTitle],
                    fromMPSettings: true
                };
            }
            else {
                tempColorChangesMap[l.originalTitle] = {
                    colorval: l.colorval,
                    fromMPSettings: false
                };
            }
        }
        map[l.originalTitle] = col;
        l.color = {
            'color': col
        };
    }

    function outLegendCategories() {
        highlightLegendCategoriesThrottled.cancel();
        $scope.ui.highlightingNodes = false;
        _.each($scope.dataGroupVMs, function(mapCategory) {
            mapCategory.highlightOnNodeHover = false;
            // console.log(logPrefix + 'unhighlighting ', mapCategory);
        });
    }

}
]);
