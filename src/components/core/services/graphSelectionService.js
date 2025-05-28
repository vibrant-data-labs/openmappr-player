/**
* Handles Graph Selection ops
*/
angular.module('common')
    .service('graphSelectionService', ['$rootScope','$q', 'renderGraphfactory', 'dataGraph', 'nodeRenderer', 'inputMgmtService', 'BROADCAST_MESSAGES',
        function($rootScope, $q, renderGraphfactory, dataGraph, nodeRenderer, inputMgmtService, BROADCAST_MESSAGES) {
            'use strict';

            /*************************************
            *************** API ******************
            **************************************/
            this.clearSelections     = clearSelections;
            this.clearSelectionCaches= clearSelectionCaches;
            this.selectByIds         = selectByIds;
            this.selectByDataPointIds= selectByDataPointIds;
            this.unselectByIds       = unselectByIds;
            this.selectNodes         = selectNodes;
            this.persistIntoSnapshot = persistIntoSnapshot;
            this.loadFromSnapshot    = loadFromSnapshot;
            this.updateNodeSelState  = updateNodeSelState;
            this.selectedNodeIds     = selectedNodeIds;
            this.appendNodeIdsToSelection = appendNodeIdsToSelection;
            this.removeNodeIdsFromSelection = removeNodeIdsFromSelection;
            this.selectedNodesAndNeighbors = selectedNodesAndNeighbors;
            this.getSelectedNodes = getSelectedNodes;
            this.getSubNetwork = getSubNetwork;
            this.getSelectedNodesLinksIds = getSelectedNodesLinksIds;
            this.selectionInPop = selectionInPop;
            this.dataGraph = dataGraph;

            this.isAnySelected = isAnySelected;
            this.getSelectedNodeNeighbours = function getSelectedNodeNeighbours() {return selectedNodeNeighbours;};
            this.getEdges = function getSelectedEdgeNeighbours() {return edges;};
            this._selectNodes = _selectNodes; // needed by dir sigma

            // Event mgmt
            this.sigBinds = sigBinds;
            this.clickStageHander = clickStageHander;
            this.clickNodesHander = clickNodesHander;

            this.enableEvents = enableEvents;
            this.disableEvents = disableEvents;
            this.enableRendering = enableRendering;
            this.disableRendering = disableRendering;
            this.runFuncInCtx = runFuncInCtx;

            /*************************************
            ********* Local Data *****************
            **************************************/

            // The nodes selected in Data Graph. Aggregations not allowed.
            var nodeIdsInSelection = [];

            // the nodes in selection in render graph
            var selectedNodes = {};
            var selectedNodeNeighbours = {};
            var edges = {};

            // Id -> Node function which finds the node in the graph with the particular id
            //
            var findNodeWithId = null;

            // Whether an event should be raised in the rootScope or not
            var eventEnabled = true;
            var renderEnabled = true;

            /*************************************
            ********* Core Functions *************
            **************************************/
            function disableEvents () { eventEnabled = false;}
            function enableEvents () {  eventEnabled = true;}
            function disableRendering () {  renderEnabled = false;}
            function enableRendering () {   renderEnabled = true;}
            function runFuncInCtx (fn, raiseEvent, enableRender) {
                if (raiseEvent) enableEvents();
                else disableEvents();
                if (enableRender) enableRendering();
                else disableRendering();

                fn();

                enableEvents();
                enableRendering();
            }

            //
            // Bind to the render graph and the define the above functions
            //
            function sigBinds(sig) {
                console.log('Binding handlers');

                var renderer = sig.renderers.graph;
                renderer.bind('render',function() {
                    draw(false);
                });

                // The function to find out which node to select for the given id. If the node is under a cluster,
                // then select the cluster
                findNodeWithId  = function findNodeWithId (nodeId) {
                    var node = sig.graph.nodes(nodeId);

                    if (!node) {
                        // possibly aggregated, return the node Aggregation
                        node = sig.graph.getParentAggrNode(nodeId);

                        if (!node) {
                            console.warn('Node with Id: %s does not exist in the graph', nodeId);
                        } else {
                            /* TODO: --- IT'S TEMPORARY COMMENT --- */
                            //console.log('Found aggregation node:%O  for node Id:%s', node, nodeId);
                        }
                    } else {
                        /* TODO: --- IT'S TEMPORARY COMMENT --- */
                        //console.log('Found node:%O  for node Id:%s', node, nodeId);
                    }

                    if (node && node[renderGraphfactory.getRendererPrefix() + 'size'] === null) { // no render data
                        console.warn('Node hasn\'t been rendered: %O', node);
                    }

                    return node;
                };
            }

            /**
             * Reset state and sigma.
             * @param {boolean} forceRender force a render for the graph
             * @return {[type]} [description]
             */
            function clearSelections(forceRender) {
                nodeIdsInSelection = [];
                _clearSel();
                if (forceRender) {
                    renderGraphfactory.getRenderer().render();
                }
            }

            // Just clear the internal caches, useful for sigma
            function clearSelectionCaches () {
                selectedNodes = {};
                selectedNodeNeighbours = {};
                edges = {};
                nodeIdsInSelection = [];
            }

            /**
             * Selects the given list of node Ids
             * @param  {[type]} nodeIds [description]
             * @return {[type]}         [description]
             */
            function selectByIds (nodeIds, degree) {
                function selectFn(rd) {
                    if (!_.isArray(nodeIds) || !_.isObject(nodeIds)) {
                        nodeIds = [nodeIds];
                    }

                    if (!rd) {
                        console.warn('[graphSelectionService] selectByIds called before dataGraph has been loaded!');
                    } else {
                        _.each(nodeIds, function(n) {
                            if (!rd.hasNode(n))
                                console.warn('Node Id: %i does not exist in the node', n.id);
                        });

                        nodeIdsInSelection = nodeIds;

                        return selectNodes(_.compact(_.map(nodeIds, findNodeWithId)), degree);
                    }
                }

                // the data exists if clicked from UI, then execute synchronously so
                // the UI functions properly (in particular runFuncInCtx needs synchronous execution)
                // the data doesn't exist if executed when loading a snapshot;
                // then execute asynchronously using promise/then
                var rd = dataGraph.getRawDataUnsafe();

                if (rd) {
                    selectFn(rd);
                } else {
                    dataGraph.getRawData().then(selectFn);
                }
            }

            /**
             * Selects the given list of node Ids
             * @param  {[type]} nodeIds [description]
             * @return {[type]}         [description]
             */
            function selectByDataPointIds (dataPointIds, degree) {
                function selectFn(rd) {
                    if (!_.isArray(dataPointIds) || !_.isObject(dataPointIds)) {// single element selection
                        dataPointIds = [dataPointIds];
                    }

                    var nodeIds = _.compact(_.map(dataPointIds, function(n) {
                        return rd.dataPointIdNodeIdMap[n];
                    }));

                    return selectByIds(nodeIds, degree);
                }

                // the data exists if clicked from UI, then execute synchronously so
                // the UI functions properly (in particular runFuncInCtx needs synchronous execution)
                // the data doesn't exist if executed when loading a snapshot;
                // then execute asynchronously using promise/then
                var rd = dataGraph.getRawDataUnsafe();

                if (rd) {
                    selectFn(rd);
                } else {
                    dataGraph.getRawData().then(selectFn);
                }
            }

            /**
             * Unselects the given list of node ids.
             * @param  {[type]} nodeIds [description]
             * @return {[type]}         [description]
             */
            function unselectByIds (nodeIds, degree) {
                var newSel = _.difference(nodeIdsInSelection, nodeIds);

                if (newSel.length > 0) {
                    return selectNodes(_.compact(_.map(newSel, findNodeWithId)), degree);
                } else {
                    return clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);
                }
            }

            function selectNodes (nodes, degree) {
                clickNodesHander('clickNodes', {
                    data: {
                        node: nodes,
                        degree: degree
                    }
                }, inputMgmtService.inputMapping().clickNode);
            }

            /* TODO: --- IT'S TEMPORARY COMMENT --- */
            // function unselectNodes (nodes) {
            //  if (nodeIdsInSelection.length > 0) {
            //      var selNodes = _.map(nodeIdsInSelection, findNodeWithId);
            //      selectNodes(selNodes);
            //  } else {
            //      clickStageHander('clickStage', {}, inputMgmtService.inputMapping().clickStage);
            //  }
            // }

            /**
             * Persist the selection info in the snapshot
             * @param  {[type]} snapshot [description]
             * @return {[type]}          [description]
             */
            function persistIntoSnapshot (snapshot) {
                snapshot.ndSelState = _.map(nodeIdsInSelection, function(nodeId) {
                    return {id:nodeId, state:0};
                });
                return snapshot;
            }

            /**
             * Load selection state from snapshot, or clear the selections
             * @param  {[type]} snapshot [description]
             * @return {[type]}          [a function to execute on sigma load]
             */
            function loadFromSnapshot (snapshot) {
                var fn = _.noop;

                if (snapshot.ndSelState && snapshot.ndSelState.length > 0) {
                    nodeIdsInSelection = _.pluck(snapshot.ndSelState,'id');
                    fn = function() {selectByIds(nodeIdsInSelection, 0);};
                } else {
                    console.log('No Selections in the snapshot: %O, resetting Selections.', snapshot);
                    nodeIdsInSelection = [];
                    fn = function() {clearSelections(true);};
                }

                return fn;
            }

            /**
             * Update the given nodes in the nodeList to match the stored selection states
             * @param  {[type]} nodes [description]
             * @return {[type]}       [description]
             */
            function updateNodeSelState(nodes) {
                // whether there is anything common node in nodes and selectedNodes
                var intersect = false;

                _.each(nodes, function(node) {
                    if (node.isAggregation) {
                        // If any of the aggregated nodes are in selection state, then mark the aggregation selected
                        intersect = _.any(node.aggregatedNodes, function(aggNode) {
                            return _.any(nodeIdsInSelection, function(id) {
                                return aggNode.id === id;
                            });
                        });
                    } else {
                        intersect = _.any(nodeIdsInSelection, function(id) { return node.id === id;});
                    }
                    
                    if (intersect) {
                        node.isSelected = true;
                    } else {
                        node.isSelected = false;
                    }
                });

                return nodes;
            }

            function selectedNodeIds () {
                return nodeIdsInSelection;
            }

            function selectedNodesAndNeighbors() {
                return _.values(selectedNodeNeighbours);
            }

            function getSelectedNodes() {
                return _.values(selectedNodes);
            }

            function isAnySelected () {
                return !_.isEmpty(selectedNodeNeighbours);
            }

            function appendNodeIdsToSelection (nodeIds, degree) {
                if (nodeIdsInSelection.length > 0) {
                    var nodeIdsToAppend = _.reject(nodeIds, function(nid) {
                        return _.any(nodeIdsInSelection, function(id) { return nid === id;});
                    });

                    if (nodeIdsToAppend.length > 0) {
                        var nodes = _.map(nodeIdsToAppend, findNodeWithId);
                        selectNodes(nodes, degree);
                    }

                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // draw(true);
                } else {
                    selectByIds(nodeIds, degree);
                }
            }
            function removeNodeIdsFromSelection (nodeIds) {
                var nodeIdsToAppend = _.reject(nodeIdsInSelection, function(nid) {
                    return _.any(nodeIds, function(id) { return nid === id;});
                });

                selectByIds(nodeIdsToAppend);
            }

            function getSubNetwork() {
                var nodes = _.uniq(_.values(selectedNodes).concat(_.values(selectedNodeNeighbours)));

                return {
                    nodeIds: _.pluck(nodes, 'id'),
                    linkIds : _.pluck(_.values(edges), 'id'),
                    colorMap : _.reduce(nodes, function(acc, n) {
                        acc[n.id] = d3.rgb(n.colorStr).toString();
                        return acc;
                    }, {})
                };
            }

            function getSelectedNodesLinksIds(needNeighboursInfo) {
                var nodeNeighbrSel = {};
                var graph = renderGraphfactory.sig().graph;
                var neighbourFn = 'getNodeNeighbours';

                if (needNeighboursInfo) {
                    _.each(_.values(selectedNodes), function(n) {
                        nodeNeighbrSel[n.id] = n; // self is a neighbour of self.
                        //Get neighbours and their edges
                        _.forEach(graph[neighbourFn](n.id), function (edgeInfo, targetId){
                            nodeNeighbrSel[targetId] = graph.getNodeWithId(targetId);
                        });
                    });
                }

                var nodes = _.uniq(_.values(selectedNodes).concat(_.values(nodeNeighbrSel)));

                return {
                    nodeIds: _.pluck(_.values(nodes), 'id'),
                    linkIds: _.pluck(_.values(edges), 'id')
                };
            }

            // true if there is a popped selection
            function nodesInPop(nodes) {
                var inPop = false;
                _.each(nodes, function(n) {
                    inPop = inPop || (n.inPop !== undefined);
                });
                return inPop;
            }

            // true if there is a popped selection
            function selectionInPop() {
                return nodesInPop(selectedNodes);
            }

            //
            // Event handlers and rendering
            //
            // Converts graph nodes -> dataG . callback receives datagarph nodes
            function g2dNodes (graphNodes, callback) {
                _.each(graphNodes, function(n) {
                    if (n.isAggregation) {
                        _.each(n.aggregatedNodes, callback);
                    } else {
                        callback(n);
                    }
                });
            }

            function _selectNodes (nodes, degree, inputMap) {
                var settings = renderGraphfactory.sig().settings;
                var graph = renderGraphfactory.sig().graph;
                var addNeigh = +settings('nodeSelectionDegree') === 1;
                var neighbourFn = 'getNodeNeighbours';

                // Which direction to use
                if (settings('edgeDirectionalRender') === 'all') {
                    neighbourFn = 'getNodeNeighbours';
                }
                else if (settings('edgeDirectionalRender') === 'incoming') {
                    neighbourFn = 'getInNodeNeighbours';
                }
                else if (settings('edgeDirectionalRender') === 'outgoing') {
                    neighbourFn = 'getOutNodeNeighbours';
                }

                if (typeof degree !== 'undefined') {
                    addNeigh = degree == 1;
                }

                var edgePaths = !!settings('edgePath');

                _.each(nodes, function(n) {
                    n.state = inputMap.node;
                    n.isSelected = true;
                    selectedNodes[n.id] = n;
                    selectedNodeNeighbours[n.id] = n; // self is a neighbour of self.

                    //Get neighbours and their edges
                    if (addNeigh)
                        _.forEach(graph[neighbourFn](n.id), function addTargetNode(edgeInfo, targetId){
                            selectedNodeNeighbours[targetId] = graph.getNodeWithId(targetId);
                            _.forEach(edgeInfo, function addConnEdge(edge, edgeId) {
                                edges[edgeId] = edge;
                            });
                        });

                    // Mark as neighbours
                    _.each(selectedNodeNeighbours, function(node) {
                        node.state = inputMap.nodeNeighbour;
                        node.isSelectedNeighbour = true;
                    });
                });

                // if edgePaths is enabled, then add them to edges as well
                if (edgePaths) {
                    /* TODO: --- IT'S TEMPORARY COMMENT --- */
                    // console.log("Num Loops: %i x %i = %i", _.size(selectedNodes), nodes.length, _.size(selectedNodes) * nodes.length);
                    console.time('edgePaths');

                    _.each(selectedNodes, function(n1) {
                        /* TODO: --- IT'S TEMPORARY COMMENT --- */
                        // _.each(nodes, function(n2) {
                        //  if (n1.id === n2.id) { return; }
                        //  _.each(graph.getEdgesBetween(n1.id, n2.id), function(edge, edgeId) {
                        //      edges[edgeId] = edge;
                        //  });
                        // });

                        // the below code is a more performant version of above, since the line edges[edgeId] = edge can be called 64,000 times
                        for(var i = nodes.length -1 ; i >= 0; i--) {
                            var n2 = nodes[i];
                            if (n1.id === n2.id ) {
                                continue;
                            }

                            var nodeEdges = graph.getEdgesBetween(n1.id, n2.id);
                            if (!nodeEdges) {
                                continue;
                            }

                            var keys = Object.keys(nodeEdges);
                            for(var j = keys.length - 1; j >= 0; j--) {
                                edges[keys[j]] = nodeEdges[keys[j]];
                            }
                        }
                    });

                    console.timeEnd('edgePaths');
                }

                nodeIdsInSelection = [];

                g2dNodes(selectedNodes, function(node) {
                    nodeIdsInSelection.push(node.id);
                });
            }

            function _clearSel () {
                var n = null;

                for(n in selectedNodes) {
                    selectedNodes[n].state = 'default';
                    selectedNodes[n].isSelected = false;
                }

                for(n in selectedNodeNeighbours) {
                    selectedNodeNeighbours[n].state = 'default';
                    selectedNodeNeighbours[n].isSelectedNeighbour = false;
                }

                selectedNodes = {};
                selectedNodeNeighbours = {};
                edges = {};
                nodeIdsInSelection = [];
            }

            // event.data.node is an array.
            function clickNodesHander (eventName, event, inputMap) {
                console.log('Node selected: %O', event);

                var extendFn = function(ev) {
                    return ev.shiftKey || ev.ctrlKey || ev.metaKey;
                };

                var nodesInPop = _.noop;

                //console.log('shiftkey Status: %s', event.shiftKey);
                // toss out click if click is on a non-popped node when selected node is popped
                if ( event.type == 'clickNodes') {
                    nodesInPop = function(nodes) {
                        var inPop = false;

                        _.each(nodes, function(n) {
                            inPop = inPop | n.inPop;
                        });

                        return inPop;
                    };

                    if (selectionInPop() && !nodesInPop(event.data.nodes)) {
                        return;
                    }
                }

                var extendingSelection = true;

                if ( !extendFn(event) && !(window.event && extendFn(window.event))) {
                    _clearSel();
                    extendingSelection = false;
                }

                _selectNodes(event.data.node, event.data.degree, inputMap);

                if (renderEnabled) {
                    draw(true);
                }

                $rootScope.$broadcast(BROADCAST_MESSAGES.selectNodes, {
                    nodes: _.values(selectedNodes),
                    nodeIds: nodeIdsInSelection,
                    lastSelected: _.head(event.data.node),
                    neighbours: _.values(selectedNodeNeighbours),
                    edges: _.values(edges),
                    newSelection: eventEnabled,
                    extendingSelection: extendingSelection
                });


                /* TODO: --- IT'S TEMPORARY COMMENT --- */
                // if (eventEnabled) {
                //  $rootScope.$broadcast(BROADCAST_MESSAGES.selectNodes, {
                //      nodes: _.values(selectedNodes),
                //      nodeIds: nodeIdsInSelection,
                //      lastSelected: _.head(event.data.node),
                //      neighbours: _.values(selectedNodeNeighbours),
                //      edges: _.values(edges),
                //      additiveSelection: extendFn(event)
                //  });
                // } else {
                //  $rootScope.$broadcast(BROADCAST_MESSAGES.tempSelectNodes, {});
                // }
            }

            function clickStageHander (eventName, event) {
                console.log('Stage Clicked: %O', event);

                /* TODO: --- IT'S TEMPORARY COMMENT --- */
                // clearSelections(renderEnabled);

                if (eventEnabled) {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.selectStage);
                }
            }

            // Called post render
            function draw(renderLabel) {
                
            }

        }
    ]);
