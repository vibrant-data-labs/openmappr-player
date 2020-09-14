'use strict';
var assert = require('assert'),
    _ = require('lodash');

var DSModel  = require("./datasys_model.js");

function insertIntoKeyArray (obj, key, value) {
    if(!_.isArray(obj[key]))
        obj[key] = [];
    return obj[key].push(value);
}
function _keyArrayMergeFunc (objVal, srcVal) {
    if(_.isArray(objVal) && _.isArray(srcVal)) {
        return objVal.concat(srcVal);
    }
    else if(!srcVal) {
        return objVal;
    }
    else if(!objVal) {
        return srcVal;
    }
}
// each array is a map from AttrId -> nodeId Affected
// additions is an array of entity Ids added
function MergeResult (attrUpdates, attrDeletes, attrInserts, additions, unprocessedEntities) {
    this.unprocessedEntities = unprocessedEntities || []; // these entities should be added to the dataset/network
    this.attrUpdates = attrUpdates || {};
    this.attrDeletes = attrDeletes || {};
    this.attrInserts = attrInserts || {};
    this.additions = additions || [];
}
MergeResult.prototype.mergeResults = function(resultToMerge) {
    var result = new MergeResult();
    result.attrUpdates = _.assign(this.attrUpdates, resultToMerge.attrUpdates, _keyArrayMergeFunc);
    result.attrDeletes = _.assign(this.attrDeletes, resultToMerge.attrDeletes, _keyArrayMergeFunc);
    result.attrInserts = _.assign(this.attrInserts, resultToMerge.attrInserts, _keyArrayMergeFunc);
    result.additions = this.additions.concat(resultToMerge.additions);
    result.unprocessedEntities = this.unprocessedEntities.concat(resultToMerge.unprocessedEntities);

    return result;
};
MergeResult.prototype.getResults = function() {
    return _.pick(this, ['attrUpdates', 'attrInserts', 'attrDeletes', 'additions']);
};


function mergeGraphData (dataset, network, graphData, globalAttrOpts, localAttrOpts) {
    // there are 2 cases
    // graphData.dataset contains
    // 1) both network + dataset attrs
    // 2) only dataset attrs
    // so 3 merges are needed
    //
    // Also any new attrs are added to network.
    // The UI needs to provide the correct listing. globalAttrOpts are operations to take on Dataset, localAttrOpts are operations
    // to take on network.
    // localAttrOpts points tp attrs which exist in dataset and networks.
    // globalAttrOpts points to only dataset operations.

    // For this merge, we follow
    // 1) Merge GD.dataset with dataset.
    // 2) Merge GD.network with network. Add the new attrs whether the exist in graphData.dataset or graphData.network
    // 3) Merge GD.Dataset with network, if localAttrOpts contains references to data in GD.dataset

    var networkToMerge = graphData.networks[0];

    var datasetMergeResults = mergeDatasetWithDataset(dataset, graphData.dataset, sanitizeAttrOpts(dataset.attrDescriptors, globalAttrOpts));
    // also adds new nodes to the networks
    var networkNWMergeResults = mergeNetworkWithNetwork(network, networkToMerge, sanitizeAttrOpts(network.nodeAttrDescriptors,localAttrOpts));

    var networkDSMergeResults = mergeDatasetWithNetwork(network, graphData.dataset, sanitizeAttrOpts(dataset.attrDescriptors,localAttrOpts));

    var networkMergeResults = networkNWMergeResults.mergeResults(networkDSMergeResults);
    return {
        datasetMergeResults : datasetMergeResults,
        networkMergeResults : networkMergeResults
    };
}

