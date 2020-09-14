'use strict';

var streamifier = require("streamifier"),
    // ObjectID = require('mongodb').ObjectID,
    ObjectID = require('mongoose').Types.ObjectId, //see: https://github.com/Automattic/mongoose/issues/4349
    Promise = require('bluebird'),
    assert = require('assert'),
    _ = require('lodash'),
    onecolor = require('onecolor');

var elasticSearchService = require('../services/elasticsearch'),
    gfs = require('../schemas/gfs_schema.js'),
    DataMapping = require('../schemas/dataMapping_schema.js'),
    DatasetRecord = require('../schemas/datasetRecord_schema.js'),
    NetworkRecord = require('../schemas/networkRecord_schema.js');

// Render types map
// Note:-
//   1) Change on client side(AttrInfoService.js) and athena(entities.py) as well on updation
//   2) Each attr type gets first render type as default
var attrRenderTypesMap = {
    'string': ['tag-cloud', 'wide-tag-cloud','categorylist' ,'categorybar', 'text', 'textlist', 'piechart', 'barchart', 'media', 'link', 'date', 'date-time', 'time', 'email', 'lat,lng', 'longtext'],
    'json': ['medialist'],
    'twitter': ['twitterfeed'],
    'instagram': ['instagramfeed'],
    'liststring': ['tag-cloud', 'wide-tag-cloud', 'tags'],
    'boolean': ['categorybar', 'piechart', 'histogram'],
    'color': ['categorybar', 'piechart', 'histogram'],
    'integer': ['histogram', 'densitybar'],
    'float': ['histogram', 'densitybar'],
    'year': ['histogram', 'densitybar'],
    'picture': ['default'],
    'profile': ['default'],
    'audio_stream': ['default'],
    'media_link': ['default'],
    'video_stream': ['default'],
    'video': ['default'],
    'html': ['default'],
    'url': ['default'],
    'timestamp' : ['histogram', 'default']
};

function getDefaultRenderTypeForAttrType (attrType) {
    return _.first(attrRenderTypesMap[attrType]);
}

function defColor () { return "#c8c8c8"; } //"rgb(200,200,200)"; }

// DataPoint class
function DataPoint (id, attr) {
    this.id = '' + id;
    this.attr = attr; // Attr is a object from id -> value
}

// Node class
function Node (id, dataPointId, attr) {
    var defAttr = {
        OriginalLabel: "node",
        OriginalSize :20,
        OriginalX :  _.random(10, 1000, false),
        OriginalY : _.random(10, 1000, false),
        OriginalColor  : defColor()
    };
    this.dataPointId = '' + dataPointId;
    this.id = '' + id;
    this.attr = _.extend(defAttr, attr, function(oldVal, newVal) {
        return newVal != null ? newVal : oldVal;
    });
}

// Link class
function Link (id, sourceId, targetId, isDirectional, attr) {
    var defAttr = {
        OriginalLabel: "link",
        OriginalSize :20,
        OriginalColor: defColor()
    };

    this.id = '' + id;
    this.source = '' + sourceId;
    this.target = '' + targetId;
    this.isDirectional = !!isDirectional;
    this.attr = _.extend(defAttr, attr, function(oldVal, newVal) {
        return newVal != null ? newVal : oldVal;
    });
}

// AttrDescriptor class
function AttrDescriptor (id, title, attrType, generatorType, generatorOptions, metadata, visible) {
    assert(id, "Attr Descriptor needs id");
    if (attrType == null) { attrType = "string"; }
    var ad = {
        id              : id,
        title           : title         != null ? title         : id,
        attrType        : attrType,
        generatorType   : generatorType != null ? generatorType : "internal",
        generatorOptions: generatorOptions != null ? generatorOptions : null,
        visible         : "boolean"  == typeof visible ? visible : true,
        metadata        : _.isObject(metadata) ? metadata : {},
        isStarred       : false,
        visibleInProfile: true,
        renderType      : getDefaultRenderTypeForAttrType(attrType),
        searchable      : ['integer', 'float'].indexOf(attrType) === -1 ? true : false
    };
    _.assign(this, ad);
}

// Dataset class
function Dataset (id, projectId, name, datapoints, attrDescriptors, sourceInfo) {
    this.id = id || new ObjectID().toString();
    this.projectId = projectId.toString();
    this.name = name || 'dataset';
    this.datapoints = datapoints;
    this.attrDescriptors = attrDescriptors;
    this.sourceInfo = sourceInfo;
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();
}

// Network class
function Network (id, datasetId, projectId, name, networkInfo, clusterInfo, generatorInfo) {
    this.datasetId = datasetId;
    this.projectId = projectId;
    this.id = id || new ObjectID().toString();
    this.name = name || 'network';
    this.description = "description of " + name;
    this.nodes = [];
    this.links = [];
    this.nodeAttrDescriptors = [];
    this.linkAttrDescriptors = [];
    this.networkInfo = networkInfo;
    this.clusterInfo = clusterInfo;
    this.generatorInfo = generatorInfo;
    this.createdAt = Date.now();
    this.modifiedAt = Date.now();
}

