/**
* Info for Node Links in graph
*/
angular.module('common')
.service('clusterService', ['$rootScope', 'dataGraph', 'renderGraphfactory',
function ($rootScope, dataGraph, renderGraphfactory) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getAllClusters = getAllClusters;
    this.getCoordinatesForCluster = getCoordinatesForCluster;
    this.d3ClusterCreate = d3ClusterCreate;
    this.getCircleCoordinates = getCircleCoordinates;

    function getAllClusters () {
        const nodes = dataGraph.getAllNodes();

        const res = nodes.reduce((acc, node) => {
            const key = node.attr.Keyword_Theme;

            return {...acc, [key]: acc[key] ? [...acc[key], node] : [node]}
        }, {})
        console.log('RESULt', res);
        return res;
    }

    function getCoordinatesForCluster (cluster, obj, node, key) {
        const {xaxis, yaxis} = obj;
        
        const points = cluster.reduce((acc, i) => {
            if (acc.xPointMin) {
                const {xPointMin, xPointMax, yPointMin, yPointMax} = acc;

                if (i.attr[xaxis] > xPointMax.attr[xaxis]) {
                    acc.xPointMax = i;
                }

                if (i.attr[xaxis] < xPointMin.attr[xaxis]) {
                    acc.xPointMin = i;
                }

                if (i.attr[yaxis] > yPointMax.attr[yaxis]) {
                    acc.yPointMax = i;
                }

                if (i.attr[yaxis] < yPointMin.attr[yaxis]) {
                    acc.yPointMin = i;
                }

            } else {
                acc.xPointMin = i;
                acc.xPointMax = i;
                acc.yPointMin = i;
                acc.yPointMax = i;
            }

            return acc;
        }, { xPointMin: null, xPointMax: null, yPointMin: null, yPointMax: null });
        const { xPointMin, xPointMax,  yPointMin, yPointMax} = points;
        
        const sig = renderGraphfactory.sig();

        const xpMin = sig.graph.nodes(xPointMin.id);
        const xpMax = sig.graph.nodes(xPointMax.id);
        const ypMin = sig.graph.nodes(yPointMin.id);
        const ypMax = sig.graph.nodes(yPointMax.id);
        const firstLine = Math.sqrt(Math.pow(xpMax['camcam1:x'] - xpMin['camcam1:x'], 2) + Math.pow(xpMax['camcam1:y'] - xpMin['camcam1:y'], 2));
        const secondLine = Math.sqrt(Math.pow(ypMax['camcam1:x'] - ypMin['camcam1:x'], 2) + Math.pow(ypMax['camcam1:y'] - ypMin['camcam1:y'], 2));
        
        if (firstLine > secondLine) {
            const coordinates = this.getCircleCoordinates(xpMin, xpMax);
            this.d3ClusterCreate(node, coordinates.x, coordinates.y, firstLine / 2, xpMin.colorStr, key);
        } else {
            const coordinates = this.getCircleCoordinates(ypMin, ypMax);
            this.d3ClusterCreate(node, coordinates.x, coordinates.y, secondLine / 2, ypMin.colorStr, key);
        }
    }
    
    function getCircleCoordinates (min, max) {
        
        const minX = min['camcam1:x'];
        const minY = min['camcam1:y'];
        const maxX = max['camcam1:x'];
        const maxY = max['camcam1:y'];

        const middleX = (minX + maxX) / 2;
        const middleY = (minY + maxY) / 2;

        return {x: middleX, y: middleY};
    }

    function d3ClusterCreate (canvas, x, y, r, color = '#eee', key) {
        var clipId = _.uniqueId('clip_');
        var sel = canvas.append('svg');

        sel.attr('id', clipId);
        sel = sel.append('g');
        // node base
        sel.append('circle').classed('node-main', true);

        var svg = canvas.select('svg#' + clipId);
        // console.log('SVG', svg);
        svg.
            attr('width', '100%')
            .attr('height', '100%')
            .style('position', 'absolute')
            .style('fill', 'none');

        svg.select('.node-main')
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", r)
            .style('stroke-width',  2 + 'px')
            .style("stroke", color);
    }

    
}
]);