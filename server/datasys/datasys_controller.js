'use strict';
/***
 * functions for project/:pid/datatset and /network code
 */

var _            = require('lodash');
var Promise      = require("bluebird"),
    streamifier      = require("streamifier"),
    moment           = require('moment');

var dataUtils        = require("../utils/dataUtils.js"),
    DSModel              = require("./datasys_model"),
    ProjModel            = require("../project/proj_model"),
    userModel            = require('../user/user_model'),
    orgModel             = require('../org/org_model'),
    NetworkDataCache     = require("../services/NetworkDataCache.js"),
    AttrModifierAPI      = require("../services/AttrModifierAPI.js"),

    DataSetAPI           = require('../services/DataSetAPI');

function saveDataToProject(req, res) {
    var logPrefix = "[DSModelController.saveDataToProject] ";
    var p = req.body;
    var user = req.user, org = req.org, proj = req.project;
    console.log(logPrefix + 'Reading network cache: ', p.fileId);
    // load data from cache
    var graphDataP = NetworkDataCache.getNetworkDataFromCache(p.fileId);
    graphDataP.tap (function(graphData) {
        console.log(logPrefix + "Build Graph");

        // Update Project Name. Its fulfillment not necessary for saveData request.
        if(graphData.dataset.sourceInfo && graphData.dataset.sourceInfo.sourceURL) {
            var projName = graphData.dataset.sourceInfo.sourceURL;
            var i = projName.lastIndexOf('.');
            if (i != -1) {
                projName = projName.substr(0, i);
            }
            console.log('Updating project name to : ' + projName);
            proj.projName = projName;
            proj.save()
                .then( () => userModel.updateProjNameAsync(user, proj.id, projName) )
                .then( ()     => orgModel.updateProjNameAsync(org, proj.id, projName))
                .catch( (err) => console.warn("[projectUpdateErr]: Unable to update user or org: ", err))
                .finally( ()  => console.log(logPrefix + 'project name updated'))
                .thenReturn(graphData);
        } else {
            console.warn(logPrefix + "Project Name updated. sourceInfo: ", graphData.dataset.sourceInfo);
        }
    });

    //save Dataset
    var datasetP = graphDataP.get('dataset').then(function(dataset) {
        // filter columns if necessary
        var selectedAttrIds = _.map(p.attrDescriptors.dsAttrs, 'id');
        dataset.attrDescriptors = DataSetAPI.filterAttrs(dataset.datapoints, dataset.attrDescriptors, selectedAttrIds);
        updateAttrDescr(dataset.attrDescriptors, p.attrDescriptors.dsAttrs, dataset.datapoints);

        // Assign title to id incase title got renamed during ingestion
        DataSetAPI.equateAttrIdAndTitle(dataset.attrDescriptors, dataset.datapoints);
        return dataset;
    })
    .then(function(dataset)  { return DSModel.createDataset(req.project.id, "dataset", dataset.datapoints, dataset.attrDescriptors, dataset.sourceInfo, true); })
    .then(function(ds)       { return DSModel.saveDataset(ds, false); })
    .then(function(ds)       { return ProjModel.updateDatasetAsync(req.project, ds).thenReturn(ds); })
    .tap(function(dataset)   { console.log(logPrefix + "Saved dataset :", dataset.id); });


    var graphDatasetP = Promise.join(graphDataP, datasetP);

    var onNetworksSave = graphDatasetP
        .spread(function(graphData, ds) {
            if(!_.isEmpty(graphData.networks) && !_.isEmpty(_.get(graphData.networks[0], 'links'))) {
                // networks uploaded, use them
                console.log("NETWORK COUNT : ", graphData.networks.length);
                // Modify 1st network's attrs
                var network = graphData.networks[0];
                if(_.isObject(network)) {
                    var selectedNwNodeAttrIds = _.map(p.attrDescriptors.nwNodeAttrs, 'id');
                    network.nodeAttrDescriptors = DataSetAPI.filterAttrs(network.nodes, network.nodeAttrDescriptors, selectedNwNodeAttrIds);
                    updateAttrDescr(network.nodeAttrDescriptors, p.attrDescriptors.nwNodeAttrs, network.nodes);
                    updateAttrDescr(network.linkAttrDescriptors, p.attrDescriptors.nwLinkAttrs, network.links);

                    // Assign title to id incase title got renamed during ingestion
                    DataSetAPI.equateAttrIdAndTitle(network.nodeAttrDescriptors, network.nodes);
                }
                return _.map(graphData.networks, function(networkData) {
                    return DSModel.createNetwork(ds, networkData);
                });
            }
            else {
                console.log('Network not uploaded or has no links');
                return Promise.reject('no network');
            }
            // else {
            //  network not found, create default network
            //  console.log("CREATING DEFAULT");
            //  return [DSModel.createNewNetwork_fromDataset(ds, graphData.defaultData)];
            // }
        })
        .map(function(network) {
            return DSModel.saveNetwork(network, false, false);
        })
        .then(function(networks) {
            return ProjModel.addNetworksAsync(req.project, networks).thenReturn(networks);
        }).catch(function(err) {
            console.log(err);
            if(err == 'no network') {
                return Promise.resolve([]);
            }
        });

    Promise.join(datasetP, onNetworksSave, function(ds, networks) {
        console.log("PROJECT NETWS COUNT -- ", req.project.networks.length);
        res.status(200).json({
            datasetId : ds.id,
            networkId : _.isObject(networks[0]) ? networks[0].id: null,
            updatedProjName: req.project.projName
        });
    })
    .catch(function(err) {
        err = err.stack || err;
        console.error(logPrefix + "Error in Importing. ", err);
        res.status(500).send(err);
    });
}

