"use strict";

var _       = require("lodash"),
    Promise = require("bluebird");

var DSModel = require("../datasys/datasys_model"),
    commonOpsListing = require("./commonOps_listing"),
    summaryGenerators = require("./ops_library/summary_generators");

// var logPrefix = "[commonOps_runner]";
var groupPrefix = "group_";

/**
 * Validate opInst object which is used to perform the operations on data
 * @param  {Object} opDesc operation description object
 * @param  {Object} opInst operation instance object
 * @return {Error | null}   returns error objects, null if everything went fine
 */
function validateOpInst(opDesc, opInst) {
    if(opDesc.opType !== opInst.opType) {
        return new Error(`opTypes are different. found: ${opInst.opType} , needed: ${opDesc.opType}`);
    }

    var opType = opInst.opType;

    if(opType === "general_op") {
        if(!opInst.srcAttrId) {
            return new Error(`general_op: srcAttrId not specified`);
        }
    } else {
        ///
        /// Validations for reduce and transform op
        if(opType === "reduce_op") {
            if(!opInst.destAttrId) {
                return new Error(`reduce_op: destAttrId not specified`);
            }
        }
        // opRow validations
        if(!_.isArray(opInst.opRows)) {
            return new Error(`${opType}: opRows not found.`);
        }
        if(opInst.opRows.length === 0) {
            return new Error(`${opType}: opRows is empty.`);
        }
        // for each individual op Row
        if(opType === "reduce_op") {
            if(_.compact(_.map(opInst.opRows, "srcAttrId")).length == 0) {
                return new Error(`${opType}: opRows specifications doesn't contain any source attrs!`);
            }
        } else {
            // transform op require both source and dest attrs
            if(_.compact(_.map(opInst.opRows, "srcAttrId")).length == 0) {
                return new Error(`${opType}: opRows specifications doesn't contain any source attrs!`);
            }
            var destAttrIds = _.compact(_.map(opInst.opRows, "destAttrId"));
            if(destAttrIds.length == 0) {
                return new Error(`${opType}: opRows specifications doesn't contain any dest attrs!`);
            }
            var attrCounts = _.reduce(destAttrIds, function (acc, attrId) {
                acc[attrId] = acc[attrId] ? acc[attrId] + 1 : 1;
                return acc;
            },{});
            if(_.keys(attrCounts).length !== destAttrIds.length) {
                var dup = [];
                _.forOwn(attrCounts, function (val, key) {
                    if(val > 1) dup.push(key);
                });
                return new Error(`${opType}: opRows destAttrIds contains duplicate attrs! Found duplicates: ${JSON.stringify(dup)}`);
            }
        }
    }
    ///
    /// Param validations
    ///
    if(opType === "transform_op") {
        // validate params existence
        if(opDesc.params && opDesc.params.length > 0) {
            var params = _.compact(_.map(opInst.opRows, "params"));
            if(params.length / opInst.opRows.length !==  opDesc.params.length) {
                return new Error(`${opType}: opRows specifications doesn't contain params which are needed by the op.
                    found : ${JSON.stringify(params)}, needed: ${JSON.stringify(opDesc.params)}`);
            }
        }
    } else {
        // validate params existence
        if(opDesc.params && opDesc.params.length > 0) {
            params = opInst.params;
            if(params.length !==  opDesc.params.length) {
                return new Error(`${opType}: op specifications doesn't contain params which are needed by the op.
                    found : ${JSON.stringify(params)}, needed: ${JSON.stringify(opDesc.params)}. length mismatch. got ${params.length}, needed: ${opDesc.params.length}`);
            }
        }
    }

    //
    // validate group attrs and summary attrs
    //
    if(opInst.isGroupingEnabled) {
        if(_.compact(_.map(opInst.groupRows, "groupAttrId")).length == 0) {
            return new Error(`${opType}: group specification doesn't contain any attrs!`);
        }
        // validate summary data
        if(opInst.isSummaryEnabled) {
            if(_.compact(_.map(opInst.summaryRows, "summaryAttrId")).length == 0) {
                return new Error(`${opType}: summary specifications doesn't contain any attrs!`);
            }
        }
    }
    return null;
}


/**
 * [runOp description]
 * @param  {[type]} opInst    [description]
 * @param  {[type]} datasetId [description]
 * @param  {[type]} networkId [description]
 * * @return {[dataset,network, trimProjectNetworks]}   returns a Promise of an array. trimProjNetworks is set true, then
 *                     rest of the networks belonging to this project must be trimmed
 */
