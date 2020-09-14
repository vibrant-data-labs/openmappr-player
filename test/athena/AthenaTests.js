var expect     = require('chai').expect,
    _          = require('lodash'),
    fs         = require('fs'),
    Promise    = require("bluebird"),
    ObjectID = require('mongodb').ObjectID;

var DSModel = require("../../server/datasys/datasys_model");
var ProjModel = require("../../server/project/proj_model");
var AthenaAPI = require('../../server/services/AthenaAPI');

var testEntities = require("../testEntities.js");

// "./node_modules/mocha/bin/mocha --recursive --grep @athena"

/**
 * Athena testing
 * - bunch of files
 * - for each file, run a particular config for that file
 * - check if the netgen happens
 */

var fileSpecsMap = {};
var testDir = "./test/data/athena_tests";

// andeMapp tests
var andeMapp = {
    "single liststring" : function (project) {
        var task = genAthenaTask(project._id);
        task.options.questions = [{
            "Question": "Areas of Focus",
            "qID": 2,
            "qAnalysisType": 3
        }];
        var athenaES = AthenaAPI.runAlgo(task);
        var onEnd = waitForFinish(task.taskId, athenaES);
        return onEnd;
    },
    "single categorical" : function (project) {
        var task = genAthenaTask(project._id);
        task.options.questions = [{
            "Question": "HQ State",
            "qID": 6,
            "qAnalysisType": 5
        }];
        var athenaES = AthenaAPI.runAlgo(task);
        var onEnd = waitForFinish(task.taskId, athenaES);
        return onEnd;
    },
    "single numerical" : function (project) {
        var task = genAthenaTask(project._id);
        task.options.questions = [{
            "Question": "Employees",
            "qID": 5,
            "qAnalysisType": 1
        }];
        var athenaES = AthenaAPI.runAlgo(task);
        var onEnd = waitForFinish(task.taskId, athenaES);
        return onEnd;
    },
    "a categorical, a numerical and a liststring" : function (project) {
        var task = genAthenaTask(project._id);
        task.options.questions = [{
            "Question": "HQ State",
            "qID": 6,
            "qAnalysisType": 5
        },{
            "Question": "Employees",
            "qID": 5,
            "qAnalysisType": 1
        },{
            "Question": "Areas of Focus",
            "qID": 2,
            "qAnalysisType": 3
        }];
        var athenaES = AthenaAPI.runAlgo(task);
        var onEnd = waitForFinish(task.taskId, athenaES);
        return onEnd;
    }
};

//Privacy Dataset specs
var privacyDataset = {
    "triple categorical" : function (project) {
        var task = genAthenaTask(project._id);
        task.options.questions = [{
            "Question": "topRankedSourceCategory",
            "qID": 0,
            "qAnalysisType": 5
        },{
            "Question": "topRankedSourceCountry",
            "qID": 1,
            "qAnalysisType": 5
        },{
            "Question": "topRankedSourceGenre",
            "qID": 2,
            "qAnalysisType": 5
        }];
        var athenaES = AthenaAPI.runAlgo(task);
        var onEnd = waitForFinish(task.taskId, athenaES);
        return onEnd;
    }
};

// a map from file Name -> {testName -> testFunc}
fileSpecsMap["ANDE-Mapp.xlsx"] = andeMapp;
// fileSpecsMap["April_Privacy_Dataset_ForMappr.xlsx"] = privacyDataset;
// fileSpecsMap["CreativityResearch_Oct2015_Keywords.xlsx"] = _.noop;
// fileSpecsMap["Sample-dataset-for-mappr.csv"] = _.noop;