function getDataset(req, res) {
    var logPrefix = "[DSModelController.getDataset] ";
    if(req.project.dataset && req.project.dataset.ref) {
        console.log(logPrefix + 'reading data for datasetId: ', req.project.dataset.ref);
        //TODO: skip building a JSON object and stream the stringified data directly
        var dataFetched = DSModel.readDataset(req.project.dataset.ref, false);
        dataFetched
            .then(function(dataset) {
                console.log(logPrefix + "Found ds with %s datapoints", dataset.datapoints.length);
                if(req.acceptsEncodings("gzip")) {
                    console.log(logPrefix + "Sending across zipped data");
                    var zlib = require('zlib');
                    var gzip = zlib.createGzip();
                    //zlib.gzip(dataset, function(err, ) {};)
                    res.set('Content-Encoding', 'gzip');
                    streamifier.createReadStream(JSON.stringify(dataset)).pipe(gzip).pipe(res);
                } else {
                    console.log(logPrefix + "Sending across plain data");
                    streamifier.createReadStream(JSON.stringify(dataset)).pipe(res);
                }
            }).catch(function(errr) {
                var err = errr.stack || errr;
                console.error(logPrefix + "Error in fetching. ", err);
                res.status(500).send(err);
            });
    } else {
        res.status(404).send('dataset not found');
    }
}
function getAllNetworks(req, res) {
    if(req.project.networks && req.project.networks.length > 0) {
        console.log("PROJECT NETWS COUNT -- ", req.project.networks.length);
        var networksP = Promise.all(_.map(req.project.networks, function(networkObj) {
            return DSModel.readNetwork(networkObj.ref, false, false);
        }));
        networksP
            .map(function(nw) {
                if(nw.networkInfo.properlyParsed && !_shouldSanitizeClusterInfo(nw)) {
                    console.log("[getAllNetworks] Network pure, returning as it is");
                    return nw;
                }

                if(!nw.networkInfo.properlyParsed) {
                    console.log("[getAllNetworks]network is impure, sanitizing it");
                    nw = dataUtils.sanitizeNetwork(nw);
                }
                if(_shouldSanitizeClusterInfo(nw)) {
                    console.log("[getAllNetworks] sanitizing cluster info");
                    nw = dataUtils.sanitizeClusterInfo(nw);
                }
                return DSModel.updateNetwork(nw);
            })
            .then(function(networks) {
                var obj = { networks : networks };
                if(req.acceptsEncodings("gzip")) {
                    var zlib = require('zlib');
                    var gzip = zlib.createGzip();
                    res.set('Content-Encoding', 'gzip');
                    streamifier.createReadStream(JSON.stringify(obj)).pipe(gzip).pipe(res);
                } else {
                    streamifier.createReadStream(JSON.stringify(obj)).pipe(res);
                }
            }).catch(function(errr) {
                var err = errr.stack || errr;
                console.error("[getAllNetworks] Error in fetching. ", err);
                res.status(500).send(err);
            });
    } else {
        res.json(200).json({networks : []});
    }
}

function getNetwork(req, res) {
    var networkId = req.params.nwid;
    if(networkId && _.any(req.project.networks, 'ref', networkId)) {
        var networkP = DSModel.readNetwork(networkId, false, false);
        networkP
            .then(function(nw) {
                if(!nw.networkInfo.properlyParsed) {
                    console.log("[getNetwork]network is impure, sanitizing it");
                    nw = dataUtils.sanitizeNetwork(nw);
                    return DSModel.updateNetwork(nw);
                } else {
                    console.log("[getNetwork] Network pure, returning as it is");
                    return nw;
                }
            })
            .then(function(network) {
                if(req.acceptsEncodings("gzip")) {
                    var zlib = require('zlib');
                    var gzip = zlib.createGzip();
                    res.set('Content-Encoding', 'gzip');
                    streamifier.createReadStream(JSON.stringify(network)).pipe(gzip).pipe(res);
                } else {
                    streamifier.createReadStream(JSON.stringify(network)).pipe(res);
                }
            }).catch(function(errr) {
                var err = errr.stack || errr;
                console.error("[getNetwork] Error in fetching. ", errr);
                res.status(500).send(err);
            });
    } else {
        res.status(404).send("Network with id:" + networkId + " not found in the project");
    }
}