Network.prototype.addNode = function(node, attr) {
    var existingNode = _.find(this.nodes, {'id': node.id});
    var newNode = new Node(node.id, node.id, attr);
    if(existingNode) {
        // Node already exists
        _.assign(existingNode, newNode);
    }
    else {
        this.nodes.push(newNode);
    }
};

Network.prototype.addLink = function(link, attr) {
    var existingLink = _.find(this.links, {'id': link.id});
    var newLink = new Link(link.id, link.source, link.target, link.edgeType, attr);
    if(existingLink) {
        // Link already exists
        _.assign(existingLink, newLink);
    }
    else {
        this.links.push(newLink);
    }
};

Network.prototype.addNodeAttrDescr = function(id, title, attrType, generatorType, generatorOptions, metadata, visible) {
    var existingAttrDescr = _.find(this.nodeAttrDescriptors, {'id': id});
    var newAttrDescr = new AttrDescriptor(id, title, attrType, generatorType, generatorOptions, metadata, visible);
    if(existingAttrDescr) {
        _.assign(existingAttrDescr, newAttrDescr);
    }
    else {
        this.nodeAttrDescriptors.push(newAttrDescr);
    }
};

Network.prototype.addLinkAttrDescr = function(id, title, attrType, generatorType, generatorOptions, metadata, visible) {
    var existingAttrDescr = _.find(this.linkAttrDescriptors, {'id': id});
    var newAttrDescr = new AttrDescriptor(id, title, attrType, generatorType, generatorOptions, metadata, visible);
    if(existingAttrDescr) {
        _.assign(existingAttrDescr, newAttrDescr);
    }
    else {
        this.linkAttrDescriptors.push(newAttrDescr);
    }
};

function getAttrProps() {
    var attrProps = ['id', 'title', 'attrType', 'generatorType', 'generatorOptions', 'isStarred', 'visible', 'searchable', 'visibleInProfile'];
    return attrProps;
}

function createDatasetFromGraph (graph, projectId, sourceInfo) {
    var attrDescriptors = _.map(graph.nodeAttrs, function(attr) {
        return new AttrDescriptor(attr.id, attr.title, attr.attrType, attr.generatorType, attr.generatorOptions, attr.metadata, attr.visible);
    });
    var labelDataExists = false,
        colorDataExists = false;

    var datapoints = _.map(graph.nodes, function(node) {
        var attr = _.reduce(node.attr, function(attrObj, attr) {
            attrObj[attr.id] = attr.val;
            return attrObj;
        }, {});
        if(node.label) {
            attr['DataPointLabel'] = node.label;
            labelDataExists = true;
        }
        if(node.col) {
            attr['DataPointColor'] = colorStr(node.col);
            colorDataExists = true;
        }
        return new DataPoint(node.id, attr);
    });
    if(labelDataExists && !_.any(attrDescriptors, 'id', 'DataPointLabel')) {
        attrDescriptors.push(new AttrDescriptor('DataPointLabel', 'DataPointLabel'));
    }
    if(colorDataExists && !_.any(attrDescriptors, 'id', 'DataPointColor')) {
        attrDescriptors.push(new AttrDescriptor('DataPointColor', 'DataPointColor','color'));
    }
    return new Dataset(new ObjectID().toString(), projectId, 'dataset', datapoints, attrDescriptors, sourceInfo);
}

function createDataset (projectId, name, datapoints, attrs, sourceInfo, validate) {
    if(validate === true) {
        var attrIds = _.pluck(attrs, 'id');
        var dpIndex = _.indexBy(datapoints, 'id');
        var dpIds = _.keys(dpIndex);
        assert(dpIds.length === datapoints.length, "DataPoint Keys should be unique");
        assert(_.all(attrIds,_.isString), "AttrIds should be defined and be strings");
    }
    return new Dataset(new ObjectID().toString(), projectId, name, datapoints, attrs, sourceInfo);
}

function createDefaultNetwork (dataset, graph) {
    var dpIndex = _.indexBy(dataset.datapoints,'id');
    var network = createEmptyNetwork(dataset.id, dataset.projectId, 'default');
    _.each(graph.nodes, function(node) {
        var attr = {
            OriginalLabel: node.label,
            OriginalSize : node.size,
            OriginalX : node.posX,
            OriginalY : node.posY,
            OriginalColor  : node.col
        };
        attr.OriginalColor = colorStr(attr.OriginalColor);
        assert(dpIndex[node.id], "dataPointId should be valid");

        network.addNode(node, attr);
    });

    _.each(graph.edgeAttrs, function(attr) {
        if(attr.id != "OriginalSize" && attr.id != "OriginalColor" && attr.id != "OriginalLabel") {
            var newAttrDescr = new AttrDescriptor(attr.id, attr.title, attr.attrType, attr.generatorType, attr.generatorOptions, attr.metadata, attr.visible);
            network.addLinkAttrDescr(newAttrDescr);
        }
    });

    _.each(graph.edges, function(link) {
        var attr = _.reduce(link.attr, function(attrObj, attr) {
            attrObj[attr.id] = attr.val;
            return attrObj;
        }, {});

        attr.OriginalColor = colorStr(link.col);
        attr.OriginalSize = link.size;
        attr.OriginalLabel= link.label;

        network.addLink(link, attr);
    });
    if(graph.edgeAttrs.length === 0) {
        network.linkAttrDescriptors = [];
        network.links = [];
    }

    return network;
}

