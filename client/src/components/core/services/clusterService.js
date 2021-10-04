/**
* Info for Node Links in graph
*/
angular.module('common')
.service('clusterService', ['$rootScope', 'dataGraph',
function ($rootScope, dataGraph) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.getAllClusters = getAllClusters;
    this.getCoordinatesForCluster = getCoordinatesForCluster;
    this.d3ClusterCreate = d3ClusterCreate;
    // this.d3ClusterRender = d3ClusterRender;

    function getAllClusters () {
        const nodes = dataGraph.getAllNodes();

        const res = nodes.reduce((acc, node) => {
            const key = node.attr.Keyword_Theme;

            return {...acc, [key]: acc[key] ? [...acc[key], node] : [node]}
        }, {})

        return res;
    }

    function getCoordinatesForCluster (clusterName) {
        const clusters = getAllClusters();
        const cluster = clusters[clusterName];

        const points = cluster.reduce((acc, i) => {
            if (acc.point1) {
                if (i.attr.OriginalY > acc.point1.attr.OriginalY) {
                    acc.point1 = i;
                }

                if (i.attr.OriginalY < acc.point2.attr.OriginalY) {
                    acc.point2 = i;
                }
            } else {
                acc.point1 = i;
                acc.point2 = i;
            }

            return acc;
        }, { point1: null, point2: null });

        return {name: clusterName, ...points};
    }
    
    function d3ClusterCreate (canvas) {
        var sel = canvas.append('svg');
        // var n = node;
        // var prefix = settings('prefix'),
        //     showImage = settings("nodeImageShow"),
        //     imageAttr = settings("nodeImageAttr");
        // console.assert(prefix.length > 6, 'prefix must be correct');

        var clipId = _.uniqueId('clip_');

        
        sel = 
            // node base
            sel.append('circle').classed('node-main', true);
            sel.append('g').classed('node-aggr-donut', true); // path group
            sel.append('text');
            //border
            sel.append('circle')
            .classed('node-border', true)
            
                .attr('width', 2 * 100)
                .attr('height', 2 * 100)
                .style('float', 'left')

                .select('.node-main')
                .attr("cx", 100)
                .attr("cy", 100)
                .attr("r", 50)
                .style('stroke-width',  2 + 'px')
                //.style('stroke-width', '1px')
                .style("fill", 'red');

            console.log('CLUSTER', sel);
        // if(enablePieRendering && n.isAggregation) {
            

        // } else {
        //     // main circle
        //     sel.append('circle').classed('node-main', true);

        //     if (node.inHover || node.isSelected) {
        //         // node image filter
        //         if (showImage && node.attr[imageAttr] && node.attr[imageAttr].length > 5) {
        //             sel.append("svg:clipPath")
        //                 .attr('id', clipId)
        //                 .append('circle');
        //             // image
        //             sel.append('svg:image').classed('node-img', true)
        //                 .attr('clip-path', 'url(#' + clipId + ')');
        //         }
        //         // hover border
        //         sel.append('circle').classed('node-hover-border', true);
        //     }

        //     //border
        //     sel.append('circle').classed('node-border', true);
        // }
    }

    
}
]);