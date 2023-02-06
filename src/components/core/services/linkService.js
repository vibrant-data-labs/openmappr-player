/**
* Info for Node Links in graph
*/
angular.module('common')
.service('linkService', ['$rootScope', 'dataGraph',
function ($rootScope, dataGraph) {
    'use strict';

    /*************************************
    *************** API ******************
    **************************************/
    this.constructLinkInfo = constructLinkInfo;
    this.getLinkInfo = getLinkInfo;


    /*************************************
    ********* Core Functions *************
    **************************************/
    //copied from dirNodeCard. TODO: combine into service
    function constructLinkInfo(node, incomingEdges, outgoingEdges, labelAttr, imageAttr) {
        var links = [];

        _.each(incomingEdges, function (edge, linkNodeId) {
            var linkNode = dataGraph.getRenderableGraph().getNodeById(linkNodeId);
            if (!_.isUndefined(linkNode)) {
                var linkNodeLabel = linkNode.attr[labelAttr] || linkNode.label || 'missing label';
                var linkNodeImage = linkNode.attr[imageAttr] || linkNode.image || '';
                links.push({
                    isIncoming: true,
                    isOutgoing: false,
                    sourceId: linkNodeId,
                    targetId: node.id,
                    linkNode: linkNode,
                    linkNodeLabel: linkNodeLabel,
                    linkNodeImage: linkNodeImage,
                    edgeInfo: edge,
                    id: edge.id
                });
            }
        });

        _.each(outgoingEdges, function (edge, linkNodeId) {
            var linkNode = dataGraph.getRenderableGraph().getNodeById(linkNodeId);
            if (!_.isUndefined(linkNode)) {
                var linkNodeLabel = linkNode.attr[labelAttr] || linkNode.label || 'missing label';
                var linkNodeImage = linkNode.attr[imageAttr] || linkNode.image || '';

                links.push({
                    isIncoming: false,
                    isOutgoing: true,
                    sourceId: node.id,
                    targetId: linkNodeId,
                    linkNode: linkNode,
                    linkNodeLabel: linkNodeLabel,
                    linkNodeImage: linkNodeImage,
                    edgeInfo: edge,
                    id: edge.id
                });
            }
        });

        links = _.sortBy(links, function (link) {
            return link.edgeInfo.attr.similarity;
        });
        links.reverse();

        return links;
    }


    //information for link hover as string
    function getLinkInfo(link) {
        var linkAttrsAR = $rootScope.$eval(link.edgeInfo.attr.linkingAttributes);
        var attrsAR = [];

        //These loops seem super convoluted - should be cleaned up.
        _.forEach(linkAttrsAR, function (attr) {
            var at = _.find(attrsAR, {
                'attr': attr[0]
            });
            if (at) {
                at.val += ', "' + attr[1] + '"';
            } else {
                attrsAR.push({
                    attr: attr[0],
                    val: '"' + attr[1] + '"'
                });
            }
        });

        attrsAR.length = Math.min(attrsAR.length, 5);
        //create string from array
        var str = _.map(attrsAR, function (attrObj) {
            var attrTitle = dataGraph.getNodeAttrTitle(attrObj.attr);
            var attrVal = attrObj.val;
            if (!attrTitle) { throw new Error('Title not found for attr id: ' + attrObj.attr); }
            return '[' + attrTitle + '] ' + attrVal;
        }).join(', ');
        return str;
    }


}
]);