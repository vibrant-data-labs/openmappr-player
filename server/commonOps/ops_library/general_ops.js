"use strict";

var _       = require("lodash");

var shared_code = require("./shared_code");
var genDestAttrs = shared_code.genDestAttrs;
var genParam = shared_code.genParam;
var createOrUpdateAttr = shared_code.createOrUpdateAttr;

var summaryGenerators = require("./summary_generators");
var genCatInfo = summaryGenerators.genCatInfo;
var genTagInfo = summaryGenerators.genTagInfo;
var genNumericInfo = summaryGenerators.genNumericInfo;

// var logPrefix = "[general_ops]";

/// general op Can have params too
/// for creating new DestAttrs, param can be specified by prefixing param.id with "destAttrId". value has to be non empty
var listing = [{
    opType : "general_op",
    id : "dedup",
    name : "remove duplicates",
    desc : "remove duplicates from data",

    groupModifierSupported : false,
    modifiesLinks : true,
    removeAddDatapoints : true,

    params :[
        genParam("preserve_nulls",
            "whether to preserve nulls or not (yes/no). Default is to preserve",
            "yes")
    ],

    sourceAttrDesc : {},
    opFn : _dedupFn
},{
    opType : "general_op",
    id : "invert_tags",
    name : "invert the tag listing",
    desc : "Give the node only tags which it does not have. Best used with GroupBy modifier",

    groupModifierSupported : true,
    isGroupingEnabled : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("destAttrId_1",
            "destAttrId, leave blank to overwrite source",
            "invertedTags")
    ],
    sourceAttrDesc : {
        isTag : true
    },
    opFn : _invertTags
},{
    opType : "general_op",
    id : "remove_tags",
    name : "removes tags from the tag attr",
    desc : "removes given tags from the tagAttr",
    params :[
        genParam("blacklist", "pipe(|) separated list of tags to remove", "")
    ],
    sourceAttrDesc : {
        isTag : true
    },
    opFn : _removeTags
},{
    opType : "general_op",
    id : "replace_tags",
    name : "replace tags",
    desc : "replaces tags with the new ones. Specify as oldTag -> newTag",
    params :[
        genParam("destAttrId_1",
            "destAttrId, leave blank to overwrite source",
            "cleanedTags"),
        genParam("replacements", "tag -> new Tag",
            ["currentTag -> newTag"], "Array")
    ],
    sourceAttrDesc : {
        isTag : true
    },
    opFn : _replaceTags
},{
    opType : "general_op",
    id : "group_summaries_categories",
    name : "write category summaries",
    desc : "summarizes the data for the given category Attribute and writes it on individual node." +
                "Best used in conjunction with groupBy Modifier",

    groupModifierSupported : true,
    isGroupingEnabled : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("destAttr_prefix",
            "prefix for summary attrs written on nodes",
            "group_"),
        genParam("genOps", "summary options and dest attr names",
            ["unique", "maxFreq", "minFreq"],
            "Array[Option]",
            {
                options : ["unique", "maxFreq", "minFreq"]
            })
    ],
    sourceAttrDesc : {
        isTag : false,
        isNumeric : false
    },
    opFn : _genCatSummaries
},{
    opType : "general_op",
    id : "summaries_numeric",
    name : "write numeric summaries",
    desc : "summarizes the data for the given numeric Attribute. and writes it on each individual node." +
            "Best used in conjunction with groupBy Modifier",

    groupModifierSupported : true,
    isGroupingEnabled : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("destAttr_prefix",
            "prefix for summary attrs written on nodes",
            "group_"),
        genParam("genOps", "summary options and dest attr names",
            ["min", "max", "mean", "median"],
            "Array[Option]",
            {
                options : ["min", "max", "mean", "median", "quantile_25", "quantile_75"]
            })
    ],
    sourceAttrDesc : {
        isNumeric : true
    },
    opFn : _genNumericSummaries
},{
    opType : "general_op",
    id : "summaries_tag",
    name : "write tag summaries",
    desc : "Summarizes the data for the given liststring attribute and writes on each individual node" +
                "Best used in conjunction with groupBy Modifier",

    groupModifierSupported : true,
    isGroupingEnabled : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("destAttr_prefix",
            "prefix for summary attrs written on nodes",
            "group_"),
        genParam("genOps", "summary options and dest attr names",
            ["unique", "maxFreq", "minFreq"],
            "Array[Option]",
            {
                options : ["unique", "maxFreq", "minFreq"]
            })
    ],
    sourceAttrDesc : {
        isTag : true
    },
    opFn : _genTagSummaries
}];

//
// General Op functions
//

