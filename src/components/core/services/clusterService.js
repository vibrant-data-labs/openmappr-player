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

    function getAllClusters () {
        const nodes = dataGraph.getAllNodes();

        const res = nodes.reduce((acc, node) => {
            const key = node.attr.Keyword_Theme;

            return {...acc, [key]: acc[key] ? [...acc[key], node] : [node]}
        }, {})
        return res;
    }

}
]);