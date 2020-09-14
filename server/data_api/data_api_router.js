'use strict';

var express = require('express');

var controller    = require('./data_api_controller'),
    model    = require('./data_api_model');

var router = express.Router({mergeParams : true});


router
    .get('/networks', controller.listNetworks)
    /**
     * query params
     * all - [true,false] - whether you want to return all or just a subset
     */
    .get('/networks/:nwid', controller.listSingleNetwork)
    .get('/networks/:nwid/links', controller.listLinks)
    .get('/networks/:nwid/links/:linkId', controller.listSingleLink);

// node specific routes
router
    /**
     * query params
     * bridgers - [true, false] -  select / remove bridgers
     * archetypes = [true, false] - select / remove archetypes
     * clusterId = <id> id of the cluster whose nodes have to be returned
     */
    .get('/networks/:nwid/nodes', controller.listNodes)
    .get('/networks/:nwid/nodes/:nodeId', controller.listSingleNode)
    .get('/networks/:nwid/nodes/:nodeId/neighbours', controller.listNodeNeighbours);

// cluster specific
router
    .get('/networks/:nwid/clusters', controller.listClusters)
    .get('/networks/:nwid/clusters/:clusterId', controller.listSingleCluster)
    .get('/networks/:nwid/clusters/:clusterId/bridgers', controller.listClusterBridgers)
    .get('/networks/:nwid/clusters/:clusterId/archetypes', controller.listClusterArchetypes)
    /**
     * query params
     * bridgers - [true, false] -  select / remove bridgers
     * archetypes = [true, false] - select / remove archetypes
     */
    .get('/networks/:nwid/clusters/:clusterId/nodes', controller.listClusterNodes);


///
/// Params
///
router.param('nwid', function  (req, res, next, id) {
    //validate nwid id
    console.log("[ROUTE.param] --------------------------------");
    console.log("[ROUTE.param] Validating nwid id");
    model.getNWData(id)
    .then(function(network) {
        if (!network ) {
            console.error('[ROUTE.param] nwid [id: ' + id + '] not found!');
            res.status(404).send("Error: nwid not found");
        } else {
            req.network = network;
            console.log('[ROUTE.param] nwid [id: ' + id + '] found!');
            next();
        }
    })
    .catch(function (err) {
        console.error('[ROUTE.param] nwid [id: ' + id + '] not found!', err);
        var data = {
            meta : { status : 404, message : `network with given id ${id} does not exist.` },
            data : {}
        };
        return res.status(404).json(data);
    });
});
router.param('clusterId', function  (req, res, next, id) {
    //validate clusterId id
    console.log("[ROUTE.param] --------------------------------");
    console.log("[ROUTE.param] Validating clusterId id");
    model.getClusterData(req.params.nwid, id)
    .then(function (cluster) {
        if (!cluster ) {
            console.error('[ROUTE.param] clusterId [id: ' + id + '] not found!');
            res.status(404).send("Error: clusterId not found");
        } else {
            req.cluster = cluster;
            console.log('[ROUTE.param] clusterId [id: ' + id + '] found!');
            next();
        }
    })
    .catch(function (err) {
        console.error('[ROUTE.param] clusterId [id: ' + id + '] not found!', err);
        var data = {
            meta : { status : 404, message : `Cluster with given id ${id} does not exist in the network.` },
            data : {}
        };
        return res.status(404).json(data);
    });
});

module.exports = router;