function _dedupFn (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId, srcAttr = _.find(nodeAttrs, "id", srcAttrId);
    var seenValues = {};

    var preserveNulls = "yes" === _.trim(opInst.params[0].value);

    console.log("[_dedupFn] srcAttrId: ", srcAttrId);
    console.log("[_dedupFn] srcAttr: ", srcAttr);
    console.log("[_dedupFn] preserveNulls: ", preserveNulls);
    var newNodes = _.reduce(nodes, function(acc, node) {
        var attrVal = node.attr[srcAttrId];
        if(attrVal != null) {
            if(!alreadySeen(attrVal)) {
                // console.log(`[_dedupFn] PRESERVE node: ${node.id}. NEW value: ${JSON.stringify(attrVal)}`);
                acc.push(node);
            } else {
                // console.log(`[_dedupFn] Removing node: ${node.id}. Already Seen value: ${JSON.stringify(attrVal)}`);
            }
        } else if(preserveNulls) { acc.push(node); }
        return acc;
    },[]);
    console.log("[_dedupFn] Final Node Count: ", newNodes.length);
    console.log("[_dedupFn] Removed Node Count: ", nodes.length - newNodes.length);

    // node list has been filtered. Now fix links, if passed in
    if(links) {
        var nodeIdx = _.indexBy(newNodes, "id");
        var newLinks = _.reduce(links, function(acc, link) {
            var source = link.source, target = link.target;
            if(nodeIdx[source] != null && nodeIdx[target] != null) {
                acc.push(link);
            }
            return acc;
        }, []);
        console.log("[_dedupFn] Final link Count: ", newLinks.length);

        // if all links have been filtered out, then cleanse the link Attrs as well
        if(newLinks.length === 0) {
            linkAttrs = [];
        }
    }
    function alreadySeen (attrVal) {
        var idxVal = srcAttr.attrType === "liststring" ? attrVal.join("|") : attrVal;
        var isStored = seenValues[idxVal];

        if(!isStored) {
            seenValues[idxVal] = true;
            return false;
        } else return true;
    }
    return {
        nodes : newNodes,
        nodeAttrs,
        links : newLinks,
        linkAttrs
    };
}

function _invertTags (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId;

    var tagFrequency = countTagFreq(srcAttrId , nodes),
        allTags = _.keys(tagFrequency);

    genDestAttrs(opInst, "liststring", nodeAttrs);
    var destAttrId = opInst.params[0].value;
    if(destAttrId.length === 0) destAttrId = srcAttrId;

    _.each(nodes, function (node) {
        var srcVal = node.attr[srcAttrId];
        if(srcVal && srcVal.length > 0) {
            node.attr[destAttrId] = _.difference(allTags, srcVal);
        }
    });

    return {
        nodes,
        nodeAttrs,
        links,
        linkAttrs
    };
}

function _removeTags (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId;

    var blacklistedTagSrc = _.get(opInst, "params[0].value");
    if(!blacklistedTagSrc || blacklistedTagSrc.length === 0) {
        return new Error("can't process removal. param is empty");
    }
    // var tagNewTagMap = _.reduce(replacements, function _genMap (acc, repString) {
    //     var broken = repString.split("->").map(_.trim);
    //     acc[broken[0]] = acc[broken[1]];
    // }, {});
    var blacklistedTags = _.compact(blacklistedTagSrc.split("|").map(_.trim));

    console.log("[_removeTags] Removing blacklisted Tags: ", blacklistedTags);
    _.each(nodes, function (node) {
        var srcVal = node.attr[srcAttrId];
        if(srcVal && srcVal.length > 0) {
            node.attr[srcAttrId] = _.difference(srcVal, blacklistedTags);
        }
    });

    return {
        nodes,
        nodeAttrs,
        links,
        linkAttrs
    };
}

function _replaceTags (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId;

    var replacements = _.get(opInst, "params[1].value");
    if(!replacements || replacements.length === 0) {
        return new Error("can't process replacements. param is empty");
    }
    var replacementsData = replacements.map(replSpec => _.compact(replSpec.split("->").map(_.trim)));
    var replacementIdx = _.reduce(replacementsData, function(acc, replRow) {
        acc[replRow[0]] = replRow[1];
        return acc;
    }, {});
    console.log("[_replaceTags] replacement Mapping: ", replacementIdx);


    var destAttrId = opInst.params[0].value;
    if(destAttrId.length === 0) destAttrId = srcAttrId;
    genDestAttrs(opInst, "liststring", nodeAttrs);
    console.log("[_replaceTags] writing on destAttrId: ", destAttrId);
    console.log("[_replaceTags] node Attrs created: ", _.map(nodeAttrs, "id"));

    _.each(nodes, function (node) {
        var srcVal = node.attr[srcAttrId];
        var hasUpdated = false;
        if(srcVal && srcVal.length > 0) {
            node.attr[destAttrId] = _.reduce(srcVal, function(acc, tag) {
                if(replacementIdx[tag]) {
                    hasUpdated = true;
                    acc.push(replacementIdx[tag]);
                } else {
                    acc.push(tag);
                }
                return acc;
            }, []);
            node.attr[destAttrId] = hasUpdated ? _.unique(node.attr[destAttrId].sort()) : node.attr[destAttrId];
        }
    });

    return {
        nodes,
        nodeAttrs,
        links,
        linkAttrs
    };
}

