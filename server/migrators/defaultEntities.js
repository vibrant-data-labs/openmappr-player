'use strict';
var _    = require('lodash'),
    bcrypt   = require('bcrypt'),
    Promise  = require("bluebird");


var orgModel     =  require("../org/org_models"),
    userModel    =  require("../user/user_model"),
    AppConfig = require('../services/AppConfig');

var defaultUser = _.get(AppConfig.get(), 'defaultUser');

/////
// Monster user
//
var passwordHash = bcrypt.hashSync(defaultUser.password, bcrypt.genSaltSync(8), null);
var monsterUsr = {
    name : defaultUser.name,
    email: defaultUser.email,
    local: {
        password : passwordHash
    }
};

var testOrg = {
    orgName : defaultUser.orgName,
    ownerEmail : defaultUser.ownerEmail
};

// function addEntitiesToDB () {
//  console.log("Adding new entities");
//  // add user
//  return userModel.addAsync(monsterUsr)
//  .then(function(user) {
//      // add org
//      return orgModel.addAsync(_.cloneDeep(testOrg))
//      .then(function(org) {
//          org.owner = {ref: user._id};
//          org.users.members.push({
//              ref: user._id,
//              name: user.name,
//              email: user.email,
//              role: 'isOwner',
//              dateJoined: Date.now()
//          });
//          user.orgs.push({
//              ref:org._id, 
//              owner: {ref: user._id}, 
//              orgName: org.orgName, 
//              role: 'isOwner', 
//              isPending: false, 
//              dateJoined: Date.now()
//          });
//          return Promise.join(user.save(), org.save(), function(user, org) {
//              return [user, org];
//          });
//      });
//  }).spread(function(user, org) {
//      // add project
//      var newProj = _.cloneDeep(testProject);
//      newProj.org = {ref: org._id};
//      newProj.owner = {ref: user._id};
        
//      return projModel.addAsync(newProj).then(function(proj) {
//          var newProj = {
//              ref: proj._id,
//              projName: proj.projName,
//              picture: proj.picture,
//              owner: {ref: proj.owner.ref},
//              members: proj.users.members,
//              dateModified: proj.dateModified
//          };
//          //update org
//          org.projects.push(newProj);

//          user.projects.push({
//              ref: proj._id,
//              org: org._id,
//              owner: proj.owner,
//              permission: 'isOwner',
//              projName: proj.projName,
//              dateJoined: Date.now()
//          });
//          return Promise.join(user.saveAsync().get(0), org.saveAsync().get(0), function(user, org) {
//              return [user, org, proj];
//          });
//      });
//  }).spread(function(user, org, proj) {
//      currentUser = user;
//      currentOrg = org;
//      currentProj = proj;
//      return true;
//  });
// }

function assertMonsterExist (cb) {
    userModel.listByEmail(monsterUsr.email, function(err, usr) {
        if(usr) {
            console.log("Monster users exists!");
            cb();
        } else {
            console.log("Monster user not found, so creating him");
            userModel
                .addAsync(monsterUsr)
                .then(function(user) {
                    return Promise.all([user, orgModel.addAsync(_.cloneDeep(testOrg))]);
                })
                .spread(function(user, org) {
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
                    return Promise.join(user.save(), org.save(), function(user, org) {
                        return [user, org];
                    });
                })
                .spread(function() {
                    console.log("Monster User and his organization created successfully");
                    cb();
                })
                .catch(function (err){
                    console.error("[assertMonsterExist] Error: ", err);
                    cb(err);
                });
        }
    });
}

///
/// API
///

module.exports = {
    assertMonsterExist : assertMonsterExist
};