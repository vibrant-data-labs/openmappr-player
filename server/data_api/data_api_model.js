'use strict';
/**
 */

var _       = require('lodash'),
    Promise = require("bluebird"),
    assert  = require('assert');

var ProjModel = require('../project/proj_model'),
    DSModel = require('../datasys/datasys_model'),
    CacheMaster = require('../services/CacheMaster');

var cache = CacheMaster.getForNetworks();
var dsCache = CacheMaster.getForDatasets();

//API
module.exports = {
    getNetworksForProject,

    getNWData,
    getClusterData,
    getDatasetData,

    injectIntelligence,
    getCluster,
    getNeighbourIds,
    getAllWithIds,

    isCluster,

    getLink,
    getNode
};


function getNWData (nwid) {
    assert(nwid && nwid.length > 8, "nwid needs to be given");
    return cache.get(nwid)
    .catch(CacheMaster.ItemNotFound, function () {
        console.log('[getNWData] Loading network: ' + nwid);
        return DSModel.readNetwork(nwid, false, false)
        .then(network => getDatasetData(network.datasetId.toHexString()).then( dataset => [network, dataset]))
        .spread(injectIntelligence)
            .tap(network => cache.insert(nwid, network));
    });
}

function getClusterData (nwid, clusterId) {
    assert(nwid && nwid.length > 8, "nwid needs to be given");
    assert(clusterId && clusterId.length > 8, "clusterId needs to be given");
    return getNWData(nwid)
    .then(function (network) {
        return getCluster(network.clusters, clusterId);
    });
}

function getDatasetData (dsId) {
    assert(dsId && dsId.length > 8, "dsId needs to be given");
    return dsCache.get(dsId)
    .catch(CacheMaster.ItemNotFound, function () {
        console.log('[getDatasetData] Loading dataset: ' + dsId);
        return DSModel.readDataset(dsId, false)
            .tap(dataset => dsCache.insert(dsId, dataset));
    });
}

function getNetworksForProject (projectId) {
    return ProjModel.listByIdAsync(projectId)
    .then(function (project) {
        if(!project) {
            return Promise.reject(new Error(`Project with id :'${projectId} not found.`));
        }
        if(!project.networks[0]) {
            return Promise.reject(new Error(`Project with id :'${projectId} has no networks.`));
        }
        return project.networks.map(obj => obj.ref);
    })
    .map(getNWData);

}

// true if the cluster is a valid cluster Id or not
function isCluster (network, clusterId) {
    return  _.some(network.clusters, 'id', clusterId);
}


function injectIntelligence (network, dataset) {
    var linkingAttrs = _.map(_.get(network, 'generatorInfo.links_FromAttributes.questions'),'Question');
    network.linkingAttrs = linkingAttrs;
    network.clusters = _.get(network, 'clusterInfo.0.clusters',[]);

    network.nNodes = network.nodes.length;
    network.nLinks = network.links.length;
    network.nClusters = network.clusters.length;

    var dpIndex = _.indexBy(dataset.datapoints, 'id');

    // remove originals from node
    _.each(network.nodes, function (node) {
        delete node.attr.OriginalX;
        delete node.attr.OriginalY;
        delete node.attr.OriginalLabel;
        delete node.attr.OriginalSize;
        delete node.attr.OriginalColor;

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
        .reduce(function (acc,val){
            acc[val[0]] = val[1];
            return acc;
        }, {});

    // add additional info
    _.each(network.clusters, function  (cluster) {
        var nodes = clusterId_NodeIds_Idx[cluster.linkingAttrName];

        cluster.id = cluster.cluster || cluster.linkingAttrName;
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

function getCluster (clusters, clusterId) {
    var tgtCluster = _.filter(clusters, 'id', clusterId);

    if(tgtCluster.length === 0) {
        return Promise.reject(new Error(`No cluster found for id: ${clusterId}`));
    } else if(tgtCluster.length > 1){
        return Promise.reject(new Error(`too many clusters found for id: ${clusterId}. Got ${tgtCluster.length}`));
    }
    return Promise.resolve(tgtCluster[0]);
}

function getNeighbourIds (network, nodeId) {
    var neighbours = {};
    _.each(network.links, function (link) {
        var src = link.source, tgt = link.target;
        if(src === nodeId) {
            neighbours[tgt] = link;
        }
        if(tgt === nodeId) {
            neighbours[src] = link;
        }
    });
    return _.keys(neighbours);
}

function getAllWithIds (nodes, nodeIds) {
    if(!_.isArray(nodeIds) || nodeIds.length === 0) return [];
    var nodeIdx = _.indexBy(nodes, 'id');
    var res = _.compact(_.map(nodeIds, id => nodeIdx[id]));
    return res;
}

function getLink (links, linkId) {
    var filteredLinks = _.filter(links, l => l.id === linkId);
    if(filteredLinks.length === 0) {
        return Promise.reject(new Error(`No link found for id: ${linkId}`));
    } else if(filteredLinks.length > 1){
        return Promise.reject(new Error(`too many links found for id: ${linkId}. Got ${filteredLinks.length}`));
    }
    return Promise.resolve(filteredLinks[0]);
}

function getNode (nodes, nodeId) {
    var filteredNodes = _.filter(nodes, n => n.id === nodeId);
    if(filteredNodes.length === 0) {
        return Promise.reject(new Error(`No node found for id: ${nodeId}`));
    } else if(filteredNodes.length > 1){
        return Promise.reject(new Error(`too many nodes found for id: ${nodeId}. Got ${filteredNodes.length}`));
    }
    return Promise.resolve(filteredNodes[0]);
}

