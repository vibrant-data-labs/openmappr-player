angular.module('common')
.service('aggregatorService', [function() {

    "use strict";

    /*************************************
    *************** API ******************
    **************************************/
    this.AggregatorDef = Aggregator;



    /*************************************
    ********* Core Functions *************
    **************************************/

    /**
     * THe aggregation class
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    function Aggregator(options) {
        this.id = _.uniqueId('aggregator_');
        this.quadX = options.quadX || 50;
        this.quadY = options.quadY || 50;
        this.layout = options.layout;
    }
    // Given a list of nodes, it returns an object containing list of nodes and edges to be render
    Aggregator.prototype.aggregate = function aggregate(nodes, edgeList, prefix) {
        var self = this,
            nodesToRender = [],
            nodeIndex = {},
            aggIndex = {},
            edges = [],
            source,
            target,
            minx = _.min(nodes, prefix + 'x')[prefix + 'x'],
            miny = _.min(nodes, prefix + 'y')[prefix + 'y'],
            maxx = _.max(nodes, prefix + 'x')[prefix + 'x'],
            maxy = _.max(nodes, prefix + 'y')[prefix + 'y'];

        // console.group('Aggregator');
        // console.log('Initial Number of Nodes: %i', nodes.length);
        // console.log('Initial Number of Edges: %i', edgeList.length);

        self.bounds = {
            x:minx,
            y:miny,
            width:maxx - minx,
            height: maxy - miny
        };
        //console.log('Aggr Bounds height: %i, width: %i', self.bounds.height, self.bounds.width);

        _.each(nodes, function(n) {
            nodeIndex[n.id] = n;
            self.clearNode(n);
        });
        // Which strategy to use for aggregation
        var aggStrat = new GridStrategy({
            bounds: self.bounds,
            prefix: prefix,
            nodes: nodes,
            quadX: self.quadX,
            quadY: self.quadY
        });

        aggStrat.iterate(function(quad){
            if(quad.nodes.length > 1) {
                var aggNode = self.buildAggregatorNode(quad.nodes, prefix);
                aggNode.quad = quad;
                aggIndex[aggNode.id] = aggNode;
            }
        });

        // Fix edges to point to aggregations
        _.each(edgeList, function(e) {
            source = nodeIndex[e.source];
            target = nodeIndex[e.target];

            if(source && source.isAggregated) {
                e.source = source.aggregatorNode.id;
            }
            if(target && target.isAggregated) {
                e.target = target.aggregatorNode.id;
            }
            //remove same node edges
            if(e.source !== e.target) {
                edges.push(e);
            }
        });

        // console.log('Aggregated Nodes length: %i, list: %O', _.size(aggIndex), aggIndex);

        //Take rest of nodes
        _.each(nodeIndex,function(n) {
            if(!n.isAggregated) {
                nodesToRender.push(n);
            }
        });
        _.each(aggIndex, function(n) {
            nodesToRender.push(n);
        });

        // console.log('Final number of Nodes: %i', nodesToRender.length);
        // console.log('Final number of Edges: %i', edges.length);
        // console.groupEnd();

        return {
            nodes : nodesToRender,
            edges : edges
        };
    };
    /**
     * Reset aggregation related node properties
     * @param  {[type]} node [description]
     * @return {[type]}      [description]
     */
    Aggregator.prototype.clearNode = function clearNode(node) {
        node.isAggregated = false;
        node.aggregatorNode = null;
    };
    /**
     * Builds the aggragator node for the given list of nodes
     * @param  {[type]} nodes  [description]
     * @param  {[type]} prefix [description]
     * @return {[type]}        [description]
     */
    Aggregator.prototype.buildAggregatorNode = function buildAggregatorNode(nodes, prefix) {
        var settings = this.layout.mapprSettings;
        var aggNodeMinSize = +settings.aggNodeMinSize,
            aggNodeMaxSize = +settings.aggNodeMaxSize;

        var aggNode = _.clone(nodes[0]),
            sumx = 0, sumy = 0, sizeAgg = 0;

        var clusterSizeStrategy = 1;

        _.each(nodes, function(n) {
            if(clusterSizeStrategy === 0) {
                sumx = sumx + n[prefix + 'x'];
                sumy = sumy + n[prefix + 'y'];
                sizeAgg = sizeAgg + n[prefix + 'size'];
            } else if(clusterSizeStrategy == 1){
                sumx = sumx + n[prefix + 'x'];
                sumy = sumy + n[prefix + 'y'];
                sizeAgg = Math.max(sizeAgg, n[prefix + 'size']);
            }
        });

        // color stuff. We want the color of the aggNode to be the common color of all the nodes
        var colorArr = _.map(_.pluck(nodes,'colorStr'), function(cl) {return d3.rgb(cl);});
        var colorArrIndex = _.reduce(colorArr, function(acc, col) {
            acc[col.toString()] = ( acc[col.toString()] || 0 )  + 1;
            return acc;
        }, {});
        var popularColor = _.reduce(colorArrIndex, function(acc, count, key) {
            if(acc[0] < count) {
                return [count, key];
            }
            else {
                return acc;
            }
        },[-1,'']);
        var d3col = d3.rgb(popularColor[1]);

        aggNode.id = 'agg:' + (_.map(nodes, function(e) {return e.id;}).join('_'));
        aggNode[prefix + 'x'] = Math.round(sumx / nodes.length);
        aggNode[prefix + 'y'] = Math.round(sumy / nodes.length);
        aggNode[prefix + 'size'] = Math.min(aggNodeMaxSize, Math.max(aggNodeMinSize,sizeAgg));
        aggNode[prefix + 'colorStr'] = d3col.toString();
        aggNode[prefix + 'color'] = [d3col.r, d3col.g, d3col.b];
        aggNode[prefix + 'aggregatedColorArray'] = colorArr.sort();
        //aggNode[prefix + 'size'] = Math.max(15,Math.round(aggNode[prefix + 'size'] * Math.max(1, Math.sqrt(nodes.length) / 2)));

        aggNode.isAggregation = true;
        aggNode.aggregatedNodes = nodes.slice(0);
        aggNode.type = 'aggr';

        //Mark individual nodes as aggregated
        _.each(nodes, function(n) {
            n.isAggregated = true;
            //n.hidden = true;
            n.aggregatorNode = aggNode;
        });

        return aggNode;
    };
    //Whether node is aggregated
    Aggregator.prototype.isAggregated = function isAggregated(node) {
        return !!node.isAggregated;
    };
    //
    Aggregator.prototype.isAggregation = function isAggregation(node) {
        return !!node.isAggregation;
    };

    //
    // Aggregation strategies
    //

    // X*Y Grid strategy.
    // The idea is the divide the graph bounds into smaller rectangles. and them map the node to a specific rectangle.
    function GridStrategy(opts) {
        var bounds = opts.bounds,
            nodes = opts.nodes,
            prefix = opts.prefix || '';

        var quadX = opts.quadX, quadY = opts.quadY;
        var i,j,l,n, posx, posy, g; //loop helpers.
        //grid of[x][y] where x ,y are grid indexes. stores all nodes in that grid.
        var grid = [];
        // Find out how many partitions to divide the bounds into
        var gridi = Math.floor( bounds.width / quadX) + 1;
        var gridj = Math.floor( bounds.height / quadY) + 1;

        //Initialize grid
        for(i = 0; i < gridi; ++i) {
            grid[i] = {};
            for (j = 0; j < gridj; ++j) {
                grid[i][j] = {};
                g = grid[i][j];
                g.nodes = [];
                g.xIndex = i;
                g.yIndex = j;
                g.bounds = {
                    x : bounds.x + quadX*i,
                    y : bounds.y + quadY*j,
                    width: quadX,
                    height: quadY
                };
            }
        }
        //Parse each node and assign to the grid
        for (i = 0, l = nodes.length; i < l; ++i) {
            n = nodes[i];
            posx = Math.floor((n[prefix + 'x'] - bounds.x) / quadX);
            posy = Math.floor((n[prefix + 'y'] - bounds.y) / quadY);
            grid[posx][posy].nodes.push(n);
        }
        this.bounds = bounds;
        this.prefix = prefix;
        this.grid = grid;
        //Build the Iteration func which Iterates over each possible aggregation target
        this.iterate = function(aggFunc) {
            for(i = 0; i < gridi; ++i) {
                for (j = 0; j < gridj; ++j) {
                    g = grid[i][j];
                    aggFunc(g);
                }
            }
        };
    }

}
]);