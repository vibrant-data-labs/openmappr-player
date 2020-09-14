/**
* Handles Graph Hover ops
*/
angular.module('common')
    .service('graphHoverService', ['$rootScope','$q', 'renderGraphfactory', 'dataGraph', 'nodeRenderer', 'inputMgmtService', 'graphSelectionService', 'BROADCAST_MESSAGES',
        function($rootScope, $q, renderGraphfactory, dataGraph, nodeRenderer, inputMgmtService,graphSelectionService, BROADCAST_MESSAGES) {

            "use strict";

            /*************************************
    *************** API ******************
    **************************************/
            this.clearHovers     = clearHovers;
            this.hoverByIds         = hoverByIds;
            this.unhoverByIds       = unhoverByIds;
            this.hoverNodes         = hoverNodes;
            this.unhoverNodes       = unhoverNodes;
            this.sigBinds = sigBinds;
            this.getNeighborNodes = function() { return _.values(hoveredNodeNeighbors); };

            this.hoverHandler = hoverHandler;
            this.hoverOutHandler = hoverOutHandler;
            this.selectOrder = selectOrder;
            //
            // If a node hovers over an aggregation, then all the nodes in the aggr will enter hover state.
            //


            /*************************************
    ********* Local Data *****************
    **************************************/
            // The nodes hovered in Data Graph. Aggregations not allowed. (VERIFY PLEASE!)
            var nodeIdsInHover = [];

            // Nodes hovered in renderGraph, might have aggrs
            var hoveredNodes = {};
            var hoveredNodeNeighbors = {};
            var edges = {};

            // Id -> Node function which finds the node in the graph with the particular id
            var findNodeWithId = null;
            // Whether an event should be raised in the rootScope or not
            var eventEnabled = true;
            var renderEnabled = true;



            /*************************************
    ********* Core Functions *************
    **************************************/
            // function disableEvents () { eventEnabled = false;}
            // function enableEvents () {  eventEnabled = true;}
            // function disableRendering () {  renderEnabled = false;}
            // function enableRendering () {   renderEnabled = true;}
            // function runFuncInCtx (fn, raiseEvent, enableRender) {
            //     if(raiseEvent) enableEvents();
            //     else disableEvents();
            //     if(enableRender) enableRendering();
            //     else disableRendering();

            //     fn();

            //     enableEvents();
            //     enableRendering();
            // }

            //
            // Bind to the render graph and the define the above functions
            //
            function sigBinds(sig) {
                console.log('Binding handlers');
                var renderer = sig.renderers.graph;
                renderer.bind('render',function() {
                    draw(false);
                });

                // The function to find out which node to hover for the given id. If the node is under a cluster,
                // then hover the cluster
                findNodeWithId  = function findNodeWithId (nodeId) {
                    var node = sig.graph.nodes(nodeId);
                    if(!node) {
                        // possibly aggregated, return the node Aggregation
                        node = sig.graph.getParentAggrNode(nodeId);
                        if(!node) {
                            console.warn('Node with Id: %s does not exist in the graph', nodeId);
                        } else {
                            //console.log('Found aggregation node:%O  for node Id:%s', node, nodeId);
                        }
                    } else {
                        //console.log('Found node:%O  for node Id:%s', node, nodeId);
                    }
                    if(node && node[renderGraphfactory.getRendererPrefix() + 'size'] == null ) {
                        console.warn('Node hasn\'t been rendered: %O', node);
                    }
                    return node;
                };
            }

            // clear the internal caches, useful for sigma
            function clearHoverCaches () {
                hoveredNodes = {};
                hoveredNodeNeighbors = {};
                edges = {};
                nodeIdsInHover = [];
            }

            /**
     * Reset state and sigma.
     * @param  {[Boolean]} forceRender [force render of graph]
     * @return {[type]} [description]
     */
            function clearHovers(forceRender) {
                _.each(hoveredNodeNeighbors, function(n) {
                    n.state = 'default';
                    n.inHover = false;
                    n.inHoverNeighbor = false;
                });
                clearHoverCaches();
                if(forceRender)
                    draw(true);
            }
            /**
     * Selects the given list of node Ids
     * @param  {[type]} nodeIds [nodeIds, agregations not allowed]
     * @return {[type]}         [description]
     */
            function hoverByIds (nodeIds, degree, hoveredFromGraph) {
                // Make sure the ids exist in the dataGraph
                var rd = dataGraph.getRawDataUnsafe();
                if(!_.isArray(nodeIds) || !_.isObject(nodeIds))
                    nodeIds = [nodeIds];
                if(!rd) {
                    console.warn('[graphHoverService] hoverByIds called before dataGraph has been loaded!');
                } else {
                    _.each(nodeIds, function(n) {
                        if(!rd.hasNode(n))
                            console.warn('Node Id: %i does not exist in the node', n.id);
                    });
                    return hoverNodes(_.compact(_.map(nodeIds, findNodeWithId)), degree, hoveredFromGraph);
                }
            }
            /**
     * Unhovers the given list of node ids.
     * @param  {[type]} nodeIds [description]
     * @return {[type]}         [description]
     */
            function unhoverByIds (nodeIds, degree) {
                return unhoverNodes(_.compact(_.map(nodeIds, findNodeWithId)), degree);
            }
            // These nodes are shown on screen. Aggr allowed
            function hoverNodes (nodes, degree, hoveredFromGraph) {
                hoverHandler('overNodes', {
                    data: {
                        nodes: nodes,
                        allNodes: nodes,
                        graphHover: hoveredFromGraph != null ? hoveredFromGraph : true
                    }
                }, inputMgmtService.inputMapping().hoverNode, degree);
            }
            function unhoverNodes (nodes, degree) {
                nodeIdsInHover = nodeIdsInHover.filter(function(n) {
                    return !_.any(nodes, {id: n.id});
                });
                hoverOutHandler('outNodes', {
                    data: {
                        nodes: nodes
                    }
                }, inputMgmtService.inputMapping().hoverStage, degree);
            }

            ///
            /// Hover Mgmt
            ///

            // Converts graph hovers -> dataG hovers. callback receives datagraph nodes
            function g2dNodes (graphNodes, callback) {
                _.each(graphNodes, function(n) {
                    if(n.isAggregation) {
                        _.each(n.aggregatedNodes, callback);
                    } else {
                        callback(n);
                    }
                });
            }

            function setHoverState (nodes, inputMap, degree) {
                var settings = renderGraphfactory.sig().settings;
                var graph = renderGraphfactory.sig().graph;
                var addNeigh = +settings('nodeSelectionDegree') === 1;
                var neighbourFn = 'getNodeNeighbours';
                // Which direction to use
                if(settings('edgeDirectionalRender') === 'all')
                    neighbourFn = 'getNodeNeighbours';
                else if(settings('edgeDirectionalRender') === 'incoming')
                    neighbourFn = 'getInNodeNeighbours';
                else if(settings('edgeDirectionalRender') === 'outgoing')
                    neighbourFn = 'getOutNodeNeighbours';

                if(typeof degree !== 'undefined')
                    addNeigh = degree == 1;
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    n.state = inputMap.node;
                    n.inHover = true;
                    hoveredNodes[n.id] = n;
                    hoveredNodeNeighbors[n.id] = n;
                    //Get neighbours and their edges
                    if(addNeigh) {
                        _.forEach(graph[neighbourFn](n.id), function addTargetNode(edgeInfo, targetId){
                            var node = graph.getNodeWithId(targetId);
                            node.state = inputMap.nodeNeighbour;
                            node.inHoverNeighbor = true;
                            hoveredNodeNeighbors[targetId] = node;
                            _.forEach(edgeInfo, function addConnEdge(edge, edgeId) {
                                edges[edgeId] = edge;
                            });
                        });
                    }
                }
                nodeIdsInHover = [];
                g2dNodes(hoveredNodeNeighbors, function(node) {
                    nodeIdsInHover.push(node.id);
                });
            }

            // clears current hovers, and sets the event.data.nodes to hover state
            function hoverHandler (eventName, event, inputMap, degree) {
                function nodesInPop(nodes) {
                    var inPop = false;
                    _.each(nodes, function(n) {
                        inPop = inPop || n.inPop !== undefined;
                    });
                    return inPop;
                }

                var nodes;
                var inPop = graphSelectionService.selectionInPop();
                var hoverTiggeredFromGraph = _.isObject(event.data) && event.data.graphHover != null ? event.data.graphHover : true;
                if(event.data.allNodes != undefined) {
                    clearHovers();
                    nodes = event.data.allNodes;
                } else {
                    nodes = event.data.nodes;
                }
                if(!inPop || nodesInPop(nodes)) {
                    console.log("[graphHoverService] hoverHandler hovering over " + nodes.length + " nodes");
                    setHoverState(nodes, inputMap, degree);
                    if(renderEnabled)
                        draw(true);
                    if(eventEnabled) {
                        $rootScope.$broadcast(BROADCAST_MESSAGES.overNodes, {
                            nodes: _.values(hoveredNodes),
                            neighbours: _.values(hoveredNodeNeighbors),
                            graphHover: hoverTiggeredFromGraph
                        });
                    }
                }
            }

            // clears out ALL hovers
            function hoverOutHandler (eventName, event, inputMap, degree) {
                var outNodes = event.data.nodes;
                // clear out each unhovered node
                _.each(outNodes,function(n) {
                    n.state = inputMap.node;
                    n.inHover = false;
                    n.inHoverNeighbor = false;
                    delete hoveredNodes[n.id];
                });
                _.each(hoveredNodeNeighbors,function(n) {
                    n.inHoverNeighbor = false;
                });
                // rebuild hover state with remaining nodes
                edges = {};
                hoveredNodeNeighbors = {};
                setHoverState(_.values(hoveredNodes), inputMap, degree);
                if(renderEnabled)
                    draw(true);

                nodeIdsInHover = [];
                g2dNodes(hoveredNodeNeighbors, function(node) {
                    nodeIdsInHover.push(node.id);
                });
                // pass event on
                if(eventEnabled) {
                    $rootScope.$broadcast(BROADCAST_MESSAGES.outNodes, {
                        nodes: outNodes
                    });
                }
            }

            function selectOrder(node) {
                if( node.isSelected && node.inHover )
                    return 6;
                if( node.isSelectedNeighbour && node.inHover )
                    return 5;
                if( node.inHover )
                    return 4;
                if( node.inHoverNeighbor )
                    return 3;
                if( node.isSelected )
                    return 2;
                if( node.isSelectedNeighbour )
                    return 1;
                return 0;
            }

            function draw (renderLabel) {
                if(!renderEnabled)
                    return;

                var sigRender = renderGraphfactory.getRenderer();
                var contexts = sigRender.contexts;
                var d3sel = sigRender.d3Sel.hovers();
                var nodes = _.values(hoveredNodeNeighbors);
                var settings = sigRender.settings.embedObjects({
                    prefix: sigRender.options.prefix,
                    inSelMode: graphSelectionService.isAnySelected(),
                    inHoverMode: nodeIdsInHover.length > 0
                });
                var nodeId = window.mappr.utils.nodeId;

                contexts.hovers.canvas.width = contexts.hovers.canvas.width;    // clear canvas
                sigRender.greyout(_.keys(hoveredNodeNeighbors).length > 1, 'hover');    // only grey out if there are neighbors to show
                if (settings('enableHovering')) {
                    // var prefix = settings('prefix');

                    //render edges on the selections canvas
                    _.each(edges, function(o) {
                        (sigma.canvas.edges[o.type] || sigma.canvas.edges.def)(
                            o,
                            hoveredNodeNeighbors[o.source] || getNode(o.source),
                            hoveredNodeNeighbors[o.target] || getNode(o.target),
                            contexts.hovers,
                            settings,
                            sigRender.displayScale
                        );
                    });

                    // Render nodes in hover state
                    var mainSel = d3sel.selectAll('div').data(nodes, nodeId);
                    mainSel.exit().remove();
                    //create nodes if needed
                    mainSel.enter()
                        .append('div')
                        .style('position', 'absolute')
                    // .style('z-index', function(d, i) { return d.idx + 1;})
                        .each(function hnc (node) {
                            if(node.state === 'highlight')
                                nodeRenderer.d3NodeHighlightCreate(node, d3.select(this), settings);
                            else if(node.state === 'selected')
                                nodeRenderer.d3NodeSelectedCreate(node, d3.select(this), settings);
                            else if(node.state === 'pop')
                                nodeRenderer.d3NodePopCreate(node, d3.select(this), settings);
                            else
                                nodeRenderer.d3NodeHighlightCreate(node, d3.select(this), settings);

                        });
                    // sort nodes by size and by selection/hover state
                    mainSel.sort(function(n1, n2) {
                        var order1 = selectOrder(n1), order2 = selectOrder(n2);
                        if(order1 == order2) {
                            // sort by size
                            return n2.idx - n1.idx;
                        } else {
                            return order1 - order2;
                        }
                    });
                    // render
                    mainSel
                        .each(function hnr (node) {
                            if(node.state === 'highlight')
                                nodeRenderer.d3NodeHighlightRender(node, d3.select(this), settings);
                            else if(node.state === 'selected')
                                nodeRenderer.d3NodeSelectedRender(node, d3.select(this), settings);
                            else if(node.state === 'pop')
                                nodeRenderer.d3NodePopRender(node, d3.select(this), settings);
                            else
                                nodeRenderer.d3NodeHighlightRender(node, d3.select(this), settings);
                        });

                    // Render node labels in hover state. Remove aggregations
                    if(renderLabel) {
                        // defined in hover service
                        sigma.d3.labels.hover(
                            _.reject(nodes,'isAggregation'),
                            _.reject(graphSelectionService.selectedNodesAndNeighbors(), 'isAggregation'),
                            sigRender.d3Sel.labels(),
                            settings
                        );
                    }
                }
            }


        }
    ]);
