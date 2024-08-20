/**
* Handles Graph Hover ops
*/
angular.module('common')
    .service('hoverService', ['$rootScope', '$timeout', '$q', 'renderGraphfactory', 'dataGraph', 'nodeRenderer', 'inputMgmtService', 'BROADCAST_MESSAGES', 'selectService', 'subsetService', 'SelectorService', 'playerFactory', 'snapshotService',
        function ($rootScope, $timeout, $q, renderGraphfactory, dataGraph, nodeRenderer, inputMgmtService, BROADCAST_MESSAGES, selectService, subsetService, SelectorService, playerFactory, snapshotService) {

            "use strict";

            /*************************************
            *************** API ******************
            **************************************/
            this.hoverNodes = hoverNodes;
            this.unhover = unhover;
            this.sigBinds = sigBinds;

            /*************************************
            ********* Local Data *****************
            **************************************/
            this.hoveredNodes = [];
            var hoveredSingleNode = null;
            var findNodeWithId;
            var deferAction = null;
            var defaultNeighborhoodDegree = 0;

            // reset to selected values only
            (function (service) {
                $rootScope.$on(BROADCAST_MESSAGES.hss.select, function (ev, data) {
                    service.unhover(true);
                });
            })(this);

            /*************************************
            ********* Core Functions *************
            **************************************/

            /**
             * Hover the nodes
             * @param {Object} hoverData - The hover descriptor
             * @param {string} hoverData.attr - The attribute
             * @param {string} hoverData.value - the attribute value
             * @param {string} hoverData.attr2 - The attribute
             * @param {string} hoverData.value2 - the attribute value
             * @param {string} hoverData.min - the attribute min value
             * @param {string} hoverData.max - the attribute max value
             * @param {string} hoverData.fivePct - fivePct
             * @param {array}  hoverData.ids - nodeIds
             * @param {boolean} hoverData.withNeighbors - whether highlight neighbors or not
             * @param {boolean} hoverData.force - whether hover the data, even if it not in subset
             */
            function hoverNodes(hoverData) {
                //  * @param {string} hoverData.degree - degree

                _runHoverNodes.call(this, hoverData);
                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.hover, {
                    nodes: this.hoveredNodes,
                });
            }

            function _runHoverNodes(hoverData) {
                if (this.hoveredNodes && this.hoveredNodes.length > 1) {
                    this.unhover();
                }
                var currentSubset = subsetService.currentSubset();
                var isFiltered = false;

                if (hoverData.ids && hoverData.ids.length) {
                    if (hoverData.ids.length == 1) {
                        hoveredSingleNode = hoverData.ids[0];
                        this.hoveredNodes = this.hoveredNodes.concat(hoverData.ids);
                    } else {
                        this.hoveredNodes = [hoverData.ids];
                    }
                } else {
                    var cs = filter(hoverData, subsetService.subsetNodes)

                    this.hoveredNodes = _.pluck(cs, 'id');
                    isFiltered = true;
                }

                if (!hoverData.force && !isFiltered && currentSubset.length > 0) {
                    this.hoveredNodes = this.hoveredNodes.filter(function (x) {
                        return (currentSubset.indexOf(x) > -1) || findNodeWithId(x).inHover;
                    });
                }

                var isShowNeighbors = hoverData.hasOwnProperty('showNeighbors') ? hoverData.showNeighbors : true;
                var snapshot = snapshotService.getCurrentSnapshot();
                _hoverHelper(this.hoveredNodes, snapshot ? (snapshot.layout.settings.nodeSelectionDegree || 0) : 0, hoverData.withNeighbors, isShowNeighbors);
            }

            function filter(data, subset) {
                var filters = selectService.copyFilters();
                if (data.min || data.max) {
                    createMinMaxFilter(filters, data.attr, data.min, data.max);
                } else {
                    createMultipleFilter(filters, data.attr, data.value);
                    if (data.attr2) {
                        createMultipleFilter(filters, data.attr2, data.value2);
                    }
                }

                return _.reduce(_.values(filters), function (acc, filterCfg) {
                    return filterCfg.filter(acc);
                }, subset.length > 0 ? subset : null);
            }

            function createMultipleFilter(filters, attrId, vals) {
                var filterConfig = filters[attrId];
                if (!filterConfig) return;
                var newVal = _.isArray(vals) ? vals : [vals];
                var filterVal = _.filter(_.flatten([filterConfig.state.selectedVals, _.clone(newVal)]), _.identity);
                filterConfig.state.selectedVals = filterVal;

                filterConfig.selector = SelectorService.newSelector().ofMultipleAttrValues(attrId, filterVal, true);
                filterConfig.isEnabled = filterVal && filterVal.length > 0;

                return filterConfig;
            }

            function createMinMaxFilter(filters, attrId, min, max) {
                var filterConfig = filters[attrId];
                if (!filterConfig) return;

                if (!filterConfig.isEnabled) {
                    filterConfig.selector = SelectorService.newSelector().ofMultiAttrRange(attrId, [{ min: min, max: max }]);
                } else {
                    var item = _.find(filterConfig.selector.attrRanges, function (r) { return r.min == min && r.max == max });
                    if (item) {
                        filterConfig.selector.attrRanges = _.filter(filterConfig.selector.attrRanges, function (r) {
                            return r.min != min || r.max != max;
                        });
                    } else {
                        filterConfig.selector.attrRanges.push({ min: min, max: max });
                    }
                }

                filterConfig.isEnabled = filterConfig.selector.attrRanges.length > 0;
                return filterConfig;
            }

            function unhover() {
                _.each(this.hoveredNodes, function(n) {
                    var node = findNodeWithId(n);
                    if (!node) return;
                    
                    node.specialHighlight = false;
                    node.inHoverNeighbor = false;
                });

                this.hoveredNodes = [];
                hoveredSingleNode = null;

                if (selectService.singleNode) {
                    this.hoveredNodes = [selectService.singleNode.id];
                    hoveredSingleNode = selectService.singleNode.id;
                } else {
                    this.hoveredNodes = _.clone(selectService.selectedNodes || []);
                }

                var snapshot = snapshotService.getCurrentSnapshot();
                _hoverHelper(this.hoveredNodes, snapshot ? (snapshot.layout.settings.nodeSelectionDegree || 0) : 0, !!selectService.singleNode);

                $rootScope.$broadcast(BROADCAST_MESSAGES.hss.hover, {
                    nodes: this.hoveredNodes,
                });
            }

            function _hoverHelper(ids, degree, withNeighbors, showNeighbors = true) {
                if (deferAction) {
                    $timeout.cancel(deferAction);
                }

                deferAction = $timeout(function () {
                    degree = degree || 0;
                    hoverByIds(ids, degree, false, withNeighbors, showNeighbors);
                }, 100);
            }

            /** 
            * Selects the given list of node Ids
            * @param  {[type]} nodeIds [nodeIds, agregations not allowed]
            * @return {[type]}         [description]
            */
            function hoverByIds(nodeIds, degree, hoveredFromGraph, withNeighbors, showNeighbors) {
                // Make sure the ids exist in the dataGraph
                var rd = dataGraph.getRawDataUnsafe();
                if (!_.isArray(nodeIds) || !_.isObject(nodeIds))
                    nodeIds = [nodeIds];
                if (!rd) {
                    console.warn('[hoverService] hoverByIds called before dataGraph has been loaded!');
                } else {
                    _.each(nodeIds, function (n) {
                        if (!rd.hasNode(n))
                            console.warn('Node Id: %i does not exist in the node', n.id);
                    });
                    return _hoverNodes(nodeIds, degree, hoveredFromGraph, withNeighbors, showNeighbors);
                }
            }

            // These nodes are shown on screen. Aggr allowed
            function _hoverNodes(nodes, degree, hoveredFromGraph, withNeighbors, showNeighbors) {
                hoverHandler('overNodes', {
                    data: {
                        nodes: nodes,
                        allNodes: nodes,
                        graphHover: hoveredFromGraph != null ? hoveredFromGraph : true,
                        withNeighbors: withNeighbors
                    }
                }, inputMgmtService.inputMapping().hoverNode, degree, showNeighbors);
            }

            // clears current hovers, and sets the event.data.nodes to hover state
            function hoverHandler(eventName, event, inputMap, degree, showNeighbors) {
                var nodes;
                var hoverTiggeredFromGraph = _.isObject(event.data) && event.data.graphHover != null ? event.data.graphHover : true;
                if (event.data.allNodes != undefined) {
                    //clearHovers();
                    nodes = event.data.allNodes;
                } else {
                    nodes = event.data.nodes;
                }
                // console.log("[hoverService] hoverHandler hovering over " + nodes.length + " nodes");

                draw(nodes, event.data.withNeighbors, degree, showNeighbors);
            }

            function draw(nodeIds, withNeighbors, degree, showNeighbors) {
                var selectedNodes = selectService.selectedNodes;
                var subsetNodes = subsetService.subsetNodes;
                var sigRender = renderGraphfactory.getRenderer();
                var contexts = sigRender.contexts;
                var d3sel = sigRender.d3Sel.hovers();
                var settings = sigRender.settings.embedObjects({
                    prefix: sigRender.options.prefix,
                    inSelMode: false,
                    inHoverMode: true
                });

                if (nodeIds.length == 0 && subsetNodes.length == 0) {
                    sigRender.greyout(false);
                }

                if (!!hoveredSingleNode) {
                    withNeighbors = true;
                }

                var neighbourFn = 'getNodeNeighbours';
                var graph;
                if (withNeighbors) {
                    // Which direction to use
                    if (settings('edgeDirectionalRender') === 'all')
                        neighbourFn = 'getNodeNeighbours';
                    else if (settings('edgeDirectionalRender') === 'incoming')
                        neighbourFn = 'getInNodeNeighbours';
                    else if (settings('edgeDirectionalRender') === 'outgoing')
                        neighbourFn = 'getOutNodeNeighbours';

                    graph = renderGraphfactory.sig().graph;
                }
                var edges = {};
                
                var nodesFilter = _.reduce(nodeIds, function(acc, nodeId) {
                    const node = findNodeWithId(nodeId, sigRender.sig);

                    if (node) {
                        acc.push(node);
                    }
                    return acc;
                }, []);

                var nodes = _.map(nodesFilter, function (node) {
                    var nodeId = node.id;
                    var isSelected = selectedNodes.indexOf(nodeId) > -1;
                    if (isSelected) {
                        node.isSelected = true;
                        node.inHover = false;
                    } else {
                        node.isSelected = false;
                        node.inHover = true;
                    }
                    
                    if (hoveredSingleNode && hoveredSingleNode == nodeId ||
                        selectService.singleNode && selectService.singleNode.id == nodeId) {
                        node.specialHighlight = true;
                        var neighNodes = [];

                        var drawNeighbors = function(neighbourNodes) {            
                            _.forEach(neighbourNodes, function addTargetNode(edgeInfo, targetId) {
                                //hoveredNodeNeighbors[targetId] = node;
                                _.forEach(edgeInfo, function addConnEdge(edge, edgeId) {
                                    var neighs = [findNodeWithId(edge.source, sigRender.sig), findNodeWithId(edge.target, sigRender.sig)];
                                    _.map(neighs, function (n) {
                                        n.inHover = true;
                                        node.inHoverNeighbor = true;
                                    });
            
                                    neighNodes.push(...neighs);
                                    edges[edgeId] = edge;
                                });
                            });
                        }

                        if (degree > 0 && graph) {
                            var neighborsFirstLevel = graph[neighbourFn](node.id);
                            
                            if (showNeighbors) {
                                drawNeighbors(neighborsFirstLevel);
                            }
                            
                            if (degree > 1) {
                                _.forEach(_.keys(neighborsFirstLevel), function (firstLevelNeighborId) {
                                    var neighborsSecondLevel = graph[neighbourFn](firstLevelNeighborId);
                                    drawNeighbors(neighborsSecondLevel);

                                    if (degree > 2) {
                                        _.forEach(_.keys(neighborsSecondLevel), function(secondLevelNeighborId) {
                                            var neighborsThirdLevel = graph[neighbourFn](secondLevelNeighborId);
                                            drawNeighbors(neighborsThirdLevel);
                                        });
                                    }
                                });    
                            }
                        }

                        return [node].concat(neighNodes);
                    }
                    else {
                        return node;
                    }
                });
                nodes = _.flatten(nodes);

                var nodeId = window.mappr.utils.nodeId;

                contexts.hovers.canvas.width = contexts.hovers.canvas.width;    // clear canvas
                var shouldGreyOut = nodes.length > 0 || subsetNodes.length > 0;
                var mode = 'hover';
                if (subsetNodes.length > 0) {
                    mode = 'subset';
                } else if (selectedNodes.length > 0) {
                    mode = 'select';
                }
                sigRender.greyout(shouldGreyOut, mode);
                if (nodes.length == 0) {
                    sigRender.greyoutSubset(false);
                } else {
                    sigRender.greyoutSubset(true, selectedNodes.length > 0 ? 'select' : 'hover');
                }
                if (settings('enableHovering')) {
                    // var prefix = settings('prefix');

                    //render edges on the selections canvas
                    _.each(edges, function (o) {
                        (sigma.canvas.edges[o.type] || sigma.canvas.edges.def)(
                            o,
                            findNodeWithId(o.source, sigRender.sig),
                            findNodeWithId(o.target, sigRender.sig),
                            contexts.hovers,
                            settings,
                            sigRender.displayScale
                        );
                    });

                    // Sort by drawing order
                    nodes = nodes.sort(function(a, b) {
                        var weightA = sigma.d3.labels.selectOrder(a);
                        var weightB = sigma.d3.labels.selectOrder(b);

                        return weightA - weightB;
                    });

                    // Render nodes in hover state
                    var mainSel = d3sel.selectAll('div').data(nodes, nodeId);
                    mainSel.exit().remove();
                    mainSel.remove();
                    //create nodes if needed
                    d3sel.selectAll('div').data(nodes, nodeId).enter()
                        .append('div')
                        .style('position', 'absolute')
                        // .style('z-index', function(d, i) { return d.idx + 1;})
                        .each(function hnc(node) {
                            if (hoveredSingleNode) {
                                var borderType = 'none';
                                var isHovered = hoveredSingleNode == node.id;
                                var isSelected = selectService.singleNode && selectService.singleNode.id == node.id;
                                if (isSelected) {
                                    borderType = 'select';
                                }
                                else if (isHovered) {
                                    borderType = 'hover';
                                }
                                else if (node.isSelected && !node.inHoverNeighbor) {
                                    borderType = 'select';
                                }

                                nodeRenderer.d3NodeHighlightCreate(node, d3.select(this), settings);
                                nodeRenderer.d3NodeHighlightRender(node, d3.select(this), settings, borderType);
                            } else {
                                nodeRenderer.d3NodeHighlightCreate(node, d3.select(this), settings);
                                nodeRenderer.d3NodeHighlightRender(node, d3.select(this), settings);
                            }
                        });

                    if (!nodes.length && selectedNodes && selectedNodes.length) {
                        sigRender.d3Sel.labels().selectAll('div').remove();
                    } else {
                        sigma.d3.labels.hover(
                            nodes,
                            [],
                            sigRender.d3Sel.labels(),
                            settings,
                            subsetNodes && subsetNodes.length
                        );
                    }
                }
            }


            //
            // Bind to the render graph and the define the above functions
            //
            function sigBinds(sig) {
                console.log('Binding handlers');
                var renderer = sig.renderers.graph;
                var _this = this;
                renderer.bind('render', function () {
                    _this.unhover();
                });

                // The function to find out which node to hover for the given id. If the node is under a cluster,
                // then hover the cluster
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