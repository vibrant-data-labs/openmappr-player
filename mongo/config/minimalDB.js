'use strict';
/**
 * Sets up an minimal organization with a basic user
 */

var _    = require('lodash'),
    mongoose = require('mongoose'),
    bcrypt   = require('bcrypt'),
    Promise  = require("bluebird");

var db  = require("../../server/schemas"),
    orgModel     = require("../../server/org/org_model.js"),
    userModel    = require("../../server/user/user_model.js"),
    projModel    = require("../../server/project/proj_model.js");

/////
/// Test Entities manages entities used in the test sutie.
/// Creates Test user / project / org
/// MongoSetup code is also here
///
var passwordHash = bcrypt.hashSync("woot", bcrypt.genSaltSync(8), null);
var testUsr = {
    name : "User",
    email: "user@mappr.io",
    local: {
        password : passwordHash
    }
};
var testOrg = {
    orgName : "Standard Org",
    ownerEmail : "user@mappr.io"
};
var testProject = {
    projName : "Demo Project",
    descr : "A basic project demonstrating the platform"
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

function setupMongo() {
    mongoose.connect('mongodb://localhost:27017/MAPPRDB');
    return Promise.fromCallback(function(cb) {
        mongoose.connection.once('open', function() {
            mongoose.connection.db.dropDatabase();
            cb(null,true);
        });
    });
}


function generateMinimalDb () {
    return setupMongo()
    .then(removeAndCreate)
    .then(genProject)
}

generateMinimalDb()
.then(console.log, console.log)
.finally(() => system.exit(0))