describe("@athena Athena netgen tests", function () {
    var user = null, org = null;
    // read the data and create a project with this dataset
    before(function(done) {
        testEntities.setupAthena();
        testEntities.setupMongo()
            .then(() => testEntities.addUserOrgToDb())
            .then(() => {
                user = testEntities.getUser();
                org = testEntities.getOrg();
                return null;
            })
            .then(done, done);
    });

    _.forOwn(fileSpecsMap, function (specObj, fileName) {
        describe(`netgen on ${fileName}`, function () {
            this.timeout(200000);
            var proj = null;
            // crate a project and add the dataset to it
            before(function(done) {
                testEntities.genProject(fileName, user, org)
                    .then(project => {
                        proj = project;
                    })
                    .then(function () {
                        // load the file
                        return testEntities.loadFileData(testDir + '/' + fileName);
                    })
                    .get('dataset')
                    .then(function(dataset)  { return DSModel.createDataset(proj.id, "dataset", dataset.datapoints, dataset.attrDescriptors, dataset.sourceInfo, true); })
                    .then(function(ds)       { return DSModel.saveDataset(ds, false); })
                    .then(function(ds)       { return ProjModel.updateDatasetAsync(proj, ds).thenReturn(ds); })
                    .tap(function(dataset)   { console.log("Saved dataset :", dataset.id); })
                    .thenReturn(null)
                    .then(done, done);
            });
            _.forOwn(specObj, function (spec, specName) {
                if(specName.startsWith("__")) return;
                // finally run the spec
                it(`generate a network for ${specName}`, function (done) {
                    var onEnd = spec(proj);
                    // ensure the generated network is readable
                    onEnd
                        .get("networkId")
                        .then(nwid => DSModel.readNetwork(nwid, false, false))
                        .then(function (network) {
                            expect(network).to.have.property("nodes")
                                .with.length.above(1);
                            expect(network).to.have.property("links")
                                .with.length.above(1);
                        })
                        .thenReturn(null).then(done,done);
                });
            });
        });
    });
});


function genAthenaTask(projectId) {
    var task = {
        "taskId": "athena_" + _.random(1,10000),
        "algo_name": "links_FromAttributes",
        "options": {
            "analyseCurrentNetwork": false,
            "dataPointsToAnalyse": [],
            "questions": [],
            "weightByFreq": true,
            "linksPer": 3,
            "fineClusters": false,
            "keepDisconnected": false,
            "minAnsweredFrac": 0.5,
            "mergeClusters": false,
            "keepQuestions": true
        },
        "projectId": projectId.toString(),
        "newNetworkName": "Network 1",
        "createNew": true
    };
    return task;
}

function genForceDirectLayoutTask(projectId, networkId) {
    var task = {
        "taskId": "athena_" + _.random(1,10000),
        "algo_name": "layout_clustered",
        "options": {
            "clumpiness": 0.3,
            "maxSteps": 500,
            "byAttribute": true,
            "clustering": "Cluster",
            "layoutName": "Clustered_1"
        },
        "projectId": projectId.toString(),
        "networkId": networkId,
        "newNetworkName": null,
        "createNew": false
    };
    return task;
}

function waitForFinish(taskId, athenaES) {
    console.log("waitForFinish from beanstalkd to socketio: ", taskId);
    var id = '' + taskId;

    return new Promise(function (resolve, reject) {
        var result = null;
        athenaES.on('data', function(payload) {
            // console.log("waitForFinish: Got payload:", payload);
            if(payload.type === 'update' && id && payload.status) {
                // var completion = typeof payload.completion != "number" ? parseInt(payload.completion,10) : payload.completion;
                // update(id, payload.status, payload.result, completion);
                console.log("[Athena][update]", payload.result);
                result = payload.result;
            }
            else if(payload.type === 'delete' && id) {
                // resolve(id);
            }
            else if(payload.type === 'error' && id) {
                // update(id, payload.status, payload.result, 0);
                reject(payload.result);
            }
            else if(payload.type === 'notify' && id) {
                // notify(id, payload);
                console.log("[Athena][notify]", payload.msg);
            }
            else {
                console.log("invalid event", payload);
            }
        });
        athenaES.on('error', function(data) {
            console.log("waitForFinish: error:", data);
            data.result && console.warn("Athena Error:", data.result);
            // update(id, data.status, data.result, 0);
            // remove(id);
            reject(data.result);
        });
        athenaES.on('end', function() {
            resolve(result);
        });
    });
}
