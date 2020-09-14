"use strict";
var _ = require("lodash");
// sample inst objects for My-Animals-missingvals.xlsx
var datasetOps = [{
    testDesc : "test is concatenate op runs",
    id: "concatenate",
    opType: "reduce_op",
    opRows: [{
        srcAttrId: "K-Val"
    }, {
        srcAttrId: "Order"
    }, {
        srcAttrId: "Votes"
    }],
    destAttrId: "concatAttr"
}, {
    testDesc : "concatenate is executable",
    id: "log10",
    opType: "transform_op",
    opRows: [{
        srcAttrId: "Log Test Val",
        destAttrId: "Log Result",
        params: [{
            value: 0
        }]
    }]
}, {
    // test for summary
    testDesc : "test if log10 op works",
    id: "log10",
    opType: "transform_op",

    groupModifierSupported: true,
    isGroupingEnabled: true,
    groupRows: [{
        groupAttrId: "wild/domestic"
    }],
    isSummaryEnabled: true,
    summaryRows: [{
        summaryAttrId : "Order",
        generations: _.map(["unique", "maxFreq", "minFreq"], function(genName) {
            return {
                genName: genName,
                isChecked: true
            };
        })
    }],
    opRows: [{
        srcAttrId: "Log Test Val",
        destAttrId: "Log Result",
        params: [{
            value: 0
        }]
    }]
}];

var networkOps = [{
    // test for summary
    testDesc : "test if log10 op works",
    id: "log10",
    opType: "transform_op",

    groupModifierSupported: true,
    isGroupingEnabled: true,
    groupRows: [{
        groupAttrId: "Cluster"
    }],
    isSummaryEnabled: true,
    summaryRows: [{
        summaryAttrId : "Order",
        generations: _.map(["unique", "maxFreq", "minFreq"], function(genName) {
            return {
                genName: genName,
                isChecked: true
            };
        })
    }],
    opRows: [{
        srcAttrId: "Log Test Val",
        destAttrId: "Log Result",
        params: [{
            value: 0
        }]
    }]
}];

module.exports = {
    fileName: "My-Animals-missingvals.xlsx",
    datasetOps: function() {
        return _.cloneDeep(datasetOps);
    },
    networkOps: function() {
        return _.cloneDeep(networkOps);
    }
};
