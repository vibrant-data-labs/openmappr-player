'use strict';

var expect     = require('chai').expect,
    _          = require('lodash'),
    util       = require('util'),
    EventEmitter= require('events'),
    fs         = require('fs'),
    Promise    = require("bluebird"),
    ObjectID = require('mongodb').ObjectID;

var testEntities = require("../testEntities.js");

var ETLMixin = require('../../server/recipe/gen_etl');
var Reporter = require('../../server/recipe/recipe_reporter');
var recipeModel = require('../../server/recipe/recipe_model.js');

var _sliceETLConfig = require("./sampleTestConfig.js").sliceETLConfig;

function MockEngine(recipe, org) {
    this.recipe = recipe;
    this.org = org;
}
ETLMixin.call(MockEngine.prototype);
util.inherits(MockEngine, EventEmitter);

// create / update / read / delete tests
describe('etl mixin tests @etlmixin', function(){
    var user, org, recipe;
    before(function(done) {
        testEntities.setupAthena();
        testEntities.setupMongo()
        .then(() => testEntities.addUserOrgToDb())
        .then(() => {
            user = testEntities.getUser();
            org = testEntities.getOrg();
            return null;
        })
        .then(() => recipeModel.addAsync(_sliceETLConfig))
        .then(r => recipe = r)
        .thenReturn(null)
        .then(done, done);
    });
    this.timeout(500000);

    describe('testing etl mixin with slice data', function(){
        it('it should successfully process 30mb of slice data', function(done){
            var etlInst = buildETLMixin();
            _.set(etlInst, "run._id","dummyEtlRun");
            etlInst.emit('book', 'booom!');
            etlInst.gen_etl(new Reporter(etlInst, {}))
            .then(result => console.log('etl result:', result))
            .then(done,done);
        });
    });

    function buildETLMixin() {
        var etlInst = new MockEngine(recipe, org);
        return etlInst;
    }

});