function mergeDatasetWithDataset (dataset, datasetToMerge, attrOpts) {
    console.log("Merging dataset with dataset");
    console.time("mergeDatasetWithDataset");
    var logPrefix = "[DataMerge.mergeDatasetWithDataset] ";

    assert(dataset.datapoints.length > 0, "dataset should have datapoints");
    assert(datasetToMerge.datapoints.length > 0, "datasetToMerge should have datapoints");

    console.log(logPrefix + "Merge Stats");
    console.log(logPrefix + "Current : Num Datapoints: ", dataset.datapoints.length);
    console.log(logPrefix + "Current : Num Attrs: ", dataset.attrDescriptors.length);

    console.log(logPrefix + "New : Num Datapoints: ", datasetToMerge.datapoints.length);
    console.log(logPrefix + "New : Num Attrs: ", datasetToMerge.attrDescriptors.length);

    console.log(logPrefix + "Attrs Opts: ", attrOpts);

    var attrDescriptors = dataset.attrDescriptors;

    var finalAttrIds = finalAttrList(_.pluck(attrDescriptors, 'id'), attrOpts.toAdd, attrOpts.toRemove);
    console.log(logPrefix + "Final List of Attrs Ids: ", finalAttrIds);
    assert(finalAttrIds.length > 0, "atleast 1 attr should be present in the dataset node");
    // merge datapoints
    var mergeResults = mergeEntities(dataset.datapoints, datasetToMerge.datapoints, "id" ,"id", attrOpts, true);
    mergeResults.additions = [];

    _.each(mergeResults.unprocessedEntities, function(newDP) {
        var attr = {};
        _.each(newDP.attr, function(value, attrId) {
            if(finalAttrIds.indexOf(attrId) !== -1) {
                attr[attrId] = value;
            }
        });
        dataset.datapoints.push(new DSModel.DataPoint(newDP.id, attr));
        mergeResults.additions.push(newDP.id);
    });

    dataset.attrDescriptors = updateAttrDescriptors(attrDescriptors, datasetToMerge.attrDescriptors, attrOpts);

    //
    // Stats
    //
    console.log(logPrefix + "DataPoint Additions: ", _.size(mergeResults.additions));
    console.log(logPrefix + "DataPoint Attr Updates: ", _.size(mergeResults.attrUpdates));
    console.log(logPrefix + "DataPoint Attr Inserts: ", _.size(mergeResults.attrInserts));
    console.log(logPrefix + "DataPoint Attr Deletes: ", _.size(mergeResults.attrDeletes));
    console.log(logPrefix + "AttrDescr Ids: ", _.pluck(dataset.attrDescriptors, 'id').join(", "));

    console.timeEnd("mergeDatasetWithDataset");
    return mergeResults;
}

