"use strict";

var _       = require("lodash"),
    math = require("mathjs");

var shared_code = require("./shared_code");
var genDestAttrs = shared_code.genDestAttrs;
var genParam = shared_code.genParam;

// var logPrefix = "[reduce_ops]";

/**
 * Reduce ops allows to select multiple Sources and combine them
 */

var listing = [{
    opType : "reduce_op",
    id : "concatenate",
    name : "concatenate attrs into a liststring",
    desc : "combine the attributes into a liststring",

    groupModifierSupported : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    sourceAttrDesc : {},
    destAttrDesc : {
        name : "attrs_concat"
    },
    opFn : genReduceFn(_concat, "liststring")
},{
    opType : "reduce_op",
    id : "node_combinators_numeric",
    name : "node combinators for numeric attrs",
    desc : "combine selected numeric srcAttrs using the selected combinators",

    groupModifierSupported : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("genOps", "combinators to use",
            "mean",
            "Option",
            {
                options : ["sum", "mean", "median", "max", "min"]
            })
    ],
    sourceAttrDesc : {
        isNumeric : true
    },
    destAttrDesc : {
        name : "numeric_summary"
    },
    opFn : genReduceFn(_combinatorNumeric, "float")
},{
    opType : "reduce_op",
    id : "node_combinators_tags",
    name : "node combinators for tags attrs",
    desc : "combine selected tags srcAttrs using the selected combinators",

    groupModifierSupported : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("genOps", "combinators to use",
            "union",
            "Option",
            {
                options : ["union", "intersection", "difference"]
            })
    ],
    sourceAttrDesc : {
        isTag : true
    },
    destAttrDesc : {
        name : "tag_summary"
    },
    opFn : genReduceFn(_combinatorTag, "liststring")
}];


// a common fn builder for simple reductions like concat
// tFn is (opInst, node.attr) => combinedVal
function genReduceFn(tFn, destAttrtype) {
    var opFn = function(opInst, nodes, nodeAttrs, links, linkAttrs) {
        if(!opInst.isGroupingEnabled) {
            console.log("[genReduceFn] Starting genTransformFn for opInst: ", opInst);
        }
        genDestAttrs(opInst, destAttrtype, nodeAttrs);
        _.each(nodes, function(node) {
            var newVal = tFn(opInst, node.attr);
            if(newVal != null) node.attr[opInst.destAttrId] = newVal;
            // console.log("[genReduceFn] New Values: ", node);
        });
        return { nodes, links, nodeAttrs, linkAttrs };
    };
    return opFn;
}


// concatenate srcvals into a taglist
function _concat (opInst, nodeAttrObj) {
    var vals = [];
    for(var i = 0; i < opInst.opRows.length; i++) {
        var srcAttrId = opInst.opRows[i].srcAttrId,
            srcVal = nodeAttrObj[srcAttrId];
        if(srcVal != null) {
            vals.push(srcVal);
        }
    }

    var value = _(vals)
        .flatten() // to concat with a liststring
        .compact() // remove null / undefines
        .map(String) // ensure all are strings
        .value();
    return vals.length > 0 ? value : null;
}

var __numericCombinators = {
    "sum": math.sum.bind(math),
    "mean": math.mean.bind(math),
    "median": math.median.bind(math),
    "max": math.max.bind(math),
    "min": math.min.bind(math)
};

function _combinatorNumeric (opInst, nodeAttrObj) {
    var vals = [];

    for(var i = 0; i < opInst.opRows.length; i++) {
        var srcAttrId = opInst.opRows[i].srcAttrId,
            srcVal = nodeAttrObj[srcAttrId];
        if(srcVal != null && _.isNumber(srcVal)) {
            vals.push(srcVal);
        }
    }
    var combinatorOp = _.get(opInst, "params[0].value");
    var op = __numericCombinators[combinatorOp];

    return vals.length > 0 ? op(vals) : null;
}

var __tagCombinators = {
    "union" : function(taglist) { return _.unique([].concat.apply([], taglist)).sort(); },
    "intersection" : function(taglist) { return _.intersection.apply(_, taglist).sort(); },
    "difference" : function(taglist) { return _.difference.apply(_, taglist).sort(); }
};

function _combinatorTag (opInst, nodeAttrObj) {
    var vals = [];

    for(var i = 0; i < opInst.opRows.length; i++) {
        var srcAttrId = opInst.opRows[i].srcAttrId,
            srcVal = nodeAttrObj[srcAttrId];
        if(srcVal != null && _.isArray(srcVal) && srcVal.length > 0) {
            vals.push(srcVal);
        }
    }
    var combinatorOp = _.get(opInst, "params[0].value");
    var op = __tagCombinators[combinatorOp];

    return vals.length > 0 ? op(vals) : null;
}
module.exports = {
    listing,
    forTesting : {
        _concat
    }
};