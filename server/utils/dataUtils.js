'use strict';
var _ = require('lodash');
var fs = require('fs');
var assert = require("assert");
var color = require('onecolor'); // color guessing
var moment = require('moment');
var Promise = require("bluebird");

var DSModel = require("../datasys/datasys_model.js");


//regexp to check if there is '(c)' as part of the title key
//this is used to set the visibility of that attributes
var expHasCInParens = new RegExp("([(])(c|C)([)])");
var expHasVInParens = new RegExp("([(])(v|V)([)])"); //video attribute - change attrType to video
var expHasPInParens = new RegExp("([(])(p|P)([)])"); //picture attribute - change attrType to picture
var expStartsWithHash = new RegExp("#(\w*[A-Za-z_]+\w*)"); //word starts with a # - used for ignoring out comment fields while parsing excel sheet

var liststring_splitter = /\s*\|\s*/;

// NOTE: Some of these constants have been copied into AttrModifierService. Make sure to update that as well
// common attr types
var stringTypes = ['string', 'picture','profile','video','audio_stream','media_link','video_stream','html','url','twitter', 'json'];
// var numericType = ['integer', 'float'];

// common attr values
var booleanValues = ["true", "y", "yes", "t", "on", "false", "n", "no", "f", "off"]; // anything <= 4 is true.  Update valueParser if modified
var values_to_ignore = ['', '-', '--', "na", "n/a", "-na-", ".", "..", "..."];

// common attr keys
// var commonFloatKeys = ["posx", "posy", "size" , "originalx", "originaly", "originalsize"];
// var commonStringKeys = ["name", "address"];

var originals = ["OriginalLabel", "OriginalSize", "OriginalX", "OriginalY", "OriginalColor"];
// a list of attrs to use for labels when no label is found, in descending order of priority.
// if nothing matches, then 1st col will be used
// All lowercase.
var attrForLabels = ['name', 'email', 'text', 'merchant', 'brand', 'id'];

// special keys. these attrIds are deleted and replaced by the placeholder.
var splKeys = [{
    alter : ["id", "nid", "node_id", "nodeid", "edge_id",  "edgeid", "link_id", "linkid"],
    placeholder : "id",
    valType: "string"
},{
    alter : ["datapointid", "parentid"],
    placeholder : "dataPointId",
    valType: "string"
},{
    alter : ["label", "originallabel", "datapointlabel"],
    placeholder : "label",
    valType: "string"
},{
    alter : ["source", "sourceid", "source_id", "from", "fromid", "from_id"],
    placeholder : "source",
    valType: "string"
},{
    alter : ["target", "targetid", "target_id", "to", "toid", "to_id"],
    placeholder : "target",
    valType: "string"
},{
    alter : ["color", "col", "originalcolor", "datapointcolor"],
    placeholder : "color",
    valType: "color"
},{
    alter : ['posx', 'pos_x', 'positionx', 'position_x', 'originalx','x'],
    placeholder : "x",
    valType: "float"
},{
    alter : ['posy', 'pos_y', 'positiony', 'position_y', 'originaly','y'],
    placeholder : "y",
    valType: "float"
},{
    alter : ["size", "originalsize"],
    placeholder : "size",
    valType: "float"
}];
_.each(splKeys, function(key) {
    key.placeholderLowerCase = key.placeholder.toLowerCase();
});

var reserved_nw_attr_names = [
    'InterclusterFraction', 'ClusterDiversity', 'ClusterBridging', 'ClusterArchetype', 'componentId', 'triangles', 'degree', 'clusterCoeff',
    'Cluster', 'Cluster1', 'Cluster2', 'Cluster3', 'Cluster4',
    'centrality_Cluster1', 'centrality_Cluster2', 'centrality_Cluster3', 'centrality_Cluster4',
    'diversity_Cluster1', 'diversity_Cluster2', 'diversity_Cluster3', 'diversity_Cluster4',
    'fracIntergroup_Cluster1', 'fracIntergroup_Cluster2', 'fracIntergroup_Cluster3', 'fracIntergroup_Cluster4',
    'bridging_Cluster1', 'bridging_Cluster2', 'bridging_Cluster3', 'bridging_Cluster4'
];
/**
 * Get the function in Datautils which can parse the given file.
 * @param  {[string]} filePathOrName
 * @return {[function]} Function which can parse the file.
 */
function getFileParser(filePathOrName) {
    //extract file-extension
    var nameArr = filePathOrName.split('.');
    var ext = (nameArr[nameArr.length-1]).toUpperCase();

    //build parse func name;
    var parseFn;

    switch (ext) {
    case 'CSV' :
        parseFn = 'parseCSVToGraph';
        break;
    case 'XLSX':
        parseFn = 'parseExcelToGraph';
        break;
    case 'XLS':
        // parseFn = 'parseXLSToGraph';
        parseFn = "parseExcelToGraph";
        break;
    case 'GEXF':
    case 'QJSON':
        parseFn = 'parse' + ext + 'ToGraph';
        break;
    default:
        //no donuts
    }
    return module.exports[parseFn];
}


function parseGEXFToGraph (gexfFilePath) {
    var readFile = Promise.promisify(fs.readFile);

    return readFile(gexfFilePath, { encoding : "UTF-8"})
    .then(dataFile => {
        // var gexf_dom = new DOMParser().parseFromString(dataFile, "application/xml");
        var graph = gexf.parse(dataFile);
        var sourceInfo = {
            file : {
                version : graph.version
            }
        };
        _.assign(sourceInfo.file, graph.meta);

        // Parse attr Descriptors
        var dpAttrDescriptors = _.map(graph.model.node, _attr_parser);
        var linkAttrDescriptors = _.map(graph.model.edge, _attr_parser);


        // add datapointLabelAttr as well
        dpAttrDescriptors.push(new DSModel.AttrDescriptor("DataPointLabel", "DataPointLabel", "string", "file"));
        dpAttrDescriptors.push(new DSModel.AttrDescriptor("DataPointColor", "DataPointColor", "string", "file"));

        var datapoints = [], nodes = [];
        // process nodes / datapoints
        _.each(graph.nodes, function process_gexf_nodes (gexf_node) {
            var ds_attr = _.clone(gexf_node.attributes);
            var col = _getColor(gexf_node.viz.color);

            ds_attr["DataPointLabel"] = gexf_node.label;
            if(col) ds_attr["DataPointColor"] = col.hex();

            var datapoint =new DSModel.DataPoint(gexf_node.id, ds_attr);
            datapoints.push(datapoint);


            var node_attr = {};

            if(col) node_attr["OriginalColor"] = col.hex();
            node_attr["OriginalLabel"] = gexf_node.label;
            node_attr["OriginalSize"] = gexf_node.viz.size;
            node_attr["OriginalX"] = gexf_node.viz.position.x;
            node_attr["OriginalY"] = gexf_node.viz.position.y;

            var node = new DSModel.Node(gexf_node.id, gexf_node.id, node_attr);
            nodes.push(node);
        });

        var links = _.map(graph.edges, function process_gexf_edges (gexf_edge, index) {
            var attr = _.clone(gexf_edge.attributes);
            var col = _getColor(gexf_edge.viz.color);

            attr["OriginalLabel"] = gexf_edge.label;
            attr["OriginalSize"] = gexf_edge.weight;
            if(col) attr["OriginalColor"] = col.hex();
            var id = gexf_edge.id != null ? id : index;
            return new DSModel.Link(id, gexf_edge.source, gexf_edge.target, gexf_edge.type == "directed", attr);
        });

        return {
            dataset : {
                sourceInfo : sourceInfo,
                datapoints : datapoints,
                attrDescriptors : dpAttrDescriptors
            },
            networks : [{
                name : "default",
                nodes : nodes,
                links : links,
                nodeAttrDescriptors : [], // nothing new here
                linkAttrDescriptors : linkAttrDescriptors
            }]
        };
    })
    .catch(err => {
        throw err;
    });
}

function parseCSVToGraph (filePath) {
    var logPrefix = "[parseCSVToGraph] ";
    return collectRows(filePath)
    .then(function(lines) {
        console.log("Read lines: ", lines.length);

        var datapoint_sheet = _gen_sheet_js_csv(lines);

        var datapoints = _.map(datapoint_sheet.entities, function  (entity, index) {
            var attr = _.clone(entity);
            var id = attr.id;
            if(attr.label) {
                attr.DataPointLabel = attr.label;
            }
            if(attr.color) {
                attr.DataPointColor = attr.color;
            }
            _.each(splKeys, function(spl) {
                delete attr[spl.placeholder];
            });
            return new DSModel.DataPoint(id, attr);
        });
        var datapointAttrs = datapoint_sheet.attrs;
        if(datapoint_sheet.attrCounts.label > 0)
            datapointAttrs.push(new DSModel.AttrDescriptor("DataPointLabel", "DataPointLabel", "string", "file"));
        if(datapoint_sheet.attrCounts.color > 0)
            datapointAttrs.push(new DSModel.AttrDescriptor("DataPointColor", "DataPointColor", "string", "file"));

        //final dataset object
        var dataset = {
            "sourceInfo" : {
                properlyParsed : true
            },
            "datapoints" : datapoints,
            "attrDescriptors" : datapointAttrs
        };
        console.log(logPrefix+ "Parsed DataPoint Counts :", datapoints.length);
        console.log(logPrefix+ "A datapoint: ", datapoints[0]);

        var removedReservedAttrs = [];
        if(_hasReservedAttrs(dataset.attrDescriptors)) {
            // no network, still reserved NW attrs found; delete them.
            removedReservedAttrs =  _removeReservedAttrs(dataset);
        }

        return {
            dataset : dataset,
            networks : [],
            removedReservedAttrs: removedReservedAttrs
        };
    })
    .catch(err => {
        throw err;
    });
}
function collectRows (filePath) {
    var lines = [];
    console.log("filePath: ", filePath);
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', line => lines.push(line))
            .on('end', () => {
                return resolve(lines);
            })
            .on('error', err => {
                return reject(new Error('Error while collecting rows'));
            });
    });
}