function runOp(opInst, datasetId, networkId) {
    var opDesc = _.find(commonOpsListing.allOps(), "id", opInst.id);

    var validateErr = validateOpInst(opDesc, opInst);

    if(validateErr) {
        console.log("Invalid op Instance");
        throw validateErr;
    }

    var opFn = opDesc.opFn;
    if(!opFn) {
        throw new Error(`Op not available for id : ${opInst.id}`);
    }

    var loadLinks = opDesc.modifiesLinks;
    // no network found, can't load links
    if(loadLinks && (!networkId || networkId.length !== 24)) {
        loadLinks = false;
    }

    var allDone = DSModel.readDataset(datasetId, false)
        .then(function(dataset) {
            // check if all the sources are in dataset, if yes, then apply to the dataset
            var allFromDataset = areSourcesAvailable(opDesc, opInst, dataset.attrDescriptors);
            if(allFromDataset && !loadLinks) {
                var newDs = runOpOnDataset(opDesc, opInst, dataset);
                return DSModel.updateDataset(newDs, false).then(d => [d, null, false]);
            } else {
                // otherwise, read the network as well
                if(!networkId || networkId.length !== 24) {
                    return Promise.reject(new Error("Network Id not given for a source Attr in network"));
                }
                // load network and build a merge graph
                return DSModel.readNetwork(networkId, false, !opDesc.modifiesLinks)
                    .then(function (network) {
                        // set .links to empty array so that it doesn't break ops
                        if(!opDesc.modifiesLinks) {
                            network.links = [];
                            network.linksLoaded = false;
                        } else {
                            network.linksLoaded = true;
                        }
                        return network;
                    })
                    .then(network => runOpOnDatasetAndNetwork(opDesc, opInst, dataset, network))
                    .spread((d,n) => Promise.join(
                        DSModel.updateDataset(d, false),
                        DSModel.updateNetwork(n, false, !opDesc.modifiesLinks),
                        (d,n) => [d,n, opDesc.modifiesLinks]));
            }
        });
    return allDone;
}

function runOpOnDataset(opDesc, opInst, dataset) {
    console.log(`[runOpOnDataset] Running op: ${opInst.id} on dataset`);
    var opFn = opDesc.opFn;
    console.log(`[runOpOnDataset]Before opFn nDatapoints: `, dataset.datapoints.length);
    if(opInst.isGroupingEnabled) {
        // group nodes and process each group individually
        var groupIdx = groupData(opInst, dataset.datapoints, dataset.attrDescriptors);

        // run the op on each individual datapoints and combine the results
        var dpIdx = _.indexBy(dataset.datapoints, "id"),
            newAttrDesc = dataset.attrDescriptors;

        // generate summaries if required
        if(opInst.isSummaryEnabled) {
            var validationResults = validateSummaryRules(opInst, dataset.attrDescriptors);
            if(validationResults) {
                throw validationResults[0];
            }
            var computedAttrs = genSummaryAttrs(opInst, newAttrDesc);
            newAttrDesc = newAttrDesc.concat(computedAttrs);
            // embed computed on individual groups if needed
            _.forOwn(groupIdx, function(grpNodes, grpId) {
                console.log(`[runOpOnDataset] Summarizing data for group ${grpId}. numNodes: ${grpNodes.length}`);
                embedSummaryData(opInst, grpNodes, newAttrDesc);
            });
        }

        _.forOwn(groupIdx, function(grpNodes) {
            var res = opFn(opInst, grpNodes, newAttrDesc);
            _.each(res.nodes, function(dp) {
                _.extend(dpIdx[dp.id].attr, dp.attr);
            });
            newAttrDesc = res.nodeAttrs;
        });
        // remove computed Info from nodes and attrs
        var cleanedData = removeSummaryData(opInst, _.values(dpIdx), newAttrDesc);
        dataset.datapoints = cleanedData.nodes;
        dataset.attrDescriptors = cleanedData.nodeAttrs;
    } else {
        var results = opFn(opInst, dataset.datapoints, dataset.attrDescriptors);
        dataset.datapoints = results.nodes;
        dataset.attrDescriptors = results.nodeAttrs;
    }
    console.log(`[runOpOnDataset]After opFn nDatapoints: `, dataset.datapoints.length);
    return dataset;
}

