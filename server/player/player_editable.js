'use strict';

var _           = require('lodash'),
    Promise     = require('bluebird'),
    ObjectID    = require('mongoose').Types.ObjectId;

var playerModel      = require("./player_model"),
    projModel        = require("../project/proj_model"),
    DSModel          = require("../datasys/datasys_model"),
    dataUtils        = require("../utils/dataUtils"),
    AthenaAPI        = require("../services/AthenaAPI"),
    PlayerTracker    = require("../services/PlayerTracker");


// ----- API ------ //
module.exports = {
    updateDsAndNetworks
};
// --------------------------- //




// ----- Core Functions ------ //
// --------------------------- //
function updateDsAndNetworks(req, res) {
    var logPrefix = 'player_editable.updateDsAndNetworks: ';
    var params = req.body;
    var projId = params.projId;

    var playerP = playerModel.listByProjectIdAsync(projId);
    console.log("Req data: ", req.body);
    console.log("attrValsColl parse: ", JSON.parse(params.attrValsColl));
    params.attrValsColl = JSON.parse(params.attrValsColl);

    playerP
        .then(player => {
            if(player.isEditable !== true) {
                console.error(logPrefix + 'Player not editable');
                console.log(logPrefix + 'Player Id: ', player._id);
                throw new Error('Player not editable');
            }
            return projModel.listByIdAsync(projId);
        })
        .then(project => {
            var datasetP = DSModel.readDataset(project.dataset.ref, false);
            var networksP = Promise.all(_.map(project.networks, function(networkObj) {
                return DSModel.readNetwork(networkObj.ref, false, false);
            }));

            return Promise.all([datasetP, networksP, Promise.resolve(project)]);
        })
        .spread((dataset, networks, project) => {
            var attrValsMap = _sanitizeFormResponse(params.attrValsColl, dataset.attrDescriptors);
            var networksToUpdateP = Promise.resolve([]);
            console.log(logPrefix + 'AttrValsMap: ', attrValsMap);

            if(!attrValsMap.Username) { throw new Error("Row data does not have Username attr"); }
            var datapointToUpdate = _.find(dataset.datapoints, 'attr.Username', attrValsMap.Username);

            if(!datapointToUpdate) {
                // New datapoint
                let newDPAttrValMap = _.pick(attrValsMap, val => {
                    return val != null && val !== "";
                });
                let newDP = new DSModel.DataPoint(new ObjectID().toString(), newDPAttrValMap);

                // Find label attr
                let firstDP = dataset.datapoints[0];
                let firstDPLabelVal = _.get(firstDP, 'attr.DataPointLabel');
                let labelSrcAttr = _.findKey(_.omit(firstDP.attr, 'DataPointLabel'), val => val === firstDPLabelVal);
                if(!labelSrcAttr) { throw new Error('Label Key not found'); }

                // Add DataPointLabel
                newDP.attr.DataPointLabel = newDP.attr[labelSrcAttr];

                // If DataPointColor exists, add default color
                if(_.find(dataset.attrDescriptors, 'id', 'DataPointColor')) {
                    newDP.attr.DataPointColor = "#c8c8c8";
                }
                // Add Datapoint
                dataset.datapoints.push(newDP);

                //Since new datapoint added, update all networks
                networksToUpdateP = Promise.resolve(networks);
            }
            else {
                // Some datapoint updated
                let dp = datapointToUpdate;
                if(!dp) { throw new Error('Datapoint doesn\'t exist at index: ', dpIdx); }
                let updatedAttrValsMap = _.pick(attrValsMap, (val, key) => !_.isEqual(val, dp.attr[key]));
                let updatedAttrIds = _.keys(updatedAttrValsMap);
                let networksToUpdate = _.filter(networks, network => _networkNeedsRegen(network, updatedAttrIds));

                _.forOwn(updatedAttrValsMap, (val, key) => {
                    if(val != null && val !== "") {
                        dp.attr[key] = val;
                    }
                    else {
                        delete dp.attr[key];
                    }
                });

                // Update networks if network attributes updated
                networksToUpdateP = Promise.resolve(networksToUpdate);
            }

            return Promise.all([DSModel.saveDataset(dataset, false), networksToUpdateP, Promise.resolve(project)]);
        })
        .spread((updatedDS, networksToUpdate, project) => {
            console.log(logPrefix + 'dataset updated');
            _.each(networksToUpdate, network => {
                console.log(logPrefix + 'network needs regen: ', network.generatorInfo.links_FromAttributes);
            });

            return Promise.all(_.map(networksToUpdate, network => _genNewAndDeleteOldNetwork(network, project)));
        })
        .then((oldNewNetworkIdsColl) => {
            return Promise.all([projModel.listByIdAsync(projId), Promise.resolve(oldNewNetworkIdsColl)]);
        })
        .spread((project, oldNewNetworkIdsColl) => {
            var oldNetworkIds = _.map(oldNewNetworkIdsColl, 'oldNetworkId');
            project.networks = _.reject(project.networks, network => {
                return oldNetworkIds.indexOf(network.ref) !== -1;
            });

            _.each(project.snapshots, function(snap) {
                var networkIdMapForSnap = _.find(oldNewNetworkIdsColl, 'oldNetworkId', snap.networkId);
                if(networkIdMapForSnap) {
                    // Snapshot network regenerated
                    snap.networkId = networkIdMapForSnap.newNetworkId;
                    // snap.layout.xaxis = 'OriginalX';
                    // snap.layout.yaxis = 'OriginalY';
                }
            });

            return project.save().thenReturn(project);
        })
        .then( project => {
            PlayerTracker.update(project.id, "data updated from google form", null);
            console.log(logPrefix, "Player and Project got updated successfully with necessary dataset and network update ops.");
            return res.status(200).send('Success');
        })
        .catch(errr => {
            var err = errr.stack || errr;
            return res.status(500).send(err);
        });

}