function parseExcelToGraph (filePath) {
    var logPrefix = "[parseExcelToGraph] ";
    var workbook = xlsx.readFile(filePath);

    var sheet_name_list = workbook.SheetNames;

    return new Promise((resolve, reject) => {
        if(sheet_name_list.length === 0)
            throw new Error("No sheets in the workbook");
        if(sheet_name_list.length > 2 && sheet_name_list.length % 2 === 1) {
            console.warn("Uneven num of sheets!", sheet_name_list.length);
            sheet_name_list = sheet_name_list.slice(0,-1);
        }

        var sheet_entities_js = _.map(sheet_name_list, _.partial(_gen_sheet_js_excel, workbook));
        console.log(logPrefix + "Num of sheets Parsed :", sheet_entities_js.length);

        // Trim empty sheets from right
        var sheetCount = sheet_entities_js.length;
        while(sheetCount > 0) {
            if(isSheetEmpty(sheet_entities_js[sheetCount-1])) {
                sheet_entities_js.splice(sheetCount-1, 1);
            }
            else {
                break;
            }
            sheetCount--;
        }

        if(isSheetEmpty(sheet_entities_js[0])) {
            throw new Error("No dataset or network found");
        }

        if(sheet_entities_js.length === 2) {
            if(isSheetEmpty(sheet_entities_js[1])) {
                sheet_entities_js.splice(1,1);
            }
        }
        _.each(sheet_entities_js, function(sheet, index) {
            console.log(logPrefix + "Sheet " +  index  + " has");
            console.log(logPrefix+ "Entity count: ", sheet.entities.length);
            console.log(logPrefix+ "AttrCount :", sheet.attrs.length);
        });
        // 3 cases
        // only nodes are loaded
        // nodes + edges are loaded
        // (nodes/edges)*n num of sheets

        // in any case, 1st sheet is datapoints(global nodes)
        var datapoint_sheet =  sheet_entities_js[0];

        var datapoints = _.map(datapoint_sheet.entities, function  (entity, index) {
            var attr = _.clone(entity);
            var id = attr.id;
            if(attr.label) {
                attr.DataPointLabel = attr.label;
            }
            if(attr.color) {
                attr.DataPointColor = attr.color;
            }
            _.each(splKeys, function(spl) {
                delete attr[spl.placeholder];
            });
            return new DSModel.DataPoint(id, attr);
        });
        var datapointAttrs = datapoint_sheet.attrs;
        if(datapoint_sheet.attrCounts.label > 0)
            datapointAttrs.push(new DSModel.AttrDescriptor("DataPointLabel", "DataPointLabel", "string", "file"));
        if(datapoint_sheet.attrCounts.color > 0)
            datapointAttrs.push(new DSModel.AttrDescriptor("DataPointColor", "DataPointColor", "string", "file"));

        //final dataset object
        var dataset = {
            "sourceInfo" : {
                properlyParsed : true
            }, // TODO: extra meta from excel file
            "datapoints" : datapoints,
            "attrDescriptors" : datapointAttrs
        };
        console.log(logPrefix+ "Parsed DataPoint Counts :", datapoints.length);
        console.log(logPrefix+ "A datapoint: ", datapoints[0]);


        var dpIndex = _.indexBy(datapoints,"id");
        var networkObjs = []; // list of all networks found
        var node_sheets = [], link_sheets = [];
        var extract_nodes_from_datapoints = true; // are nodes extracted from datapoints?

        if(sheet_entities_js.length > 2) {
            var network_sheets_js = sheet_entities_js.slice(1);
            _.each(network_sheets_js, function (entity_sheet, index) {
                if(index % 2 === 0) {
                    if(!isSheetEmpty(entity_sheet) && !isSheetEmpty(network_sheets_js[index+1])) {
                        node_sheets.push(entity_sheet);
                        link_sheets.push(network_sheets_js[index+1]);
                    }
                }
            });
            assert(node_sheets.length === link_sheets.length, "num of node + edge sheets should be equal");
            extract_nodes_from_datapoints = false;
        }
        else {
            !isSheetEmpty(sheet_entities_js[0]) && node_sheets.push(sheet_entities_js[0]); // 1st sheet is node
            !isSheetEmpty(sheet_entities_js[1]) && link_sheets.push(sheet_entities_js[1]); // 2nd sheet is links
        }

        // process nodes and links to generate network
        _.times(node_sheets.length, function (index) {
            var n_sheet = node_sheets[index],
                l_sheet = link_sheets.length > index ? link_sheets[index] : undefined;

            var nodes = null, links = null;
            console.log(logPrefix + "Parsing node for network :" + index);
            // process nodes
            nodes = _.map(n_sheet.entities, function (entity, index) {
                var attr = _.clone(entity);
                var id = attr.id,
                    dataPointId = attr.dataPointId;
                if(attr.label)  attr.OriginalLabel = attr.label;
                if(attr.size)   attr.OriginalSize = attr.size;
                if(attr.x)   attr.OriginalX = attr.x;
                if(attr.y)   attr.OriginalY = attr.y;
                if(attr.color)  attr.OriginalColor = entity.color;

                if(dataPointId == null) {
                    dataPointId = id;
                }
                if(!dpIndex[dataPointId]) {
                    console.log(attr);
                }
                assert(dpIndex[dataPointId], "datapoint should exist: " + dataPointId);

                _.each(splKeys, function(spl) {
                    delete attr[spl.placeholder];
                });
                if(extract_nodes_from_datapoints) { // remove all other attrs
                    _.forOwn(attr, function(val, key) {
                        if(!_.contains(originals, key)) {
                            delete attr[key];
                        }
                    });
                }
                return new DSModel.Node(id, dataPointId, attr);
            });
            console.log(logPrefix + "Num of nodes parsed: " + nodes.length);
            console.log(logPrefix + "Sample Node: ", nodes[0]);

            var nodeIdx = _.indexBy(nodes, "id");
            if(l_sheet) {
                console.log(logPrefix + "Parsing links for network :" + index);
                links = _.compact(_.map(l_sheet.entities, function (entity, index) {
                    var attr = _.clone(entity);
                    var id = attr.id,
                        source = attr.source,
                        target = attr.target;
                    if(attr.label)  attr.OriginalLabel = attr.label;
                    if(attr.size)   attr.OriginalSize = attr.size;
                    if(attr.color)  attr.OriginalColor = entity.color;

                    // assert(nodeIdx[source], "source node should exist");
                    // assert(nodeIdx[target], "target node should exist");

                    var nodeExists = true;
                    if(!nodeIdx[source]) {
                        console.log('node id:', source, ' does not exist as source. skipping link');
                        nodeExists = false;
                    } else if(!nodeIdx[target]) {
                        console.log('node id:', target, ' does not exist as target. skipping link');
                        nodeExists = false;
                    }
                    _.each(splKeys, function(spl) {
                        delete attr[spl.placeholder];
                    });
                    if(nodeExists) return new DSModel.Link(id, source, target, false, attr);
                    else return false;
                }));
                console.log(logPrefix + "Num of links parsed: " + links.length);
                console.log(logPrefix + "Sample Link: ", links[0]);
            }
            if(!n_sheet.positionDataExists) {
                console.log(logPrefix + "POSITION DATA randomized for network nodes");
            }
            networkObjs.push({
                name : n_sheet.name,
                networkInfo : {
                    properlyParsed : true,
                    positionRandomized : !n_sheet.positionDataExists
                },
                nodes : nodes,
                links : l_sheet ? links : [],
                nodeAttrDescriptors : extract_nodes_from_datapoints ? [] : n_sheet.attrs,
                linkAttrDescriptors : l_sheet ? l_sheet.attrs : []
            });
        });

        var removedReservedAttrs = [];
        if(_hasReservedAttrs(dataset.attrDescriptors)) {
            if(networkObjs.length > 0) {
                // move network attrs from DS to NW
                _moveReservedNwAttrsToNw(dataset, networkObjs[0]);
            }
            else {
                // no network, still reserved NW attrs found; delete them.
                removedReservedAttrs =  _removeReservedAttrs(dataset);
            }
        }

        resolve({
            dataset : dataset,
            networks : networkObjs,
            removedReservedAttrs: removedReservedAttrs
        });
    })
    .catch(function(err) {
        console.error(logPrefix, err);
        // throw new Error('Unable to parse excel file');
        throw err;
    });
}

function _removeReservedAttrs(dataset) {
    // var logPrefix = '[_removeReservedAttrs: ] ';
    var splitDsAttrs = _.partition(dataset.attrDescriptors, function(attrDescr) {
        return reserved_nw_attr_names.indexOf(attrDescr.id) < 0;
    });
    dataset.attrDescriptors = splitDsAttrs[0];
    _.each(splitDsAttrs[1], function(attr) {
        // console.log(logPrefix + 'removing attr: ' + attr.id + ' from dataset');
        _.each(dataset.datapoints, function(dp) {
            if(dp.attr[attr.id] != null) {
                delete dp.attr[attr.id];
            }
        });
    });
    return _.map(splitDsAttrs[1], 'id');
}

function _hasReservedAttrs(attrDescriptors) {
    return _.any(attrDescriptors, function(attrDescr) {
        return reserved_nw_attr_names.indexOf(attrDescr.id) > -1;
    });
}