function mergeNetworkWithNetwork (network, networkToMerge, attrOpts) {
    console.log("Merging network with network");
    console.time("mergeNetworkWithNetwork");
    var logPrefix = "[DataMerge.mergeNetworkWithNetwork] ";

    assert(network.nodes.length > 0, "network should have nodes");
    assert(networkToMerge.nodes.length > 0, "networkToMerge should have nodes");

    console.log(logPrefix + "Merge Stats");
    console.log(logPrefix + "Current : Num Entities: ", network.nodes.length);
    console.log(logPrefix + "Current : Num EntityAttrs: ", network.nodeAttrDescriptors.length);

    console.log(logPrefix + "New : Num Entities: ", networkToMerge.nodes.length);
    console.log(logPrefix + "New : Num EntityAttrs: ", networkToMerge.nodeAttrDescriptors.length);

    console.log(logPrefix + "Attrs Opts: ", attrOpts);

    var attrDescriptors = network.nodeAttrDescriptors;

    var finalAttrIds = finalAttrList(_.pluck(attrDescriptors, 'id'), attrOpts.toAdd, attrOpts.toRemove);
    console.log(logPrefix + "Final List of Attrs Ids: ", finalAttrIds);
    assert(finalAttrIds.length > 0, "atleast 1 attr should be present in the network node");
    // merge nodes
    var mergeResults = mergeEntities(network.nodes, networkToMerge.nodes, "id" ,"id", attrOpts);
    mergeResults.additions = [];

    _.each(mergeResults.unprocessedEntities, function(newNode) {
        var attr = {};
        _.each(newNode.attr, function(value, attrId) {
            if(finalAttrIds.indexOf(attrId) !== -1) {
                attr[attrId] = value;
            }
        });
        network.nodes.push(new DSModel.Node(newNode.id, newNode.dataPointId, attr));
        mergeResults.additions.push(newNode.id);
    });

    network.nodeAttrDescriptors = updateAttrDescriptors(attrDescriptors, networkToMerge.nodeAttrDescriptors, attrOpts);

    //
    // Stats
    //
    console.log(logPrefix + "Node Additions: ", _.size(mergeResults.additions));
    console.log(logPrefix + "Node Attr Updates: ", _.size(mergeResults.attrUpdates));
    console.log(logPrefix + "Node Attr Inserts: ", _.size(mergeResults.attrInserts));
    console.log(logPrefix + "Node Attr Deletes: ", _.size(mergeResults.attrDeletes));
    console.log(logPrefix + "AttrDescr Ids: ", _.pluck(network.nodeAttrDescriptors, 'id').join(", "));

    console.timeEnd("mergeNetworkWithNetwork");
    return mergeResults;
}
function mergeDatasetWithNetwork (network, datasetToMerge, attrOpts) {
    console.log("Merging dataset with network");
    console.time("mergeDatasetWithNetwork");
    var logPrefix = "[DataMerge.mergeDatasetWithNetwork] ";

    assert(network.nodes.length > 0, "network should have nodes");
    assert(datasetToMerge.datapoints.length > 0, "datasetToMerge should have datapoints");

    console.log(logPrefix + "Merge Stats");
    console.log(logPrefix + "Current : Num Entities: ", network.nodes.length);
    console.log(logPrefix + "Current : Num EntityAttrs: ", network.nodeAttrDescriptors.length);

    console.log(logPrefix + "New : Num Entities: ", datasetToMerge.datapoints.length);
    console.log(logPrefix + "New : Num EntityAttrs: ", datasetToMerge.attrDescriptors.length);

    console.log(logPrefix + "Attrs Opts: ", attrOpts);

    var attrDescriptors = network.nodeAttrDescriptors;

    var finalAttrIds = finalAttrList(_.pluck(attrDescriptors, 'id'), attrOpts.toAdd, attrOpts.toRemove);
    console.log(logPrefix + "Final List of Attrs Ids: ", finalAttrIds);
    assert(finalAttrIds.length > 0, "atleast 1 attr should be present in the network node");
    // merge nodes
    var mergeResults = mergeEntities(network.nodes, datasetToMerge.datapoints, "dataPointId", "id", attrOpts);

    network.nodeAttrDescriptors = updateAttrDescriptors(attrDescriptors, datasetToMerge.attrDescriptors, attrOpts);

    //
    // Stats
    //
    console.log(logPrefix + "Node Additions: ", _.size(mergeResults.additions));
    console.log(logPrefix + "Node Attr Updates: ", _.size(mergeResults.attrUpdates));
    console.log(logPrefix + "Node Attr Inserts: ", _.size(mergeResults.attrInserts));
    console.log(logPrefix + "Node Attr Deletes: ", _.size(mergeResults.attrDeletes));
    console.log(logPrefix + "AttrDescr Ids: ", _.pluck(network.nodeAttrDescriptors, 'id').join(", "));

    console.timeEnd("mergeDatasetWithNetwork");
    return mergeResults;
}

///
/// Calculate final attrId list
///
function finalAttrList (finalAttrIds, attrIds_toAdd, attrIds_toRemove) {
    // add new ones
    _.each(attrIds_toAdd, function(attrId) {
        if(finalAttrIds.indexOf(attrId) ===  -1) finalAttrIds.push(attrId);
    });
    // remove
    finalAttrIds = _.filter(finalAttrIds, function(existingAttrId) {
        return attrIds_toRemove.indexOf(existingAttrId) === -1;
    });
    return finalAttrIds;
}

function sanitizeAttrOpts (attrDescriptors, attrOpts) {
    // make sure toUpdate / toRemove actually exist. if not, then remove those
    var attrIds = _.pluck(attrDescriptors,"id");
    var newAttrOpts = _.clone(attrOpts);
    attrOpts.toUpdate = _.intersection(attrOpts.toUpdate, attrIds);
    attrOpts.toRemove = _.intersection(attrOpts.toRemove, attrIds);
    return newAttrOpts;
}


