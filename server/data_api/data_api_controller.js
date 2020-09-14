'use strict';
/**
 */

var _       = require('lodash');

var ApiModel = require('./data_api_model');

//API
module.exports = {
    listNetworks,
    listSingleNetwork,
    listClusters,
    listLinks,
    listSingleLink,
    listNodes,
    listSingleNode,
    listNodeNeighbours,

    listSingleCluster,

    listClusterBridgers,
    listClusterArchetypes,
    listClusterNodes
};

function listNetworks (req, res) {
    var projectId = req.query.projectId;
    if(!projectId || !_.isString(projectId) || projectId.length < 5) {
        return res.status(404).json({
            meta : { status : 404, message : "query param 'projectId' not specified or is invalid"},
            data : {}
        });
    }
    ApiModel.getNetworksForProject(projectId)
    .map(function (network) {
        return _.omit(network, ['nodes', 'links', 'networkInfo', 'clusters',
            'nodeAttrDescriptors', 'linkAttrDescriptors', 'clusterInfo']);
    })
    .then(function (networks) {
        res.status(200).json({
            meta : { status : 200 },
            data : networks
        });
    })
    .catch(function (err) {
        res.status(404).json({
            meta : { status : 404, message : err.message },
            data : {}
        });
    });

}

/**
 * [listSingleNetwork description]
 * @return {[type]}     [description]
 */
function listSingleNetwork (req, res) {
    var retAll = req.query.all === "true",
        network = req.network;

    if(!retAll) {
        network = _.omit(network, ['nodes', 'links', 'networkInfo', 'clusters',
            'nodeAttrDescriptors', 'linkAttrDescriptors', 'clusterInfo']);
    }
    var result = {
        meta : { status : 200 },
        data : network
    };
    res.status(200).json(result);
}
/**
 * [listClusters description]
 * @return {[type]}     [description]
 */
function listClusters (req, res) {
    var limit = Number(req.query.limit);
    var clusters = req.network.clusters;

    if(!isNaN(limit) && limit > 0) {
        clusters = _.take(clusters, limit);
    }

    var result = {
        meta : { status : 200 },
        data : clusters
    };
    res.status(200).json(result);
}

function listLinks (req, res) {
    var links = req.network.links;

    var result = {
        meta : { status : 200 },
        data : links
    };
    res.status(200).json(result);
}

function listNodes (req, res) {
    var nodes = req.network.nodes;
    var bridgers = req.query.bridgers,
        archetypes = req.query.archetypes,
        clusterId = req.query.clusterId;

    var selNodes = _(nodes);

    if(archetypes  === 'true' || archetypes === 'false') {
        selNodes = selNodes.filter('isArchetype', archetypes === 'true');
    }

    if(bridgers  === 'true' || bridgers === 'false') {
        selNodes = selNodes.filter('isBridger', bridgers === 'true');
    }

    if(clusterId && ApiModel.isCluster(req.network, clusterId)) {
        selNodes = selNodes.filter('clusterId', clusterId);
    }

    var result = {
        meta : { status : 200 },
        data : selNodes.value()
    };
    res.status(200).json(result);
}

function listSingleCluster (req, res) {
    var cluster = req.cluster;

    var result = {
        meta : { status : 200 },
        data : cluster
    };
    res.status(200).json(result);
}

function listClusterBridgers (req, res) {
    var network = req.network,
        cluster = req.cluster,
        nodes = network.nodes;

    var selNodes = ApiModel.getAllWithIds(nodes, cluster.Bridgers);

    var result = {
        meta : { status : 200 },
        data : selNodes
    };
    res.status(200).json(result);
}

function listClusterArchetypes (req, res) {
    var network = req.network,
        cluster = req.cluster,
        nodes = network.nodes;

    var selNodes = ApiModel.getAllWithIds(nodes, cluster.MostCentral);

    var result = {
        meta : { status : 200 },
        data : selNodes
    };
    res.status(200).json(result);
}

function listClusterNodes (req, res) {
    var network = req.network,
        cluster = req.cluster,
        nodes = network.nodes;

    var bridgers = req.query.bridgers,
        archetypes = req.query.archetypes;

    var selNodes = _(ApiModel.getAllWithIds(nodes, cluster.Nodes));

    if(archetypes  === 'true' || archetypes === 'false') {
        selNodes = selNodes.filter('isArchetype', archetypes === 'true');
    }

    if(bridgers  === 'true' || bridgers === 'false') {
        selNodes = selNodes.filter('isBridger', bridgers === 'true');
    }

    var result = {
        meta : { status : 200 },
        data : selNodes.value()
    };
    res.status(200).json(result);
}

function listSingleLink (req, res) {
    var linkId = req.params.linkId,
        links = req.network.links;

    var result = ApiModel.getLink(links, linkId)
    .then(function (link) {
        return {
            meta : { status : 200 },
            data : link
        };
    });
    res.status(200).json(result);
}

function listSingleNode (req, res) {
    var nodeId = req.params.nodeId,
        nodes = req.network.nodes;

    var result = ApiModel.getNode(nodes, nodeId)
    .then(function (node) {
        return {
            meta : { status : 200 },
            data : node
        };
    });
    res.status(200).json(result);
}

function listNodeNeighbours (req, res) {
    var nodeId = req.params.nodeId,
        network = req.network;
    if(!nodeId) {
        res.status(404).send("NodeId not on the request");
    }
    var neighbourIds = ApiModel.getNeighbourIds(network, nodeId);
    var data = {
        meta : { status : 200 },
        data : neighbourIds
    };
    res.status(200).json(data);
}