/**
 * Run ops on merged dataset and network data.
 * @return {[Array]}  returns an array of [dataset, network]
 */
function runOpOnDatasetAndNetwork(opDesc, opInst, dataset, network) {
    var opFn = opDesc.opFn;
    // merge dataset and network before running the operation
    var results = mergeAndOperate(opDesc, dataset, network,
        function runOpOnMergedNetwork(mergedGraph) {

            var allSourcesAvailable = areSourcesAvailable(opDesc, opInst, mergedGraph.nodeAttrDescriptors);
            if(!allSourcesAvailable) {
                throw new Error("sources not found in data. can't proceed.");
            }

            if(opInst.isGroupingEnabled) {
                // group nodes and process each group individually
                var groupIdx = groupData(opInst, mergedGraph.nodes, mergedGraph.nodeAttrDescriptors);

                // run the op on each individual datapoints and combine the results
                var nwIdx = _.indexBy(mergedGraph.nodes, "id"),
                    newAttrDesc = mergedGraph.nodeAttrDescriptors;

                // generate summaries if required
                if(opInst.isSummaryEnabled) {
                    var validationResults = validateSummaryRules(opInst, mergedGraph.nodeAttrDescriptors);
                    if(validationResults) {
                        throw validationResults[0];
                    }
                    var computedAttrs = genSummaryAttrs(opInst, newAttrDesc);
                    newAttrDesc = newAttrDesc.concat(computedAttrs);
                    // embed computed on individual groups if needed
                    _.forOwn(groupIdx, function(grpNodes, grpId) {
                        console.log(`[runOpOnDatasetAndNetwork] Summarizing data for group ${grpId}. numNodes: ${grpNodes.length}`);
                        embedSummaryData(opInst, grpNodes, newAttrDesc);
                    });
                }

                _.forOwn(groupIdx, function(grpNodes, gIdx) {
                    var res = opFn(opInst, grpNodes, newAttrDesc, mergedGraph.links, mergedGraph.linkAttrDescriptors);
                    // console.log(`[Group opFn][${gIdx}] A node: `, res.nodes[0]);
                    _.each(res.nodes, function(node) {
                        _.extend(nwIdx[node.id].attr, node.attr);
                    });
                    newAttrDesc = res.nodeAttrs;
                });

                // remove computed Info from nodes and attrs
                var cleanedData = removeSummaryData(opInst, _.values(nwIdx), newAttrDesc);
                mergedGraph.nodes = cleanedData.nodes;
                mergedGraph.nodeAttrDescriptors = cleanedData.nodeAttrs;

                // TODO: Need to process links
                mergedGraph.links = mergedGraph.links;
                mergedGraph.linkAttrDescriptors = mergedGraph.linkAttrDescriptors;
            } else {
                var opResult = opFn(opInst, mergedGraph.nodes,
                    mergedGraph.nodeAttrDescriptors,
                    mergedGraph.links, mergedGraph.linkAttrDescriptors);

                mergedGraph.nodes = opResult.nodes;
                mergedGraph.links = opResult.links;
                mergedGraph.nodeAttrDescriptors = opResult.nodeAttrs;
                mergedGraph.linkAttrDescriptors = opResult.linkAttrs;
            }
            return mergedGraph;
        });

    var newDataset = results.dataset,
        newNetwork = results.network;
    return [newDataset, newNetwork];
}
/**
 * If datapoints have been removed, then trim the networks in the project so that they won't access deleted datapoints
 * @param  {[type]} dataset    [description]
 * @param  {[type]} networkIds [description]
 * @return {[type]}            [description]
 */
function trimNetworks(dataset, networkIds) {
    var dpIdx = _.indexBy(dataset.datapoints, "id");
    return Promise.map(networkIds, nwid => DSModel.readNetwork(nwid, false, false))
        .map(function (network) {
            var nodes = _.filter(network.nodes, node => !!dpIdx[node.dataPointId]);
            var nodeIdx = _.indexBy(nodes, "id");
            var links = _.filter(network.links, link => nodeIdx[link.source] && nodeIdx[link.target]);
            network.nodes = nodes;
            network.links = links;
            return DSModel.updateNetwork(network, false, false);
        }).then(nw => nw.id);
}
/**
 * finds out if all the sources are available.
 */
