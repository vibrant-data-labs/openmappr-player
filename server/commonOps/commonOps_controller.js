"use strict";

var _ = require("lodash");

var commonOpsListing = require("./commonOps_listing"),
    commonOpsRunner = require("./commonOps_runner");
module.exports = {
    allOps: function(req, res) {
        res.status(200).send(commonOpsListing.allOps());
    },
    /**
     * A list of scripts is generally pushed to this url which has to be stored under their respective organizations
     */
    runOp: function(req, res) {
        var opInst = req.body.opInst,
            datasetId = req.body.datasetId || _.get(req.project,"dataset.ref"),
            networkId = req.body.networkId,
            opId = req.params.op_id;

        var opDesc = _.find(commonOpsListing.allOps(), "id", opId);
        if(!opDesc) {
            return res.status(400).send(`Op not found. given : ${opId}`);
        }
        if(!datasetId || datasetId.length !== 24) {
            return res.status(400).send(`datasetId not found or invalid. given : ${datasetId}`);
        }

        // if(req.query.validateOnly) {

        // }

        console.log("running Op opInst:", opInst);

        var allDone = commonOpsRunner.runOp(opInst, datasetId, networkId);

        var done = allDone.spread(function(dataset, network, shouldTrimNetworks) {
            if(network && shouldTrimNetworks) {
                var networkIds = _.map(req.project.networks, "ref");
                console.log("networkIds: ", networkIds, network.id);
                networkIds = _.filter(networkIds, nwid => nwid != network.id.toString());
                console.log(`[commonOpsController:runOp] trimming ${networkIds.length} networks...`);
                return commonOpsRunner.trimNetworks(dataset, networkIds)
                    .tap(() => console.log(`[commonOpsController:runOp] trimming ${networkIds.length} networks...done`))
                    .thenReturn([dataset, network, shouldTrimNetworks]);
            } else return [dataset, network, shouldTrimNetworks];
        });
        res.status(200).json(done);
    }
};