function _moveReservedNwAttrsToNw(dataset, network) {
    var logPrefix = '[_moveReservedNwAttrsToNw: ] ';
    var splitDsAttrs = _.partition(dataset.attrDescriptors, function(attrDescr) {
        return reserved_nw_attr_names.indexOf(attrDescr.id) < 0;
    });

    if(splitDsAttrs[1].length < 1) {
        console.log(logPrefix + 'no reserved network attribs found!');
        return;
    }
    dataset.attrDescriptors = splitDsAttrs[0];
    network.nodeAttrDescriptors = network.nodeAttrDescriptors.concat(splitDsAttrs[1]);

    // move network attr vals from datapoints to network nodes
    _.each(splitDsAttrs[1], function(attr) {
        _.each(dataset.datapoints, function(dp) {
            if(dp.attr[attr.id] != null) {
                var nwNode = _.find(network.nodes, 'dataPointId', dp.id);
                nwNode.attr[attr.id] = dp.attr[attr.id];
                delete dp.attr[attr.id];
            }
        });
    });
}

function isSheetEmpty(jsSheet) {
    return !(jsSheet && !_.isEmpty(jsSheet.entities));
}

function hasListLikeVal(val) {
    if(_.isString(val)) {
        //make sure string isn't json TODO: check for json attrType
        try {
            JSON.parse(val);
            return false;
        } catch(e) {
            return ((val.length > 0 && val[0] == '[' && val[val.length-1] == ']') || val.indexOf('|') != -1)
        }
    } else return _.isArray(val);
}
// attribute is likely a list of strings if a large enough number of values look like lists of strings
function testIsListString(attrVals, attrId) {
    var nPipe = _.filter(attrVals, function(attrVal) { return hasListLikeVal(attrVal[attrId]); }).length;
    return nPipe > Math.max(1, attrVals.length/20);
}
//////
/// Network Sanitization code. because no one knows what athena spits out
///

function ensureStringData(attrId, entities) {
    var haveChangedData = false;
    _.each(entities, function(entity) {
        var val = entity.attr[attrId];
        if( val != null && !_.isString(val)) {
            entity.attr[attrId] = '' + val;
            haveChangedData = true;
        }
    });
    return haveChangedData;
}
function testEntityAttrIsListString(entities, attrId) {
    var nPipe = _.filter(entities, function(ent) { return hasListLikeVal(ent.attr[attrId]); }).length;
    return nPipe > Math.max(1, entities.length/20);
}

// cleans up the network
function sanitizeNetwork (network) {
    // var logPrefix = "[sanitizeNetwork] ";
    var attrIdx = [_.indexBy(network.nodeAttrDescriptors, "id"), _.indexBy(network.linkAttrDescriptors, "id")],
        attrCounts = [{},{}],
        attrArrays = [network.nodeAttrDescriptors, network.linkAttrDescriptors];

    // check if the type being broadcasted is invalid or not
    _.each(network.nodeAttrDescriptors, _.partial(validateAttrTypeDesc, network.nodes));
    _.each(network.linkeAttrDescriptors, _.partial(validateAttrTypeDesc, network.links));

    // sanitize entities
    _.each([network.nodes, network.links], function(entity_list, index) {
        // index 0 is nodes, index 1 is edges
        // apply the correct type to entities and collect counts
        var entityAttrIdx = attrIdx[index],
            entityAttrCounts = attrCounts[index];
        _.each(entity_list, function applyTypesToEntities(entity) {
            _.forOwn(entity.attr, function(val, attrId) {
                var refinedVal = valueParser(entityAttrIdx[attrId].attrType, val);
                if(refinedVal == null) {
                    console.error("Refined value can't be null : ",attrId , val, entityAttrIdx[attrId].attrType);
                    if(entityAttrIdx[attrId].attrType == 'color') {
                        refinedVal = "#c8c8c8";
                    }
                }
                assert(refinedVal != null, "Refined value can't be null : " +  attrId + ' : ' + val + ' : ' + entityAttrIdx[attrId].attrType);
                entity.attr[attrId] = refinedVal;
                entityAttrCounts[attrId] = entityAttrCounts[attrId] ? entityAttrCounts[attrId] + 1 : 1;
            });
        });

        attrArrays[index] = _.filter(entityAttrIdx, function(val, attrId) { return entityAttrCounts[attrId] > 0; });
    });
    network.nodeAttrDescriptors = attrArrays[0];
    if(network.links.length > 0)
        network.linkAttrDescriptors = attrArrays[1];
    _.assign(network.networkInfo, { properlyParsed : true });

    function validateAttrTypeDesc(entities, attrDesc) {
        if(stringTypes.indexOf(attrDesc.attrType) > 0) {
            ensureStringData(attrDesc.id, entities);
        }
        else if(attrDesc.attrType === 'liststring') { // ensure liststring, otherwise move to strings
            var majorlyListString = testEntityAttrIsListString(entities, attrDesc.id);
            if(!majorlyListString) { attrDesc.attrType = 'string'; }
        } else if(attrDesc.attrType === 'integer') {
            var isIntegral = _.all(entities, function(ent) {
                var val = ent.attr[attrDesc.id];
                return val != null ? +val %1 === 0 : true;
            });
            if(!isIntegral) {
                attrDesc.attrType = 'float';
            }
        }
    }
    return network;
}

function _get_ordered_attr_list(sheet) {
    var val, r, R, C;
    var result = [];

    if(!sheet || !sheet["!ref"]) return result;
    r = xls.utils.decode_range(sheet["!ref"]);
    console.log('----------', r);
    for(R=r.s.r, C = r.s.c; C <= r.e.c; ++C) {
        val = sheet[xls.utils.encode_cell({c: C, r:R})];
        if(!val) continue;
        result.push(val.v); //push formated cell value a.k.a column name
    }
    return _.unique(result);
}

function _replace_attrid_in_list(list, newVal, oldVal) {
    var idx = list.indexOf(oldVal);
    if(idx > -1) {
        list[idx] = newVal;
    }
    else {
        // console.warn('Old val not found in list ', list, oldVal, newVal);
    }
}

function _gen_sheet_js_csv (lines) {
    var entities =  lines;
    var ordered_attr_ids_lowercase = _.keys(entities[0]);
    return _gen_sheet_js(entities, ordered_attr_ids_lowercase.map(sanitizeAttrId));
}

function _gen_sheet_js_excel (workbook, name) {
    var entities =  xls.utils.sheet_to_json(workbook.Sheets[name], { raw : true });
    var ordered_attr_ids_lowercase = _.map(_get_ordered_attr_list(workbook.Sheets[name]), function(attrId) {
        return sanitizeAttrId(attrId.toLowerCase());
    });
    return _gen_sheet_js(entities, ordered_attr_ids_lowercase);
}