// Assumes validation has already happened
function createNetwork (dataset, networkData) {
    var dpIndex = _.indexBy(dataset.datapoints,'id');
    var nodeIndex = _.indexBy(networkData.nodes, 'id');
    var network = createEmptyNetwork(dataset.id, dataset.projectId, networkData.name || 'default');

    if(networkData.description) network.description = networkData.description;
    if(networkData.networkInfo) _.assign(network.networkInfo, networkData.networkInfo);
    if(networkData.generatorInfo) _.assign(network.generatorInfo, networkData.generatorInfo);

    _.each(networkData.nodeAttrDescriptors, function(attr) {
        var newAttrDescr = new AttrDescriptor(attr.id, attr.title, attr.attrType, attr.generatorType, attr.generatorOptions, attr.metadata, attr.visible);
        network.nodeAttrDescriptors.push(newAttrDescr);
    });
    _.each(networkData.linkAttrDescriptors, function(attr) {
        var newAttrDescr = new AttrDescriptor(attr.id, attr.title, attr.attrType, attr.generatorType, attr.generatorOptions, attr.metadata, attr.visible);
        network.linkAttrDescriptors.push(newAttrDescr);
    });

    _.each(networkData.nodes, function(node_data) {
        assert(dpIndex[node_data.dataPointId], "dataPointId should be valid");
        var node =  new Node(node_data.id, node_data.dataPointId, node_data.attr);
        var attr = node.attr;
        assert(attr.OriginalLabel != null,   "OriginalLabel should exist");
        assert(!isNaN(+attr.OriginalSize) ,  "OriginalSize should exist");
        assert(!isNaN(+attr.OriginalX),      "OriginalX should exist");
        assert(!isNaN(+attr.OriginalY),      "OriginalY should exist");
        assert(attr.OriginalColor != null,   "OriginalColor should exist");
        network.nodes.push(node);
    });

    _.each(networkData.links, function(link) {
        assert(nodeIndex[link.source], "link source should be valid");
        assert(nodeIndex[link.target], "link target should be valid");
        network.links.push(new Link(link.id, link.source, link.target, link.edgeType, link.attr));
    });

    return network;
}
function createNewNetwork_fromDataset (dataset, networkData) {
    var dpIndex = _.indexBy(dataset.datapoints,'id');
    var network = createEmptyNetwork(dataset.id, dataset.projectId, networkData.sheetName || 'default');

    _.each(networkData.nodeAttrs, function(attr) {
        network.addNodeAttrDescr(attr.id, attr.title, attr.attrType, attr.generatorType, attr.generatorOptions, attr.metadata, attr.visible);
    });

    _.each(networkData.nodes, function(node) {
        var attr = {};

        _.reduce(node.attr, function(attrObj, nodeAttr) {
            attrObj[nodeAttr.id] = nodeAttr.val;
            return attrObj;
        }, attr);

        attr.OriginalLabel = node.label;
        attr.OriginalSize = node.size;
        attr.OriginalX = node.posX;
        attr.OriginalY = node.posY;
        attr.OriginalColor = colorStr(node.col);

        assert(dpIndex[node.id], "dataPointId should be valid");
        network.addNode(node, attr);
    });

    _.each(networkData.edgeAttrs, function(attr) {
        network.addLinkAttrDescr(attr.id, attr.title, attr.attrType, attr.generatorType, attr.generatorOptions, attr.metadata, attr.visible);
    });

    _.each(networkData.links, function(link) {
        var attr = _.reduce(link.attr, function(attrObj, attr) {
            attrObj[attr.id] = attr.val;
            return attrObj;
        }, {});

        attr.OriginalColor = colorStr(link.col);
        attr.OriginalSize = link.size;
        attr.OriginalLabel= link.label;

        network.addLink(link, attr);
    });

    return network;
}

function createEmptyNetwork (datasetId, projectId, networkName) {
    var defaultNetwork = new Network(new ObjectID().toString(), datasetId, projectId, networkName, {}, {}, {});
    defaultNetwork.addNodeAttrDescr("OriginalX", "OriginalX", 'float', "Original_layout", null, {}, false);
    defaultNetwork.addNodeAttrDescr("OriginalY", "OriginalY", 'float', "Original_layout", null, {}, false);
    defaultNetwork.addNodeAttrDescr("OriginalColor", "OriginalColor", 'color', "Original_layout", null, {}, false);
    defaultNetwork.addNodeAttrDescr("OriginalSize", "OriginalSize", 'float', "Original_layout", null, {}, false);
    defaultNetwork.addNodeAttrDescr("OriginalLabel", "OriginalLabel", 'string', "Original_layout", null, {}, false);

    defaultNetwork.addLinkAttrDescr("OriginalColor", "OriginalColor", 'color', "Original_layout", null, {}, false);
    defaultNetwork.addLinkAttrDescr("OriginalSize", "OriginalSize", 'float', "Original_layout", null, {}, false);
    defaultNetwork.addLinkAttrDescr("OriginalLabel", "OriginalLabel", 'string', "Original_layout", null, {}, false);

    return defaultNetwork;
}

