/**
* Handles Graph Subset ops
*/
angular.module('common')
    .service('subsetService', ['$rootScope', '$q', 'renderGraphfactory', 'dataGraph', 'nodeRenderer', 'inputMgmtService', 'BROADCAST_MESSAGES',
        function ($rootScope, $q, renderGraphfactory, dataGraph, nodeRenderer, inputMgmtService, BROADCAST_MESSAGES) {

            "use strict";

            /*************************************
    *************** API ******************
    **************************************/
            this.subset = subset;
            this.subsetSelection = subsetSelection;
            this.unsubset = unsubset;
            this.undo = undo;
            this.redo = redo;
            this.subsetHistory = [];
            this.subsetNodes = [];
            this.sigBinds = sigBinds;
            this.currentSubset = function () {
                if (currentSubsetIndex >= this.subsetHistory.length || currentSubsetIndex < 0)
                    return [];

                return this.subsetHistory[currentSubsetIndex];
            }

            $rootScope.$on(BROADCAST_MESSAGES.sigma.clickStage, () => {
                const nodes = this.currentSubset();
                if (!nodes || !nodes.length) {
                    return;
                }

                draw(nodes);
            });

            /*************************************
    ********* Local Data *****************
    **************************************/
            var currentSubsetIndex = -1;
            var findNodeWithId;

            /*************************************
    ********* Core Functions *************
    **************************************/
            function subset() {
                draw([]);
                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.subset.init);
            }

            function subsetSelection(nodes) {
                if (this.subsetNodes) {
                    _.forEach(this.subsetNodes, function (val) {
                        val.isSubsetted = false;
                    });
                }
                var nodeIds = _.pluck(nodes, 'id');
                if (currentSubsetIndex == this.subsetHistory.length - 1) {
                    this.subsetHistory.push(nodeIds);
                } else {
                    this.subsetHistory.splice(currentSubsetIndex);
                    this.subsetHistory.push(nodeIds);
                }

                currentSubsetIndex++;

                this.subsetNodes = nodes;
                draw(this.currentSubset());

                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.subset.changed, {
                    subsetCount: this.currentSubset().length,
                    nodes: nodes,
                });
            }

            function unsubset() {
                if (this.subsetNodes) {
                    _.forEach(this.subsetNodes, function (val) {
                        val.isSubsetted = false;
                    });
                }
                
                currentSubsetIndex = -1;
                this.subsetHistory = [];
                this.subsetNodes = [];
                draw([]);

                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.subset.changed, {
                    subsetCount: 0,
                    nodes: dataGraph.getAllNodes(),
                });
            }

            function undo() {

            }

            function redo() {

            }

            function draw(nodeIds) {
                var sigRender = renderGraphfactory.getRenderer();
                var contexts = sigRender.contexts;
                var d3sel = sigRender.d3Sel.subset();
                var settings = sigRender.settings.embedObjects({
                    prefix: sigRender.options.prefix,
                    inSelMode: false,
                    inHoverMode: false
                });

                var nodes = _.map(nodeIds, findNodeWithId).filter(node => !!node); // exclude nodes without lat,lng coordinates that not found on geo layout
                _.forEach(nodes, function (val) {
                    val.isSubsetted = true;
                    val.inHover = false;
                    val.isSelected = false;
                });

                if (settings('drawEdges')) {
                    var graph = renderGraphfactory.sig().graph;
                    var edges = {};
                    var neighbourFn = 'getNodeNeighbours';
                    var graph;
                    // Which direction to use
                    if (settings('edgeDirectionalRender') === 'all')
                        neighbourFn = 'getNodeNeighbours';
                    else if (settings('edgeDirectionalRender') === 'incoming')
                        neighbourFn = 'getInNodeNeighbours';
                    else if (settings('edgeDirectionalRender') === 'outgoing')
                        neighbourFn = 'getOutNodeNeighbours';

                    var subsetNodes = _.pluck(nodes, 'id');
                    _.forEach(nodes, function(node) {
                        _.forEach(graph[neighbourFn](node.id), function addTargetNode(edgeInfo, targetId) {
                            _.forEach(edgeInfo, function addConnEdge(edge, edgeId) {
                                if (_.includes(subsetNodes, edge.source) &&
                                    _.includes(subsetNodes, edge.target)) {
                                    edges[edgeId] = edge;
                                }
                            });
                        });
                    });

                    contexts.subset.canvas.width = contexts.subset.canvas.width;    // clear canvas

                    _.each(edges, function (o) {
                        sigma.canvas.edges.def(
                            o,
                            findNodeWithId(o.source, sigRender.sig),
                            findNodeWithId(o.target, sigRender.sig),
                            contexts.subset,
                            settings,
                            sigRender.displayScale
                        );
                    });
                }

                var nodeId = window.mappr.utils.nodeId;

                var mainSel = d3sel.selectAll('div').data(nodes, nodeId);
                mainSel.exit().remove();
                mainSel.remove();
                //create nodes if needed
                d3sel.selectAll('div').data(nodes, nodeId).enter()
                    .append('div')
                    .style('position', 'absolute')
                    // .style('z-index', function(d, i) { return d.idx + 1;})
                    .each(function hnc(node) {
                        nodeRenderer.d3NodeHighlightCreate(node, d3.select(this), settings);
                        nodeRenderer.d3NodeHighlightRender(node, d3.select(this), settings);
                    });

                _.forEach(nodes, function(node) {
                    node.isSelected = false;
                });
                
                if (nodeIds && nodeIds.length > 0) {
                    sigma.d3.labels.def(
                        nodes,
                        nodes,
                        sigRender.d3Sel.labels(),
                        settings,
                        true
                    );
                }
            }

            function sigBinds(sig) {
                console.log('Binding handlers');
                var renderer = sig.renderers.graph;
                var _this = this;
                renderer.bind('render', function () {
                    draw(_this.currentSubset());
                });

                findNodeWithId = function findNodeWithId(nodeId) {
                    var node = sig.graph.nodes(nodeId);
                    if (!node) {
                        // possibly aggregated, return the node Aggregation
                        node = sig.graph.getParentAggrNode(nodeId);
                        if (!node) {
                            console.warn('Node with Id: %s does not exist in the graph', nodeId);
                        } else {
                            //console.log('Found aggregation node:%O  for node Id:%s', node, nodeId);
                        }
                    } else {
                        //console.log('Found node:%O  for node Id:%s', node, nodeId);
                    }
                    if (node && node[renderGraphfactory.getRendererPrefix() + 'size'] == null) {
                        console.warn('Node hasn\'t been rendered: %O', node);
                    }
                    return node;
                };
            }
        }
    ]);