function areSourcesAvailable(opDesc, opInst, attrDescriptors) {
    var sourceIds = [], opType = opInst.opType;
    if(opType == "general_op") {
        sourceIds.push(opInst.srcAttrId);
    } else {
        sourceIds = _.map(opInst.opRows, "srcAttrId");
    }
    // other possible source Ids
    // params have type "attr-select" need to exist in the source
    if(opType === "general_op" || opType === "reduce_op") {
        _.each(opDesc.params, function(paramDesc, idx) {
            if(paramDesc.paramType === "attr-select") {
                var attrId = opInst.params[idx].value;
                sourceIds.push(attrId);
            }
        });
    } else {
        _.each(opDesc.params, function(paramDesc, idx) {
            if(paramDesc.paramType === "attr-select") {
                _.each(opInst.opRows, function(op) {
                    var attrId = op.params[idx].value;
                    sourceIds.push(attrId);
                });
            }
        });
    }
    // check group Attrs sources
    if(opInst.isGroupingEnabled) {
        var groupAttrs = _.compact(_.map(opInst.groupRows, "groupAttrId"));
        groupAttrs.forEach(attrId => sourceIds.push(attrId));

        // check summary attrs
        if(opInst.isSummaryEnabled) {
            _.compact(_.map(opInst.summaryRows, "summaryAttrId"))
                .forEach(attrId => sourceIds.push(attrId));

            // remove computed attr ids as sources. they will gen generated later on
            var computedAttrIds = genSummaryAttrs(opInst, attrDescriptors).map(attr => attr.id);
            console.log("[areSourcesAvailable] Computed Attrs: ", computedAttrIds);
            sourceIds = _.difference(sourceIds, computedAttrIds);
        }
    }
    console.log("[areSourcesAvailable] Looking for sources: ", sourceIds);
    var dsIdx = _.indexBy(attrDescriptors, "id");
    var isOnAll = _.every(sourceIds, srcId => !!dsIdx[srcId]);
    return isOnAll;
}

//
// helper to operate on combined data and unpack the results.
// New attributes are added to network
// Existing attributes are updated in both dataset and network
//
function mergeAndOperate (opDesc, dataset, network, fn) {
    // merge network node data and dataset datapoint data for now
    var dpIndex = _.indexBy(dataset.datapoints, "id");

    var mergedNetwork = _.clone(network);
    mergedNetwork.nodes = _.cloneDeep(network.nodes);
    mergedNetwork.nodeAttrDescriptors = _.cloneDeep(network.nodeAttrDescriptors);

    // copy over Datapoint attrs into network node
    _.each(mergedNetwork.nodes, function(node) {
        var dp = dpIndex[node.dataPointId];
        _.defaults(node.attr, dp.attr);
    });
    // update attr descriptions too
    var nwNodeAttrDescIndex = _.indexBy(mergedNetwork.nodeAttrDescriptors, "id");
    // mark these attrs as from Network
    mergedNetwork.nodeAttrDescriptors.forEach(attr => attr.fromNetwork = true);
    var mergedNodeAttrDescriptors = [];

    _.each(dataset.attrDescriptors, function(attrDesc) {
        // if the attribute exists in dataset and network, just copy over
        // the props from dataset
        var existingAttr = nwNodeAttrDescIndex[attrDesc.id];
        if(existingAttr) {
            _.extend(existingAttr, attrDesc);
        } else {
            var dsAttrCopy = _.cloneDeep(attrDesc);
            dsAttrCopy.fromDataset = true;
            mergedNodeAttrDescriptors.push(dsAttrCopy);
        }
    });

    // push network attrs to merged attrs
    mergedNodeAttrDescriptors = mergedNodeAttrDescriptors.concat(mergedNetwork.nodeAttrDescriptors);
    mergedNetwork.nodeAttrDescriptors = mergedNodeAttrDescriptors;
    mergedNetwork.networkId = network.id;
    mergedNetwork.datasetId = dataset.id;

    ///
    /// Run the function
    ///
    console.log(`[mergeAndOperate]Before opFn nNodes: `, mergedNetwork.nodes.length);
    console.log(`[mergeAndOperate]Before opFn nLinks: `, mergedNetwork.links.length);
    console.log(`[mergeAndOperate]Before opFn nNodeAttrs: `, mergedNetwork.nodeAttrDescriptors.length);
    console.log(`[mergeAndOperate]Before opFn nLinkAttrs: `, mergedNetwork.linkAttrDescriptors.length);
    var updatedNW = fn(mergedNetwork);
    console.log(`[mergeAndOperate]After opFn nNodes: `, mergedNetwork.nodes.length);
    console.log(`[mergeAndOperate]After opFn nLinks: `, mergedNetwork.links.length);
    console.log(`[mergeAndOperate]After opFn nNodeAttrs: `, mergedNetwork.nodeAttrDescriptors.length);
    console.log(`[mergeAndOperate]After opFn nLinkAttrs: `, mergedNetwork.linkAttrDescriptors.length);

    //
    // use merged network nodes to update dataset/network data
    // all new attributes are added to the dataset.
    // nodes are also deleted from dataset as well
    //

    // remove all attributes which are part of network
    var updateDSAttrs = _.reject(updatedNW.nodeAttrDescriptors, "fromNetwork");
    var dsAttrIds = _.map(updateDSAttrs, "id");

    // remove nw attr from nodes and get update datapoints
    var newDPs = _.map(updatedNW.nodes, function(node) {
        var newAttr = _.pick(node.attr, dsAttrIds);
        var dp = dpIndex[node.dataPointId];
        dp.attr = newAttr;
        return dp;
    });

    // get all attrs which are part of network
    var updatedNWAttrDesc = _.filter(updatedNW.nodeAttrDescriptors, "fromNetwork");
    var nwAttrIds = _.map(updatedNWAttrDesc, "id");

    // remove ds attr from nodes and get updated nodes
    var newNodes = _.map(updatedNW.nodes, function(node) {
        var newAttr = _.pick(node.attr, nwAttrIds);
        node.attr = newAttr;
        return node;
    });

    // replace datapoints with selected ones
    if(opDesc.removeAddDatapoints) {
        dataset.datapoints = newDPs;
    }
    dataset.attrDescriptors = updateDSAttrs;

    network.nodes = newNodes;
    network.links = updatedNW.links;
    network.nodeAttrDescriptors = updatedNWAttrDesc;
    network.linkAttrDescriptors = updatedNW.linkAttrDescriptors;
    // finally return the update dataset and network
    return {
        dataset,
        network
    };

}