function _gen_sheet_js(entities, ordered_attr_ids_lowercase) {
    console.time("_gen_sheet_js");
    var logPrefix = "[_gen_sheet_js] ";
    console.log(logPrefix + 'Ordered attr ids: ', ordered_attr_ids_lowercase);
    // build attrs and sanitize entities
    var attrIdx = {}, // attrId -> attrDescriptor
        attrCounts = {}, /// attrId -> counts
        attrUniqueCountIdx = {}, // attrId -> unique counts
        attrTypeGuess = {}, // attrId -> guessedType
        num_entities = entities.length;

    // optimizing variables
    var maxSizeOfIgnoredValues = _.max(_.map(values_to_ignore, 'length'));
    var splKeysCache = _.reduce(splKeys, function(acc, spl) {
        _.each(spl.alter, function(alter) {
            acc[alter] = spl;
        });
        return acc;
    }, {});

    // sanitize attr Names and Ids, delete silly ones
    console.log(logPrefix + 'Sanitizing ' + num_entities + ' entities...');
    console.time('Sanitizing entities');
    _.each(entities, function sanitizeAttrs(entity) {
        _.forOwn(entity, function(attrVal, attrId) {
            //console.log(logPrefix, attrId, attrId.length, '-->', attrVal);
            if(attrId.length === 0) {
                delete entity[attrId];
                return;
            }
            // unorm is super slow and super heavy. need to bypass it as much as we can
            var val = _.isString(attrVal)  ? getNormalizedString(attrVal.trim()) : attrVal;
            var new_attr_id = sanitizeAttrId(attrId);
            var attrId_lower = new_attr_id.toLowerCase();
            var old_sanitized_attr_id = attrId_lower;

            // if sanitization yields a different key, then use it
            if(new_attr_id != attrId) {
                delete entity[attrId];
                entity[new_attr_id] = val;
            }

             // delete value if it can be ignored
            if(val == null || ( _.isString(val) && val.length <= maxSizeOfIgnoredValues && _.contains(values_to_ignore, val))) {
                delete entity[new_attr_id];
                return;
            }
            var replace_by = splKeysCache[attrId_lower];
            if (replace_by) {
                delete entity[new_attr_id];
                entity[replace_by.placeholder] = val;
                new_attr_id = replace_by.placeholder;
                attrTypeGuess[new_attr_id] = replace_by.valType;
            }
            _replace_attrid_in_list(ordered_attr_ids_lowercase, new_attr_id.toLowerCase(), old_sanitized_attr_id);
            attrCounts[new_attr_id] = attrCounts[new_attr_id] ? attrCounts[new_attr_id] + 1 : 1;
        });
    });

    // _.each(entities, function printStats(entity) {
    //     console.log(entity);
    // });

    console.timeEnd('Sanitizing entities');
    console.log(logPrefix + 'Guessing types for attributes...');
    // guess types
    _.each(entities, function guessAttrTypes(entity) {
        _.forOwn(entity, function(val, attrId) {
            var typeGuess = attrTypeGuess[attrId];
            if(!typeGuess) { typeGuess = attrTypeGuess[attrId] = ['integer', 'float', 'color', 'boolean']; } // initial guess
            if(_.isString(typeGuess) || (_.isArray(typeGuess) && typeGuess.length === 0)) return; // type has already been guessed correctly
            typeGuess = attrTypeGuess[attrId] = reducingTypeGuesser(typeGuess, val);
        });
    });
    // attrTypeGuess[attrId] now contains all possible guesses for the attrId. Now we get 3 cases
    // 1) empty list -> string type / liststring since all are strings by default
    // 2) single elem -> that is the type
    // 3) more than 1 -> multiple guesses, take the most general one. or frankly, just set it as string/float
    console.log(logPrefix + 'Finalizing types for attributes...');
    _.forOwn(attrTypeGuess, function finalizeTypes(typeGuess, attrId) {
        if(_.isArray(typeGuess)) {
            if(typeGuess.length == 1) attrTypeGuess[attrId] = typeGuess[0];
            else if(typeGuess.length !== 0 && _.contains(typeGuess, 'boolean')) attrTypeGuess[attrId] = "boolean";
            else if(typeGuess.length !== 0 && _.contains(typeGuess, 'integer')) attrTypeGuess[attrId] = "integer";
            else if(typeGuess.length !== 0 && _.contains(typeGuess, 'float')) attrTypeGuess[attrId] = "float";
            else {
                attrTypeGuess[attrId] = "string_type";
                if(expHasVInParens.exec(attrId)) {
                    attrTypeGuess[attrId] = "video";
                } else if(expHasPInParens.exec(attrId)) {
                    attrTypeGuess[attrId] = "picture";
                } else {
                    attrTypeGuess[attrId] = testIsListString(entities, attrId) ? 'liststring' : 'string';
                }
            }
        } else {
            attrTypeGuess[attrId] = attrTypeGuess[attrId] || 'string';
        }
    });
    // apply the correct type to entities
    console.log(logPrefix + 'Correcting types for entities...');
    console.time('Correcting types for entities');
    _.each(entities, function applyTypesToEntities(entity) {
        _.forOwn(entity, function(val, attrId) {
            var refinedVal = valueParser(attrTypeGuess[attrId], val);
            if(refinedVal == null) {
                console.error("Refined value can't be null : ",attrId ,attrTypeGuess[attrId] , val, typeof val);
                if(attrTypeGuess[attrId] == 'color') {
                    refinedVal = "#c8c8c8";
                }
            }
            assert(refinedVal != null, "Refined value can't be null : " +  attrId + ' : ' + val);
            entity[attrId] = refinedVal;
        });
    });
    console.timeEnd('Correcting types for entities');
    console.log(logPrefix + 'Building attr Descriptors...');
    // build attr Descriptors for non spl attr Ids
    _.forOwn(attrTypeGuess, function buildAttrDesc(attrType, attrId) {
        if(!_.any(splKeys, 'placeholder', attrId)) {
            attrIdx[attrId] = new DSModel.AttrDescriptor(attrId, attrId, attrType, "file");
        }
    });

    ordered_attr_ids_lowercase = _.filter(ordered_attr_ids_lowercase, function(id) {
        return !_.any(splKeys, 'placeholderLowerCase', id);
    });

    // load counts

    var sortedAttrs = _sort_attr_descriptors(ordered_attr_ids_lowercase, attrIdx);
    _.each(sortedAttrs, attr => {
        attrUniqueCountIdx[attr.id] = _.unique(_.map(entities, attr.id)).length;
    });

    //
    //  additional processing for attrs. best place to intelligently guess id,color,label
    // Index checker
    if(attrCounts["id"]) {
        attrUniqueCountIdx["id"] = _.unique(_.map(entities, "id")).length;
    }
    if(!attrCounts["id"] || attrUniqueCountIdx["id"] !== entities.length) {
        console.log('no id field found, autgen ids.');
        // no id field found, autgen ids. TODO: use name, email, fields if possible
        _.each(entities, function (entity, index) {
            entity.id = '' + (index + 1);
        });
        attrCounts["id"] = entities.length;
    }
    attrUniqueCountIdx["id"] = entities.length;

    assert(attrUniqueCountIdx["id"] === num_entities, "ids should be unique currCount:" + attrUniqueCountIdx["id"] + ' | num_entities found: ' + num_entities);

    var positionDataExists = _.any(entities, function(entity) {
        return entity['x'] != null && entity['y'] != null;
    });
    if(positionDataExists) {
        console.log(logPrefix + "POSITION DATA FOUND IN entities");
    }

    // smart guess labels
    // try for email / name
    // 1st column of the file

    if(!attrCounts.label && sortedAttrs.length > 0) {
        console.log(logPrefix + "No Label found. Generation labels");
        var countKeyMap = _.reduce(_.keys(attrCounts), (acc, key) => {
            acc[key.toLowerCase()] = key;
            return acc;
        }, {});

        // find the key
        var label_key_to_use = _.reduce(attrForLabels,
            (labelKey, candiate) => labelKey != null ? labelKey : countKeyMap[candiate] ? candiate : null,
            null),
            labelAttrId = null;
        if(label_key_to_use) {
            // get the actual attrId
            labelAttrId = countKeyMap[label_key_to_use];
            assert(attrCounts[labelAttrId] > 0, "key must exist");
            // if text field exists, take 1st 5 words + ...
            if(label_key_to_use == 'text') {
                _.each(entities, function(entity) {
                    if(entity[labelAttrId]) {
                        entity.label = _.trunc(entity[labelAttrId], 30);
                    } else entity.label = entity.id;
                });
            } else {
                _.each(entities, function(entity) {
                    if(entity[labelAttrId]) {
                        entity.label = '' + entity[labelAttrId];
                    } else entity.label = entity.id;
                });
            }
        } else {
            // 1st column of the file
            var fstAttrId = sortedAttrs[0].id;
            _.each(entities, function(entity) {
                if(entity[fstAttrId]) {
                    entity.label = '' + entity[fstAttrId];
                } else entity.label = entity.id;
            });
        }
        attrCounts.label = entities.length;
    } else {
        if(sortedAttrs.length === 0) {
            console.log("Labels already found or the attribute has no ids. Setting id as the label");
            _.each(entities, function(entity) {
                entity.label = '' + entity.id;
            });
        }
    }

    // Guess renderTypes
    _guess_render_types(sortedAttrs, attrUniqueCountIdx, attrCounts);

    console.log(logPrefix + 'Sheet processing done');
    console.timeEnd("_gen_sheet_js");
    return {
        entities : entities,
        attrs : sortedAttrs,
        attrCounts : attrCounts,
        positionDataExists : positionDataExists
    };
}

// overwrites renderTypes with better guesses in attr Descriptors
function _guess_render_types(attrDescriptors, attrUniqueCountIdx, attrCountsIdx) {
    var logPrefix = '[_guess_render_types: ] ';
    console.log(logPrefix + 'improving renderType guesses');
    _.each(attrDescriptors, attrDescr => {
        var uniqAttrCount = attrUniqueCountIdx[attrDescr.id],
            attrCount = attrCountsIdx[attrDescr.id];

        if(!uniqAttrCount || !attrCount) {
            console.warn(logPrefix + 'count or uniqCount not found for attr: ' + attrDescr.id);
            return;
        }

        switch(attrDescr.attrType) {
        case 'string':
            if(uniqAttrCount > (0.6 * attrCount)) {
                attrDescr.renderType = 'text';
            }
            break;
        }
    });
}

function _sort_attr_descriptors(ordered_attr_ids, attrIdx) {
    var logPrefix = '[_sort_attr_descriptors: ] ';
    var attrDescriptors = [];
    var attrIdx_lowercase = {};
    _.forOwn(attrIdx, function(attrDescr, id) {
        attrIdx_lowercase[id.toLowerCase()] = attrDescr;
    });

    if(ordered_attr_ids.length === 0 || _.union(ordered_attr_ids, _.keys(attrIdx_lowercase)).length !== ordered_attr_ids.length) {
        console.warn(logPrefix + 'attrs mismatch');
        console.log(logPrefix + 'ordered_attr_ids: ', ordered_attr_ids);
        console.log(logPrefix + 'attr list derived from index: ', _.pluck(_.values(attrIdx_lowercase), 'id'));
        return _.values(attrIdx);
    }
    console.log(logPrefix + 'ordered_attr_ids count: ' + ordered_attr_ids.length);
    console.log(logPrefix + 'derived atrrs from index count: ' + _.keys(attrIdx).length);

    _.each(ordered_attr_ids, function(attrId) {
        var attrDescr = attrIdx_lowercase[attrId];
        if(!attrDescr) {
            console.warn(logPrefix + 'attr descriptor not found in attr index');
        } else {
            attrDescriptors.push(attrDescr);
        }
    });
    return attrDescriptors;
}

/// Attr Parser. Used exclusively by GEXF
function _attr_parser (gexf_attr) {
    var attr = new DSModel.AttrDescriptor(gexf_attr.id, gexf_attr.id, gexf_attr.type, "file");
    if(attr.attrType === 'double') {
        attr.attrType = "float";
    }
    return attr;
}
// Generates sanitized ids. Idea is to remove quotes, spaces and other stuff
function sanitizeAttrId (attrId) {
    return attrId.replace(/\./g,' ').trim();
}

function _getColor (val) {
    var col =  color(val) || color("rgb(" + val + ")") || color("rgba(" + val + ')');
    return col ? col : undefined;
}
// for a given string, find out if it contains chars which have code gt 255
function charCodeGT255(val) {
    for(var i = 0; i < val.length; i ++) {
        if(val.charCodeAt(i) > 255) return true;
    }
    return false;
}
function getNormalizedString(val) {
    return charCodeGT255(val) ? unorm.nfkc(val.trim()) : val;
}

// returns a list of possible types, or a single type if it has guessed correctly
function reducingTypeGuesser(possible_types, val) {
    // check for all possible types, whether they are valid for the value
    var newTypes = _.filter(possible_types, function(type) {
        switch(type) {
        case "boolean"      : return _.isBoolean(val) || (_.isString(val) && _.contains(booleanValues, val.toLowerCase()));
        case "float"        : return !isNaN(+val);
        case "integer"      : return +val %1 === 0;
        case "color"        : return  _.isString(val) && _getColor(val);
        }
    });
    return newTypes;
}