// Updates dataset attrs
// @obj.attrSequenceChanged    Boolean
// @obj.orderedAttrIds         Array
// @obj.changedAttrDescriptors Array
function updateDatasetAttrs(req, res) {
    if(!_.get(req, "project.dataset.ref")) {
        return res.status(400).send("No dataset associated with this project");
    }
    console.log(`[DSModelController.updateDatasetAttrs] Updating attrs for dataset: ${req.project.dataset.ref}`);
    DSModel.readDataset(req.project.dataset.ref, true)
    .then(function(dataset) {
        var changedAttrDescriptors = req.body.changedAttrDescriptors;
        var orderedAttrIds = req.body.orderedAttrIds,
            removedAttrIds = req.body.removedAttrIds;

        var opResults = applyAttrOps(dataset, "attrDescriptors", "datapoints", DSModel.loadDatapoints.bind(DSModel),
            req.body.attrSequenceChanged, orderedAttrIds, changedAttrDescriptors, removedAttrIds);
        return [dataset, opResults];
    })
    .spread(function (dataset, opResults) {
        var skipDatapoints = true;
        if(opResults.attrModified || opResults.attrRemoved) {
            skipDatapoints = false;
        }
        return DSModel.updateDataset(dataset, skipDatapoints);
    })
    .then(function() {
        console.log('[DSModelController.updateDatasetAttrs] Dataset Attr Descriptors updated');
        res.status(200).send({attrDescriptorsUpdated: true});
    })
    .catch(function(errr) {
        var err = errr.stack || errr;
        console.error("[DSModelController.updateDatasetAttrs] Error in updating attr sequence. ", errr);
        res.status(500).send(err);
    });
}

function updateNetwork(req, res) {
    var fields_to_update = ['name', 'description', 'networkInfo'];

    var networkId = req.params.nwid;
    var opts = _.pick(req.body, fields_to_update);

    if(!networkId || !_.any(req.project.networks, 'ref', networkId)) {
        return res.status(400).send("Network with id:" + networkId + " not found in the project");
    }

    var networkP = DSModel.readNetwork(networkId, true, true);
    var oldNetworkName;

    networkP
        .then(function(network) {
            oldNetworkName = network.name;

            _.each(fields_to_update, function(field) {
                network[field] = opts[field] != null ?  opts[field] : network[field];
            });
            return network;
        })
        .then(function(network) {
            return DSModel.saveNetwork(network, true, true);
        })
        .then(function(network) {
            var updatedValues = _.pick(network, fields_to_update);
            var updatedNWSnapsMap = {};

            // If network name changed, update snapshots names & descriptions
            if(network.name != oldNetworkName) {
                var networkSnaps = _.filter(req.project.snapshots, 'networkId', network.id);
                if(networkSnaps.length > 0) {
                    var oldNameRegex = new RegExp(oldNetworkName);
                    _.each(networkSnaps, function(snap) {
                        snap.snapName = snap.snapName.replace(oldNameRegex, network.name);
                        snap.descr = snap.descr.replace(oldNameRegex, network.name);
                        updatedNWSnapsMap[snap.id] = {
                            name: snap.snapName,
                            descr: snap.descr
                        };
                    });

                    req.project.save(function(err){
                        if(err) {
                            console.log('[DSModelController.updateNetwwork] Snapshot names were not updated in project');
                            console.log(err);
                        }
                    });
                }
            }

            res.status(200).send({
                updatedValues: updatedValues,
                updatedNWSnapsMap: updatedNWSnapsMap
            });
        })
        .catch(function(errr) {
            var err = errr.stack || errr;
            console.error("[DSModelController.getNetwork] Error in updating network. ", errr);
            res.status(500).send(err);
        });

}

function updateNetworkAttrs(req, res) {
    var networkId = req.params.nwid;
    if(!networkId || !_.any(req.project.networks, 'ref', networkId)) {
        res.status(400).send('Cant find network with id:' + networkId);
    }
    var networkP = DSModel.readNetwork(networkId, true, true);

    networkP.then(function(network) {
        var changedAttrDescriptors = req.body.changedNodeAttrDescriptors;
        var orderedAttrIds = req.body.orderedNodeAttrIds,
            removedAttrIds = req.body.removedNodeAttrIds;

        var nodeOpResults = applyAttrOps(network, "nodeAttrDescriptors", "nodes", DSModel.loadNodes.bind(DSModel),
            req.body.nodeAttrSequenceChanged, orderedAttrIds, changedAttrDescriptors, removedAttrIds);

        return [network, nodeOpResults];
    }).spread(function(network, nodeOpResults) {
        var changedAttrDescriptors = req.body.changedLinkAttrDescriptors;
        var orderedAttrIds = req.body.orderedLinkAttrIds,
            removedAttrIds = req.body.removedLinkAttrIds;

        var linkOpResults = applyAttrOps(network, "linkAttrDescriptors", "links", DSModel.loadLinks.bind(DSModel),
            req.body.linkAttrSequenceChanged, orderedAttrIds, changedAttrDescriptors, removedAttrIds);

        return [network, nodeOpResults, linkOpResults];
    })
    .spread(function (network, nodeOpResults, linkOpResults) {
        console.log(`[DSModelController.updateNetworkAttrs] nodeOpResults : `, nodeOpResults);
        console.log(`[DSModelController.updateNetworkAttrs] linkOpResults : `, linkOpResults);

        var skipNodes = true, skipLinks = true;
        if(nodeOpResults.attrModified || nodeOpResults.attrRemoved) {
            skipNodes = false;
        }
        if(linkOpResults.attrModified || linkOpResults.attrRemoved) {
            skipLinks = false;
        }
        console.log(`[DSModelController.updateNetworkAttrs] Network Attrs updated. Saving to grid. skipNodes: ${skipNodes}. skipLinks: ${skipLinks}`);
        return DSModel.saveNetwork(network, skipNodes, skipLinks);
    })
    .then(function() {
        res.status(200).send({networkAttrsUpdated: true});
        console.log('[DSModelController.updateNetworkAttrs] Network saved');
    })
    .catch(function(errr) {
        var err = errr.stack || errr;
        console.error("[DSModelController.updateNetworkAttrs] Error in updating network attrs. ", errr);
        res.status(500).send(err);
    });
}