function updateDataset(dataset, skipDatapoints) {
    return saveDataset(dataset, skipDatapoints);
}
function updateNetwork(network, skipNodes, skipLinks) {
    return saveNetwork(network, skipNodes, skipLinks);
}

function saveDatasetRecord(dataset) {
    console.log("[DSModel.saveDatasetRecord] Saving dataset record...");
    var recObj = _.omit(dataset, "datapoints");
    recObj.nDatapoints = _.get(dataset, 'datapoints.length') || recObj.nDatapoints;
    recObj.datapointsFile = dataset.datapointsFile;
    recObj._id = dataset.id;

    var onSaveP = DatasetRecord.findById(recObj._id).exec()
        .then(function (oldRec) {
            if(!oldRec) {
                console.log(`[DSModel.saveDatasetRecord] Creating new Dataset Record by id: ${recObj._id}`);
                return new DatasetRecord(recObj).save();
            } else {
                console.log(`[DSModel.saveDatasetRecord] updating existing Dataset Record of id: ${oldRec._id}`);
            }
            /// update older record with this new one
            oldRec.projectId       = recObj.projectId;
            oldRec.name            = recObj.name;
            oldRec.attrDescriptors = _.map(recObj.attrDescriptors, attr => _.omit(attr, "_id"));
            oldRec.sourceInfo      = recObj.sourceInfo;
            oldRec.nDatapoints     = recObj.nDatapoints;
            oldRec.datapointsFile  = recObj.datapointsFile;
            oldRec.modifiedAt      = Date.now();
            return oldRec.save();
        });

    onSaveP.tap(() => console.log("[DSModel.saveDatasetRecord] Saving dataset record... done"));
    return onSaveP;
}

function saveDataset (dataset, skipDatapoints) {
    var id = dataset.id;
    assert(id, "id is valid");
    console.log(`[Dataset.saveDataset] Started saving of dataset: ${dataset.name}`);
    var shouldIndex = true;
    // save datapoints in its own file if needed
    var datapointsP = Promise.resolve(dataset.datapointsFile);
    if(!skipDatapoints || dataset.datapointsFile == null) {
        dataset.datapointsFile = dataset.datapointsFile != null ? dataset.datapointsFile : new ObjectID();
        console.log("[DSModel.saveDataset] Saving datapoints...");
        datapointsP = storeViaMapping(dataset.datapointsFile, dataset.datapoints, `datapoints_${dataset.id}`, {
            datasetId : dataset.id,
            entityId : new ObjectID(dataset.id),
            nDatapoints : dataset.datapoints.length
        })
            .tap(() => console.log("[DSModel.saveDataset] Saving datapoints... done"));
    } else {
        shouldIndex = false;
        console.log("[DSModel.saveDataset] Datapoints save skipped");
    }

    // save dataset record
    var onSaveP = datapointsP.then(function (pointsFileId) {
        dataset.datapointsFile = pointsFileId;
        return saveDatasetRecord(dataset);
    })
        .then(() => dataset)
        .tap(function(dataset) {
            if(shouldIndex) {
                return elasticSearchService.storeDataSet(dataset.id, dataset.attrDescriptors, dataset.datapoints, function (err){
                    if(err) {
                        return console.warn("[DSModel.saveDataset] error storing data to elasticsearch", err);
                    }
                    console.log("[DSModel.saveDataset] Successfully stored data to elasticsearch");
                });
            } else return null;
        });
    return onSaveP.tap(() => console.log(`[Dataset.saveDataset] Successfully saved dataset: ${dataset.name}`));

    // // var dataMap = new DataMapping({
    // //     entityRef : id,
    // //     fileDataRef : new ObjectID().toString(),
    // //     opInfo : {}
    // // });

    // // DataMapping.update({ entityRef : id }, { $set : { isDeleted : true}}, { multi: true }).exec()
    // // .then(() => dataMap.save());

    // return new Promise(function(resolve, reject) {
    //     var writestream = gfs().createWriteStream({
    //         _id : dataMap.fileDataRef,
    //         filename: 'dataset_' + dataset.id,
    //         mode : 'w',
    //         metadata : {
    //             entityRef : dataMap.entityRef
    //         }
    //     });
    //     console.log('[DSModel.saveDataset] writing Dataset to GridStore.....');
    //     var data = JSON.stringify(dataset);
    //     streamifier.createReadStream(data).pipe(writestream);

    //     writestream.on('close', function(file) {
    //         console.log('[DSModel.saveDataset] writing Dataset to GridStore.....Done');
    //         resolve(dataset);
    //     });
    //     writestream.on('error', function(err) { reject(err); });
    // }).tap(function(dataset) {
    //     elasticSearchService.storeDataSet(dataset.id, dataset.datapoints, function (err, result){
    //         if(err) {
    //             console.warn("[DSModel.saveDataset] : error storing data to elasticsearch", err);
    //         } else {
    //             console.log("[DSModel.saveDataset] : successfully stored data to elasticsearch");
    //         }
    //     });
    // });
}