// tries to lift the value to the targetType, returns null if not possible
function valueParser (targetType, val) {
    // parse weighted tag string
    function parseWtdTags(val) {
        try {
            return JSON.parse(val.replace(/\(/g, '[').replace(/\)/g, ']').replace(/\'/g, '"'));
        } catch(err) {
            return val;
        }
    }

    var updated_val = val;
    if     (targetType === "no_type")  updated_val = null;
    else if(_.contains(stringTypes,targetType)) {
        if(_.isArray(val)) {
            updated_val = val.join(' | ');
        } else {
            updated_val = getNormalizedString('' + val);
        }
    }
    else if(targetType === "liststring") {
        if(_.isArray(val)) updated_val = val;
        else if(_.isString(val)){
            if( val[0] == '[') {
                updated_val = parseWtdTags(val)
            } else {
                updated_val = _.map(_.filter(val.split(liststring_splitter), function(elem) { return elem.length > 0; }), getNormalizedString);
            }
        } else {
            updated_val = ['' + val];
        }
        updated_val = _.uniq(updated_val);
    }
    else {
        switch(targetType) {
        case "boolean":
            var lower_val = ('' + val).toLowerCase();
            if(_.contains(booleanValues, lower_val)) {
                updated_val = booleanValues.indexOf(lower_val) <= 4 ? true : false;
            } else updated_val = null;
            break;
        case "float":
            updated_val = isNaN(+val) ? null : +val;
            break;
        case "integer":
            updated_val = +val;
            updated_val = !isNaN(updated_val) && updated_val %1 === 0 ? updated_val : null;
            break;
        case "color" :
            var c = _getColor(val); // c is 'false' if parse fails
            updated_val = c ? c.hex() : null;
            break;
        default:
            updated_val = null;
        }
    }
    return updated_val;
}

//no guarantees - very specific - quid jsons
function parseQJSONToGraph(jsonFilePath) {
    var readFile = Promise.promisify(fs.readFile);

    return readFile(jsonFilePath, 'utf8')
    .then(dataFile => {
        var data = {
            graphType: null,
            nodeAttrs: [],
            edgeAttrs: [],
            nodes: [],
            edges: []
        };
        var key;

        console.log('jsonFilePath', jsonFilePath);
        //console.log('dataFile',dataFile);
        var dataArr = JSON.parse(dataFile);
        console.log('[parseQJSON]', dataArr);

        if (true || dataArr.length > 0) {

            console.log('[parseQJSON] crunching nodes');


            var nprop = dataArr.nodeSchema.properties;
            console.log('[parseQJSON] nodeschema', nprop);

            // node attrs from the nodeschema
            for (key in nprop) {
                if (nprop.hasOwnProperty(key)) {
                    switch (key.toLowerCase()) {
                    case 'id':
                    case 'origid':
                    case 'node_id':
                    case 'nodeid':
                    case 'nid':
                    case 'r':
                    case 'g':
                    case 'b':
                    case 'col':
                    case 'name':
                    case 'label':
                    case 'visible':
                    case 'x':
                    case 'posx':
                    case 'y':
                    case 'posy':
                    case 'size':
                        break;
                    default:
                        data.nodeAttrs.push({
                            title: nprop[key].title,
                            id: key,
                            generatorType: 'quid json',
                            generatorOptions: null,
                            visible: expHasCInParens.exec(key.toLowerCase()) ? false : true
                        });
                        console.log('[parseJSON] nodeAttrs - found: ', key);
                        break;
                    }
                }
            }

            console.log('[parseJSON] no of nodeAttrs', data.nodeAttrs.length);

            // nodes
            _.each(dataArr.nodeData, function(nd_raw) {
                var nd = {attr:[]};

                for (var prop in nd_raw) {
                    if (nd_raw.hasOwnProperty(prop)) {
                        switch (prop.toLowerCase()) {
                        case 'id':
                        case 'origid':
                        case 'node_id':
                        case 'nodeid':
                        case 'nid':
                            nd.id = nd_raw[prop].toString();
                            break;
                        case 'col':
                            //assume the excel sheets have color as "r,g,b"
                            var cl = nd_raw[prop].split(',');
                            nd.col = {
                                r: parseFloat(cl[0]),
                                g: parseFloat(cl[1]),
                                b: parseFloat(cl[2])
                            };
                            //console.log('-------color--------');
                            //console.log(nd_raw[prop.toLowerCase()]);
                            break;
                        case 'r':
                            (nd.col === 'undefined') ? nd.col = {r: nd_raw[prop]} : nd.col.r = nd_raw[prop];
                            break;
                        case 'g':
                            (nd.col === 'undefined') ? nd.col = {g: nd_raw[prop]} : nd.col.g = nd_raw[prop];
                            break;
                        case 'b':
                            (nd.col === 'undefined') ? nd.col = {b: nd_raw[prop]} : nd.col.b = nd_raw[prop];
                            break;
                        case 'name':
                        case 'label':
                            nd.label = nd_raw[prop];
                            break;
                        case 'visible':
                            nd.visible = !! nd_raw[prop];
                            break;
                        case 'x':
                        case 'posx':
                        case 'pos_x':
                        case 'positionx':
                        case 'position_x':
                            nd.posX = +nd_raw[prop];
                            break;
                        case 'y':
                        case 'posy':
                        case 'pos_y':
                        case 'positiony':
                        case 'position_y':
                            nd.posY = +nd_raw[prop];
                            break;
                        case 'size':
                            nd[prop] = +nd_raw[prop];
                            break;
                        default:
                            nd.attr.push({id: prop, val:nd_raw[prop]});
                            break;
                        }
                    }
                }

                //required params - project wont load otherwise
                //gexf files usually have these but now that we can load excel sheets adding a guard against undefined vals
                if(typeof nd.id === 'undefined'){ nd.id = UID.generateShortUID6();}
                if(typeof nd.posX === 'undefined'){ nd.posX = Math.random()*100;}
                if(typeof nd.posY === 'undefined'){ nd.posY = Math.random()*100;}
                if(typeof nd.size === 'undefined'){ nd.size = Math.random()*100;}
                if(typeof nd.col === 'undefined'){ nd.col = {r:200,g:200,b:200};}

                // console.log('node-id->', nd.id);
                // inspect(nd);

                data.nodes.push(nd);
            });

            console.log('[parseJSON] no of nodes:', data.nodes.length);

            // link attrs from the linkschema
            var eprop = dataArr.linkSchema.properties;
            console.log('[parseQJSON] linkschema', eprop);

            for (key in eprop) {
                if (eprop.hasOwnProperty(key)) {
                    switch (key.toLowerCase()) {
                    case 'id':
                    case 'link_id':
                    case 'linkid':
                    case 'col':
                    case 'label':
                    case 'visible':
                    case 'weight':
                    case 'size':
                    case 'source':
                    case 'sourceid':
                    case 'source_id':
                    case 'from':
                    case 'fromid':
                    case 'from_id':
                    case 'target':
                    case 'targetid':
                    case 'target_id':
                    case 'to':
                    case 'toid':
                    case 'to_id':
                        break;
                    default:
                        data.edgeAttrs.push({
                            title: eprop[key].title,
                            id: key,
                            generatorType: 'quid json',
                            generatorOptions: null,
                            visible: expHasCInParens.exec(key.toLowerCase()) ? false : true
                        });
                        console.log('[parseXLS] edgeAttrs - found: ', key);
                        break;
                    }
                }
            }

            // links
            _.each(dataArr.linkData, function(ed_raw) {
                var ed = {attr:[]};

                for (var prop in ed_raw) {
                    if (ed_raw.hasOwnProperty(prop)) {
                        switch (prop.toLowerCase()) {
                        case 'id':
                        case 'link_id':
                        case 'linkid':
                            ed.id = ed_raw[prop];
                            break;
                        case 'col':
                        case 'label':
                        case 'visible':
                            ed[prop.toLowerCase()] = ed_raw[prop];
                            break;
                        case 'weight':
                        case 'size':
                            ed[prop.toLowerCase()] = +ed_raw[prop];
                            break;
                        case 'type':
                        case 'edgetype':
                        case 'edge_type':
                            ed.edgeType = ed_raw[prop];
                            break;
                        case 'source':
                        case 'sourceid':
                        case 'source_id':
                        case 'from':
                        case 'fromid':
                        case 'from_id':
                            ed.source = ed_raw[prop].toString();
                            break;
                        case 'target':
                        case 'targetid':
                        case 'target_id':
                        case 'to':
                        case 'toid':
                        case 'to_id':
                            ed.target = ed_raw[prop].toString();
                            break;
                        default:
                            ed.attr.push({id: prop, val:ed_raw[prop]});
                            break;
                        }
                    }
                }

                if(typeof ed.id === 'undefined'){ ed.id = UID.generateShortUID6();}
                data.edges.push(ed);
            });
        }

        return data;
    })
    .catch(function(err) {
        throw new Error(err);
    });
}

function parseXLSXToSurveyTemplate(xlsxFilePath, callback) {
    // var readFile = Promise.promisify(fs.readFile);

    //read data from filepath
    fs.readFile(xlsxFilePath, function(err, dataFile) {

        var workbook = xlsx.readFile(xlsxFilePath);

        //assumption
        // - 1 worksheet -> categories
        // - 2 worksheet -> questions

        var sheet_name_list = workbook.SheetNames;
        console.log('sheet_name_list', sheet_name_list);

        var categoryIdx = (sheet_name_list.indexOf('Categories') + 1 || sheet_name_list.indexOf('categories') + 1) - 1;
        var questionIdx = (sheet_name_list.indexOf('Questions') + 1 || sheet_name_list.indexOf('questions') + 1) - 1;
        var settingIdx = (sheet_name_list.indexOf('Settings') + 1 || sheet_name_list.indexOf('settings') + 1) - 1;
        var introIdx = (sheet_name_list.indexOf('IntroSections') + 1 || sheet_name_list.indexOf('introSections') + 1 || sheet_name_list.indexOf('introsections') + 1) - 1;
        var giftsIdx = (sheet_name_list.indexOf('Gifts') + 1 || sheet_name_list.indexOf('gifts') + 1) - 1;
        var profileIdx = (sheet_name_list.indexOf('ProfileQuestions') + 1 || sheet_name_list.indexOf('profileQuestions') + 1 || sheet_name_list.indexOf('profilequestions') + 1) - 1;

        console.log('categoryIdx', categoryIdx);
        console.log('questionIdx', questionIdx);
        console.log('settingsIdx', settingIdx);
        console.log('introIdx', introIdx);
        console.log('profileIdx', profileIdx);

        var categories_raw = (categoryIdx === -1) ? [] : xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheet_name_list[categoryIdx]]);
        var questions_raw = (questionIdx === -1) ? [] : xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheet_name_list[questionIdx]]);
        var settings_raw = (settingIdx === -1) ? [] : xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheet_name_list[settingIdx]]);
        var intro_raw = (introIdx === -1) ? [] : xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheet_name_list[introIdx]]);
        var gifts_raw = (giftsIdx === -1) ? [] : xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheet_name_list[giftsIdx]]);
        var profile_raw = (profileIdx === -1) ? [] : xlsx.utils.sheet_to_row_object_array(workbook.Sheets[sheet_name_list[profileIdx]]);

        console.log('settings_raw----------------------');
        console.log(settings_raw.length);
        console.log('intro_raw----------------------');
        console.log(intro_raw.length);
        console.log('gifts_raw----------------------');
        console.log(gifts_raw.length);
        console.log('categories_raw----------------------');
        console.log(categories_raw.length);
        console.log('questions_raw----------------------');
        console.log(questions_raw.length);
        console.log('profile_raw----------------------');
        console.log(profile_raw.length);

        var data = {
            settings: {},
            introSections: [],
            gifts: [],
            cats: [],
            questions: [],
            profileQuestions: [],
            questionAttrs: [],
            profileQuestionAttrs: []
        };

        if (settings_raw.length > 0) {
            console.log('[parseXLSX] crunching settings');
            //console.log(settings_raw);

            var settings = {
                backgroundImage: null,
                surveyName: 'Untitled',
                surveyTheme: 'styleHC',
                locale: 'english',
                showCatsInSlides: false,
                hideProfile: false,
                canAnswerAfterSubmission: false,

                //header
                headerTitle: 'Unititled',
                headerSubTitle: null,
                headerHighlightColor: null,

                //intro
                showIntroVideo: false,
                dontShowIntroNav: false,
                videoUrl: null,
                introLoginText: 'login',
                introHighlightColor: null,

                //login
                useLogin: true,
                loginTitle: 'login',
                loginDescr: '',
                showOptInForCommunication: false,
                useFBLogin: true,
                useGoogLogin: true,
                isManualPrimaryLogin: false,
                useSurveyPassword: false,
                surveyPassword: null,
                dataPolicyHtml: null,
                termsOfUseHtml: null,
                privacyPolicyHtml: null,
                loginHighlightColor: null,

                //profile
                profileTitle: 'Profile',
                profileDescr: '',
                completeProfile: false,
                showProfilePercent: false,
                uploadMediaToProfile: false,
                showSocialSectionsInProfile: false,
                isExpandedProfile: false,
                hideProfileOption: false,
                profileInstructions: null,
                profileTwitterInstructions: null,
                profileInstagramInstructions: null,
                profileMediaInstructions: null,
                profileSocialHash: null,
                profileMediaTags: null,
                profileHighlightColor: null,

                //timeline
                timelineDescr: null,
                timelineTooltipGroundwork: null,
                timelineTooltipSurvey: null,
                timelineTooltipProfile: null,
                timelineTooltipInvite: null,
                timelineTooltipAnalysis: null,
                timelineTooltipMapp: null,
                timelineHighlightColor: null,

                //faq
                faqTitle: 'FAQ',
                faqBody: null,
                faqHighlightColor: null,

                //thanks
                thanksTitle: 'thanks title',
                thanksDescr: 'thanks descr',
                showProfileBtn: false,
                thanksImg: null,
                thanksTooltips: null,
                thanksHighlightColor: null,


                //invite
                inviteTitle: 'invite title',
                inviteDescr: null,
                inviteImg: null,
                allowInvite: true,
                invitationEmailSender: null,
                invitationEmailSenderPassword: null,
                invitationEmailHtmlTop: null,
                invitationEmailHtmlBottom: null,
                invitationSubject: 'invite subject',
                invitationBody: null,
                invitationHighlightColor: null,

                showIntro: false,
                showInvite: false,
                showTimeline: false,
                showFaq: false,

                useCoupons: false,
                noOfCoupons: 0

            };

            _.each(settings_raw, function(setting_raw) {
                console.log('Key: '+setting_raw.Key+" Value: "+setting_raw.Value);
                if(expStartsWithHash.exec(setting_raw.Key) || setting_raw.Key === '' || typeof setting_raw.Key === "undefined" || typeof setting_raw.Value === "undefined"){
                    // skip
                } else {
                    if(typeof settings[setting_raw.Key] === "boolean") {
                        settings[setting_raw.Key] = setting_raw.Value.toLowerCase() == 'true';
                    } else {
                        settings[setting_raw.Key] = setting_raw.Value;
                    }
                }
            });

            data.settings = settings;
        }

        if (intro_raw.length > 0) {
            console.log('[parseXLSX] crunching intro');

            //build sections
            var sections = {};
            _.each(intro_raw, function(row) {
                sections[row.ID] = sections[row.ID] || {slides:[]};
                sections[row.ID].slides.push({title: row.Title, descr: row.Descr, img: row.Image, next: row.NextText});
            });
            // inspect(sections);

            //convert sections object into an array
            _.each(sections, function(section){
                data.introSections.push(section);
            });

            // inspect(data.introSections);
        }

        if(gifts_raw.length > 0) {
            console.log('[parseXLSX] crunching gifts');

            //biuld sections
            _.each(gifts_raw, function(row) {
                data.gifts.push({title: row.Title, url: row.Link, img: row.Image, requirement: row.Requirement});
            });

            console.log('inspecting gifts: ');
            // inspect(data.gifts);

        }



        var catLookup = {}, prop;

        if (categories_raw.length > 0) {
            console.log('[parseXLSX] crunching categories');

            _.each(categories_raw, function(cat_raw) {

                var cat = {slideList:[]};

                // build the cat object
                for (prop in cat_raw) {
                    if (cat_raw.hasOwnProperty(prop)) {

                        switch (prop.toLowerCase()) {
                        case 'id':
                            cat.id = cat_raw[prop];
                            break;
                        case 'title':
                            cat.title = cat_raw[prop];
                            break;
                        case 'color':
                            cat.col = cat_raw[prop];
                            break;
                        case 'backcolor':
                            cat.bgCol = cat_raw[prop];
                            break;
                        case 'font1':
                            cat.font1 = cat_raw[prop];
                            break;
                        case 'font2':
                            cat.font2 = cat_raw[prop];
                            break;
                        }
                    }
                }

                //add cat object to data
                data.cats.push(cat);
                catLookup[cat.id] = cat;
            });
        }

        if (questions_raw.length > 0) {
            console.log('[parseXLSX] crunching questions');

            // process raw questions
            _.each(questions_raw, function(question_raw) {

                var ques = {attr:[]};

                for (var prop in question_raw) {
                    if (question_raw.hasOwnProperty(prop)) {
                        switch (prop.toLowerCase()) {
                        case 'id':
                        case 'qid':
                        case 'q_id':
                            ques.id = question_raw[prop];
                            data.questionAttrs.push('id');
                            break;
                        case 'qanalysistype':
                        case 'q_analysistype':
                            ques.analysisType = +question_raw[prop];
                            data.questionAttrs.push('analysisType');
                            break;
                        case 'qrendertype':
                        case 'q_rendertype':
                            //renderType
                            switch(question_raw[prop]){
                            case "TXT": ques.renderType = 'text'; break;
                            case "PTX": ques.renderType = 'para'; break;
                            case "CKF": ques.renderType = 'checkboxfilter'; break;
                            case "CHK": ques.renderType = 'checkbox'; break;
                            case "MCH": ques.renderType = 'radio'; break;
                            case "YNO": ques.renderType = 'switch'; break;
                            case "RNG": ques.renderType = 'range'; break;
                            case "RRG": ques.renderType = 'radiorange'; break;
                            case "DTE": ques.renderType = 'date'; break;
                            case "TME": ques.renderType = 'time'; break;
                            case "SCL": ques.renderType = 'scale'; break;
                            case "MXM": ques.renderType = 'matrix_radio'; break;
                            case "MXC": ques.renderType = 'matrix_check'; break;
                            case "FLE": ques.renderType = 'file'; break;
                            case "CMT": ques.renderType = 'comment'; break;
                            default: ques.renderType = 'comment'; break;
                            }
                            data.questionAttrs.push('renderType');
                            break;
                        case 'questionbigtext':
                            //questionText
                            ques.titleText = question_raw[prop];
                            data.questionAttrs.push('titleText');
                            break;
                        case 'questionsubtext':
                            //questionHelperText
                            //TODO: NAME CHANGE
                            ques.subText = question_raw[prop];
                            data.questionAttrs.push('subText');
                            break;
                        case 'questionshorttitle':
                            //questionShortTitleText
                            ques.shortTitleText = question_raw[prop];
                            data.questionAttrs.push('shortTitleText');
                            break;
                        case 'possibleresponses':
                            //possibleResponses
                            //TODO: NAME CHANGE
                            var answerOptions = processPossibleResponses(question_raw[prop]);
                            ques.answerOptions = answerOptions;
                            data.questionAttrs.push('answerOptions');
                            break;
                        case 'required':
                        case 'require':
                            //required?
                            ques.required = question_raw[prop];
                            data.questionAttrs.push('required');
                            break;
                        case 'categoryid':
                        case 'category_id':
                            //catId
                            ques.categoryId = +question_raw[prop];
                            data.questionAttrs.push('categoryId');
                            break;
                        default:
                            ques.attr.push({id: prop, val:question_raw[prop]});
                            data.questionAttrs.push(prop);
                            break;
                        }
                    }
                }

                data.questions.push(ques);
                catLookup[ques.categoryId].slideList.push(ques.id);
            });

            data.questionAttrs = _.uniq(data.questionAttrs);
            console.log('[parseXLSX] no of questions:', data.questions.length);
            console.log('[parseXLSX] questionAttrs-->', data.questionAttrs);
        }


        if (profile_raw.length > 0) {
            console.log('[parseXLSX] crunching profileQuestions');

            // process raw profileQuestions
            _.each(profile_raw, function(profileQuestion_raw) {

                var ques = {attr:[]};

                for (var prop in profileQuestion_raw) {
                    if (profileQuestion_raw.hasOwnProperty(prop)) {
                        switch (prop.toLowerCase()) {
                        case 'id':
                        case 'qid':
                        case 'q_id':
                            ques.id = profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('id');
                            break;
                        case 'qanalysistype':
                        case 'q_analysistype':
                            ques.analysisType = +profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('analysisType');
                            break;
                        case 'qrendertype':
                        case 'q_rendertype':
                            //renderType
                            switch(profileQuestion_raw[prop]){
                            case "TXT": ques.renderType = 'text'; break;
                            case "VIDPTX": ques.renderType = 'vidpara'; break;
                            default: ques.renderType = 'text'; break;
                            }
                            data.profileQuestionAttrs.push('renderType');
                            break;
                        case 'questionbigtext':
                            //profileQuestionText
                            ques.titleText = profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('titleText');
                            break;
                        case 'questionsubtext':
                            //profileQuestionHelperText
                            //TODO: NAME CHANGE
                            ques.subText = profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('subText');
                            break;
                        case 'questionshorttitle':
                            //profileQuestionShortTitleText
                            ques.shortTitleText = profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('shortTitleText');
                            break;
                        case 'possibleresponses':
                            //possibleResponses
                            //TODO: NAME CHANGE
                            var answerOptions = processPossibleResponses(profileQuestion_raw[prop]);
                            ques.answerOptions = answerOptions;
                            data.profileQuestionAttrs.push('answerOptions');
                            break;
                        case 'required':
                        case 'require':
                            //required?
                            ques.required = profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('required');
                            break;
                        case 'categoryid':
                        case 'category_id':
                            //catId
                            ques.categoryId = profileQuestion_raw[prop];
                            data.profileQuestionAttrs.push('categoryId');
                            break;
                        default:
                            ques.attr.push({id: prop, val:profileQuestion_raw[prop]});
                            data.profileQuestionAttrs.push(prop);
                            break;
                        }
                    }
                }

                data.profileQuestions.push(ques);
            });

            data.profileQuestionAttrs = _.uniq(data.profileQuestionAttrs);
            console.log('[parseXLSX] no of profile Questions:', data.profileQuestions.length);
            console.log('[parseXLSX] profileQuestionAttrs-->', data.profileQuestionAttrs);
        }
        //data.cats = null; data.questions = null;
        //inspect(data);
        callback(data);
    });
}