// generate a map of grpId => nodes in groups
function groupData (opInst, nodes, nodeAttrs, links, linkAttrs) {
    if(!opInst.isGroupingEnabled) {
        return [{ nodes, links, nodeAttrs, linkAttrs}];
    } else {
        var groupAttrIds = _.compact(_.map(opInst.groupRows, "groupAttrId"));
        return _partitionGrps({ _nodes_ : nodes }, _.clone(groupAttrIds));
    }

    /// recursively group nodes
    function _partitionGrps (grpNodeIdx, groupAttrIds) {
        if(groupAttrIds.length === 0) return grpNodeIdx;
        var groupAttrId = groupAttrIds.shift();

        var newGrpMap = {};
        _.forOwn(grpNodeIdx, function(nodes, grpId) {
            var partition = _genGrouping(groupAttrId, nodes);
            _.forOwn(partition, function(grpNodes, newGrpId) {
                newGrpMap[grpId + "|" + newGrpId] = grpNodes;
            });
        });
        return _partitionGrps(newGrpMap, groupAttrIds);
    }

    // group nodes depending on groupAttrId
    function _genGrouping (groupAttrId, entities) {
        console.log(`[groupData._genGrouping()] starting grouping of: ${groupAttrId}]`);
        var rejectedNumNodes = 0;
        var grpIdx =  _(entities)
            .filter(node => {
                var res = node.attr[groupAttrId] != null;
                if(!res) {
                    ++rejectedNumNodes;
                    // console.log(`Filtered out node: ${node.id} with val: ${node.attr[groupAttrId]}`);
                }
                return res;
            }) // filter out all nodes which don't have any values
            .groupBy("attr." + groupAttrId).value();
        console.log(`[groupData._genGrouping()] finished grouping of: ${groupAttrId}]`);
        console.log(`[groupData._genGrouping()][${groupAttrId}] nGroups: ${_.keys(grpIdx).length}, nRejectedNodes : ${rejectedNumNodes}]`);
        return grpIdx;
    }
}

/**
 * > check if the attrs being summarized exist in dataset
 * > make sure none of the transient ComputedAttrs are in the dataset
 * @return {[type]}           [list of errors, or null if there are no errors]
 */