function updateAttrDescriptors (attrDescriptors, newAttrDescriptors, attrOpts) {

    // remove
    attrDescriptors = _.filter(attrDescriptors, function(attr) {
        return attrOpts.toRemove.indexOf(attr.id) === -1;
    });
    // update
    _.each(attrDescriptors, function(attr) {
        if(attrOpts.toUpdate.indexOf(attr.id) > -1) {
            _.assign(attr, _.find(newAttrDescriptors, 'id', attr.id));
        }
    });
    // append
    var attrsToAppend = _.filter(newAttrDescriptors, function(attr) {
        return attrOpts.toAdd.indexOf(attr.id) !== -1;
    });
    attrDescriptors = _.reduce(attrsToAppend, function(acc, attr) {
        if(!_.some(acc, "id", attr.id)) {
            acc.push(attr);
        }
        return acc;
    }, attrDescriptors);
    return attrDescriptors;
}
// idKey2 -> Primary key of entitiesToMerge entities. is always "id"
// idKey1 -> the key which maps entities with entitiesToMerge. is "id" if both are nodes/ datapoints.
// Otherwise it is "dataPointId" if entities are nodes and entitiesToMerge are datapoints
function mergeEntities (entities, entitiesToMerge, idKey1, idKey2, attrOpts, isDatasetMerge) {
    var results = new MergeResult();
    var updatedEntitiesIdx = _.indexBy(entitiesToMerge, idKey2);

    _.each(entities, function(dp) {
        // remove attrs
        _.each(attrOpts.toRemove, function(attrId) {
            if(dp.attr[attrId] != null) {
                delete dp.attr[attrId];
                insertIntoKeyArray(results.attrDeletes, attrId, dp[idKey1]);
            }
        });
        /// add / update new attrs
        var newDP = updatedEntitiesIdx[dp[idKey1]];
        if(newDP) {
            // update existing attrs specified in the list
            _.each(attrOpts.toUpdate, function(attrId) {
                if(isDatasetMerge
                  ? !_valsEqual(dp.attr[attrId], newDP.attr[attrId])
                  : newDP.attr[attrId] != null && dp.attr[attrId] != null && !_valsEqual(dp.attr[attrId], newDP.attr[attrId])
                ) {
                    dp.attr[attrId] = newDP.attr[attrId];
                    insertIntoKeyArray(results.attrUpdates, attrId, dp[idKey1]);
                }
            });

            // add new attrs
            _.each(attrOpts.toAdd, function(attrId) {
                if(newDP.attr[attrId] != null && dp.attr[attrId] == null) { // should not exist in the base dataset
                    dp.attr[attrId] = newDP.attr[attrId];
                    insertIntoKeyArray(results.attrInserts, attrId, dp[idKey1]);
                }
            });
            delete updatedEntitiesIdx[dp[idKey1]];
        } else {
            console.log("Entity id " + dp[idKey1] + " not found in entities to merge map.");
        }
    });
    // Anything left in updatedEntitiesIdx are new entities which should be added
    results.unprocessedEntities = _.values(updatedEntitiesIdx);
    return results;
}

function _valsEqual(a, b) {
    var epsilon = 0.00001;
    var MIN_VALUE = 1.17549435E-38;
    var valType = typeof a;
    switch(valType) {
    case 'number':
        var absA = Math.abs(a);
        var absB = Math.abs(b);
        var diff = Math.abs(a - b);

        if (a == b) { // shortcut, handles infinities
            return true;
        } else if (a === 0 || b === 0 || diff < MIN_VALUE) {
            // a or b is zero or both are extremely close to it
            // relative error is less meaningful here
            return diff < (epsilon * MIN_VALUE);
        } else { // use relative error
            return diff / (absA + absB) < epsilon;
        }
    case "object" :
        if(_.isArray(a) && _.isArray(b)) {
            return isliststringEqual(a,b);
        } else {
            return a === b;
        }
    default:
        return a === b;
    }
}
// both length of arrays, and their intersections should be of same length
function isliststringEqual (a, b) {
    return a.length === b.length && _.intersection(a,b).length === a.length;
}

// Export out the class
module.exports = {
    // mergeDataset : MergeableDataset,
    mergeGraphData : mergeGraphData
};