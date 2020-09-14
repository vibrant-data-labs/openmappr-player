"use strict";
var _ = require("lodash"),
    Promise = require("bluebird"),
    expect = require("chai").expect;

/**
 * Contains test for each individual commonOps to verify their workings.
 * All these ops are for base.xlsx
 */


var commonOpsListing = require("../../server/commonOps/commonOps_listing");
var commonOpsRunner = require("../../server/commonOps/commonOps_runner");

var DSModel = require("../../server/datasys/datasys_model");
var dataUtils = require("../../server/utils/dataUtils.js");

var testEntities = require("../testEntities.js");
var baseOps = require("./commonOps_insts").baseOps;

var filePath = "./test/data/base.xlsx";

describe("common Ops on Data @ops", () => {
    var rawData = null;

    before(function(done) {
        testEntities.setupAthena();
        testEntities.setupMongo()
            .then(() => testEntities.addUserOrgToDb())
            .then(() => {
                // user = testEntities.getUser();
                // org = testEntities.getOrg();
                return null;
            })
            .then(() => dataUtils.parseExcelToGraph(filePath))
            .then(function(result) {
                // set generator type correctly
                _.each(result.dataset.attrDescriptors, function(attrDescr) {
                    attrDescr.generatorType = "base";
                });
                return result;
            })
            .then(ds => rawData = ds)
            // .then((ds) => console.log("LOaded DataSource:", ds))
            .then(() => console.log("==== Finished Setup ===="))
            .then(done, done);
    });

    it("allOps() should return a listing of ops", () => {
        var ops = commonOpsListing.allOps();
        expect(ops).to.have.length.above(4);
    });

    describe("genDestAttrs()", () => {
        it("should generate new attr descriptor if it doesn't exist for reduce_op", () => {
            var dataset = rawData.dataset;
            var concatenateOp = baseOps().concatenate;
            var attrs1 = _.cloneDeep(dataset.attrDescriptors);

            commonOpsListing.forTesting.genDestAttrs(concatenateOp, "liststring", attrs1);
            expect(attrs1.length - dataset.attrDescriptors.length).to.equal(1);

            var attr = _.find(attrs1, "id", concatenateOp.destAttrId);
            expect(attr).to.have.property("id", concatenateOp.destAttrId);
            expect(attr).to.have.property("attrType", "liststring");
        });

        it("should generate new attr descriptor if it doesn't exist for transform_op", () => {
            var dataset = rawData.dataset;
            // transform op
            var split_stringOp = baseOps().split_string;
            var attrs1 = _.cloneDeep(dataset.attrDescriptors);

            commonOpsListing.forTesting.genDestAttrs(split_stringOp, "liststring", attrs1);
            expect(attrs1.length - dataset.attrDescriptors.length).to.equal(split_stringOp.opRows.length);

            _.each(split_stringOp.opRows, function(op) {
                var attr = _.find(attrs1, "id", op.destAttrId);
                expect(attr).to.have.property("id", op.destAttrId);
                expect(attr).to.have.property("attrType", "liststring");
            });
        });
        it("should generate new attr descriptor if it doesn't exist for transform_op and copy src type correctly", () => {
            var dataset = rawData.dataset;
            var identityOp = baseOps().identity;
            var attrs1 = _.cloneDeep(dataset.attrDescriptors);

            commonOpsListing.forTesting.genDestAttrs(identityOp, "copySrcType", attrs1);
            expect(attrs1.length - dataset.attrDescriptors.length).to.equal(identityOp.opRows.length);

            _.each(identityOp.opRows, function(op) {
                var attr = _.find(attrs1, "id", op.destAttrId), srcAttr = _.find(attrs1, "id", op.srcAttrId);
                expect(attr).to.have.property("id", op.destAttrId);
                expect(attr).to.have.property("attrType", srcAttr.attrType);
            });
        });


        it("should not generate attr descriptor if it already exist for reduce_op", () => {
            var dataset = rawData.dataset;
            var concatenateOp = baseOps().concatenate;
            concatenateOp.destAttrId = "Sex";

            var attrs1 = _.cloneDeep(dataset.attrDescriptors);

            commonOpsListing.forTesting.genDestAttrs(concatenateOp, "liststring", attrs1);
            var attr = _.find(attrs1, "id", concatenateOp.destAttrId);
            expect(attr).to.have.property("id", concatenateOp.destAttrId);
            expect(attr).to.have.property("attrType", "liststring");
        });

        it("should not generate attr descriptor if it already exist for transform_op", () => {
            var dataset = rawData.dataset;
            var split_stringOp = baseOps().split_string;
            _.each(split_stringOp.opRows,op => {
                op.destAttrId = op.srcAttrId;
            });
            var attrs1 = _.cloneDeep(dataset.attrDescriptors);

            commonOpsListing.forTesting.genDestAttrs(split_stringOp, "liststring", attrs1);
            _.each(split_stringOp.opRows, function(op) {
                var attr = _.find(attrs1, "id", op.destAttrId);
                expect(attr).to.have.property("id", op.destAttrId);
                expect(attr).to.have.property("attrType", "liststring");
            });
        });

        it("should not generate attr descriptor if it already exist for transform_op and update scr type correctly", () => {
            var dataset = rawData.dataset;
            var identityOp = baseOps().identity;
            _.each(identityOp.opRows,op => {
                op.destAttrId = op.srcAttrId;
            });
            var attrs1 = _.cloneDeep(dataset.attrDescriptors);

            commonOpsListing.forTesting.genDestAttrs(identityOp, "copySrcType", attrs1);
            _.each(identityOp.opRows, function(op) {
                var attr = _.find(attrs1, "id", op.destAttrId), srcAttr = _.find(attrs1, "id", op.srcAttrId);
                expect(attr).to.have.property("id", op.destAttrId);
                expect(attr).to.have.property("attrType", srcAttr.attrType);
            });
        });
    });

    ///
    /// Individual operation tests
    ///
   
    //
    // General Op tests
    //
    describe("dedup op Tests @opsy", () => {
        var opId = "dedup";
        it("dedup on base.xlsx 'Sex' should only give 1 datapoint", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];
            var opDesc = _.find(commonOpsListing.allOps(), "id", opId);

            var newData = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);
            // console.log("NewData :", newData);
            // console.log("NewData.datapoints:", newData.datapoints);
            // console.log("NewData.links:", newData.links);
        });
    });

    describe("replace_tags op Tests", () => {
        var opId = "replace_tags";

        it("replace tags full tests", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];
            var opDesc = _.find(commonOpsListing.allOps(), "id", opId);
            var destAttrId = opInst.params[0].value;

            var newData = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);

            _.each(newData.datapoints, function  (dp) {
                var destVal = dp.attr[destAttrId];
                // console.log(`[${opId}] DestVal: ${JSON.stringify(destVal)}`);
                expect(destVal).to.have.length.above(0);
            });
            assertDestAttrCreated(opInst, dataset.attrDescriptors);
        });
    });
    describe("summaries_numeric op Tests", () => {
        var opId = "summaries_numeric";

        it("numeric summaries tests", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];
            var opDesc = _.find(commonOpsListing.allOps(), "id", opId);
            var destAttrId = opInst.params[0].value;

            var newData = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);

            // _.each(newData.datapoints, function  (dp) {
            //     var destVal = dp.attr[destAttrId];
            //     console.log(`[${opId}] DestVal: ${JSON.stringify(destVal)}`);
            //     expect(destVal).to.have.length.above(0);
            // });
            // assertDestAttrCreated(opInst, dataset.attrDescriptors);
        });
    });
    //
    // Reduce Op Tests
    //
    describe("concat op Tests", () => {
        var opId = "concatenate";
        it("_concat()", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];

            _.each(dataset.datapoints, function  (dp) {
                var destVal = commonOpsListing.forTesting._concat(opInst, dp.attr);
                expect(destVal).to.have.length.above(0);
            });
        });
        it("concat op tests", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];
            var opDesc = _.find(commonOpsListing.allOps(), "id", opId);

            var newData = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);

            _.each(newData.datapoints, function  (dp) {
                var destVal = dp.attr[opInst.destAttrId];
                // console.log(`[${opId}] DestVal: ${JSON.stringify(destVal)}`);
                expect(destVal).to.have.length.above(0);
            });
            assertDestAttrCreated(opInst, dataset.attrDescriptors);
        });
    });

    //
    // Transform Op Tests
    //

    describe("log10 op Tests", () => {
        var opId = "log10";
        it("log10", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];
            var opDesc = _.find(commonOpsListing.allOps(), "id", opId);

            // console.log("opInst: ", opInst);
            // console.log("opDesc: ", opDesc);

            var newData = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);

            _.each(newData.datapoints, function  (dp) {
                var opR = opInst.opRows[0];
                var srcVal = dp.attr[opR.srcAttrId];
                var destVal = dp.attr[opR.destAttrId];
                expect(destVal).to.be.above(1);
                expect(destVal).to.be.equal(Math.log10(srcVal + opR.params[0].value));
            });
            assertDestAttrCreated(opInst, dataset.attrDescriptors);
        });
    });

    describe("split_string op Tests", () => {
        var opId = "split_string";
        it("split_string", () => {
            var dataset = rawData.dataset;
            var opInst = baseOps()[opId];
            var opDesc = _.find(commonOpsListing.allOps(), "id", opId);

            var newData = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);

            _.each(newData.datapoints, function  (dp) {
                _.each(opInst.opRows, function  (opR) {
                    var destVal = dp.attr[opR.destAttrId];
                    // console.log(`[${opId}] DestVal: ${JSON.stringify(destVal)}`);
                    expect(destVal).to.have.length.above(1);
                });
            });
            assertDestAttrCreated(opInst, dataset.attrDescriptors);
        });
    });
});

// make sure attrDescriptors has all the destAttrs
function assertDestAttrCreated (opInst, attrDescriptors) {
    var desAttrIds = [], idx = _.indexBy(attrDescriptors, "id");
    if(opInst.opType === "reduce_op") {
        desAttrIds.push(opInst.destAttrId);
    } else {
        desAttrIds = _.map(opInst.opRows, "destAttrId");
    }
    _.each(desAttrIds, attrId => expect(idx).to.have.property(attrId));
}
