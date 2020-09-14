'use strict';
/**
 */

var _       = require('lodash'),
    assert  = require('assert');

//API
module.exports = {
    reworkNetwork
};

// generates cluster info + many other things
function reworkNetwork (network, dataset, removeOriginals) {
    var linkingAttrs = _.map(_.get(network, 'generatorInfo.links_FromAttributes.questions'),'Question');
    network.linkingAttrs = linkingAttrs;
    network.clusters = _.get(network, 'clusterInfo.0.clusters',[]);

    network.nNodes = network.nodes.length;
    network.nLinks = network.links.length;
    network.nClusters = network.clusters.length;

    var dpIndex = _.indexBy(dataset.datapoints, 'id');

    // remove originals from node
    _.each(network.nodes, function (node) {
        if(removeOriginals) {
            delete node.attr.OriginalX;
            delete node.attr.OriginalY;
            delete node.attr.OriginalLabel;
            delete node.attr.OriginalSize;
            delete node.attr.OriginalColor;
        }

        node.archetypes = [];
        node.bridgers = [];
        node.clusters = [];
        node.clusterId = undefined;

        node.isArchetype = false;
        node.isBridger = false;

        var dp = dpIndex[node.dataPointId];
        assert(dp, 'each node should have a corresponding datapoint');
        _.defaults(node.attr, dp.attr);
    });

    // find all nodes in a cluster
    var clusterId_NodeIds_Idx = _(network.nodes)
        .groupBy('attr.Cluster')
        .pairs()
        .reduce(function (acc,val) {
            acc[val[0]] = val[1];
            return acc;
        }, {});

    // add additional info
    _.each(network.clusters, function  (cluster) {
        var nodes = !_.isEmpty(linkingAttrs)  //use cluster.label for default networks
            ? clusterId_NodeIds_Idx[cluster.linkingAttrName]
            : clusterId_NodeIds_Idx[cluster.label];

        cluster.id = cluster.cluster;
        cluster.Nodes       = _.map(nodes,'id');
        cluster.Bridgers    = _.map(_.get(cluster, 'Bridgers', []), id => '' + id);
        cluster.MostCentral = _.map(_.get(cluster, 'MostCentral', []), id => '' + id);

        // decorate node with cluster info
        _.each(nodes, function (node) {
            node.clusterId = cluster.id;
            node.clusters.push(cluster.id);

            if(cluster.MostCentral.indexOf(node.id) > 0) {
                node.isArchetype = true;
                node.archetypes.push(cluster.id);
            }

            if(cluster.Bridgers.indexOf(node.id) > 0) {
                node.isBridger = true;
                node.bridgers.push(cluster.id);
            }
        });
    });
    return network;
}