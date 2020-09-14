"use strict";
var _ = require("lodash"),
    Promise = require("bluebird"),
    expect = require("chai").expect;

/**
 * Test fragment for my-animals- file. It runs tests for corresponding instances in my-animals-insts.js
 */

var commonOpsListing = require("../../../server/commonOps/commonOps_listing");
var commonOpsRunner = require("../../../server/commonOps/commonOps_runner");

var ops = require("./my-animals-inst");


function myAnimals_dataset(datasetFn) {
    describe("my-animals dataset tests", function() {
        _.each(ops.datasetOps(), function (opInst) {
            var opId = opInst.id,
                opType = opInst.opType,
                opDesc = _.find(commonOpsListing.allOps(), "id", opId);

            it(`op id ${opId} of type: ${opType}. ${opInst.testDesc}`, function () {
                var ds = datasetFn();
                expect(opDesc).not.to.be.null;
                var allFromDataset = commonOpsRunner.forTesting.areSourcesAvailable(opDesc, opInst, ds.attrDescriptors);
                expect(allFromDataset).to.be.true;
                var newDs = commonOpsRunner.forTesting.runOpOnDataset(opDesc, opInst, ds);
                if(opInst.isSummaryEnabled) {
                    // console.log(`[myAnimals_dataset] attrs`, _.map(newDs.attrDescriptors, "id"));
                    // console.log(`[myAnimals_dataset] datapoints`, newDs.datapoints);
                }
            });
        });
    });
}

function myAnimals_network(datasetFn, networkFn) {
    describe("my-animals combined data tests", function() {

        _.each(ops.datasetOps(), function (opInst) {
            var opId = opInst.id,
                opType = opInst.opType,
                opDesc = _.find(commonOpsListing.allOps(), "id", opId);

            var ds = datasetFn();
            var nw = networkFn();

            it(`op id ${opId} of type: ${opType}. ${opInst.testDesc}`, function () {
                expect(opDesc).not.to.be.null;

                commonOpsRunner.forTesting.runOpOnDatasetAndNetwork(opDesc, opInst, ds, nw);
            });
        });
    });
}
module.exports = {
    myAnimals_network,
    myAnimals_dataset
};
