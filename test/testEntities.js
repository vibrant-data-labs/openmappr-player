'use strict';
var _    = require('lodash'),
    mongoose = require('mongoose'),
    elasticsearch = require('elasticsearch'),
    Promise  = require("bluebird");

var emptyOrgFixture = require('./emptyOrgFixture.js');
var AthenaAPI = require('../server/services/AthenaAPI');
var ElasticSearchService = require('../server/services/elasticsearch');
var dataUtils = require("../server/utils/dataUtils.js");
var DSModel = require("../server/datasys/datasys_model");

Promise.longStackTraces();
// use bluebird for promises
mongoose.Promise = Promise;

var testUser = null, testOrg = null, testProj = null;

function addUserOrgToDb () {
    return emptyOrgFixture.removeAndCreate()
    .spread(function(user, org, proj) {
        testUser = user;
        testOrg = org;
        testProj = proj;
        return true;
    })
    .catch(function(err) {
        console.error("Unable to create entities!", err);
        throw err;
    });
}

function loadFileData (filePath) {
    var parser = dataUtils.getFileParser(filePath);
    return parser(filePath)
        .then(function (result) {
            // set generator type correctly
            _.each(result.dataset.attrDescriptors, function(attrDescr) {
                attrDescr.generatorType = "test_data";
            });
            return result;
        });
}
// generate dataset and network from raw data correctly, which can be saved
function genNWData (rawData, dataId) {
    var dataset = rawData.dataset;
    dataset = DSModel.createDataset("temp_project", "test_dataset", dataset.datapoints, dataset.attrDescriptors, dataset.sourceInfo, true);
    // console.log("Dataset: ", dataset);
    var network = DSModel.createNetwork(dataset, rawData.networks[0]);
    // console.log("Network: ", network);
    return { dataset, network };
}

///
/// API
///

var esClient = null, _mongoInitialized = false;
module.exports = {
    // addEntitiesToDB     : addEntitiesToDB,
    // removeEntitiesFromDB: removeEntitiesFromDB,
    // assertEntitiesExist : assertEntitiesExist,
    getUser             : function() { return testUser;},
    getProj             : function() { return testProj;},
    getOrg              : function() { return testOrg;},
    genProject :function (projName, user, org) {
        return emptyOrgFixture.genProject(projName, user, org);
    },
    loadFileData,
    addUserOrgToDb,
    setupAthena : function() {
        // if(!esClient) {
        var esClientCfg = {
            host: 'localhost:9200',
            log: 'error'
        };
        ElasticSearchService.init(function () {
            return new elasticsearch.Client(_.extend(_.clone(esClientCfg), {
                defer: function () {
                    return Promise.defer();
                }
            }));
        });

        // }
        return AthenaAPI.init('localhost', 11300);
    },
    setupMongo : function() {
        if(_mongoInitialized) {
            return Promise.resolve(null);
        }
        mongoose.connect('mongodb://localhost:27017/MAPPR_TEST');
        return Promise.fromCallback(function(cb) {
            mongoose.connection.once('open', function() {
                mongoose.connection.db.dropDatabase();
                _mongoInitialized = true;
                cb(null,true);
            });
        });
    },
    setupApp : function() {
        return this.setupMongo();
    }
};