function saveNetworkRecord(network) {
    var recObj = _.omit(network, ["nodes", "links"]);
    recObj.nNodes = _.get(network, "nodes.length") || recObj.nNodes;
    recObj.nLinks = _.get(network, "links.length") || recObj.nLinks;
    recObj.nodesFile = network.nodesFile;
    recObj.linksFile = network.linksFile;
    recObj._id = network.id;

    var onSaveP = Promise.resolve(NetworkRecord.findById(network.id).exec()
        .then(function (oldRec) {
            if(!oldRec) { return new NetworkRecord(recObj).save(); }

            /// update older record with this new one
            oldRec.projectId       = recObj.projectId;
            oldRec.datasetId       = recObj.datasetId;
            oldRec.name            = recObj.name;
            oldRec.description     = recObj.description;

            oldRec.nodeAttrDescriptors = _.map(recObj.nodeAttrDescriptors, attr => _.omit(attr, "_id"));
            oldRec.linkAttrDescriptors = _.map(recObj.linkAttrDescriptors, attr => _.omit(attr, "_id"));

            oldRec.nodesFile      = recObj.nodesFile;
            oldRec.linksFile      = recObj.linksFile;

            oldRec.networkInfo = recObj.networkInfo;
            oldRec.clusterInfo = recObj.clusterInfo;
            oldRec.generatorInfo = recObj.generatorInfo;

            oldRec.nNodes     = recObj.nNodes;
            oldRec.nLinks     = recObj.nLinks;

            oldRec.modifiedAt      = Date.now();

            return oldRec.save();
        })); 
    onSaveP.tap(() => console.log("[DSModel.saveNetwork] Saving network record... done"));
    return onSaveP;
}

function saveNetwork (network, skipNodes, skipLinks) {
    var id = network.id;
    assert(id, "id is valid");
    var nodesFileP = Promise.resolve(network.nodesFile),
        linksFileP = Promise.resolve(network.linksFile);

    // skip nodes / update nodes
    if(!skipNodes || network.nodesFile == null) {
        network.nodesFile = network.nodesFile != null ? network.nodesFile : new ObjectID();
        console.log("[DSModel.saveNetwork] Saving nodes...");
        nodesFileP = storeViaMapping(network.nodesFile, network.nodes, `network_nodes_${network.id}`, {
            networkId : network.id,
            entityId : new ObjectID(network.id),
            nNodes : network.nodes.length
        }).tap(() => console.log("[DSModel.saveNetwork] Saving nodes...done"));
    } else {
        console.log("[DSModel.saveNetwork] Nodes save skipped");
    }

    // skip links / update links
    if(!skipLinks || network.linksFile == null) {
        network.linksFile = network.linksFile || new ObjectID();
        linksFileP = storeViaMapping(network.linksFile, network.links, `network_links_${network.id}`, {
            networkId : network.id,
            entityId : new ObjectID(network.id),
            nLinks : network.links.length
        }).tap(() => console.log("[DSModel.saveNetwork] Saving links...done"));
    } else {
        console.log("[DSModel.saveNetwork] Links save skipped");
    }

    // update network record
    var onSaveP = Promise.join(nodesFileP, linksFileP, function (nodesFileId, linksFileId) {
        network.nodesFile = nodesFileId;
        network.linksFile = linksFileId;
        return saveNetworkRecord(network);
    })
        .then(function (nwRec) {
            console.log(`[Dataset.saveNetwork] Successfully saved network: ${nwRec.name}`);
            return network;
        });
    return onSaveP;
}

function storeViaMapping(mappedId, entities, filename, metadata) {
    console.log(`[DSModel.storeViaMapping] Storing ${entities.length} entities via mapping. mappedFileId: `, mappedId, "...");
    var id = typeof mappedId === "string" ? new ObjectID(mappedId) : mappedId;
    var objId = new ObjectID();

    // store the data
    var dataFileP = serializeEntities(entities, objId, filename, _.assign(metadata, { mappedId : id}))
        .tap(() => console.log(`[DSModel.storeViaMapping] Saved entities into grid file ${objId.toString()}`));

    var dataMap = new DataMapping({
        entityRef : id,
        fileDataRef : objId,
        opInfo : {}
    });
    // store the mapping
    var mapping = DataMapping.update({ entityRef : id}, { $set : { isDeleted : true}}, { multi: true }).exec()
        .then(() => dataMap.save());

    return Promise.join(dataFileP, mapping, function (dataFile, mapping) {
        console.log("[DSModel.storeViaMapping] Created Mapping", mapping.toObject());
        console.log("[DSModel.storeViaMapping] Storing entities via mapping. mappedFileId: ", mappedId, "...done");
        return mappedId;
    });
}

