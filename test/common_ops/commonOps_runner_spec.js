"use strict";
var _ = require("lodash"),
    Promise = require("bluebird"),
    expect = require("chai").expect;

/**
 * Tests for the execution engine for commonOps.
 */

var commonOpsListing = require("../../server/commonOps/commonOps_listing");
var commonOpsRunner = require("../../server/commonOps/commonOps_runner");

var DSModel = require("../../server/datasys/datasys_model");
var dataUtils = require("../../server/utils/dataUtils.js");

var testEntities = require("../testEntities.js");

var filePath = "./test/data/base.xlsx";
// var filePath = "./test/data/TED_Fellows_April2015_Trim.xlsx";
// var filePath = "./test/data/My-Animals-missingvals.xlsx";

var baseOps = require("./commonOps_insts").baseOps;

describe("common Ops runner specs @ops", () => {
    var rawData = null, dataset = null, network = null;

    function getDataset () {
        return _.cloneDeep(dataset);
    }
    function getNetwork () {
        return _.cloneDeep(network);
    }

    // generate dataset and network from raw data correctly, which can be saved
    function genNWData (rawData) {
        dataset = rawData.dataset;
        dataset = DSModel.createDataset("temp_project", "test_dataset", dataset.datapoints, dataset.attrDescriptors, dataset.sourceInfo, true);
        // console.log("Dataset: ", dataset);
        if(rawData.networks[0]) {
            network = DSModel.createNetwork(dataset, rawData.networks[0]);
        }
        // console.log("Network: ", network);
    }

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
            .then(ds => genNWData(ds))
            // .then((ds) => console.log("Loaded DataSource:", ds.dataset))
            .then(() => console.log("==== Finished Setup ===="))
            .then(done, done);
    });

    describe("areSourcesAvailable()", () => {

        it("true for attr in dataset", () => {
            var allOps = commonOpsListing.allOps();
            _.forOwn(baseOps(), function(opInst, opId) {
                var opDesc = _.find(allOps, "id", opId);
                if(!opDesc) {
                    console.warn("[areSourcesAvailable]", "not found opDesc for opId:", opId);
                    console.warn("available Ids are:", _.map(allOps,"id"));
                }
                expect(commonOpsRunner.forTesting.areSourcesAvailable(opDesc, opInst, getDataset().attrDescriptors)).to.be.true;
            });
        });
        it("false for attr not in dataset", () => {
            var newBaseOps = _.pick(baseOps(), ["dedup", "concatenate", "split_string", "identity", "log10"]);
            var allOps = commonOpsListing.allOps();
            newBaseOps.dedup.srcAttrId = "Bite Me";
            newBaseOps.concatenate.opRows[0].srcAttrId = "Boo Yeah";
            newBaseOps.split_string.opRows[0].srcAttrId = "Bite Me";
            newBaseOps.identity.opRows[0].srcAttrId = "Bite Me";
            newBaseOps.log10.opRows[0].srcAttrId = "Bite Me";
            _.forOwn([], function(opInst, opId) {
                var opDesc = _.find(allOps, "id", opId);
                expect(commonOpsRunner.forTesting.areSourcesAvailable(opDesc, opInst, getDataset().attrDescriptors)).to.be.false;
            });
        });
    });
    describe("validateOpInst()", () => {
        _.forOwn(baseOps(), function validateTestOpInst (opInst, opId) {
            it(`validateOpInst() for ${opId} test Inst should be true`, () => {
                var opDesc = _.find(commonOpsListing.allOps(), "id", opId);

                var valRun = commonOpsRunner.forTesting.validateOpInst(opDesc, opInst);

                expect(valRun).to.be.null;
            });
        });
    });
    describe("runOpOnDatasetAndNetwork() Tests", () => {
        describe("split_string op Tests should create new attr on dataset", () => {
            var opId = "split_string";
            it("split_string", () => {
                var opInst = baseOps()[opId];
                var opDesc = _.find(commonOpsListing.allOps(), "id", opId);

                var newData = commonOpsRunner.forTesting.runOpOnDatasetAndNetwork(opDesc, opInst, getDataset(), getNetwork());
                var nDS = newData[0], nNW = newData[1];
                console.log(`[${opId}] new Attrs dataset: `, _.map(nDS.attrDescriptors, "id"));
                _.each(nDS.datapoints, function  (node) {
                    _.each(opInst.opRows, function  (opR) {
                        var destVal = node.attr[opR.destAttrId];
                        if(!destVal) {console.log(`[${opId}] DestVal: ${JSON.stringify(node,null,2)}`);}
                        // console.log(`[${opId}] DestVal: ${JSON.stringify(destVal)}`);
                        expect(destVal).to.have.length.above(1);
                    });
                });
                assertDestAttrCreated(opInst, nDS.attrDescriptors);
            });
        });
    });

    describe("groupData() Tests", () => {
        it("groupData() is callable", () => {
            var dataset = getDataset();
            var opInst = {
                isGroupingEnabled : true,
                groupRows : [{
                    grpAttrId : "Country 1"
                },{
                    grpAttrId : "Gender"
                }]
            };
            var grpIdx = commonOpsRunner.forTesting.groupData(opInst, dataset.datapoints, dataset.attrDescriptors);
            // console.log("grpIdx: ", grpIdx);
        });
        it("partitioned Data works", () => {
            var dataset = getDataset();
            var opDesc = _.find(commonOpsListing.allOps(), "id", "summaries_numeric");
            var opInst = {
                opType: "general_op",
                srcAttrId : "Votes",
                params :[{
                    value: "group_"
                }, {
                    value: ["min", "max", "mean", "median"]
                }],
                isGroupingEnabled : true,
                groupRows : [{
                    grpAttrId : "wild/domestic"
                },{
                    grpAttrId : "Order"
                }]
            };
            var nDataset = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, dataset);
            // console.log("datapoints: ", nDataset.datapoints);
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
