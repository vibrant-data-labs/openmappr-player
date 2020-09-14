"use strict";
var _       = require("lodash");
// sample op instance objects for base.xlsx
var baseOps = {
    // remove duplicates op
    "dedup" : {
        opType: "general_op",
        srcAttrId: "Sex",
        params: [{ value : "yes"}]
    },
    "replace_tags" : {
        opType : "general_op",
        srcAttrId : "Random Tags",
        params : [{
            id : "destAttrId_1",
            value : "CleanedTags"
        },{
            id : "replacements",
            value : ["ab -> gh", "bc -> cd"]
        }]
    },
    "summaries_numeric" : {
        id: "summaries_numeric",
        opType : "general_op",
        srcAttrId: "Some Ints",
        groupAttrId :"Grp1",
        params: [{
            id: "destAttr_prefix",
            value: "group_"
        },{
            id: "genOps",
            value: ["min", "max", "mean", "median"]
        }]
    },
    // reduce ops
    concatenate : {
        opType: "reduce_op",
        opRows: [{
            srcAttrId: "Sex"
        }, {
            srcAttrId: "City"
        }],
        destAttrId: "concatAttr"
    },
    // transform ops
    split_string : {
        opType: "transform_op",
        opRows: [{
            srcAttrId: "Branding",
            destAttrId : "Branding_tags",
            params : [{ value : ";"}]
        }, {
            srcAttrId: "Mailing Address",
            destAttrId : "Mailing Address_tags",
            params : [{ value : " "}]
        }]
    },
    identity : {
        opType: "transform_op",
        opRows: [{
            srcAttrId: "Branding",
            destAttrId : "Branding_dup"
        }, {
            srcAttrId: "Some Ints",
            destAttrId : "Some Ints_dup"
        }]
    },
    log10 : {
        opType: "transform_op",
        opRows: [{
            srcAttrId: "Some Ints",
            destAttrId : "Some Ints_log10",
            params : [{
                value : 20
            }]
        }]
    }
};

module.exports = {
    baseOps : function() {return _.cloneDeep(baseOps); }
};