function serializeEntities(entities, objId, filename, metadata) {
    objId = objId || new ObjectID();
    return new Promise(function(resolve, reject) {
        var writestream = gfs().createWriteStream({
            _id : objId,
            filename: filename,
            mode : 'w',
            metadata : metadata
        });
        console.log(`[DSModel.serializeEntities][${filename}][${objId.toString()}] writing entities to GridStore.....`);
        var data = JSON.stringify(entities);
        streamifier.createReadStream(data).pipe(writestream);

        writestream.on('close', function() {
            console.log(`[DSModel.serializeEntities][${filename}][${objId.toString()}] writing entities to GridStore.....Done`);
            resolve(objId);
        });
        writestream.on('error', function(err) { reject(err); });
    });
}

// load a JSON file stored in GridFS
function _readData (entityId) {
    return new Promise(function(resolve, reject) {
        var readstream = gfs().createReadStream({
            _id: entityId,
            mode : 'r'
        });
        var dataString = [];
        readstream.on('data', function (chunk) {
            var part = chunk.toString();
            dataString.push(part);
            console.log('[DSModel.readData] got %d bytes of data', chunk.length);
        });
        readstream.on('end', function(){
            var dsstr = dataString.join('');
            if(dsstr === "") {
                reject(new Error("Data is empty. got empty string. maybe corrupted in previous operation"));
                return;
            }
            try {
                var dataDocs = JSON.parse(dsstr);
                resolve(dataDocs);
            }
            catch(e) {
                reject(new Error("Data corrupted. Can't be formatted into json. given: " + dataString));
            }
        });
        readstream.on('error', reject);
    });
}

function _fileExists (fileId) {
    return Promise.fromCallback(function(cb) {
        gfs().exist({
            _id : fileId
        }, cb);
    });
}
/**
 * There are 3 ways data has been stored
 * 1) File written directly
 * 2) DataMapping used to store the actual file
 * 3) data split into a MongoRecord + point files. (nodes / links / datapoints)
 */
function readDatasetFromRecord(entityId, skipDatapoints) {
    return DatasetRecord.findById(entityId).exec()
        .then(function (dsRec) {
            if(!dsRec) { return null; }

            var dsObj = dsRec.toObject();
            if(skipDatapoints) {
                console.log(`[DSModel.readDatasetFromRecord] skipping datapoints`);
                return dsObj;
            }
            console.log("[DSModel.readDatasetFromRecord] Found record: ", _.omit(dsObj, "attrDescriptors"));
            return _readFromMapping(dsObj.datapointsFile)
                .then(function (datapoints) {
                    if(!datapoints || datapoints.length === 0) {
                        throw new Error("Datapoints not found");
                    }
                    dsObj.datapoints = datapoints;
                    return dsObj;
                });
        });
}

function _readFromMapping(entityId) {
    return DataMapping.find({ entityRef : entityId, isDeleted: false }).sort("-createdAt").exec()
        .then(function(items) {
            if(!items) {
                throw new Error("Unable to find anything for entityId");
            }
            if(items.length === 0) {
                console.log("[DSModel._readFromMapping] There is no mapping for entity: " + entityId);
                return _readData(entityId);
            } else {
                _.each(items, mapping => console.log(`Found Mapping ${entityId} -> ${mapping.fileDataRef} createdAt ${mapping.createdAt}`));
                return Promise.reduce(items, function(entity, mapping) {
                    if(!entity) {
                        console.log("[DSModel._readFromMapping] Reading mapping : ", mapping);
                        return _fileExists(mapping.fileDataRef)
                            .then(function(found) {
                                if(found) { return _readData(mapping.fileDataRef);}
                                else return null;
                            });
                    } else {
                        return entity;
                    }
                }, null);
            }
        });
}

function _readOldData(entityId) {
    // body...
    return DataMapping.find({ entityRef : entityId, isDeleted: false }).sort("-createdAt").exec()
        .then(function(items) {
            if(!items) {
                throw new Error("Unable to find anything for entityId");
            }
            if(items.length === 0) {
                console.log("[DSModel._readOldData] There is no mapping for entity: " + entityId);
                return _readData(entityId);
            } else {
                _.each(items, mapping => console.log(`Found Mapping ${entityId} -> ${mapping.fileDataRef} createdAt ${mapping.createdAt}`));
                return Promise.reduce(items, function(entity, mapping) {
                    if(!entity) {
                        console.log("[DSModel._readOldData] Reading mapping : ", mapping);
                        return _fileExists(mapping.fileDataRef)
                            .then(function(found) {
                                if(found) { return _readData(mapping.fileDataRef).tap(data => data._mapping = mapping); }
                                else return null;
                            });
                    } else {
                        return entity;
                    }
                }, null);
            }
        });
}