function processPossibleResponses(responseText){
    var responseRows = [], responseCols = [], symbolArray;

    //eg:
    //A huge mess:1|Somewhat disordered:2|Average:3|tidiness:4|Neat:5|It varies:10|Other:10 >> colA|colB

    var responsesArray = responseText.split('>>');
    //responsesArray = ["A huge mess:1|Somewhat disordered:2|Average:3|tidiness:4|Neat:5|It varies:10|Other:10 ", " colA|colB"]

    //ROWS
    var rowsArray = responsesArray[0].split('|');
    //rowsArray = ["A huge mess:1", "Somewhat disordered:2", "Average:3", "tidiness:4", "Neat:5", "It varies:10", "Other:10 "]

    _.each(rowsArray, function(r){
        symbolArray = r.split (":");
        if (symbolArray.length < 2) {
            //no val found - use the key as val
            key = symbolArray[0];
            val = symbolArray[0];
        } else if (symbolArray.length === 2) {
            //key val found
            key = symbolArray[0];
            val = symbolArray[1];
        } else if (symbolArray.length > 2){
            //key val matrix found //error
            key = symbolArray[0];
            val = symbolArray[1];
        }

        val = parseFloat(val) == val ? +val : val;
        responseRows.push({descr: key, value: val});
    });

    //COLS - if they exist
    if(responsesArray.length > 1){
        //matrix
        var colsArray = responsesArray[1].split('|');
        //colArray = [" colA", "colB"]

        _.each(colsArray, function(r){
            symbolArray = r.split (":");
            if (symbolArray.length < 2) {
                //no val found - use the key as val
                key = symbolArray[0];
                val = symbolArray[0];
            } else if (symbolArray.length === 2) {
                //key val found
                key = symbolArray[0];
                val = symbolArray[1];
            } else if (symbolArray.length > 2){
                //key val matrix found //error
                key = symbolArray[0];
                val = symbolArray[1];
            }

            val = parseFloat(val) == val ? +val : val;
            responseCols.push({descr: key, value: val});
        });
    }

    return {rows: responseRows, cols: responseCols};
}

