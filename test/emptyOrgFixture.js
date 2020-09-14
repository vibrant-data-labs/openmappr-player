'use strict';
/**
 * Sets up an empty organization called 'test_org'.
 * DOn't bother with cleanup since test db is purged before starting it up
 */

var _    = require('lodash'),
    mongoose = require('mongoose'),
    bcrypt   = require('bcrypt'),
    Promise  = require("bluebird");

var db  = require("../server/schemas"),
    orgModel     = require("../server/org/org_model.js"),
    userModel    = require("../server/user/user_model.js"),
    projModel    = require("../server/project/proj_model.js");

/////
/// Test Entities manages entities used in the test sutie.
/// Creates Test user / project / org
/// MongoSetup code is also here
///
var passwordHash = bcrypt.hashSync("woot", bcrypt.genSaltSync(8), null);
var testUsr = {
    name : "Test user",
    email: "test@mappr.io",
    local: {
        password : passwordHash
    }
};
var testOrg = {
    orgName : "Test Org",
    ownerEmail : "test@mappr.io"
};
var testProject = {
    projName : "Test Project 111",
    descr : "a test project for testing"
};

// update user and org post project creation
function postProjectCreate(user, org, projDoc) {
    var newProj = {
        ref: projDoc._id,
        projName: projDoc.projName,
        picture: projDoc.picture,
        owner: {
            ref: projDoc.owner.ref
        },
        members: projDoc.users.members,
        dateModified: projDoc.dateModified
    };
    //update org
    org.projects.push(newProj);

    user.projects.push({
        ref: projDoc._id,
        org: org._id,
        owner: projDoc.owner,
        permission: 'isOwner',
        projName: projDoc.projName,
        dateJoined: Date.now()
    });
}

function removeAndCreate () {
    return db.user.remove({"email" : testUsr.email})
    .then(function() {
        return db.org.remove({"orgName" : testOrg.orgName});
    })
    .then(function createTestUser() {
        return userModel.addAsync(userModel.create(testUsr));
    })
    .then(function createTestOrg(user) {
        // add org
        return orgModel.addAsync(testOrg)
        .then(function(org) {
            org.owner = {ref: user._id};
            org.users.members.push({
                ref: user._id,
                name: user.name,
                email: user.email,
                role: 'isOwner',
                dateJoined: Date.now()
            });
            user.orgs.push({
                ref:org._id, 
                owner: {ref: user._id}, 
                orgName: org.orgName, 
                role: 'isOwner', 
                isPending: false, 
                dateJoined: Date.now()
            });
            // add project
            var newProj = _.clone(testProject);
            newProj.org = {
                ref: org._id
            };
            newProj.owner = {
                ref: user._id
            };
            return projModel.addAsync(newProj)
            .then(function (proj) {
                postProjectCreate(user, org, proj);
                return Promise.join(user.save(), org.save(), proj.save(), function(user, org, proj) {
                    return [user, org, proj];
                });
            });
        });
    });
}

function genProject(projName, user, org) {
    // add project
    var newProj = _.clone(testProject);
    newProj.projName = projName;
    newProj.org = {
        ref: org._id
    };
    newProj.owner = {
        ref: user._id
    };

    return projModel.addAsync(newProj)
    .then(function (proj) {
        postProjectCreate(user, org, proj);
        return Promise.join(user.save(), org.save(), proj.save(), function(user, org, proj) {
            return proj;
        });
    });
}

module.exports = {
    removeAndCreate,
    genProject
};