function readDataset (entityId, skipDatapoints) {
    return readDatasetFromRecord(entityId, skipDatapoints)
        .then(function (dataset) {
            if(dataset) { return dataset; }
            console.log("[DSModel.readDataset] No Record found for dataset. reading from mapping");
            return _readOldData(entityId);
        });
}

function readNetworkFromRecord(entityId, skipNodes, skipLinks) {
    return NetworkRecord.findById(entityId).exec()
        .then(function (nwRec) {
            if(!nwRec) { return null; }
            var nwObj = nwRec.toObject();
            nwObj.networkInfo = nwObj.networkInfo || {};
            nwObj.generatorInfo = nwObj.generatorInfo || {};
            console.log("[DSModel.readNetworkFromRecord] Found record: ", _.omit(nwObj, ["nodeAttrDescriptors", "linkAttrDescriptors"]));
            var nP = Promise.resolve(nwObj);
            if(!skipNodes) {
                nP = _readFromMapping(nwObj.nodesFile)
                    .then(function (nodes) {
                        if(!nodes || nodes.length === 0) {
                            throw new Error("nodes not found");
                        }
                        nwObj.nodes = nodes;
                        return nwObj;
                    });
            }
            if(!skipLinks) {
                nP = nP.then(function (nwObj) {
                    return _readFromMapping(nwObj.linksFile)
                        .then(function (links) {
                            if(!links || links.length === 0) {
                                throw new Error("links not found");
                            }
                            nwObj.links = links;
                            return nwObj;
                        });
                });
            }
            return nP;
        });
}

function readNetwork (networkId, skipNodes, skipLinks) {
    return readNetworkFromRecord(networkId, skipNodes, skipLinks)
        .then(function (network) {
            if(network) { return network; }
            console.log("[DSModel.readNetwork] No Record found for network. reading from mapping");
            return _readOldData(networkId);
        });
}

/**
 * Common function to load nodes/links/datapoints
 * Stores it on the recObj
 * @return {Promise[RecObj]}            RecObj. basically network / datapoints
 */
function loadEntities(recObj, entityKey, entityFileKey) {
    if(!recObj[entityFileKey]) {
        return Promise.reject(`[DSModel.loadEntities] entityFileKey not found on recObj. given key: ${entityFileKey}`);
    }
    var nP = _readFromMapping(recObj[entityFileKey])
        .then(function (entities) {
            if(!entities || entities.length === 0) {
                throw new Error("entities not found");
            }
            recObj[entityKey] = entities;
            return recObj;
        });
    return nP;
}
function loadDatapoints(recObj) {
    return loadEntities(recObj, "datapoints", "datapointsFile");
}
function loadNodes(nwObj) {
    return loadEntities(nwObj, "nodes", "nodesFile");
}
function loadLinks(nwObj) {
    return loadEntities(nwObj, "links", "linksFile");
}
// deletion funcs and helpers
function _removeData(entityId) {
    console.log("[DSModel._removeData] Removing data for Id: " + entityId);
    return Promise.fromNode(cb => gfs().remove({_id : entityId}, cb));
}
function _removeEntityById (entityId) {
    console.assert(entityId.toString().length > 1, `entity Id must be valid. Given: ${entityId}`);

    return DataMapping.find({ entityRef : entityId }).exec()
        .then(function(items) {
            if(!items) {
                throw new Error("Unable to find anything for entityId");
            }
            if(items.length === 0) {
                return _removeData(entityId);
            } else {
                return Promise.map(items, mapping => _removeData(mapping.fileDataRef));
            }
        });
}
// User needs to manually remove it from project and org
function removeDatasetById (datasetId) {
    console.assert(datasetId.length > 1, "Dataset Id must be valid");
    return readDatasetFromRecord(datasetId, true)
        .then(function (dsRec) {
            if(!dsRec) return _removeEntityById(datasetId);
            let removals = Promise.all([
                _removeData(dsRec.datapointsFile),
                _removeEntityById(dsRec.datapointsFile)]);
            return removals.then(() =>
                DatasetRecord.remove({"_id" : dsRec._id })
                    .exec()
                    .tap(function (res) {
                        console.log("[DSModel.removeDatasetById] deletion results:", res.result);
                    }
                    ));
        });
}
// User needs to manually remove it from project and org
function removeNetworkById (networkId) {
    console.assert(networkId.length > 1, "Network Id must be valid");
    return readNetworkFromRecord(networkId, true, true)
        .then(function (nwRec) {
            if(!nwRec) return _removeEntityById(networkId);
            let removals = Promise.all([
                _removeData(nwRec.nodesFile),
                _removeData(nwRec.linksFile),
                _removeEntityById(nwRec.nodesFile),
                _removeEntityById(nwRec.linksFile)]);
            return removals.then(() =>
                NetworkRecord.remove({"_id" : nwRec._id })
                    .exec()
                    .tap(function (res) {
                        console.log("[DSModel.removeNetworkById] deletion results:", res.result);
                    }
                    ));
        });
}
function cloneDataset (dataSetRef, projectId) {
    var logPrefix = "[DSModel.cloneDataset] ";
    var datasetP = readDataset(dataSetRef, false)
        .then(function(dataset) {
            console.log(logPrefix + "Fetched data. Starting to clone");

            var cloneDS = dataset;
            cloneDS.id = new ObjectID().toString();
            cloneDS.projectId = projectId;
            cloneDS.datapointsFile = null;
            cloneDS.createdAt = Date.now();
            cloneDS.modifiedAt = Date.now();

            return saveDataset(cloneDS);
        });
    datasetP.tap(function(dataset) { console.log(logPrefix + "Saved cloned data :", dataset.id); });
    return datasetP;
}
function cloneNetwork (networkId, datasetId, projectId) {
    var logPrefix = "[DSModel.cloneNetwork] ";
    var networkP = readNetwork(networkId)
        .then(function(network) {
            console.log(logPrefix + "Fetched data. Starting to clone");
            var cloneNW = network;
            cloneNW.id = new ObjectID().toString();
            cloneNW.datasetId = datasetId;
            cloneNW.projectId = projectId;
            cloneNW.createdAt = Date.now();
            cloneNW.modifiedAt = Date.now();
            cloneNW.nodesFile = null;
            cloneNW.linksFile = null;
            return saveNetwork(cloneNW);
        });
    networkP.tap(function(network) { console.log(logPrefix + "Saved cloned data :", network._id); });
    return networkP;
}

