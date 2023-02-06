// provide custom node repositioning on user actions such as node pop
//
angular.module('common')
.service('repositionService', ['$q', '$rootScope', '$timeout', 'dataGraph', 'layoutService', 'zoomService', 'renderGraphfactory', 'BROADCAST_MESSAGES',
function($q, $rootScope, $timeout, dataGraph, layoutService, zoomService, renderGraphfactory, BROADCAST_MESSAGES) {

    "use strict";


    /*************************************
    *************** API ******************
    **************************************/
    this.popNeighbors = popNeighbors;
    this.undoRepositioning  = undoRepositioning;



    /*************************************
    ********* Local Data *****************
    **************************************/



    /*************************************
    ********* Core Functions *************
    **************************************/

    // var refreshRenderGraph = _.debounce(function(rg, delta, event, fn) {
    //     if(delta !== 0) {
    //         if(rg.disableAggregation) {
    //             rg.updateZoomLevel(rg.zoomLevel + delta);
    //         } else {
    //             rg.refreshForZoomLevel(delta);
    //         }
    //     }
    //     fn();
    //     $rootScope.$broadcast(event.type, _.extend(event.data, { delta : delta }));
    // }, 250);

    function doReposition(graph, posInfo, postOp) {
        $rootScope.$broadcast(BROADCAST_MESSAGES.renderGraph.tween, {rg: graph, pos: posInfo, postOp: postOp});
    }

    // pop neighbors around a point (which may not be the node's current position)
    //
    function popNeighbors(node, pos, scale, zoomScale, postOp) {
        var sz = scale * node.size;
        var nodes = [];
        var movedPos = {};
        var originalPos = {};
        var sig = renderGraphfactory.sig();
        var graph = sig.graph;
        var prefix = renderGraphfactory.getTweenPrefix();

        // get target nodes
        _.forEach(graph['getNodeNeighbours'](node.id), function(edgeInfo, targetId) {
            var trg = graph.getNodeWithId(targetId);    // get neighbor node
            trg.inPop = {neighbor: true};
            nodes.push(trg);
        });
        console.log("[repositionService.popNeighbors] processing " + nodes.length + " neighbors");
        // reposition neighbor nodes
        var nodeInfo = circlePack({x: pos.x, y: pos.y, r: sz}, nodes, 3/zoomScale);
        _.each(nodeInfo.info, function(n) {
            // save node position and size, get destination if in tween
            var sz = n.node[prefix+'size'] === undefined ? n.node['size'] : n.node[prefix+'size'];
            var x = n.node[prefix+'x'] === undefined ? n.node['x'] : n.node[prefix+'x'];
            var y = n.node[prefix+'y'] === undefined ? n.node['y'] : n.node[prefix+'y'];
            originalPos[n.node.id] = {node: n, x: x, y: y, size: sz};
            movedPos[n.node.id] = {x: n.x, y: n.y, size: n.r};  // new node position and size
        });
        // update graph
        doReposition(graph, movedPos, postOp);
        return {pos: originalPos, maxR: nodeInfo.maxR};
    }

    function undoRepositioning(originalPos, postOp) {
        _.each(originalPos, function(info) {
            // reset flag if node is not the new popped node
            if(info.node.node.inPop && info.node.node.inPop.neighbor) {
                info.node.node.inPop = undefined;
            }
        });
        doReposition(renderGraphfactory.sig().graph, originalPos, postOp);
    }

    // position nodes (the neighbors) around a circle (the popped node)
    // two "forces" - attraction towards center
    // and repulsion along line connecting centers when overlap occurs
    //
    function circlePack(circle, nodes, minSz) {
        // attract to center node and avoid overlapping center node
        function attract(node) {
            var r = Math.sqrt(node.x*node.x + node.y*node.y);
            var dr = node.r + circle.r - r;
            node.deltax += dr * node.x/r;
            node.deltay += dr * node.y/r;
        }

        function collide(n1, n2) {
            var dx = n2.x - n1.x;
            var dy = n2.y - n1.y;
            var r = Math.sqrt(dx*dx + dy*dy);
            var dr = n1.r + n2.r - r;
            if(dr > 0) {
                var rTot = n1.r + n2.r;
                n1.deltax += -0.5 * dr * dx * n1.r/(n2.r*rTot);
                n1.deltay += -0.5 * dr * dy * n1.r/(n2.r*rTot);
                n2.deltax += 0.5 * dr * dx * n2.r/(n1.r*rTot);
                n2.deltay += 0.5 * dr * dy * n2.r/(n1.r*rTot);
            }
        }

        var nodeInfo = [];
        // build info for use in layout algo; offset so node center is at (0,0)
        // enlarge nodes if they are below a minimum threshold
        _.each(nodes, function(n) {
            nodeInfo.push({node: n,
                x: n.x - circle.x,
                y: n.y - circle.y,
                r: (n.size < minSz) ? minSz : n.size
            });
        });
        for(var k = 0; k < 100; k++) {
            // clear deltas
            _.each(nodeInfo, function(n) {n.deltax = n.deltay = 0;});
            // compute attraction to center
            _.each(nodeInfo, attract);
            // compute overlap repulsion - check each pair for overlap
            for(var i = 0; i < nodeInfo.length; i++) {
                for(var j = i+1; j < nodeInfo.length; j++) {
                    collide(nodeInfo[i], nodeInfo[j]);
                }
            }
            // reposition and check movement scale
            var maxDelta = 0;
            _.each(nodeInfo, function(n) {
                n.x += n.deltax;
                n.y += n.deltay;
                if( n.deltax > maxDelta ) {
                    maxDelta = n.deltax;
                }
                if( n.deltay > maxDelta ) {
                    maxDelta = n.deltay;
                }
            });
            // break out of the loop if movement is small
            if(maxDelta < circle.r/100) {
                break;
            }
        }
        // offset nodes back to screen relative position
        // and test whether node is to left of popped node so label needs to be moved
        var maxR = 0;
        _.each(nodeInfo, function(n) {
            if( n.r > maxR ) {
                maxR = n.r;
            }
            if(n.x < 0 && Math.abs(n.y) < circle.r) {
                n.node.inPop.left = true;
            }
            n.x += circle.x;
            n.y += circle.y;
        });
        return {info: nodeInfo, maxR: maxR};
    }

}
]);