function generateJSONFromGraph(dataset, networks, callback) {
    var result = {};

    //datapoints sheet
    if(_.isObject(dataset)) {
        result.dataset = {
            attributes: [],
            datapoints: []
        };

        result.dataset.attributes = dataset.attrDescriptors;

        var temp = {};
        _.each(dataset.datapoints, function(dp) {
            temp.id = dp.id;
            _.assign(temp, dp.attr);
            result.dataset.datapoints.push(temp);
        });

    }

    // networks sheets
    if(_.isArray(networks)) {
        result.networks = {};

        _.each(networks, function(network) {
            result.networks[network.name] = {};
            var currNetwork = result.networks[network.name];
            currNetwork.description = network.description;
            currNetwork.nodeAttributes = network.nodeAttrDescriptors;
            currNetwork.linkAttrbiutes = network.linkAttrDescriptors;
            currNetwork.nodes = [];
            currNetwork.links = [];
            // currNetwork.nodeAttributes.push({});

            var temp = {};
            _.each(network.nodes, function(node) {
                temp.id = node.id;
                temp.datapointid = node.dataPointId;
                _.assign(temp, node.attr);
                currNetwork.nodes.push(temp);
            });

            _.each(network.links, function(link) {
                temp.isDirectional = link.isDirectional;
                temp.source = link.source;
                temp.target = link.target;
                _.assign(temp, link.attr);
                currNetwork.links.push(temp);
            });

        });
    }
    callback(result);
}

function generateNetworksXLSX(dataset, networks, dataFilters, fileName, callback){

    var wb = new Workbook();
    var ws_name, ws;
    assert(dataset, "dataset should exist");
    assert(networks.length > 0, "networks should exist");
    //nodes sheet(dataset + network)
    //first row is for attribs
    if(!_.isObject(dataset)) {
        throw new Error("[generateNetworksXLSX] Dataset object malformed!");
    }

    var dsAttrIdx = _.indexBy(dataset.attrDescriptors, "id");
    _.each(networks, function _writeNetworkSheet(network) {
        var nd_data_arr = [];
        var dp_attr_arr =  _.map(dataset.attrDescriptors, "id");
        dp_attr_arr.unshift('ID');
        var network_nd_attrib_arr = _.map(network.nodeAttrDescriptors, "id");
        var combined_nd_attrib_arr = dp_attr_arr.concat(network_nd_attrib_arr);
        var indexedNetworkNodes = _.indexBy(network.nodes, "dataPointId");
        var nwAttrIdx = _.indexBy(network.nodeAttrDescriptors, "id");

        nd_data_arr.push(combined_nd_attrib_arr);

        _.each(dataFilters.nodesFilter(dataset.datapoints), function buildDataArray(dp) {
            if(!_.has(indexedNetworkNodes, dp.id)) {
                // Datapoint not present in network
                // console.warn('Datapoint does not exist in network');
                return;
            }
            var dpRow = [];
            _.each(dp_attr_arr, function writeDatasetAttr(attr) {
                if(attr === 'ID') {
                    dpRow.push(dp.id);
                }
                else {
                    if (dp.attr[attr] != null){
                        var val = genWriteVal( dsAttrIdx[attr].attrType, dp.attr[attr]);
                        dpRow.push(val);
                    } else {
                        dpRow.push("");
                    }
                }
            });
            _.each(network_nd_attrib_arr, function writeNetworkAttr(nwAttr) {
                var nwNode = indexedNetworkNodes[dp.id];
                if (nwNode.attr[nwAttr] != null){
                    var val = genWriteVal( nwAttrIdx[nwAttr].attrType, nwNode.attr[nwAttr]);
                    dpRow.push(val);
                } else {
                    dpRow.push("");
                }
            });
            nd_data_arr.push(dpRow);
        });

        ws_name = (fileName || network.name) + "-nodes";
        ws = sheet_from_array_of_arrays(nd_data_arr);
        wb.SheetNames.push(ws_name);
        wb.Sheets[ws_name] = ws;

        // Links
        var ed_data_arr = [];
        var ed_attrib_arr = _.pluck(network.linkAttrDescriptors, 'id');
        ed_attrib_arr.push('isDirectional', 'source', 'target');
        ed_data_arr.push(ed_attrib_arr);

        _.each(dataFilters.linksFilter(network.links), function(link) {
            var linkRow = [];
            _.each(ed_attrib_arr, function(attr) {
                var attrVal = link.attr[attr] != null ? link.attr[attr] : link[attr];
                if(attrVal == null) {
                    attrVal = '';
                }
                linkRow.push(attrVal);
            });
            ed_data_arr.push(linkRow);
        });

        ws_name =  (fileName || network.name) +  "-links";
        ws = sheet_from_array_of_arrays(ed_data_arr);
        wb.SheetNames.push(ws_name);
        wb.Sheets[ws_name] = ws;
    });

    // debug code do remove
    // xlsx.writeFile(wb, 'uploads_tmp/sheetgen.xlsx');
    // clustering sheets
    var wbout = xlsx.write(wb, {
        bookType: 'xlsx',
        bookSST: false,
        type: 'binary'
    });

    callback(wbout);
}

