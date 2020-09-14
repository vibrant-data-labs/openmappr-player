"use strict";
var _ = require("lodash"),
    Promise = require("bluebird"),
    expect = require("chai").expect;

/**
 * Framework for running ops on varity of files. For now, ops run on base.xlsx. This system will test all the
 * edge cases we encounter in production and ensure they never happen again. This done my storing the op and
 * the edge case data file and writing a test for it.
 * WIP
 */

var commonOpsListing = require("../../server/commonOps/commonOps_listing");
var commonOpsRunner = require("../../server/commonOps/commonOps_runner");

var DSModel = require("../../server/datasys/datasys_model");
var ProjModel = require("../../server/project/proj_model");
var dataUtils = require("../../server/utils/dataUtils.js");

var testEntities = require("../testEntities.js");

// var filePath = "./test/data/base.xlsx";
// var filePath = "./test/data/TED_Fellows_April2015_Trim.xlsx";
var filePath = "./test/data/My-Animals-missingvals.xlsx";

var animalsOps = require("./ops_library/my-animals-frag");

describe("Common Ops Tests @ops", function() {
    var files = ["./test/data/My-Animals-missingvals.xlsx", "./test/data/base.xlsx"];

    testAFile(files[0]);


    function testAFile(fileName) {
        describe(`commonOps tests for ${fileName}`, function() {
            // this.timeout(50000);
            var proj = null;
            // for each file, run all algos. and test results
            var dataset = null;

            function getDataset() {
                return _.cloneDeep(dataset);
            }

            // generate dataset from raw data correctly, which can be saved
            function genDataset(rawData) {
                // console.log("rawData: ", rawData);
                dataset = rawData.dataset;
                dataset = DSModel.createDataset(proj.id, "test_dataset", dataset.datapoints, dataset.attrDescriptors, dataset.sourceInfo, true);
                return dataset;
            }

            before(function(done) {
                testEntities.setupAthena();
                testEntities.setupMongo()
                    .then(() => testEntities.addUserOrgToDb())
                    .tap(() => {
                        proj = testEntities.getProj();
                    })
                    .then(() => dataUtils.parseExcelToGraph(filePath))
                    .then(function(result) {
                        // set generator type correctly
                        _.each(result.dataset.attrDescriptors, function(attrDescr) {
                            attrDescr.generatorType = "base";
                        });
                        return result;
                    })
                    .then(ds => genDataset(ds))
                    .then(ds => DSModel.saveDataset(ds))
                    .then(ds => ProjModel.updateDatasetAsync(proj, ds).thenReturn(ds))
                    .then(() => console.log("==== Finished Setup ===="))
                    .then(done, done);
            });

            // test dataset
            describe(`dataset tests for ${fileName}`, function() {
                animalsOps.myAnimals_dataset(getDataset);
            });
        });
    }

    function buildNetwork(projectId, fileName) {
        var netgenOps = [{
            "fileName" : "./test/data/My-Animals-missingvals.xlsx",
            "taskId": "athena_" + _.random(0, 100000, false).toString(),
            "algo_name": "links_FromAttributes",
            "options": {
                "analyseCurrentNetwork": false,
                "dataPointsToAnalyse": [],
                "questions": [{
                    "Question": "wild/domestic",
                    "qID": 0,
                    "qAnalysisType": 5
                }, {
                    "Question": "K-Val",
                    "qID": 1,
                    "qAnalysisType": 1
                }],
                "weightByFreq": true,
                "linksPer": 3,
                "keepDisconnected": false,
                "minAnsweredFrac": 0.5,
                "keepQuestions": true
            },
            "projectId": projectId,
            "newNetworkName": "Network 1",
            "createNew": true
        }];

    }


});