function validateSummaryRules (opInst, nodeAttrs) {
    if(!opInst.isGroupingEnabled || !opInst.isSummaryEnabled) {
        return null;
    } else {
        var isGenerationPossible = _.compact(_.map(opInst.summaryRows, validateSummaryRow));
        if(isGenerationPossible.length > 0) {
            console.error("[validateSummaryRules] Generation not possible: ", isGenerationPossible);
            return isGenerationPossible;
        } else return null;
    }

    /**
     * check if the attrs exist in dataset and
     * check if the computed attrs aren't in the dataset
     * @param  {[type]} summaryRow [description]
     * @return {null | Exception} Returns an exception if there is an error in summaryRow validation
     */
    function validateSummaryRow (summaryRow) {
        var attrId = summaryRow.summaryAttrId;

        var alreadyExists = _.some(nodeAttrs, attr => attr.id === attrId);
        if(!alreadyExists) {
            return new Error(`[validateSummaryRules] Attribute with id ${attrId} doesn't exist in data. can't summarize`);
        }
        // check if any of the transitent computed attrs aren't in the dataset
        var selGenerations = _.map(_.filter(summaryRow.generations, "isChecked"), "genName");
        // console.log("[Generation] generating: ", selGenerations);
        var errors = _.compact(_.map(selGenerations, function checkForExistance(genName) {
            var computedAttrId = genComputedAttrId(attrId, genName);
            var alreadyExists = _.some(nodeAttrs, attr => attr.id === computedAttrId);
            if(alreadyExists) {
                console.log("[validateSummaryRules] All attrs: ", _.map(nodeAttrs, "id"));
                return new Error(`[validateSummaryRules] Computed Attribute with id ${computedAttrId} already exist in data. can't overwrite it`);
            } else return null;
        }));
        if(errors.length > 0) {
            console.error(`[validateSummaryRules.validateSummaryRow] Generation not possible for summary Attr : ${attrId}`, errors);
            return errors[0];
        }
        // all good
        return null;
    }
}
/**
 * > generate computed Attrs for each summary Attr. Does no validations
 * @param  {[type]} opInst    [description]
 * @param  {[type]} nodeAttrs [description]
 * @return {[NodeAttrs]}      List of generated ComputedAttrs. otherwise an empty list
 */
function genSummaryAttrs (opInst, nodeAttrs) {

    if(!opInst.isGroupingEnabled || !opInst.isSummaryEnabled) {
        return [];
    } else {

        // generate summary info
        // summary info is a Map of computedAttrId -> attr
        // we combine all generated maps into a single large one
        var summaryAttrMap = _.assign.apply(_, _.map(opInst.summaryRows, genSummaryAttr));
        // console.log("[genSummaryAttrs] summaryAttrMap: ", summaryAttrMap);

        // write data
        var generatedAttrs = _.values(summaryAttrMap);
        // console.log("[genSummaryAttrs] generatedAttrs : ", _.map(generatedAttrs, "id"));
        return generatedAttrs;
    }
    /**
     * returns a map of computedAttrId -> attr
     * @param  {[type]} summaryRow [description]
     * @return {[type]}            [description]
     */
    function genSummaryAttr (summaryRow) {
        var attrId = summaryRow.summaryAttrId;
        var attr = _.find(nodeAttrs, attr => attr.id === attrId);
        if(!attr) {
            return {};
        }

        // attrTypeFn gets the type of the newely generated attribute
        var attrTypeFn = _.noop,
            // type of generation, how to summarize the attribute
            genType = "";
        if(summaryRow.isNumeric || isNumericAttr(attr)) {
            // numeric
            attrTypeFn = summaryGenerators.getAttrType_Numeric;
            genType = "numeric";
        } else if(attr.attrType === "liststring") {
            // tag
            attrTypeFn = summaryGenerators.getAttrType_Tag;
            genType = "tag";
        } else {
            // category / strings
            attrTypeFn = summaryGenerators.getAttrType_Cat;
            genType = "cat";
        }
        //
        var attrMap = {};
        var selGenerations = _.map(_.filter(summaryRow.generations, "isChecked"), "genName");
        _.forOwn(selGenerations, function(genName) {
            var attrType = attrTypeFn(genName);
            var computedAttr = genAttrDescriptor(attrId, attrType, genName, genType);
            attrMap[computedAttr.id] = computedAttr;
        });
        return attrMap;
    }

    function genAttrDescriptor (attrId, attrType, genName, genType) {
        var computedAttrId = genComputedAttrId(attrId, genName);
        var attr = new DSModel.AttrDescriptor(computedAttrId, computedAttrId, attrType);
        attr.isComputed = true;
        attr.summaryAttrId = attrId;
        attr.genType = genType;
        return attr;
    }
}