function generateDatasetXLSX(dataset, fileName, callback){

    var wb = new Workbook();
    var ws_name, ws;
    assert(dataset, "dataset should exist");

    if(!_.isObject(dataset)) {
        throw new Error("[generateDatasetXLSX] Dataset object malformed!");
    }

    var dsAttrIdx = _.indexBy(dataset.attrDescriptors, "id");
    var nd_data_arr = [];
    var dp_attr_arr =  _.map(dataset.attrDescriptors, "id");
    nd_data_arr.push(dp_attr_arr);

    _.each(dataset.datapoints, function buildDataArray(dp) {
        var dpRow = [];
        _.each(dp_attr_arr, function writeDatasetAttr(attr) {
            if (dp[attr] != null){
                var val = genWriteVal( dsAttrIdx[attr].attrType, dp[attr]);
                dpRow.push(val);
            } else {
                dpRow.push("");
            }
        });
        nd_data_arr.push(dpRow);
    });

    ws_name = fileName;
    ws = sheet_from_array_of_arrays(nd_data_arr);
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;

    // debug code do remove
    // xlsx.writeFile(wb, 'uploads_tmp/sheetgen.xlsx');
    // clustering sheets
    var wbout = xlsx.write(wb, {
        bookType: 'xlsx',
        bookSST: false,
        type: 'binary'
    });

    callback(wbout);
}

// what values to write the the file
function genWriteVal (attrType, val) {
    //any transforms necessary goes here for different types
    switch(attrType){
    case "liststring": return _.isArray(val) ? val.join(" | ") : val;
    case "timestamp":
        if(!moment(val).isValid()) throw new Error("Invalid timestamp! Given : " + val);
        return moment.unix(val).format("YYYY/MM/DD");
    default:
        return val;
    }
}

// function generateNodeAttribArray(rowData, selector){
//     var arr = [];
//     //required
//     arr.push('id');
//     arr.push('label');
//     arr.push('posX');
//     arr.push('posY');
//     arr.push('size');
//     arr.push('col');
//     //user defined
//     for(var i = 0, l = rowData.length; i<l; i++){
//         //console.log(rowData[i],' , ',rowData[i][selector]);
//         arr.push(rowData[i][selector]);
//     }
//     return arr;
// }

// function generateNodeRowArray(nodeData, selectorArray){
//     var arr = [], valObj = {}, val;
//     //required
//     arr.push(nodeData.id || '-');
//     arr.push(nodeData.label || 'node');
//     arr.push(nodeData.posX || 0);
//     arr.push(nodeData.posY || 0);
//     arr.push(nodeData.size || 0);
//     arr.push((nodeData.col.r || 0) +','+ (nodeData.col.g || 0) +','+ (nodeData.col.b || 0));
//     //user defined
//     for(var i = 6, l = selectorArray.length; i<l; i++){
//         valObj = _.find(nodeData.attr, {id: selectorArray[i]});

//         if(typeof valObj !== 'undefined' && typeof valObj.val !== 'undefined'){
//             val = valObj.val || "";
//         } else {
//             val = "";
//         }
//         arr.push(val);
//     }
//     return arr;
// }

// function generateEdgeAttribArray(rowData, selector){
//     var arr = [];
//     //required
//     arr.push('id');
//     arr.push('source');
//     arr.push('target');
//     arr.push('edgeType');
//     //console.log(rowData);
//     //user defined
//     for(var i = 0, l = rowData.length; i<l; i++){
//         console.log(rowData[i],' , ',rowData[i][selector]);
//         arr.push(rowData[i][selector]);
//     }
//     return arr;
// }

// function generateEdgeRowArray(edgeData, selectorArray){
//     var arr = [], valObj = {}, val;
//     //required
//     arr.push(edgeData.id || '-');
//     arr.push(edgeData.source || '-');
//     arr.push(edgeData.target || '-');
//     arr.push(edgeData.edgeType || 'UNKNOWN');
//     //user defined
//     for(var i = 4, l = selectorArray.length; i<l; i++){
//         valObj = _.find(edgeData.attr, {id: selectorArray[i]});
//         if(typeof valObj !== 'undefined' && typeof valObj.val !== 'undefined'){
//             val = valObj.val || "";
//         } else {
//             val = "";
//         }
//         arr.push(val);
//     }
//     return arr;
// }

function sheet_from_array_of_arrays(data, opts) {
    var ws = {};
    var range = {s: {c:10000000, r:10000000}, e: {c:0, r:0 }};
    for(var R = 0; R != data.length; ++R) {
        for(var C = 0; C != data[R].length; ++C) {
            if(range.s.r > R) range.s.r = R;
            if(range.s.c > C) range.s.c = C;
            if(range.e.r < R) range.e.r = R;
            if(range.e.c < C) range.e.c = C;
            var cell = {v: data[R][C] };
            if(cell.v === null) continue;
            var cell_ref = xlsx.utils.encode_cell({c:C,r:R});

            if(typeof cell.v === 'number') cell.t = 'n';
            else if(typeof cell.v === 'boolean') cell.t = 'b';
            else if(cell.v instanceof Date) {
                cell.t = 'n'; cell.z = xlsx.SSF._table[14];
                cell.v = datenum(cell.v);
            }
            else cell.t = 's';

            ws[cell_ref] = cell;
        }
    }
    if(range.s.c < 10000000) ws['!ref'] = xlsx.utils.encode_range(range);
    return ws;
}

function datenum(v, date1904) {
    if(date1904) v+=1462;
    var epoch = Date.parse(v);
    return (epoch - new Date(Date.UTC(1899, 11, 30))) / (24 * 60 * 60 * 1000);
}

function Workbook() {
    if(!(this instanceof Workbook)) return new Workbook();
    this.SheetNames = [];
    this.Sheets = {};
}
// xlsx writing utilities - end

function generateCSVFromGraph(dataDoc,callback){
    //console.log(dataDoc);
    var data  = dataDoc.data;
    var nodes_csv = '';

    //first row is for attribs
    var attrib_arr =  generateRowArray(data.nodeAttrs, 'title');
    nodes_csv += attrib_arr.join(',') + '\r\n';
    //for each node
    var nd_arr;
    _.each(data.nodes, function(nd){
        nd_arr = generateRowArray(nd.attr, 'val');
        nodes_csv += nd_arr.join(',') + '\r\n';
    });
    callback(nodes_csv);
}

function sanitizeClusterInfo(network) {
    if(!_.isEmpty(_.get(network, 'clusterInfo[0].clusters'))) {
        var clustersList = _.get(network, 'clusterInfo[0].clusters');
        _.each(clustersList, function(cluster) {
            // If cluster doesn't have linkingAttrName, assign label to it
            if(!cluster.linkingAttrName) {
                cluster.linkingAttrName = cluster.label;
            }
        });
        return network;
    }

    var hasNetworkProps = _.find(network.nodeAttrDescriptors, 'id', 'ClusterArchetype')
                            && _.find(network.nodeAttrDescriptors, 'id', 'ClusterBridging')
                            && _.find(network.nodeAttrDescriptors, 'id', 'Cluster') ? true : false;
    console.log('HAS NETWORK PROPS: ', hasNetworkProps);
    if(!hasNetworkProps) {
        console.warn('Network doesn\'t have required network properties, skipping clusterInfo sanitize!');
        return network;
    }

    var clusterInfo = {};
    var nodesGroupedByCluster = _.groupBy(network.nodes, 'attr.Cluster');

    _.each(nodesGroupedByCluster, function(nodes, clusterName) {
        var nodeIdsSortedByArchetype = _(nodes)
                                    .sortBy('attr.ClusterArchetype')
                                    .map('id')
                                    .value();

        var nodeIdsSortedByBridging = [];
        if(_.uniq(_.map(nodes, 'attr.ClusterBridging')).length > 1) {
            nodeIdsSortedByBridging = _(nodes)
                                    .sortBy('attr.ClusterBridging')
                                    .map('id')
                                    .value();
        }

        clusterInfo[clusterName] = {
            MostCentral: nodeIdsSortedByArchetype.slice(nodeIdsSortedByArchetype.length - 5).reverse(),
            Bridgers: nodeIdsSortedByBridging.slice(nodeIdsSortedByBridging.length - 5).reverse(),
            linkingAttrName: clusterName,
            label: clusterName,
            nNodes: nodes.length
        };
    });

    network.clusterInfo = [{name: 'Cluster', clusters: _.values(clusterInfo)}];
    return network;
}

module.exports = {
    getFileParser             : getFileParser,
    sanitizeNetwork           : sanitizeNetwork,
    sanitizeClusterInfo       : sanitizeClusterInfo,
    parseGEXFToGraph          : parseGEXFToGraph,
    parseExcelToGraph         : parseExcelToGraph,
    parseCSVToGraph           : parseCSVToGraph,
    parseXLSXToSurveyTemplate : parseXLSXToSurveyTemplate,
    generateCSVFromGraph      : generateCSVFromGraph,
    generateNetworksXLSX      : generateNetworksXLSX,
    generateJSONFromGraph     : generateJSONFromGraph,
    gen_sheet_js_excel        : _gen_sheet_js_excel,
    gen_sheet_js_csv          : _gen_sheet_js_csv,
    generateDatasetXLSX       : generateDatasetXLSX,
    valueParser               : valueParser
};