function downloadNetworksData(req, res) {
    var logPrefix = "[DSModelController.downloadNetworksData] ";
    var p = req.body;
    var dataFilters = {
        nodesFilter: function(n) {return n;},
        linksFilter: function(n) {return n;}
    };
    if(p.selectionData) {
        dataFilters.nodesFilter = function(entities) {
            return _.filter(entities, function(entity) {
                return p.selectionData.nodeIds.indexOf(entity.id) > -1;
            });
        };
        dataFilters.linksFilter = function(entities) {
            return _.filter(entities, function(entity) {
                return p.selectionData.linkIds.indexOf(entity.id) > -1;
            });
        };
    }
    if(req.project.dataset && req.project.dataset.ref) {
        var downloadFormat = p.downloadFormat || 'xlsx';
        console.log(logPrefix + 'reading data for datasetId: ', req.project.dataset.ref);
        var datasetP = DSModel.readDataset(req.project.dataset.ref, false);

        var networksP = Promise.resolve(null);
        if(_.isArray(p.networkIds) && p.networkIds.length > 0) {
            if(req.project.networks && req.project.networks.length > 0) {
                var networksToDownload = _.filter(req.project.networks, function(network) {
                    return p.networkIds.indexOf(network.ref) > -1;
                });
                networksP = Promise.all(_.map(networksToDownload, function(networkObj) {
                    return DSModel.readNetwork(networkObj.ref, false, false);
                }));
            }
        }

        var dataFetchedP = Promise.join(datasetP, networksP);

        dataFetchedP.then(function(dataArr) {
            // console.log(dataArr);
            var dataset = dataArr[0] || null;
            var networks = dataArr[1] || null;
            var fileGenerator = _.noop();
            switch(downloadFormat.toLowerCase()) {
            case 'xlsx':
            case 'Xls':
                fileGenerator = dataUtils.generateNetworksXLSX;
                break;
            case 'json':
                fileGenerator = dataUtils.generateJSONFromGraph;
                break;
            default:
                fileGenerator = dataUtils.generateNetworksXLSX;
            }

            //create xlsx file
            fileGenerator(dataset, networks, dataFilters, p.fileNamePrefix, function(fileData) {
                res.set('MP-Response-Length', fileData.length);
                res.status(200).send(fileData);
            });
        }).catch(function(errr) {
            var err = errr.stack || errr;
            console.error("[DSModelController.downloadNetworksData] Error in fetching. ", err);
            res.status(500).send(err);
        });
    } else {
        res.status(500).send('dataset not found');
    }
}

function bakeGroups (req, res) {
    // bakes the groups store in project Settings into the datagraph.
    var MAPPR_GRP_ATTR = "mappr_groups";
    if(!_.get(req,"project.dataset.ref")) {
        return res.status(400).send("No dataset associated in the project");
    }

    var groups = _.get(req, 'project.settings.selectionData.selections', []);
    if(groups.length === 0) {
        console.warn("[DSModelController.bakeGroups] No groups in the project. Cleaning all groups from the node");
    }
    // groups is an array of { selName , dpIDs} objects
    // build a nodeId -> tags map
    var nodeGrpMap = _.reduce(groups, function(acc, selObj) {
        _.map(selObj.dpIDs, function(dpId) {
            if(!acc[dpId]) {
                acc[dpId] = [];
            }
            acc[dpId].push(selObj.selName);
        });
        return acc;
    }, {});
    // console.log("[bakeGroups] nodeGrpMap: ", nodeGrpMap);

    // update tags on datapoints
    DSModel.readDataset(req.project.dataset.ref, false)
        .then(function(dataset) {
            // create attribute if necessary
            if(!_.some(dataset.attrDescriptors, "id", MAPPR_GRP_ATTR)) {
                dataset.attrDescriptors.push(new DSModel.AttrDescriptor(MAPPR_GRP_ATTR, MAPPR_GRP_ATTR, "liststring"));
            }
            _.each(dataset.datapoints, function(dp) {
                var tagVal = nodeGrpMap[dp.id];
                dp.attr[MAPPR_GRP_ATTR] = tagVal ? tagVal : ["others"];
            });
            return DSModel.saveDataset(dataset, false);
        })
        .then(function() {
            res.status(200).json({
                result : "Groups baked successfully.",
                nodeGrpMap
            });
            console.log("[DSModelController.bakeGroups] Dataset saved");
        })
        .catch(function(errr) {
            var err = errr.stack || errr;
            console.error("[DSModelController.bakeGroups] Error in baking groups. ", errr);
            res.status(400).send(err);
        });
}

