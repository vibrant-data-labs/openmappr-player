'use strict';
var testEntities = require("./testEntities.js");

var expect = require('chai').expect,
    _ = require('lodash'),
    Promise = require("bluebird");

// @test tagged. @test tags are for tests which need to work for rest of suite to be testable
describe('testEntities @test', function() {
    before(function(done) {
        testEntities.setupMongo()
            .then(function() {
                return null;
            })
            .then(done, done);
    });
    this.timeout(5000);
    //
    // addEntitiesToDB()
    //
    describe('#addEntitiesToDB()', function() {
        it('it should create the test entities in the database', function(done) {
            testEntities.addUserOrgToDb().then(function(isSuccessful) {
                expect(isSuccessful).to.be.true;
                expect(testEntities.getUser()).to.have.property('_id');
                expect(testEntities.getProj()).to.have.property('_id');
                expect(testEntities.getOrg()).to.have.property('_id');
                done();
            }, done);
        });
    });
});