'use strict';
var _            = require('lodash');

var JobTracker = require('../services/JobTracker');
var AthenaAPI = require('../services/AthenaAPI');

module.exports = {
    create : function runAlgo(req, res) {
        // body contains
        //
        // taskId : data.data.id,
        // algo_name: name,
        // options: options,
        // projectId: projectId,
        // networkId : networkId,
        // newNetworkName : networkName,
        // createNew: networkId == null

        var algoData = _.pick(req.body, ["taskId", "algo_name", "options", "projectId", "networkId", "newNetworkName", "createNew"]);
        var taskId = req.body.taskId;

        if(_.size(algoData) > 0 && taskId && taskId.length > 0) {
            console.log("TASK ID:", taskId);
            console.log("Running new athena algo with options:", algoData);
            var job = JobTracker.get(taskId);
            if(job == null) {
                res.status(400)
                    .send(`No Task tracking available for taskId ${taskId}. create a new task if monitoring is required`);
            }
            var athenaES = AthenaAPI.runAlgo(algoData);
            JobTracker.pipeAthenaEvents(job.id, athenaES);

            res.json(200,job);
        } else {
            res.json(400, {
                error : 'Invalid or no name/taskId given:' + JSON.stringify(algoData)
            });
        }
    },
    listAlgo : function listAlgo(req, res){
        req.socket.setTimeout(0);
        // console.log("Got request for algo listing!");
        AthenaAPI.getAlgoList()
        .then(function(listing) {
            // console.log("Athena algo returns:", listing);
            res.json(200, listing);
        })
        .catch(function(e) {
            res.json(400, {
                msg : "Error in fetching algo Listing from athena",
                err : e.stack || e
            });
        });
    }
};