function createNetworkFromSubGraph(req, res) {
    var logPrefix = "[DSModelController.createNetworkFromSubGraph] ";
    var nodeIds = req.body.nodeIds,
        linkIds = req.body.linkIds,
        nodeColorMap = req.body.nodeColorMap,
        networkName = req.body.networkName,
        parentNwId = req.params.nwid;

    if(!nodeIds || nodeIds.length === 0) {
        res.status(400).send("No nodes found in the request");
        return;
    }
    if(!parentNwId) {
        res.status(400).send("No parentNetwork specified in the request");
        return;
    }
    if(!networkName) {
        res.status(400).send("No networkName specified in the request");
        return;
    }
    if(!nodeColorMap) {
        res.status(400).send("No nodeColorMap specified in the request");
        return;
    }


    DSModel.readNetwork(parentNwId, false, false)
    .then(function() {
        return DSModel.genSubNetwork(parentNwId, nodeIds, linkIds, nodeColorMap, networkName);
    })
    .then(function(network) {
        return ProjModel.addNetworkAsync(req.project, network).thenReturn(network);
    })
    .then(function(network) {
        console.log(logPrefix + "Sub network created successfully");
        res.status(200).json({
            networkId : network.id
        });
    })
    .catch(function(errr) {
        var err = errr.stack || errr;
        console.error("[createNetworkFromSubGraph] Error: ", err);
        res.status(500).send(err);
    });
}

function updateAttrCategoriesForDataset(req, res) {
    var logPrefix = "[DSModelController.updateAttrCategoriesForDataset] ";
    var attrId = req.body.attrId,
        updationMap = req.body.updationMap;
    if(!updationMap || _.size(updationMap) === 0) {
        res.status(400).send("No updationMap found in the request");
        return;
    }
    if(!attrId) {
        res.status(400).send("No attrId specified in the request");
        return;
    }
    if(req.project.dataset && req.project.dataset.ref) {
        DSModel.readDataset(req.project.dataset.ref, false)
        .then(function(dataset) {
            _updateAttrCategories(dataset.datapoints, attrId, updationMap);
            console.log(logPrefix + 'Dataset Attr Category Names updated');
            return DSModel.updateDataset(dataset, false);
        })
        .then(function(dataset) {
            console.log(logPrefix + "Datapoints cat values updated");
            res.status(200).send({
                dataset : dataset.id
            });
        })
        .catch(function(errr) {
            var err = errr.stack || errr;
            console.error(logPrefix + " Error:\n" + err);
            res.status(500).send(err);
        });
    }
}

function updateAttrCategoriesForNetworkNodes(req, res) {
    var logPrefix = "[DSModelController.updateAttrCategoriesForNetworkNodes] ";
    var attrId = req.body.attrId,
        networkId = req.body.networkId,
        updationMap = req.body.updationMap;
    if(!updationMap || _.size(updationMap) === 0) {
        res.status(400).send("No updationMap found in the request");
        return;
    }
    if(!attrId) {
        res.status(400).send("No attrId specified in the request");
        return;
    }
    if(!networkId) {
        res.status(400).send("No network specified in the request");
        return;
    }
    if(networkId && _.any(req.project.networks, 'ref', networkId)) {
        DSModel.readNetwork(networkId, false, false)
        .then(function(network) {
            var cluster = _.get(network, 'clusterInfo[0].clusters');
            if(_.isEmpty(cluster)) throw new Error('Network does not have cluster Info');
            //update clusterInfo for clusterName. Required for associating bridgers and archetypes
            for (var i = 0; i < cluster.length; i++) {
                if(updationMap[cluster[i].linkingAttrName]){
                    cluster[i].linkingAttrName = updationMap[cluster[i].linkingAttrName];
                }
            }
            _updateAttrCategories(network.nodes, attrId, updationMap);
            console.log(logPrefix + 'Network nodes Attr Category Names updated');
            return DSModel.updateNetwork(network, false, false);
        })
        .then(function(network) {
            console.log(logPrefix + "network cat values updated");
            res.status(200).send({
                network : network.id
            });
        })
        .catch(function(errr) {
            var err = errr.stack || errr;
            console.error(logPrefix + " Error:\n" + err);
            res.status(500).send(err);
        });
    }
}

function addAttributeToDataset(req, res) {
    var srcAttrId = req.body.srcAttrId,
        newAttrName = req.body.newAttrName,
        newAttrType = req.body.newAttrType,
        fnScript = req.body.fnScript;

    var logPrefix = "[DSModelController.addAttributeToDataset] ";

    if(!srcAttrId) {
        res.status(400).send("srcAttrId not found in request");
        return;
    }
    if(!newAttrName) {
        res.status(400).send("newAttrName not found in request");
        return;
    }
    if(!newAttrType) {
        res.status(400).send("newAttrType not found in request");
        return;
    }
    if(!fnScript) {
        res.status(400).send("fnScript not found in request");
        return;
    }

    if(req.project.dataset && req.project.dataset.ref) {
        DSModel.readDataset(req.project.dataset.ref, false)
        .then(function(dataset) {
            var newFn = new Function("_", "moment", "x", fnScript);
            _.each(dataset.datapoints, function(dp) {
                if(dp.attr[srcAttrId] != null) {
                    var newVal = newFn(_, moment, dp.attr[srcAttrId]);
                    dp.attr[newAttrName] = newVal;
                }
            });
            console.log(logPrefix,"Function successfully evaluted!");
            dataset.attrDescriptors.push(new DSModel.AttrDescriptor(newAttrName, newAttrName, newAttrType));
            return DSModel.updateDataset(dataset, false);
        })
        .then(function(dataset) {
            console.log(logPrefix + "Attribute generated");
            res.status(200).send({
                dataset : dataset.id
            });
        })
        .catch(function(errr) {
            var err = errr.stack || errr;
            console.error(logPrefix + " Error:\n" + err);
            res.status(500).send(err);
        });
    } else {
        res.status(500).send("No Dataset found on the project!");
    }
}