function _genCatSummaries (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId;

    var destAttr_prefix = _.get(opInst, "params[0].value");

    console.log(`[_genCatSummaries] srcAttrId: `, srcAttrId);
    console.log(`[_genCatSummaries] destAttr_prefix: `, destAttr_prefix);

    var opOpts = _.get(opInst, "params[1].value");

    // a map from op -> destAttrId
    var opDestAttrMap = _.reduce(opOpts, function(acc, catOp) {
        //var attrType = catOp === "unique" ? "liststring" : "string";
        var attrType = "liststring";
        acc[catOp] = createOrUpdateAttr(destAttr_prefix + "_" + catOp, attrType, nodeAttrs);
        return acc;
    }, {});

    // calc group Infos
    var catInfo = genCatInfo(srcAttrId, nodes);
    console.log(`[_genCatSummaries] catInfo.minFreq: `, catInfo.minFreq);
    console.log(`[_genCatSummaries] catInfo.maxFreq: `, catInfo.maxFreq);

    _.each(nodes, function (node) {
        _.forOwn(opDestAttrMap, function(destAttr, catOp) {
            node.attr[destAttr.id] = _.clone(catInfo[catOp]);
        });
    });

    return {
        nodes,
        nodeAttrs,
        links,
        linkAttrs
    };
}

function _genNumericSummaries (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId;

    var destAttr_prefix = _.get(opInst, "params[0].value");

    console.log(`[_genNumericSummaries] srcAttrId: `, srcAttrId);
    console.log(`[_genNumericSummaries] destAttr_prefix: `, destAttr_prefix);

    var opOpts = _.get(opInst, "params[1].value");
    // a map from op -> destAttrId
    var opDestAttrMap = _.reduce(opOpts, function(acc, numericOp) {
        acc[numericOp] = createOrUpdateAttr(destAttr_prefix + "_" + numericOp, "float", nodeAttrs);
        return acc;
    }, {});

    console.log(`[_genNumericSummaries] opDestAttrMap: `, opDestAttrMap);

    // calc group Infos
    var bounds = genNumericInfo(srcAttrId, nodes);
    console.log(`[_genNumericSummaries] bounds: `, bounds);

    _.each(nodes, function (node) {
        _.forOwn(opDestAttrMap, function(destAttr, numericOp) {
            node.attr[destAttr.id] = bounds[numericOp];
        });
    });

    return {
        nodes,
        nodeAttrs,
        links,
        linkAttrs
    };
}

function _genTagSummaries (opInst, nodes, nodeAttrs, links, linkAttrs) {
    var srcAttrId = opInst.srcAttrId;

    var destAttr_prefix = _.get(opInst, "params[0].value");

    console.log(`[_genTagSummaries] srcAttrId: `, srcAttrId);
    console.log(`[_genTagSummaries] destAttr_prefix: `, destAttr_prefix);

    var opOpts = _.get(opInst, "params[1].value");

    // a map from op -> destAttrId
    var opDestAttrMap = _.reduce(opOpts, function(acc, tagOp) {
        //var attrType = tagOp === "unique" ? "liststring" : "string";
        var attrType = "liststring";
        acc[tagOp] = createOrUpdateAttr(destAttr_prefix + "_" + tagOp, attrType, nodeAttrs);
        return acc;
    }, {});

    // calc group Infos
    var tagInfo = genTagInfo(srcAttrId, nodes);
    console.log(`[_genTagSummaries] nodes len: `, nodes.length);
    console.log(`[_genTagSummaries] tagInfo: `, tagInfo);

    _.each(nodes, function (node) {
        _.forOwn(opDestAttrMap, function(destAttr, tagOp) {
            node.attr[destAttr.id] = _.clone(tagInfo[tagOp]);
        });
    });

    return {
        nodes,
        nodeAttrs,
        links,
        linkAttrs
    };
}


module.exports = {
    listing,
    forTesting : {
        _replaceTags,
        _removeTags,
        _invertTags,
        _dedupFn
    }
};