function _sanitizeFormResponse(attrValsColl, attrDescriptors) {
    // attrValsColl = [{id: 'Born', val: 1945}, {id: 'Name', val: 'Bimal'}, {id: 'Born', val: ''}]
    var attrValsMap = {};
    _.each(attrValsColl, keyValPair => {
        var attrId = keyValPair.id;
        var attrVal = keyValPair.val;
        var attrDescr = _.find(attrDescriptors, attrDescr => attrDescr.id && attrDescr.id.toLowerCase() == attrId.toLowerCase());
        if(!attrDescr) {
            return console.error('Ignoring update for Attr as attrDescriptor not found for id: ', attrId);
        }

        if(!_.has(attrValsMap, attrId)) {
            attrValsMap[attrId] = null;
        }
        if(attrVal != null && attrVal !== "") {
            attrValsMap[attrId] = dataUtils.valueParser(attrDescr.attrType, attrVal);
        }
    });

    return attrValsMap;
}

function _genNewAndDeleteOldNetwork(network, project) {
    var logPrefix = 'player_editable: _genNewAndDeleteOldNetwork ';
    var algoOptions = _.get(network, 'generatorInfo.links_FromAttributes', {});
    var generateNetworkP = _generateNetwork(project._id, project.dataset.ref, network.name, algoOptions);
    var newNetworkId = null;

    return generateNetworkP
        .then(netgenResult => {
            console.log(logPrefix, 'network generated successfully');
            newNetworkId = _.get(netgenResult, 'result.networkId');
            if(!newNetworkId) throw new Error('Result did not contain new network id!');
            return DSModel.removeNetworkById(network.id);
        })
        .then(() => {
            console.log(logPrefix + 'Old Network deleted.');
            console.log(logPrefix + 'Deleted nework Id: ' + network.id);
            return {oldNetworkId: network.id, newNetworkId: newNetworkId};
        })
        .catch(function(errr) {
            var err = errr.stack || errr;
            console.error(logPrefix + "Error in deleting. ", err);
        });
}

function _generateNetwork(projectId, datasetID, networkName, algoOptions) {
    var algoDataDef = {
        "algo_name": "links_FromAttributes",
        "options": {
            "analyseCurrentNetwork": false,
            "dataPointsToAnalyse": [],
            "questions": [],
            "aggregation": "",
            "headerID": "id",
            "minAnsweredFrac": 0.5,
            "linksPer": 3,
            "keepDisconnected": false,
            "keepQuestions": true,
            "weightByFreq": true,
            "fineClusters": false,
            "mergeClusters" : false
        },
        "projectId": projectId,
        "datasetId": datasetID,
        "newNetworkName": networkName,
        "createNew": true
    };
    var logPrefix = 'player_editable: _generateNetwork ';

    algoDataDef.taskId =  "athena_" + _.random(1,10000);
    _.assign(algoDataDef.options, algoOptions);

    var athenaES = AthenaAPI.runAlgo(algoDataDef);
    var promise = new Promise(function(resolve, reject) {
        var isDone = false;
        var finalPayload = null;
        athenaES.on('data', function _athenaDataStream(payload) {
            console.log(logPrefix, payload);
            var err = null;
            if(payload.type === 'update' && payload.status) {
                if(payload.status === 'completed') {
                    isDone = true;
                    console.log(logPrefix, "network generated successfully");
                    finalPayload = payload;
                }
            }
            else if(payload.type === 'delete') {
                if(!isDone) {
                    console.error(logPrefix, "Network gen job got deleted before finishing: ", err);
                    reject(payload);
                }
            }
            else if(payload.type === 'error') {
                if(!isDone) {
                    console.error(logPrefix, "Network gen job got errored out before finishing: ", err);
                    reject(payload);
                }
            }
            else if(payload.type === 'notify') {
                // Progress updates
            }
            else {
                console.warn(logPrefix, "network gen job got invalid event");
            }
        })
        .on('error', function(err) {
            err = err.stack || err;
            console.error(logPrefix, "Network gen job got errored out before finishing", err);
            reject(err);
        })
        .on('end', function() {
            console.log(logPrefix, "network gen job stream ended");
            if(finalPayload) {
                resolve(finalPayload);
            } else {
                console.error(logPrefix, "stream ended before finishing generation");
                reject("stream ended before finishing generation");
            }
        });
    });
    return promise;
}

function _networkNeedsRegen(network, updatedAttrs) {
    if(_.intersection(_getNetworkAttrs(network), updatedAttrs).length > 0) {
        return true;
    }
    return false;
}

function _getNetworkAttrs(network) {
    var result = [];
    if(!network) throw new Error('Network not found');
    var genInfo = network.generatorInfo;
    if(_.isObject(genInfo) && genInfo.links_FromAttributes) {
        result = _.map(genInfo.links_FromAttributes.questions, 'Question');
    }
    return result;
}