function addAttributeToNetwork(req, res) {
    var
        newAttrName = req.body.newAttrName,
        newAttrType = req.body.newAttrType,
        valMapping = req.body.newValMapping,
        nwid = req.params.nwid;

    var logPrefix = "[DSModelController.addAttributeToDataset] ";

    if(!newAttrName) {
        res.status(400).send("newAttrName not found in request");
        return;
    }
    if(!newAttrType) {
        res.status(400).send("newAttrType not found in request");
        return;
    }
    if(!valMapping) {
        res.status(400).send("valMapping not found in request");
        return;
    }

    DSModel.readNetwork(nwid, false, false)
    .then(function(network) {
        var nodeIdx = _.mapValues(_.indexBy(valMapping, _.head), _.last);
        _.each(network.nodes, function(node) {
            node.attr[newAttrName] = nodeIdx[node.id];
        });
        console.log(logPrefix,"Function successfully evaluted!");
        network.nodeAttrDescriptors.push(new DSModel.AttrDescriptor(newAttrName, newAttrName, newAttrType));
        return DSModel.updateNetwork(network, false, false);
    })
    .then(function(network) {
        console.log(logPrefix + "Attribute generated");
        res.status(200).send({
            network : network.id
        });
    })
    .catch(function(errr) {
        var err = errr.stack || errr;
        console.error(logPrefix + " Error:\n" + err);
        res.status(500).send(err);
    });
}

function changeAttrsScope(req, res) {
    // var logPrefix = '[DSModelController.changeAttrsScope] ';
    var p = req.body;
    var newScope = p.newScope;
    var dsAttrIds = p.dsAttrIds;
    var nwAttrIds = p.nwAttrIds;
    var currNwId = p.currentNetworkId;

    if(!newScope) {
        res.status(400).send("new scope not found in request!");
        return;
    }

    if(!currNwId) {
        res.status(400).send("network id not found in request!");
        return;
    }
    if(req.project.dataset &&
        req.project.dataset.ref &&
        _.isArray(req.project.networks) &&
        req.project.networks.length > 0) {
        var DsP = DSModel.readDataset(req.project.dataset.ref, false);
        var NwP = Promise.map(req.project.networks, networkObj => DSModel.readNetwork(networkObj.ref, false, false));

        Promise.join(DsP, NwP)
        .spread(function(dataset, networks) {
            var currentNetwork = _.find(networks, 'id', currNwId);

            if(newScope == 'local') {
                // Move DS attrs to network
                if(_.isArray(dsAttrIds) && dsAttrIds.length > 0) {
                    // Copy Ds attrs vals to Nw attrs
                    _copyAttrsInDsOrNw(dsAttrIds, dataset.datapoints, currentNetwork.nodes, 'id', 'dataPointId');
                    // Push attr descriptors to Nw
                    _.each(dsAttrIds, function(attrId) {
                        var attrDescr = _.find(dataset.attrDescriptors, 'id', attrId);
                        currentNetwork.nodeAttrDescriptors.push(attrDescr);
                    });
                    // Remove attrs from DS attrDescrs
                    dataset.attrDescriptors = _.filter(dataset.attrDescriptors, function(attrDescr) {
                        return dsAttrIds.indexOf(attrDescr.id) < 0;
                    });
                    // Remove attrs from datapoints
                    _removeAttrsFromEntities(dsAttrIds, dataset.datapoints);

                }
                else {
                    throw new Error('nothing to update');
                }

            }
            else if(newScope == 'global') {
                // Move NW attrs to DS
                if(_.isArray(nwAttrIds) && nwAttrIds.length > 0) {
                    // Copy NW attrs vals to DS attrs
                    _copyAttrsInDsOrNw(nwAttrIds, currentNetwork.nodes, dataset.datapoints, 'dataPointId', 'id');
                    // Push attr descriptors to DS
                    _.each(nwAttrIds, function(attrId) {
                        var attrDescr = _.find(currentNetwork.nodeAttrDescriptors, 'id', attrId);
                        dataset.attrDescriptors.push(attrDescr);
                    });
                    // Remove attrs from all NW attrDescrs
                    _.each(networks, function(network) {
                        network.nodeAttrDescriptors = _.filter(network.nodeAttrDescriptors, function(attrDescr) {
                            return nwAttrIds.indexOf(attrDescr.id) < 0;
                        });
                        // Remove attrs from all NW nodeAttrDescrs
                        _removeAttrsFromEntities(nwAttrIds, network.nodes);
                    });
                }
                else {
                    throw new Error('nothing to update');
                }
            }
            var saveDsP = DSModel.updateDataset(dataset);
            var saveNwP = Promise.map(networks, network => DSModel.updateNetwork(network));
            return Promise.join(saveDsP, saveNwP);
        }).then(function() {
            res.status(200).json({attrsScopeChanged: true});
        }).catch(function(errr) {
            var err = errr.stack || errr;
            console.error("[changeAttrsScope] Error in changing scope. ", errr);
            res.status(500).send(err);
        });

    }
}

