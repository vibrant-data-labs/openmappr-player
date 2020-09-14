'use strict';

var expect = require('chai').expect,
    _ = require('lodash'),
    fs = require('fs'),
    Promise = require("bluebird"),
    ObjectID = require('mongodb').ObjectID;

var testEntities = require("../testEntities.js");

// create / update / read / delete tests
describe('recipe CRUD @test', function() {
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
                // expect(testEntities.getProj()).to.have.property('_id');
                expect(testEntities.getOrg()).to.have.property('_id');
                done();
            }, done);
        });
    });
});