function genSubNetwork (parentNetworkId, nodeIds, linkIds, nodeColorMap, networkName) {
    var logPrefix = "[DSModel.genSubNetwork] ";
    var networkP = readNetwork(parentNetworkId)
        .then(function(network) {
            console.log(logPrefix + "Fetched Parent network. Starting to filter out data");
            var subNw = network;
            subNw.id = new ObjectID();
            subNw.name = networkName || subNw.name;
            subNw.clusterInfo = {};
            subNw.createdAt = Date.now();
            subNw.modifiedAt = Date.now();

            subNw.nodes = _.filter(network.nodes, function(n) { return _.contains(nodeIds, n.id); });
            subNw.links = _.filter(network.links, function(l) { return _.contains(linkIds, l.id); });
            subNw.nodesFile = null;
            subNw.linksFile = null;
            console.log(logPrefix + "Generating network with " + subNw.nodes.length + "nodes and " + subNw.links.length + 'links');

            var nwInfo = subNw.generatorInfo['subGraph'] = {};
            nwInfo.parentNWId = parentNetworkId;
            if(_.size(nodeColorMap) > 0) { // create the baseColor attribute
                Network.prototype.addNodeAttrDescr.call(subNw, "ParentNetworkColor", "ParentNetworkColor", "color", "Parent_Color", null, {}, false);
                _.each(subNw.nodes, function(n) {
                    n.attr["ParentNetworkColor"] = nodeColorMap[n.id] || "#c8c8c8";
                });

            }
            return saveNetwork(subNw);
        });
    networkP.tap(function(network) { console.log(logPrefix + "Saved subgraph data :", network._id); });
    return networkP;
}

function colorStr (colorObj) {
    var _color= null;
    if(colorObj == null) return defColor();
    if(_.isArray(colorObj) && colorObj.length ===3) {
        _color = onecolor("rgb(" + colorObj[0] + ',' + colorObj[1] + ',' + colorObj[2] + ')');
    } else if(_.isObject(colorObj)) {
        _color = onecolor('rgb(' + colorObj.r + ',' + colorObj.g + ',' + colorObj.b + ')');
    } else if(_.isString(colorObj)) {
        _color = onecolor(colorObj);
    } else {
        throw new Error("colorObj is not defined");
    }
    return _color.hex();
}


module.exports = {
    // constructors
    DataPoint : DataPoint,
    Node : Node,
    Link : Link,
    AttrDescriptor : AttrDescriptor,
    Dataset : Dataset,
    Network : Network,

    // functions
    createDataset : createDataset,
    createNetwork : createNetwork,
    createDatasetFromGraph : createDatasetFromGraph,
    createDefaultNetwork : createDefaultNetwork,
    createNewNetwork_fromDataset: createNewNetwork_fromDataset,
    createEmptyNetwork : createEmptyNetwork,
    cloneNetwork: cloneNetwork,
    saveDataset : saveDataset,
    updateDataset : updateDataset,
    updateNetwork : updateNetwork,
    saveNetwork : saveNetwork,
    readDataset : readDataset,
    readNetwork : readNetwork,

    loadDatapoints : loadDatapoints,
    loadNodes : loadNodes,
    loadLinks : loadLinks,

    removeDatasetById : removeDatasetById,
    removeNetworkById : removeNetworkById,
    cloneDataset : cloneDataset,
    genSubNetwork : genSubNetwork,
    getAttrProps: getAttrProps,
    getDefaultRenderTypeForAttrType : getDefaultRenderTypeForAttrType
};