function deleteNetwork(req, res) {
    var logPrefix = '[DSModelController.deleteNetwork] ';
    var networkId = req.params.nwid;
    if(!networkId) {
        res.status(400).send("NetworkId to be deleted not found in the request.");
        return;
    }
    if(!_.any(req.project.networks, 'ref', networkId)) {
        res.status(400).send("Network with id:" + networkId + " not found in the project. param: nwid");
        return;
    }
    var networkDelP = DSModel.removeNetworkById(networkId);
    networkDelP
    .then(function() {
        console.log(logPrefix + 'Network deleted.');
        console.log(logPrefix + 'Deleted nework Id: ' + networkId);

        // Delete network from project
        var projNetworkIdx = _.findIndex(req.project.networks, 'ref', networkId);
        req.project.networks.splice(projNetworkIdx, 1);


        if(!_.isEmpty(req.query.newNetworkId)) {
            // Replace network Id for network regeneration
            _.each(req.project.snapshots, function(snap) {
                if(snap.networkId == networkId) {
                    snap.networkId = req.query.newNetworkId;
                    snap.layout.xaxis = 'OriginalX';
                    snap.layout.yaxis = 'OriginalY';
                }
            });
            // remove the networkId from project allNetworks as well
            req.project.allGenNWIds = req.project.allGenNWIds.filter( nwid => nwid != networkId);
        }
        else {
            // Delete network specific snapshots
            req.project.snapshots = _.filter(req.project.snapshots, function(snap) {
                return snap.networkId != networkId;
            });
        }

        // Save project
        req.project.save(function(err) {
            if(err) {
                console.log(logPrefix + 'Project could not be updated after deleting network');
                console.log(logPrefix + 'Project Id - ' + req.project._id);
                res.status(500).send(err);
            }
            else {
                console.log(logPrefix + 'Project updated after deleting network');
                res.status(200).json({delNetworkId: networkId});
            }
        });

    })
    .catch(function(errr) {
        var err = errr.stack || errr;
        console.error(logPrefix + "Error in deleting. ", errr);
        res.status(500).send(err);
    });
}

function _updateAttrCategories(entities, attrId, oldVal_newValMap) {
    _.each(entities, function(entity) {
        if(entity.attr[attrId] != null) {
            var oldVal = entity.attr[attrId];
            entity.attr[attrId] = oldVal_newValMap[oldVal] != null ? oldVal_newValMap[oldVal] : oldVal;
        }
    });
}

function applyAttrOps(recObj, attrDescKey, entityKey, entityLoadFn,
    attrSequenceChanged, orderedAttrIds, changedAttrDescriptors, removedAttrIds) {

    var orderChanged = true, // always for simplicity sake
        attrModified = false,
        attrRemoved = false;

    // update ordering
    if(attrSequenceChanged === true && _.isArray(orderedAttrIds)) {
        orderChanged = true;
        recObj[attrDescKey] = updateAttrDescOrder(recObj[attrDescKey], orderedAttrIds);
    }
    // update metadata of given attrs
    updateAttrData(recObj[attrDescKey], changedAttrDescriptors);
    // check to see if we need to load entities
    if(_shouldLoadEntities(recObj[attrDescKey], changedAttrDescriptors, removedAttrIds)) {
        console.log(`[DSModelController.applyAttrOps] loading ${entityKey} ..`);
        return entityLoadFn(recObj)
            .then(function () {
                // Overwrite attr descriptors if values changed
                if(_.isArray(changedAttrDescriptors) && changedAttrDescriptors.length > 0) {
                    attrModified = updateAttrDescr(recObj[attrDescKey], changedAttrDescriptors, recObj[entityKey]);
                }

                // Delete attrs if requested
                if(_.isArray(removedAttrIds) && removedAttrIds.length > 0) {
                    attrRemoved = true;
                    recObj[attrDescKey] = _.filter(recObj[attrDescKey], function(attrDescr) {
                        return removedAttrIds.indexOf(attrDescr.id) < 0;
                    });
                    _removeAttrsFromEntities(removedAttrIds, recObj[entityKey]);
                }
                return {
                    orderChanged,
                    attrModified,
                    attrRemoved
                };
            });
    } else {
        console.log(`[DSModelController.applyAttrOps] skip loading ${entityKey}`);
        return Promise.resolve({
            orderChanged,
            attrModified,
            attrRemoved
        });
    }
}
// helper for applyAttrOps
function _shouldLoadEntities(existingAttrDescr, changedAttrDescriptors, removedAttrIds) {
    if(_.isArray(removedAttrIds) && removedAttrIds.length > 0) {
        return true;
    }
    if((_.isArray(changedAttrDescriptors) && changedAttrDescriptors.length > 0)) {
        var attrDescIdx = _.indexBy(existingAttrDescr, "id");
        // should only load if any of the attr descriptors have changed
        return _.any(changedAttrDescriptors, function (attr) {
            return attr.attrType !== attrDescIdx[attr.id].attrType;
        });
    } else return false;
}

