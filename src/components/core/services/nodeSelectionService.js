/**
* APIs for Node(s) selection from anywhere but graph
*/
angular.module('common')
    .service('nodeSelectionService', ['$q', '$sce', 'graphSelectionService', 'zoomService', 'dataGraph', 'graphHoverService', 'BreadCrumbService', 'SelectorService', 'AttrInfoService',
        function($q, $sce, graphSelectionService, zoomService, dataGraph, graphHoverService, BreadCrumbService, SelectorService, AttrInfoService) {
            'use strict';
            /*
     * Nodes Selection
     */

            /*************************************
    *************** API ******************
    **************************************/

            this.hoverNodesByAttrib       = hoverNodesByAttrib;
            this.hoverNodesByAttributes   = hoverNodesByAttributes;
            this.unhoverNodesByAttributes = unhoverNodesByAttributes;
            this.unhoverNodesByAttrib = unhoverNodesByAttrib;
            this.hoverNodesByAttribRange  = hoverNodesByAttribRange;
            this.hoverNodeIdList          = hoverNodeIdList;
            this.hoverNodeNeighborIdList  = hoverNodeNeighborIdList;
            this.selectNodesByAttrib      = selectNodesByAttrib;
            this.selectNodesByAttribRange = selectNodesByAttribRange;
            this.selectNodeIdList         = selectNodeIdList;
            this.selectNodeNeighborIdList = selectNodeNeighborIdList;
            this.selectAllNodes           = selectAllNodes;
            this.selectBySelector         = selectBySelector;
            this.selectEdgesByAttrib      = selectEdgesByAttrib;
            this.nodeAttrsToArray         = nodeAttrsToArray;
            this.edgeAttrsToArray         = edgeAttrsToArray;
            this.setSelectedNodes         = setSelectedNodes;
            this.getSelectedNodes         = getSelectedNodes;
            this.getSelectionInfo         = getSelectionInfo;
            this.setSelectionInfo         = setSelectionInfo;
            this.clearSelections          = clearSelections;
            this.selectionActionByAttributes = selectionActionByAttributes;
            this.unselectActionByAttributes = unselectActionByAttributes;
            this.highlightAllSelected = highlightAllSelected;
            this.clearSelectedNodes = clearSelectedNodes;
            this.addNodesToSelected = addNodesToSelected;
            this.addNodesToTempHighlightedNodes = addNodesToTempHighlightedNodes;
            this.removeNodesFromTempHighlightedNodes = removeNodesFromTempHighlightedNodes;
            this.selectionActionByAttribRange = selectionActionByAttribRange;
            this.getHistogramRangeNodeIds = getHistogramRangeNodeIds;
            this.getSelectedActionNodes = getSelectedActionNodes;




            /*************************************
    ********* Local Data *****************
    **************************************/

            // var logPrefix = '[nodeSelectionService: ] ';

            var selectedNodesData = null;
            var selectionInfo = {};
            var selectedActionNodes = [];
            var histogramRanges = {};
            var tempHighlightNodes = [];


            /*************************************
    ********* Core Functions *************
    **************************************/

            function setSelectedNodes(data) {
                console.error("######## setSelectedNodes Called!");
                selectedNodesData = data;
            }

            function getSelectedNodes() {
                console.error("######## getSelectedNodes Called!");
                return selectedNodesData;
            }

            // works only for exact matches
            // attr - by which node Attr
            // value - hover nodes for which the value of above mentioned attr is 'value'
            function hoverNodesByAttrib(attr, value, $event, fivePct) {
                _hoverHelper(value != null ? dataGraph.getNodesByAttrib(attr, value, fivePct) : []);
            }

            function hoverNodesByAttributes(attr, values, $event, fivePct) {
                _hoverHelper(values.length ? dataGraph.getNodesByAttributes(attr, values, fivePct) : []);
            }

            function unhoverNodesByAttributes(attr, values, $event, fivePct) {
                _unhoverHelper(values.length ? dataGraph.getNodesByAttributes(attr, values, fivePct) : []);
            }

            function unhoverNodesByAttrib(attr, values, $event, fivePct) {
                _unhoverHelper(values.length ? dataGraph.getNodesByAttrib(attr, values, fivePct) : []);
            }

            function hoverNodesByAttribRange(attr, min, max) {
                _hoverHelper(dataGraph.getNodesByAttribRange(attr, min, max));
                // highlightAllSelected(true);
            }

            function hoverNodeIdList(nodeIds) {
                _hoverHelper(nodeIds);
            }

            function hoverNodeNeighborIdList(nodeIds) {
                _hoverHelper(nodeIds, 1);
            }

            function getHistogramRangeNodeIds() {
                var nodesIds = [];

                _.forEach(histogramRanges, function (attrRange, attribute) {
                    if (attrRange && attribute) {
                        var selector = SelectorService.newSelector()
                            .ofAttrRange(attribute, attrRange.min, attrRange.max);
                        selector.selectfromDataGraph();
                        var ids = selector.nodeIds;
                        nodesIds = _.uniq(nodesIds.concat(ids));
                    }
                });

                return _filterSubsettedNodeIds(nodesIds);
            }

            // Select action - START
            function selectionActionByAttributes(attr, values, subsettedValues) {
                if (!values || !values.length) {
                    return;
                }

                subsettedValues = subsettedValues || [];

                _.remove(values, function (value) {
                   return subsettedValues.indexOf(value) > -1;
                });

                selectionInfo[attr] = selectionInfo[attr] || [];
                selectionInfo[attr] = [...selectionInfo[attr], ...values];

                selectionInfo[attr] = _.uniq(selectionInfo[attr]);

                highlightAllSelected(true);
            }

            function unselectActionByAttributes(attr, values) {
                _.remove(selectionInfo[attr], function (value) {
                    return values.indexOf(value) > -1;
                });

                if (selectionInfo[attr] && !selectionInfo[attr].length) {
                    delete selectionInfo[attr];
                }

                highlightAllSelected(true);
            }

            function selectionActionByAttribRange(attr, min, max) {
                var selector = SelectorService.newSelector()
                    .ofAttrRange(attr, min, max);

                histogramRanges[attr] = {
                    min: min,
                    max: max
                };

                selector.selectfromDataGraph();
                var ids = selector.nodeIds;
                var filteredIds = _filterSubsettedNodeIds(ids);

                _hoverHelper(filteredIds);

                return filteredIds;
            }

            function highlightAllSelected(fivePct) {
                graphHoverService.clearHovers(true);
                var subsettedNodes = dataGraph.getAllNodes();
                var nodes = [];

                _.forEach(selectionInfo, function (attrValues, attribute) {
                    if (attrValues && attrValues.length) {
                        nodes = attrValues.length ? dataGraph.getNodesByAttributes(attribute, attrValues, fivePct, nodes.length ? nodes : (subsettedNodes || []), true) : [];                   
                    }
                });

                var nodesIds = _.map(nodes, 'id');

                _.forEach(histogramRanges, function (attrRange, attribute) {
                    if (attrRange && attribute) {
                        var selector = SelectorService.newSelector()
                            .ofAttrRange(attribute, attrRange.min, attrRange.max);
                        selector.selectfromDataGraph();
                        var ids = selector.nodeIds;
                        nodesIds = _.uniq(nodesIds.concat(ids));
                    }
                });

                nodesIds = nodesIds.concat(_.map(selectedActionNodes, 'id'));

                nodesIds = nodesIds.concat(_.map(tempHighlightNodes, 'id'));

                _hoverHelper(nodesIds);
            }

            function getSelectedActionNodes() {
                return selectedActionNodes;
            }

            // Select action - END
            function selectBySelector(selector, $event, raiseEvents) {
                console.debug('select by Selector------------------------', selector);
                _selectHelper(selector, raiseEvents, $event);
            }

            function selectNodesByAttrib(attr, value, $event, raiseEvents, fivePct) {
                console.debug('select by Attrib------------------------', attr, value);
                var selector = SelectorService.newSelector();
                if (attr.startsWith('Cluster')) {
                    selector.ofCluster(attr, value, fivePct);
                } else {
                    selector.ofAttrValue(attr, value, fivePct);
                }
                _selectHelper(selector, raiseEvents, $event);
            }

            function selectNodesByAttribRange(attr, min, max, $event, raiseEvents) {
                console.debug('select range------------------------', attr, min, max);
                var selector = SelectorService.newSelector()
                    .ofAttrRange(attr, min, max);
                _selectHelper(selector, raiseEvents, $event);
            }

            function selectNodeIdList(nodeIds, $event, raiseEvents, preventZoom) {

                console.debug('select node list------------------------');
                var selector = SelectorService.newSelector()
                    .ofMultipleNodes(nodeIds);
                _selectHelper(selector, raiseEvents, $event, 0, preventZoom);
            }

            function selectNodeNeighborIdList(nodeIds, $event, raiseEvents) {

                console.debug('select node list------------------------');
                var selector = SelectorService.newSelector()
                    .ofMultipleNodes(nodeIds);
                _selectHelper(selector, raiseEvents, $event, 1);
            }

            function selectAllNodes($event, raiseEvents) {
                console.debug('select all node ------------------------');
                var selector = SelectorService.newSelector()
                    .ofMultipleNodes(_.pluck(dataGraph.getAllNodes(), 'id'));
                _selectHelper(selector, raiseEvents, $event);
            }

            function selectEdgesByAttrib(attr, value, $event, raiseEvents) {
                console.log('Selecting from Legend by value: %s for attr: %s', value, attr);
                var selectedEdges = dataGraph.getEdgesByAttrib(attr, value);
                if (!selectedEdges || (angular.isArray(selectedEdges) && selectedEdges.length === 0)) {
                    console.warn('Nothing matched the selection criteria');
                } else {
                    // Find all nodes which need to be selected
                    var selectedNodeIds = _.keys(_.reduce(selectedEdges, function(chosenNodes, edge) {
                        chosenNodes[edge.source] = edge.source;
                        chosenNodes[edge.target] = edge.target;
                        return chosenNodes;
                    }, {}));
                    // zero degree selection
                    graphSelectionService.runFuncInCtx(function() {
                        if ($event.shiftKey)
                            graphSelectionService.appendNodeIdsToSelection(selectedNodeIds, 0);
                        else
                            graphSelectionService.selectByIds(selectedNodeIds, 0);
                    }, raiseEvents, true);
                }
            }


            function clearSelectedNodes() {
                selectionInfo = {};
                selectedActionNodes = [];
                histogramRanges = {};
            }


            // attrObj -> a node's Attr Obj
            // Note:- Function should loop over attrsObj's attrs instead of datagraph's attrs, since attributes
            //  with empty values are deleted during parsing for that node. But that feature exists right now
            //  for excel parsing only, so can't guarantee for every dataset.
            function nodeAttrsToArray(attrObj) {
                var result = [];
                //get the attribute visibility and type from datagraph nodeattrs
                var nodeAttrs = dataGraph.getNodeAttrs();
                _.each(nodeAttrs, function(attr) {
                    var interim = {};
                    var attrObjVal = attrObj[attr.id];
                    if (attrObjVal == null || (_.isString(attrObjVal) && attrObjVal.trim() === '')) {
                        console.warn('Ignoring empty attr - ' + attr.id, attrObjVal);
                    } else {
                        interim.id = attr.id;
                        interim.title = attr.title;
                        if (attr.attrType == 'picture' || attr.attrType == 'video' || attr.attrType == 'audio_stream' || attr.attrType == 'video_stream') {
                            interim.value = $sce.trustAsResourceUrl(attrObjVal);
                        } else {
                            interim.value = attrObjVal;
                        }
                        interim.attrType = attr.attrType || 'string';
                        interim.renderType = attr.renderType || 'default';
                        interim.visible = attr.visible;
                        interim.isStarred = _.has(attr, 'isStarred') ? attr.isStarred : false;
                        interim.searchable = _.has(attr, 'searchable') ? attr.searchable : true;
                        interim.spHeight = AttrInfoService.getAttrSPHeight(interim.id, interim.renderType, interim.visible, true);
                        result.push(interim);
                    }
                });

                return result;
            }

            // generates attrListing for edge
            function edgeAttrsToArray(edge) {
                var edgeAttributeArray = [];
                //get the attribute visibility and type from datagraph nodeattrs
                var edgeAttrs = dataGraph.getEdgeAttrsTitleKeys();
                angular.forEach(edge.attr, function(value, key) {
                    if (edgeAttrs[key] && edgeAttrs[key].visible) {
                        var interim = {};
                        interim.id = edge.id;
                        interim.title = key;
                        interim.value = value;
                        interim.attrType = (edgeAttrs[key] && edgeAttrs[key].attrType) || 'string';
                        edgeAttributeArray.push(interim);
                    }
                });
                return edgeAttributeArray;
            }

            function setSelectionInfo(category, value) {
                console.error("######## setSelectionInfo Called!");
                selectionInfo[category] = value;
            }

            function getSelectionInfo() {
                console.error("######## getSelectionInfo Called!");
                return selectionInfo || {};
            }

            function clearSelections() {
                graphSelectionService.clearSelections(true);
                BreadCrumbService.newBreadCrumb(); // clear out the breadcrumbs
            }

            function addNodesToSelected(nodes) {
                selectedActionNodes = selectedActionNodes.concat(_filterSubsettedNodes(nodes));
                selectedActionNodes = _.uniq(selectedActionNodes, 'id');
            }

            function addNodesToTempHighlightedNodes(nodes) {
                tempHighlightNodes = [];
                tempHighlightNodes = tempHighlightNodes.concat(_filterSubsettedNodes(nodes));
            }

            function removeNodesFromTempHighlightedNodes(nodes) {
                var nodeIds = _.map(nodes, 'id');
                _.remove(tempHighlightNodes, function filterNodes(node) {
                   return nodeIds.indexOf(node.id) > -1;
                });
            }



            /*************************************
    ********* Local Functions ************
    **************************************/
            function _hoverHelper(ids, degree) {
                degree = degree || 0;
                if (ids.length === 0) {
                    graphHoverService.clearHovers(true);
                } else {
                    graphHoverService.hoverByIds(ids, degree, false);
                }
            }

            function _unhoverHelper(ids, degree) {
                degree = degree || 0;
                if (ids && ids.length) {
                    graphHoverService.unhoverByIds(ids, degree, false);
                }
            }

            function _selectHelper(selector, raiseEvents, $event, degree, preventZoom) {
                console.log(selector, raiseEvents, $event);
                selector.selectfromDataGraph();
                degree = degree || 0;
                var ids = selector.nodeIds;
                if (!ids || (angular.isArray(ids) && ids.length === 0)) {
                    console.warn('Nothing matched the selection criteria');
                } else {
                    BreadCrumbService.appendBreadCrumbItem(new BreadCrumbService.BreadCrumbItem(selector.getTitle(), selector));
                    graphSelectionService.runFuncInCtx(function() {
                        if ($event.shiftKey || $event.ctrlKey || $event.metaKey) {
                            graphSelectionService.appendNodeIdsToSelection(ids, degree);
                        }
                        else {
                            graphSelectionService.selectByIds(ids, degree);
                        }
                        if (!preventZoom) {
                            if(ids.length === 1) {
                                zoomService.centerNode(_.first(graphSelectionService.getSelectedNodes()));
                            }
                            else {
                                zoomService.zoomToNodes(graphSelectionService.selectedNodesAndNeighbors());
                            }

                            zoomService.saveCamera();
                        }
                    }, raiseEvents, true);
                }
            }

        }
    ]);