/**
 * generate summaries and write to every node.
 * @return {Array[Node]}    List of updated Nodes
 */
function embedSummaryData (opInst, nodes, nodeAttrs) {

    if(!opInst.isGroupingEnabled || !opInst.isSummaryEnabled) {
        return nodes;
    } else {
        var computedAttrs = _.filter(nodeAttrs, "isComputed");
        // console.log("[embedSummaryData] Computed Attr Ids: ", _.map(computedAttrs, "id"));
        // generate summary info
        // summary info is a Map of computedAttrId ->  summaryVal
        var summaryInfo = _.assign.apply(_, _.map(opInst.summaryRows, genSummary));
        // console.log("[embedSummaryData] summaryInfo : ", summaryInfo);

        // write data
        _.forOwn(summaryInfo, function(summaryVal, computedAttrId) {
            var attr = _.find(computedAttrs, attr => attr.id == computedAttrId);
            if(!attr) {
                throw new Error(`[genSummaryData] Summary Info attr with Id : ${computedAttrId} not generated. Fatal Logic Error`);
            }
            writeToData(computedAttrId, summaryVal);
        });
        return nodes;
    }

    /**
     * returns a map of computedAttrId -> summaryVal
     * @param  {[type]} summaryRow [description]
     * @return {[type]}            [description]
     */
    function genSummary (summaryRow) {
        var attrId = summaryRow.summaryAttrId;
        var attr = _.find(nodeAttrs, attr => attr.id === attrId);
        var generations = _.map(_.filter(summaryRow.generations, "isChecked"), "genName");

        if(!attr) {
            console.log(`[genSummary][${attrId}] given attrIds: `, _.map(nodeAttrs, "id"));
        }

        var summaryData = null;
        if(summaryRow.isNumeric || isNumericAttr(attr)) {
            // numeric
            summaryData = summaryGenerators.genNumericInfo(attr.id, nodes);
        } else if(attr.attrType === "liststring") {
            // tag
            summaryData = summaryGenerators.genTagInfo(attr.id, nodes);
        } else {
            // category / strings
            summaryData = summaryGenerators.genCatInfo(attr.id, nodes);
        }
        //
        var attrValMap = {};

        _.forOwn(summaryData, function(summaryVal, genName) {
            if(generations.indexOf(genName) > 0) {
                attrValMap[genComputedAttrId(attrId, genName)] = summaryVal;
            }
        });
        // console.log(`[genSummary] attrValMap for attr: ${attrId} : `, attrValMap);

        return attrValMap;
    }

    function writeToData (computedAttrId, summaryVal) {
        for(var i = 0, node = null; i < nodes.length; ++i) {
            node = nodes[i];
            node.attr[computedAttrId] = summaryVal;
        }
    }
}

function removeSummaryData (opInst, nodes, nodeAttrs) {
    if(!opInst.isGroupingEnabled || !opInst.isSummaryEnabled) {
        return {nodes, nodeAttrs};
    } else {
        var computedAttrs = _.filter(nodeAttrs, "isComputed");
        _.each(computedAttrs, function(attr) {
            removeComputedAttrId(attr.id);
        });

        var removedAttrs = _.reject(nodeAttrs, "isComputed");

        return {
            nodes : nodes,
            nodeAttrs : removedAttrs
        };
    }

    function removeComputedAttrId (attrId) {
        for(var i = 0, node = null; i < nodes.length; ++i) {
            node = nodes[i];
            delete node.attr[attrId];
        }
    }
}

// encodes schema of computed attr name
function genComputedAttrId (attrId, genName) {
    var computedAttrId = groupPrefix + "_" + attrId + "_" + genName;
    return computedAttrId;
}

function isNumericAttr (attr) {
    return attr.attrType === 'integer' ||
            attr.attrType === 'float' ||
            attr.attrType === 'timestamp' ||
            attr.attrType === 'year';
}

var api = {
    runOp,
    trimNetworks,
    forTesting : {
        validateOpInst,
        runOpOnDataset,
        runOpOnDatasetAndNetwork,
        mergeAndOperate,
        areSourcesAvailable,
        groupData
    }
};
module.exports = api;
