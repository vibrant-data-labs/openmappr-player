angular.module('common')
.service('svgRenderService',[ '$q', '$http', 'layoutService', 'dataGraph', 'renderGraphfactory', 'graphSelectionService',
function ($q, $http, layoutService, dataGraph, renderGraphfactory, graphSelectionService) {
    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.renderSvg = renderSvg;
    this.getSvgUrl = getSvgUrl;


    /*************************************
    ********* Local Data *****************
    **************************************/
    var borderSize = 0.5;

    var minx, miny, maxx, maxy;
    var nodesWithLabel = {};
    // Settings
    var settings = null;
    var nodeSizeMultiplier,
        aggNodeSizeScale,
        edgeTaperScale,
        edgeSizeDefaultValue,
        isDirectional,
        isEdgeSizeFixed,
        edgeAlpha,
        curvature,
        labelAttr,
        labelSizeFunc;


    /*************************************
    ********* Core Functions *************
    **************************************/

    // Function references
    var util = window.mappr.utils;
    var toPx = util.toPx,
        nodeId = util.nodeId,
        darkenColor = util.darkenColor;
        // isSpecial = util.isSpecial,
        // invert = util.invert,
        // multi = util.multi,
        // add = util.add,
        // plucker = util.plucker,
        // lightenColor = util.lightenColor;

    function setSettings(settings) {
        nodeSizeMultiplier = +settings('nodeSizeMultiplier') || 1;
        aggNodeSizeScale = +settings('aggNodeSizeScale') || 1;
        edgeTaperScale = +settings('edgeTaperScale') || 0.5;
        edgeAlpha = +settings('edgeDrawAlpha') || 0.6;
        curvature = settings('edgeCurvature');
        isDirectional = settings('edgeTaper') === true;
        edgeSizeDefaultValue = settings('edgeSizeDefaultValue');
        isEdgeSizeFixed = settings('edgeSizeStrat') === 'fixed';
        labelAttr = settings('labelAttr') || 'OriginalLabel';
        labelSizeFunc = labelSizeFuncFactory(settings);
    }

    function finalNodeSize(node) {
        return node.isAggregation? node.size * aggNodeSizeScale : node.size * nodeSizeMultiplier;
    }

    // Label size func, copied from d3.labels.def
    function labelSizeFuncFactory (settings) {
        var func = _.noop;
        if(settings('labelSize') === 'fixed') {
            func = _.constant(Math.max(settings('minLabelSize'), settings('defaultLabelSize')));
        }
        else if(settings('labelSize') === 'proportional') {
            func = function propLabel (node) {
                return Math.min(
                    settings('maxLabelSize'),
                    Math.max(
                        settings('minLabelSize'),
                        settings('labelSizeRatio') * finalNodeSize(node)
                        )
                    );
            };
        } else {
            func = function propLabel (node) {
                return Math.min(settings('maxLabelSize'), Math.max(settings('minLabelSize'), settings('labelSizeRatio') * node.baseSize));
            };
        }
        return func;
    }

    function nodeX (node) {
        return Math.round(node.x - minx);
    }
    function nodeY (node) {
        return Math.round(node.y - miny);
    }

    function _ptStr(point) {
        return '' + (point.x- minx) + ',' + (point.y- miny);
    }
    function edgePath(startc1, startc2, curve1, curve2) {
        //Curve source offset -> ctrl point -> dest offsets
        //line b/w dest offsets
        //Curve src offset -> ctrl point -> dest offset
        //line b/w src offsets
        var path = 'M' + _ptStr(startc1) +
            'Q' + _.map(curve1,_ptStr).join(',') +
            'L' + _ptStr(startc2) +
            'Q' + _.map(curve2,_ptStr).join(',') + 'Z';
        return path;
    }

    ///
    /// Node Renderer
    ///
    function renderNode (node) {
        var d3g = d3.select(this);
        var nodeSize = finalNodeSize(node);

        d3g
        .append('circle')
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", Math.floor(nodeSize))
            .style('stroke-width', toPx(borderSize))
            .style("fill", node.colorStr)
            .style("stroke", darkenColor(node.color));
    }
    /*
        Label Renderer
     */
    function renderLabel (node) {
        var d3g = d3.select(this);
        var nodeSize = finalNodeSize(node);

        d3g.append('text')
            .attr('x', nodeSize + borderSize + 1)
            .attr('dy', '0.35em')
            .attr('y',  0)
            .style('font-size',function(node) {
                var fontSize = labelSizeFunc(node);
                return toPx(fontSize);
            })
            .text(function(node) {
                return node.attr[labelAttr];
            });
    }
    ///
    /// Graph renderer
    ///
    function renderGraph (divElem, renderG) {
        var nodes = renderG.nodes(),
            edges = renderG.edges(),
            nodeIndex = _.reduce(nodes, function(acc, n) {
                acc[n.id] = n;
                return acc;
            }, {});

        // bounds
        minx = _.min(nodes,'x').x;
        miny = _.min(nodes,'y').y;
        maxx = _.max(nodes,'x').x;
        maxy = _.max(nodes,'y').y;

        var maxSize = _.max(nodes, 'size').size;

        var width = (maxx - minx) + 2*(maxSize + borderSize),
            height = (maxy - miny) + 2*(maxSize + borderSize);
        var maxCurvature = width >  height ? (curvature * width/4) : (curvature * height/4);
        // THe main svg
        var svg = divElem.append('svg')
            .attr('width', width + maxCurvature)
            .attr('height', height + maxCurvature);

        // background color
        svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', settings('backgroundColor'));

        // Gradients
        // Optimize gradients, otherwise num gradients == num edges
        var gradientsMap = {};
        var edgeGradMap = {};
        var foundDuplicates = 0;

        _.each(edges, function(edge) {
            var x1 = nodeX(nodeIndex[edge.source]),
                x2 = nodeX(nodeIndex[edge.target]);
            var gx1, gx2, gy1, gy2;
            gx1 = gy1 = gx2 = gy2 = 0;
            if(x2 > x1) {
                // Forward facing edge
                gx2 = 1;
            } else {
                gx1 = 1;
            }
            //coords
            var key = "" + gx1 + ',' + gy1 + ',' + gx2 + ',' + gy2;
            // colors
            key = key + ':' + nodeIndex[edge.source].colorStr + ':' + nodeIndex[edge.target].colorStr;

            edgeGradMap[edge.id] = key;
            if(!gradientsMap[key]) {
                var grad = {
                    id : _.uniqueId('grad'),
                    x1 : gx1,
                    y1 : gy1,
                    x2 : gx2,
                    y2 : gy2,
                    srcClr :nodeIndex[edge.source].colorStr,
                    tgtClr :nodeIndex[edge.target].colorStr
                };
                gradientsMap[key] = grad;
            } else {
                foundDuplicates++;
            }
        });
        console.log("SVG FOUND DUPLICATES : " + foundDuplicates);

        var gradientList = _.values(gradientsMap);

        var gradientsDefns = svg.append('defs')
                .selectAll('linearGradient')
                .data(gradientList, function(grad) { return grad.id;})
                .enter()
                    .append('linearGradient')
                    .attr('id', function(grad) { return grad.id;})
                    .attr('spreadMethod', 'pad')
                    .each(function(grad) {
                        d3.select(this)
                            .attr('x1',grad.x1)
                            .attr('y1',grad.y1)
                            .attr('x2',grad.x2)
                            .attr('y2',grad.y2);
                    });

        gradientsDefns
            .append('stop')
                .attr('offset', '5%')
                .attr('stop-color', function(grad) {return grad.srcClr;});
                //.attr('stop-opacity', '1');
        gradientsDefns
            .append('stop')
                .attr('offset', '95%')
                .attr('stop-color', function(grad) {return grad.tgtClr;});
                //.attr('stop-opacity', '1');


        var drawgroup = svg.append('g')
            .attr('transform', 'translate(' + maxSize + ',' + maxSize + ')');

        // Edge generator
        d3.svg.line()
            .x(nodeX)
            .y(nodeY)
            .interpolate('basis');

        // D3 builders
        function edgeBuilder (edge) {
            var path = d3.select(this);
            var x1 = nodeIndex[edge.source].x, y1 = nodeIndex[edge.source].y,
                x2 = nodeIndex[edge.target].x, y2 = nodeIndex[edge.target].y;
            var x1a, x1b, y1a, y1b, x2a, x2b, y2a, y2b,
                s1 = Math.round(finalNodeSize(nodeIndex[edge.source]) * 10) / 10,
                s2 = Math.round(finalNodeSize(nodeIndex[edge.target]) * 10) / 10;

            var w = (isEdgeSizeFixed ? edgeSizeDefaultValue : (edge.size || 1));
            var w1 = w * (isDirectional ? (0.1 + edgeTaperScale) : 0.5),
                w2 = w * (isDirectional ? 0.0 : 0.5);

            w1  = s1 * w1 < 0.5  ? 0.5 : w1;
            w2  = s2 * w2 < 0.5  ? 0.5 : w2;

            if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
                //split horizontal Y
                x1a = x1 + w1/2;
                x1b = x1 - w1/2;
                y1a = y1 + w1/2;
                y1b = y1 - w1/2;
            } else {
                //vertical - split X
                x1a = x1 + w1/2;
                x1b = x1 - w1/2;
                y1a = y1 + w1/2;
                y1b = y1 - w1/2;
            }
            x2a = x2 + w2/2;
            x2b = x2 - w2/2;
            y2a = y2 + w2/2;
            y2b = y2 - w2/2;

            var startc1 = {x : x1a.toFixed(3), y: y1a.toFixed(3)};
            var startc2 = {x : x2b.toFixed(3), y: y2b.toFixed(3)};
            var curve1 = [ {
                x: (x1a + x2a) / 2 + curvature * (y2 - y1) / 4,
                y: (y1a + y2a) / 2 + curvature * (x1 - x2) / 4
            }, {
                x: x2a,
                y: y2a
            }];
            var curve2 = [{
                x: (x1b + x2b) / 2 + curvature * (y2 - y1) / 4,
                y:  (y1b + y2b) / 2 + curvature * (x1 - x2) / 4
            }, {
                x: x1b,
                y: y1b
            }];
            // var data = [{
            //         x: x1a,
            //         y: y1a
            //     }, {
            //         x: (x1a + x2a) / 2 + curvature * (y2 - y1) / 4,
            //         y: (y1a + y2a) / 2 + curvature * (x1 - x2) / 4
            //     }, {
            //         x: x2a,
            //         y: y2a
            //     },
            //     {
            //         x: x2b,
            //         y: y2b
            //     }, {
            //         x: (x1b + x2b) / 2 + curvature * (y2 - y1) / 4,
            //         y:  (y1b + y2b) / 2 + curvature * (x1 - x2) / 4
            //     }, {
            //         x: x1b,
            //         y: y1b
            //     }
            //     ];
            _.each(curve1, function(obj) {
                obj.x = obj.x.toFixed(3);
                obj.y = obj.y.toFixed(3);
            });
            _.each(curve2, function(obj) {
                obj.x = obj.x.toFixed(3);
                obj.y = obj.y.toFixed(3);
            });
            // edgeGroup.attr("fill", function(edge) {return 'url(#' + gradientsMap[edgeGradMap[edge.id]].id + ')';});

            path
                .attr('d', function() { return edgePath(startc1, startc2, curve1, curve2);})
                .attr("stroke-width", 1)
                .attr("fill", function(edge) {return 'url(#' + gradientsMap[edgeGradMap[edge.id]].id + ')';});
            // edgeGroup
            //     .append('path')
            //     .attr('d', function() {return edgeDraw(curve1) + 'Z';});

            // path
            //     .attr('d', function() {return edgeDraw(curve1) + 'Z';})
            //     .attr('d', function() {return edgeDraw(curve2) + 'Z';})
            //     // .attr("stroke-width", 1)
            //     //.attr("stroke", nodeIndex[edge.source].colorStr)
            //     //.attr("fill", function(edge) {return 'url(#edge_' + edge.id + ')';});
            //     .attr("fill", function(edge) {return 'url(#' + gradientsMap[edgeGradMap[edge.id]].id + ')';});
        }


        //
        //  render edges
        //
        drawgroup.append('g')
            .attr('class', 'edges')
            .attr('fill-opacity', edgeAlpha)
            .selectAll('path')
            .data(edges)
            .enter()
            .append('path')
            .each(edgeBuilder);

        //
        // render nodes
        //
        drawgroup.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes, nodeId)
            .enter()
                .append('g')
                .attr('transform', function(node) {
                    return 'translate(' + nodeX(node) + ',' + nodeY(node) + ')';
                })
                .each(renderNode);


        // For selections
        var selectgroup = svg.append('g')
            .attr('transform', 'translate(' + maxSize + ',' + maxSize + ')');

        var selectedNodeIds = _.keys(graphSelectionService.getSelectedNodeNeighbours());
        // find node with labels
        var strat =  settings('labelDisplayStrat') == 'topx' ? sigma.d3.labels.topXSize : (settings('labelDisplayStrat') == 'threshold' ? sigma.d3.labels.thresholdStrat : sigma.d3.labels.filterCollision);
        var selectedNodes = _.filter(nodes, function(n) {
            return _.any(selectedNodeIds, function(snId) {
                return snId === n.id;
            });
        });
        if(selectedNodes.length > 0) {
            strat(selectedNodes, settings, false, function(nodesToLabel){
                if(nodesToLabel.length > 0 && typeof _.last(nodesToLabel) !== "undefined"){
                    nodesWithLabel = _.reduce(nodesToLabel, function(acc, n) {
                        acc[n.id] = n;
                        return acc;
                    }, {});

                } else {
                    nodesWithLabel = {};
                }
            });
            // set opacity
            drawgroup.attr("opacity", 0.1);
        } else {
            strat(nodes, settings, false, function(nodesToLabel){
                if(nodesToLabel.length > 0 && typeof _.last(nodesToLabel) !== "undefined"){
                    nodesWithLabel = _.reduce(nodesToLabel, function(acc, n) {
                        acc[n.id] = n;
                        return acc;
                    }, {});

                } else {
                    nodesWithLabel = {};
                }
            });
        }

        //
        //  render edges
        //
        var selEdgeIds = _.keys(graphSelectionService.getEdges());
        var selEdges = _.filter(edges, function(edge) {
            return _.any(selEdgeIds, function(snId) {
                return snId === edge.id;
            });
        });
        selectgroup.append('g')
            .attr('class', 'edges')
            .attr('fill-opacity', edgeAlpha)
            .selectAll('path')
            .data(selEdges)
            .enter()
            .append('path')
            .each(edgeBuilder);

        //
        // render nodes
        //
        selectgroup.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(selectedNodes, nodeId)
            .enter()
                .append('g')
                .attr('transform', function(node) {
                    return 'translate(' + nodeX(node) + ',' + nodeY(node) + ')';
                })
                .each(renderNode);

        //
        //  Render labels
        //
        selectgroup.append('g')
            .attr('class', 'labels')
            .style('fill', '#000000')
            .style('font-family', 'proxima-nova, "Proxima Nova", "Helvetica Neue", Helvetica, Arial, sans-serif')
            .style('text-shadow', 'white -1px -1px 0px, white 1px -1px 0px, white -1px 1px 0px, white 1px 1px 0px')
            .style('font-weight', 'bold')
            .selectAll('g')
            .data(_.values(nodesWithLabel), nodeId)
            .enter()
                .append('g')
                .attr('transform', function(node) {
                    return 'translate(' + nodeX(node) + ',' + nodeY(node) + ')';
                })
                .each(renderLabel);

    }

    function renderSvg (divElem) {
        var detached = d3.select(divElem);
        settings = renderGraphfactory.sig().settings;
        setSettings(settings);
        // renderGraph(detached, dataGraph.getRenderableGraph().graph, {});
        renderGraph(detached, renderGraphfactory.sig().graph, {});
    }

    function getSvgUrl (xml) {
        return $http.post("/api/svg_render", {
            svg_data : xml
        }).then(function(data) {
            return data.data.url;
        });
    }


}]);