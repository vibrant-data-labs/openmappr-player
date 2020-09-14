'use strict';

//
// All these tests ensure minimal correct functioning. With hand marshalled data
//

var expect = require('chai').expect,
    _ = require('lodash'),
    util = require('util'),
    fs = require('fs'),
    Promise = require("bluebird"),
    ObjectID = require('mongodb').ObjectID;

var DSModel = require('../../server/datasys/datasys_model');
var RecipeEngine = require('../../server/recipe/recipeEngine.js'),
    recipeModel = require('../../server/recipe/recipe_model.js'),
    recipeRunModel = require('../../server/recipe/recipeRun_model.js');

var dataUtils = require("../../server/utils/dataUtils.js");
var NetworkDataCache = require("../../server/services/NetworkDataCache.js");

var testEntities = require("../testEntities.js");
var _sampleRecipeCfg = require("./sampleTestConfig.js").sampleRecipe;
var _s3MultiSampleConfig = require("./sampleTestConfig.js").s3MultiSampleConfig;
var _alchemySampleRecipe = require("./sampleTestConfig.js").alchemySampleRecipe;
var _globbingRecipe = require("./sampleTestConfig.js").globbingRecipe;
var _retailerEcoConfig = require("./sampleTestConfig.js").retailerEcoConfig;
// create / update / read / delete tests
describe('@recipe recipe Machine tests', function() {
    var
        sampleTmpl = null,
        alSampleTmpl = null,
        glSampleTmpl = null,
        retailerTmpl = null,
        user = null,
        org = null;

    before(function(done) {
        testEntities.setupAthena();
        testEntities.setupMongo()
            .then(() => testEntities.addUserOrgToDb())
            .then(() => {
                user = testEntities.getUser();
                org = testEntities.getOrg();
                return null;
            })
            // setup recipe object
            .then(() => recipeModel.addAsync(_sampleRecipeCfg))
            .then(tmpl => sampleTmpl = tmpl)
            // .then(() => recipeModel.addAsync(_s3MultiSampleConfig))
            // .then(tmpl => sampleTmpl = tmpl)
            .then(() => recipeModel.addAsync(_alchemySampleRecipe))
            .then(tmpl => alSampleTmpl = tmpl)
            .then(() => recipeModel.addAsync(_globbingRecipe))
            .then(tmpl => glSampleTmpl = tmpl)
            .then(() => recipeModel.addAsync(_retailerEcoConfig))
            .then(tmpl => retailerTmpl = tmpl)
            .then(() => console.log("==== Finished Setup ===="))
            .then(done, done);
    });
    this.timeout(200000);

    // describe("file upload based recipes", function () {
    //     var rawData = null;
    //     // var filePath = "./test/data/TED_Fellows_April2015_Trim.xlsx";
    //     var filePath = "./test/data/Retailer_Ecosystem.xls";

    //     // load all file based data
    //     before(function(done) {
    //         var sourceInfo = sourceInfo || {
    //             sourceType : 'xlsx',
    //             sourceURL : 'Retailer_Ecosystem'
    //         };
    //         dataUtils.parseExcelToGraph(filePath)
    //             .then(function (result) {
    //                 // set generator type correctly
    //                 _.each(result.dataset.attrDescriptors, function(attrDescr) {
    //                     attrDescr.generatorType = 'Retailer_Ecosystem';
    //                 });
    //                 _.assign(result.dataset.sourceInfo, sourceInfo);
    //                 // console.log("DataSource", result);
    //                 return result;
    //             })
    //             .then(ds => rawData = ds)
    //             // .then((ds) => console.log("Loaded DataSource:", ds))
    //             .then(() => console.log("==== Finished Setup ===="))
    //             .then(done, done);
    //     });

    //     describe('#snapshot generation tests', function(){
    //         var engine = null;
    //         before(function(done) {
    //             var tmplObj = retailerTmpl.toObject();
    //             NetworkDataCache.cacheNetworkData(rawData)
    //             .then(function(uploadId) {
    //                 engine = new RecipeEngine(tmplObj, user, org, {
    //                     uploadId: uploadId
    //                 });
    //                 bindEventStreamToConsole(engine);
    //                 return null;
    //             })
    //             .then(done,done);
    //         });
    //         it('it should generate snapshots successfully', function(done){
    //             engine.begin_gen().bind(engine)
    //             .then(function () {
    //                 var networkIds = _.flatten(_.map(this._runningArtifacts,'networkIds'));
    //                 console.log("Got networkIds: ",util.inspect(networkIds));
    //                 expect(networkIds).to.have.length.of.at.least(2);
    //                 return networkIds;
    //             })
    //             .map(networkId => DSModel.readNetwork(networkId, false, false))
    //             // check if they can be read
    //             .each(function(network) {
    //                 expect(network).to.have.property('nodes').with.length.of.at.least(10);
    //                 expect(network).to.have.property('links').with.length.of.at.least(10);
    //                 expect(network).to.have.property('nodeAttrDescriptors');
    //                 expect(network).to.have.property('linkAttrDescriptors');
    //                 console.log("Network:", _.omit(network, ["nodes", "links", "nodeAttrDescriptors", "linkAttrDescriptors"]));
    //             })
    //             // check if default network got named correctly
    //             .then(function (networks) {
    //                 expect(networks).to.have.lengthOf(2);
    //                 expect(networks).to.have.deep.property("0.name", "Customers");
    //                 return null;
    //             })
    //             // tests snaps
    //             .then(function () {
    //                 var proj = this._runningArtifacts[0].project;
    //                 expect(proj).to.exist;
    //                 expect(proj).to.have.property('snapshots')
    //                     .to.have.length.of.at.least(3);
    //                 var snapshots = proj.snapshots;

    //                 var networkIds = _.flatten(_.map(this._runningArtifacts,'networkIds'));


    //                 /// check 3rd custom snapshot to have correct props
    //                 /// two are auto gen for each network
    //                 expect(snapshots[4]).to.have.property("snapName", "Spend vs Orders");
    //                 expect(snapshots[4]).to.have.deep.property("layout.plotType", "scatterplot");
    //                 expect(snapshots[4]).to.have.deep.property("layout.xaxis", "log_orders");
    //                 expect(snapshots[4]).to.have.deep.property("layout.yaxis", "log_spend");

    //                 expect(snapshots[4]).to.have.deep.property("layout.settings.labelSizeRatio", 0.5);
    //                 expect(snapshots[4]).to.have.deep.property("layout.settings.maxLabelSize", 16);
    //                 expect(snapshots[4]).to.have.deep.property("layout.settings.minLabelSize", 12);
    //                 expect(snapshots[4]).to.have.deep.property("layout.settings.nodeColorAttr", "log_spend");
    //                 expect(snapshots[4]).to.have.deep.property("layout.settings.nodeSizeAttr", "log_spend");
    //                 expect(snapshots[4]).to.have.deep.property("layout.settings.nodeSizeMultiplier", 0.5);

    //                 // _.each(snapshots, snap => expect(snap).to.have.property("networkId", networkIds));
    //                 console.log("snapshots setings", _.map(snapshots, "layout.settings"));
    //                 console.log("snapshots networks", _.map(snapshots, "networkId"));
    //                 console.log("gen networks", networkIds);
    //             })
    //             .then(done, done);
    //         });
    //     });


    //     this.timeout(200000);
    // });
    describe("S3 ETL recipes tests", function() {
        this.timeout(2000000);
        describe('#snapshot generation tests for retailerTmpl', function() {
            var engine = null;
            before(function() {
                var tmplObj = retailerTmpl.toObject();
                engine = new RecipeEngine(tmplObj, user, org, {});
                bindEventStreamToConsole(engine);
                return null;
            });
            it('it should generate snapshots successfully', function(done) {
                engine.begin_gen({}, {}).bind(engine)
                    .then(function() {
                        var networkIds = _.flatten(_.map(this._runningArtifacts, 'networkIds'));
                        console.log("Got networkIds: ", util.inspect(networkIds));
                        expect(networkIds).to.have.length.of.at.least(2);
                        return networkIds;
                    })
                    .map(networkId => DSModel.readNetwork(networkId, false, false))
                    // check if they can be read
                    .each(function(network) {
                        expect(network).to.have.property('nodes').with.length.of.at.least(10);
                        expect(network).to.have.property('links').with.length.of.at.least(10);
                        expect(network).to.have.property('nodeAttrDescriptors');
                        expect(network).to.have.property('linkAttrDescriptors');
                        console.log("Network:", _.omit(network, ["nodes", "links", "nodeAttrDescriptors", "linkAttrDescriptors"]));
                    })
                    // check if default network got named correctly
                    .then(function(networks) {
                        expect(networks).to.have.lengthOf(2);
                        expect(networks).to.have.deep.property("0.name", "Customers");
                        return null;
                    })
                    .then(done, done);
            });
        });
    });
    // project creation tests
    //    describe('#Project Creation tests', function(){
    //        it('it should create basic project successfully', function(done){
    //            var tmplObj = sampleTmpl.toObject();
    //            var engine = new RecipeEngine(tmplObj, user, org, {
    //                skipDataSourceParsing : true,
    //                skipDatasetGen : true,
    //                skipNetworkGen : true
    //            });
    //            bindEventStreamToConsole(engine);
    //            return engine.begin_gen().bind(engine)
    //            .then(function () {
    //                var proj = this.project;
    //                expect(proj).to.have.property('_id');
    //                expect(user.projects).to.have.deep.property('[0].ref', proj.id);
    //                expect(org.projects).to.have.deep.property('[0].ref', proj.id);
    //                return null;
    //            })
    //            .then(done, done);
    //        });
    //    });

    //    // data source tests
    //    describe('#data source tests', function(){
    //        it('it should process uploadData successfully', function(done){
    //            var tmplObj = sampleTmpl.toObject();
    //            NetworkDataCache.cacheNetworkData(rawData)
    //            .then(function(uploadId) {
    //                var engine = new RecipeEngine(tmplObj, user, org, {uploadId: uploadId});
    //                bindEventStreamToConsole(engine);
    //                return engine.gen_dataSource()
    //                .then(function (ds) {
    //                    expect(ds).to.have.property('datapoints');
    //                    expect(ds).to.have.property('attrDescriptors');
    //                    expect(engine.dataSource).to.have.property('networks');
    //                    return null;
    //                });
    //            })
    //            .then(done, done);
    //        });
    // });

    // dataset generation tests
    // describe('#data source tests', function(){
    //     var engine = null;
    //     before(function(done) {
    //         var tmplObj = sampleTmpl.toObject();
    //         NetworkDataCache.cacheNetworkData(rawData)
    //         .then(function(uploadId) {
    //             engine = new RecipeEngine(tmplObj, user, org, {
    //                 uploadId: uploadId,
    //                 skipNetworkGen : true
    //             });
    //             bindEventStreamToConsole(engine);
    //             return null;
    //         })
    //         .then(done,done);
    //     });
    //     it('it should process dataset generation phase successfully', function(done){
    //         engine.begin_gen().bind(engine)
    //         .then(function () {
    //             var ds = this.dataset;
    //             expect(ds).to.have.property('id');
    //             expect(ds).to.have.property('datapoints');
    //             expect(ds).to.have.property('attrDescriptors');
    //             expect(this).to.have.deep.property('project.dataset.ref', ds.id);
    //             return ds.id;
    //         })
    //         // read back from grid to be sure
    //         .then(function(dsId) {
    //             console.log("Reading dataset with Id: ", dsId);
    //             return DSModel.readDataset(dsId)
    //             .then(function(ds) {
    //                 expect(ds).to.have.property('id');
    //                 expect(ds).to.have.property('datapoints');
    //                 expect(ds).to.have.property('attrDescriptors');
    //                 return null;
    //             });
    //         })
    //         .then(done, done);
    //     });
    // });
    // network generation tests
    // describe('#network generation tests', function(){
    //     var engine = null;
    //     before(function(done) {
    //         var tmplObj = sampleTmpl.toObject();
    //         NetworkDataCache.cacheNetworkData(rawData)
    //         .then(function(uploadId) {
    //             engine = new RecipeEngine(tmplObj, user, org, {
    //                 uploadId: uploadId
    //             });
    //             bindEventStreamToConsole(engine);
    //             return null;
    //         })
    //         .then(done,done);
    //     });
    //     it('it should generate network successfully', function(done){
    //         engine.begin_gen().bind(engine)
    //         .then(function () {
    //             var networkIds = this.networkIds;
    //             console.log("Got Result",util.inspect(networkIds));
    //             expect(networkIds).to.have.length.of.at.least(1);
    //             return networkIds;
    //         })
    //         .spread(function(networkId) {
    //             return DSModel.readNetwork(networkId)
    //             .then(function (network) {
    //                 expect(network).to.have.property('nodes');
    //                 expect(network).to.have.property('links');
    //                 expect(network).to.have.property('nodeAttrDescriptors');
    //                 expect(network).to.have.property('linkAttrDescriptors');
    //                 return null;
    //             });
    //         })
    //         .then(done, done);
    //     });
    // });
    //

    // test alchemy recipe
    // describe('#alchemy recipe generation tests', function(){
    //     var engine = null;
    //     before(function() {
    //         var tmplObj = alSampleTmpl.toObject();
    //         engine = new RecipeEngine(tmplObj, user, org, {
    //         });
    //         bindEventStreamToConsole(engine);
    //     });
    //     it('it should generate network from alchemy keywords successfully', function(done){
    //         engine.begin_gen().bind(engine)
    //         .then(function () {
    //             var networkIds = _.flatten(_.map(this._runningArtifacts,'networkIds'));
    //             console.log("Got Result",util.inspect(networkIds));
    //             expect(networkIds).to.have.length.of.at.least(1);
    //             return networkIds;
    //         })
    //         .spread(function(networkId) {
    //             return DSModel.readNetwork(networkId)
    //             .then(function (network) {
    //                 expect(network).to.have.property('nodes');
    //                 expect(network).to.have.property('links');
    //                 expect(network).to.have.property('nodeAttrDescriptors');
    //                 expect(network).to.have.property('linkAttrDescriptors');
    //                 return null;
    //             });
    //         })
    //         .then(done, done);
    //     });
    // });
    // test globbing recipe
    // describe('#alchemy recipe generation tests', function(){
    //     var engine = null,
    //         recipeRun = null;
    //     before(function() {
    //         var tmplObj = glSampleTmpl.toObject();
    //         engine = new RecipeEngine(tmplObj, user, org, {
    //         });
    //         recipeRun = recipeRunModel.startNewRun(glSampleTmpl, engine);
    //         bindEventStreamToConsole(engine);
    //     });
    //     it('it should glob files and generate multiple projects successfully', function(done){
    //         engine.begin_gen().bind(engine)
    //         .then(function () {
    //             var networkIds = _.flatten(_.map(this._runningArtifacts,'networkIds'));
    //             console.log("Got Result",util.inspect(networkIds));
    //             expect(networkIds).to.have.length.of.at.least(1);
    //             return networkIds;
    //         })
    //         .spread(function(networkId) {
    //             return DSModel.readNetwork(networkId)
    //             .then(function (network) {
    //                 expect(network).to.have.property('nodes');
    //                 expect(network).to.have.property('links');
    //                 expect(network).to.have.property('nodeAttrDescriptors');
    //                 expect(network).to.have.property('linkAttrDescriptors');
    //                 return null;
    //             });
    //         })
    //         .then(done, done);
    //     });
    // });

});

function bindEventStreamToConsole(engine) {
    engine.on('info', msg => console.log(`[Engine.INFO]${msg}`));
    engine.on('progress', msg => console.log(`[Engine.PROGRESS]${msg.msg}`));
    engine.on(engine.VALIDATION_FAILED, msg => console.log("[Engine.VALIDATION_FAILED]" + msg));
    engine.on('error', msg => console.log("[Engine.ERROR]" + msg));
}
