"use strict";

var _       = require("lodash"),
    moment = require('moment'),
    math = require("mathjs");

var shared_code = require("./shared_code");
var genDestAttrs = shared_code.genDestAttrs;
var genParam = shared_code.genParam;

// var logPrefix = "[transform_ops]";

var listing = [{
    opType : "transform_op",
    id : "split_string",
    name : "string -> liststring",
    desc : "uses the given separator specified to break a string into a listring",
    params :[
        genParam("split_char", "the character on which to split", "/")
    ],
    compactInput : true,
    sourceAttrDesc : {
        isNumeric : false,
        isTag : false
    },
    destAttrDesc : {
        suffix : "_tags"
    },
    opFn : genTransformFn(_split_string, "liststring")
},{
    opType : "transform_op",
    id : "log10",
    name : "attr -> log10(attr)",
    desc : "generates a new attribute which is the log of the given param",

    groupModifierSupported : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("log_offset", "the log offset to use", 0)
    ],
    compactInput : true,
    sourceAttrDesc : {
        isNumeric : true
    },
    destAttrDesc : {
        suffix : "_log10"
    },
    opFn : genTransformFn((opRow, val) => Math.log10(val + opRow.params[0].value), "float")
},{
    opType : "transform_op",
    id : "identity",
    name : "attr -> attr (clone)",
    desc : "generates a new attribute which is a clone of given attr",

    groupModifierSupported : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[],
    sourceAttrDesc : {},
    destAttrDesc : {
        suffix : "_copy"
    },
    opFn : genTransformFn((opRow, val) => val, "copySrcType")
},{
    opType : "transform_op",
    id : "formatted_date",
    name : "timestamp -> formatted date",
    desc : "generates a new attribute from timestamp where the date is formatted with the given format string. http://momentjs.com/docs/#/displaying/format/",

    params :[
        genParam("format string", "the format string to use", "DD/MM/YY")
    ],
    compactInput : true,
    sourceAttrDesc : {
        isTimestamp : true
    },
    destAttrDesc : {
        suffix : "_formatted"
    },
    opFn : genTransformFn((opRow, val) => moment.unix(Number(val)).format(opRow.params[0].value), "string")
},{
    opType : "transform_op",
    id : "maths_script",
    name : "numeric attr -> numeric attr (math js scripting)",
    desc : "use mathjs scripts to transform attribute. http://mathjs.org/docs/expressions/syntax.html",

    groupModifierSupported : true,
    groupAttrDesc : {
        isNumeric : false,
        isTag : false,
        defAttrId : "Cluster"
    },

    params :[
        genParam("expression", "the numeric expression to use", "x ^ 2")
    ],
    sourceAttrDesc : {
        isNumeric : true
    },
    destAttrDesc : {
        suffix : "_updated"
    },
    opFn : genTransformFn(mathsJSTransform, "float")
}];


// a common fn builder for simple transformations like log / split strings
// tFn is (opRow, srcAttrId) => destVal
function genTransformFn(tFn, destAttrtype) {
    var opFn = function(opInst, nodes, nodeAttrs, links, linkAttrs) {
        if(!opInst.isGroupingEnabled) {
            console.log("[genTransformFn] Starting genTransformFn with opInst: ", opInst);
        }
        genDestAttrs(opInst, destAttrtype, nodeAttrs);
        _.each(nodes, function(node) {
            var newVals = _.reduce(opInst.opRows, function(acc, op) {
                var newVal = tFn(op, node.attr[op.srcAttrId]);
                if(newVal != null) acc[op.destAttrId] = newVal;
                return acc;
            }, {});
            // console.log("[genTransformFn] New Values: ", newVals);
            // copy over the new values into the node
            _.extend(node.attr, newVals);
        });
        return { nodes, links, nodeAttrs, linkAttrs };
    };
    return opFn;
}

// split string
function _split_string (opRow, val) {
    var splitChar = opRow.params[0].value || " ";
    console.log(`[_split_string] Splitting val: ${val} on char: ${splitChar}`);
    if(_.isString(val)) {
        return _.compact(_.map(val.split(splitChar), _.trim));
    } else return null;
}

function mathsJSTransform(opRow, val) {
    return math.eval(opRow.params[0].value, { x : val});
}

module.exports = {
    listing,
    forTesting : {
        _split_string
    }
};