// returns newly ordered attr descrs
function updateAttrDescOrder(attrDescriptors, orderedIds) {
    var existingAttrIds = _.pluck(attrDescriptors, 'id');

    if(attrDescriptors.length !== orderedIds.length) { // check length
        throw new Error('Node Attrs count not same');
    }
    if(_.union(existingAttrIds, orderedIds).length !== existingAttrIds.length) { // check similarity
        throw new Error("Node ids don't match");
    }
    var attrIdx = _.indexBy(attrDescriptors, 'id');
    return _.reduce(orderedIds, function(acc, attrId) {
        acc.push(attrIdx[attrId]);
        return acc;
    }, []);
}
// updates individual attr info. Does not change order
// newAttrDesc -> only attrs which have changed
// does not update attrType
// returns true if entities have been updated
function updateAttrData(existingAttrDescr, newAttrDesc) {
    var entitiedUpdated = false;
    var attrDescIdx = _.indexBy(newAttrDesc, "id");
    var logPrefix = "[DSModelController.updateAttrData]";
    console.log(`${logPrefix} Got Attrs to update: `, _.pluck(newAttrDesc, "id"));

    _.each(existingAttrDescr, function(attr) {
        var newAttr = attrDescIdx[attr.id];
        if(newAttr) {
            entitiedUpdated = true;
            _.assign(attr, _.pick(newAttr, ['id', 'title', 'renderType', 'generatorType',
                            'generatorOptions', 'metadata', 'visible', 'isStarred', 'searchable', 'visibleInProfile']));
        }
    });
    return entitiedUpdated;
}
// updates individual attr Object. Does not change order
// newAttrDesc -> only attrs which have changed
// returns true if entities have been updated
function updateAttrDescr(existingAttrDescr, newAttrDesc, entities) {
    var entitiedUpdated = false;
    var attrDescIdx = _.indexBy(newAttrDesc, "id");
    var logPrefix = "[DSModelController.updateAttrDescr]";
    console.log(`${logPrefix} Got Attrs to update: `, _.pluck(newAttrDesc, "id"));

    _.each(existingAttrDescr, function(attr) {
        var newAttr = attrDescIdx[attr.id];
        if(newAttr) {
            var newAttrType = newAttr.attrType;
            // check if types have changed
            if(attr.attrType != newAttrType) {
                entitiedUpdated = true;
                console.log(`${logPrefix} Attr Type has changed. Updating attrs. from: ${attr.attrType} to: ${newAttrType}`);
                var converter = AttrModifierAPI.valueConverter(newAttrType, attr.attrType, attr.id, entities);
                // update entities
                _.each(entities, function(entity) {
                    if(entity.attr[attr.id] != null) {
                        var newVal = converter(entity.attr[attr.id]);
                        if(_.isArray(newVal) && newVal.length === 0) { // empty liststring case
                            delete entity.attr[attr.id];
                        } else entity.attr[attr.id] = newVal;
                    }
                });
            }

            _.assign(attr, _.pick(newAttr, ['id', 'title', 'attrType', 'renderType', 'generatorType',
                            'generatorOptions', 'metadata', 'visible', 'isStarred', 'searchable', 'visibleInProfile']));
            console.log(`${logPrefix} Updated Attr:`, attr.id);
        }
    });
    return entitiedUpdated;
}

function _removeAttrsFromEntities(attrIdsList, entities) {
    _.each(entities, function(entity) {
        _.each(attrIdsList, function(attrId) {
            if(_.has(entity.attr, attrId)) {
                delete entity.attr[attrId];
            }
        });
    });
}

function _copyAttrsInDsOrNw(attrIdsList, entities, newEntities, id, newId) {
    _.each(entities, function(entity) {
        var newEntity = _.find(newEntities, newId, entity[id]);
        _.each(attrIdsList, function(attrId) {
            newEntity.attr[attrId] = entity.attr[attrId];
        });
    });
}

function _shouldSanitizeClusterInfo(nw) {
    return _.isEmpty(nw.clusterInfo) || !_.get(nw, 'clusterInfo[0].clusters[0].linkingAttrName');
}


//API
module.exports                      = {
    saveDataToProject                   : saveDataToProject,
    getDataset                          : getDataset,
    getAllNetworks                      : getAllNetworks,
    getNetwork                          : getNetwork,
    updateNetwork                       : updateNetwork,
    downloadNetworksData                : downloadNetworksData,
    updateDatasetAttrs                  : updateDatasetAttrs,
    updateNetworkAttrs                  : updateNetworkAttrs,
    addAttributeToDataset               : addAttributeToDataset,
    addAttributeToNetwork               : addAttributeToNetwork,
    createNetworkFromSubGraph           : createNetworkFromSubGraph,
    bakeGroups                          : bakeGroups,
    deleteNetwork                       : deleteNetwork,
    changeAttrsScope                    : changeAttrsScope,
    updateAttrCategoriesForDataset      : updateAttrCategoriesForDataset,
    updateAttrCategoriesForNetworkNodes : updateAttrCategoriesForNetworkNodes
};
