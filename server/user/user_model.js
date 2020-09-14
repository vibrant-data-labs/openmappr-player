'use strict';
var _           = require('lodash'),
    crypto      = require('crypto'),
    nodemailer  = require('nodemailer'),
    Promise     = require('bluebird'),
    // db       = require('../db.js'),
    mcapi       = require('mailchimp-api/mailchimp'),
    AppConfig   = require('../services/AppConfig'),
    mailchimpKey = _.get(AppConfig.get(), 'mailChimp.ACCESS_KEY'),
    mc          = new mcapi.Mailchimp(mailchimpKey),
    CacheMaster = require('../services/CacheMaster');

var cache = CacheMaster.getForUsers();

var userDB = require('../schemas/user_schema');


var api = {
    cache : function() { return cache; },

    listAll: function(callback) {
        console.log('[UserModel.findAll]');
        return userDB.find({}, function(err, docs) {
            if (err) {
                console.log('[UserModel.listAll] Database Error');
                callback(err, false);
            } else {
                //obscuring password
                // _.each(docs, function(doc){doc.password = '*';});
                callback(null, docs);
            }
        });
    },

    listById: function(id, callback) {
        // console.log('[user_model.listById] id:' + id);
        cache.get(id)
        .then(function(o) {
            return callback(null, o);
        })
        .catch(CacheMaster.ItemNotFound, function(err) {
            return userDB.findById( id, function(err, docs) {
                if (err) {
                    // console.log('[user_model.listById] Error: ' + err);
                    return callback(err);
                }
                if(!docs) {
                    // console.log('[user_model.listById] No User found. Id ' + id);
                    return callback(new Error('[user_model.listById] No User found. Id ' + id));
                }
                // console.log('[user_model.listById] Success: ');
                cache.insert(id,docs);
                callback(null, docs);
            });
        });
    },

    listByEmail: function(email, callback) {
        console.log('[user_model.listByEmail] find email: ' + email);
        if(!email) throw new Error('Email not passed');
        return userDB.findOne({
            'email': email.toLowerCase()
        }, function(err, docs) {
            if (err) {
                console.log('[user_model.listByEmail] Error: ' + err);
                return callback(err);
            }
            if(!docs) {
                console.log('[user_model.listByEmail] Email not found!');
                return callback('[user_model.listByEmail] Email not found!');
            }
            console.log('[user_model.listByEmail] ' + email + ' found');
            cache.insert(docs.id, docs);
            return callback(null, docs);
        });
    },


    add: function(user, callback) {
        //console.log('[user_model.add]' + JSON.stringify(user));
        module.exports.listByEmail(user.email.toLowerCase(), function(err, docs) {
            if (err) {
                user.save(function(err, docs) {
                    if (err) {
                        console.log('[user_model.add] Database Error: could not add new user');
                        callback(err);
                    } else {
                        console.log('[user_model.add] Success: ');// + JSON.stringify(docs));
                        callback(null, docs);
                    }
                });
            } else {
                console.log('[user_model.add] Email already exists');
                callback('Error: Email already exists');
            }
        });
    },

    removeById: function (id, callback) {
        userDB.remove({ _id: id }, function (err, result) {
            if (err) {
                console.log('[user_model.RemoveById] Error:' + err);
                callback(err, false);
            } else {
                console.log('' + result + ' document(s) deleted');
                callback(null, result);
            }
        });
    },
    create : function (usrObj, callback) {
        var usr = new userDB(usrObj || {});
        if(callback) callback(usr);
        return usr;
    },
    findByFBProfile : function (profileId, callback) {
        userDB.findOne({ 'facebook.id' : profileId }, callback);
    },
    findByTwitter : function (profileId, callback) {
        userDB.findOne({ 'twitter.id' : profileId }, callback);
    },
    findByGoogle : function (profileId, callback) {
        userDB.findOne({ 'google.id' : profileId }, callback);
    },
    updateProjName: function(user, projRef, newName, callback) {
        //update user refs
        var userProj = _.find(user.projects, 'ref', String(projRef));

        if(userProj) {
            userProj.projName = newName;
            // Save user
            return user.save().asCallback(callback);
        } else {
            return Promise.resolve(user).asCallback(callback);
        }
    },
    // listAllProjects: function(id, callback) {
    //  console.log('[user_model.listAllProjects] id:' + id);
    //  userDB.findById({
    //      _id: id
    //  },
    //  'project_refs',
    //  function(err, userdocs) {
    //      if (err || (!userdocs || userdocs.length < 1) {
    //          console.log('[USERModel.listProjects] User not found');
    //          callback(err, false);
    //      } else {
    //          console.log('[USERModel.listProjects] projects ->' + JSON.stringify(userdocs.project_refs));
    //          callback(err, userdocs.project_refs);
    //      }
    //  });
    // },

    // addProjectRef: function(id, projId, role, mapSettings, callback) {
    //  console.log('[USERModel.addProjectRef]: adding project [' + projId + '] to user [' + id + ']');

    //  userDB.findOne({
    //      _id: id
    //  },
    //  'project_refs',
    //  function(err, userdocs) {
    //      if (!userdocs || userdocs.length < 1) {
    //          console.log('[USERModel.addProject] User not found');
    //          callback(err, false);
    //      } else {
    //          //user found. updatenow.
    //          userdocs.project_refs.unshift({
    //              role: role,
    //              proj_name: mapSettings.title,
    //              proj_id: projId,
    //              proj_descr:mapSettings.descr,
    //              date_joined: mapSettings.createdAt
    //          });
    //          //console.log('[USERModel.addProject] userdocs.project_refs: ' + JSON.stringify(userdocs.project_refs));

    //          userdocs.save(function(err, doc, numberAffected) {
    //              console.log('[USERModel.addProject] updated user [' + userdocs._id + '] projects -> ' + JSON.stringify(userdocs.project_refs));
    //              callback(null, userdocs);
    //          });
    //      }
    //  });
    // },


    // updateProjectRef: function(id, projId, role, mapSettings, callback) {
    //  console.log('[USERModel.updateProjectRef]: update project [' + projId + '] from user [' + id + ']');

    //  userDB.findOne({
    //      _id: id
    //  },
    //  'project_refs',
    //  function(err, userdocs) {
    //      if (!userdocs || userdocs.length < 1) {
    //          console.log('[USERModel.removeProjectRef] User not found');
    //          callback(err, false);
    //      } else {

    //          //proj found. update refs
    //          var newProjectRefList = [];
    //          _.each(userdocs.project_refs, function(ref){
    //              if((ref.proj_id == projId)) {
    //                  var r = {
    //                      role: role,
    //                      proj_id: projId,
    //                      proj_name: mapSettings.title,
    //                      proj_descr: mapSettings.descr,
    //                      date_joined: ref.date_joined
    //                  };
    //                  newProjectRefList.push(r);
    //              } else
    //              {
    //                  newProjectRefList.push(ref);
    //              }
    //          });

    //          userdocs.project_refs = newProjectRefList;
    //          userdocs.save(function(err, doc, numberAffected) {
    //              console.log('[USERModel.updateProjectRef] updated user [' + userdocs._id + '] projects -> ' + JSON.stringify(userdocs.project_refs));
    //              callback(null, userdocs);
    //          });
    //      }
    //  });
    // },

    // removeProjectRef: function(id, projId, callback) {
    //  projId = projId.toString();
    //  console.log('[USERModel.removeProjectRef]: remove project [' + projId + '] from user [' + id + ']');

    //  userDB.findOne({
    //      _id: id
    //  },
    //  'project_refs',
    //  function(err, userdocs) {
    //      if (!userdocs || userdocs.length < 1) {
    //          console.log('[USERModel.removeProjectRef] User not found');
    //          callback(err, false);
    //      } else {
    //          //user found. update refs
    //          var newProjectRefList = [];
    //          _.each(userdocs.project_refs, function(ref){
    //              if(_.isEqual(ref.proj_id, projId)) {
    //                  console.log("[userModel.removeProjectRef] REMOVED " + ref.proj_id + "["+projId+"]");
    //              } else {
    //                  newProjectRefList.push(ref);
    //                  console.log("[userModel.removeProjectRef] RETAINED " + ref.proj_id + "["+projId+"]");
    //              }
    //          });

    //          userdocs.project_refs = newProjectRefList;
    //          userdocs.save(function(err, doc, numberAffected) {
    //              console.log('[USERModel.removeProjectRef] updated user [' + userdocs._id + '] projects -> ' + JSON.stringify(userdocs.project_refs));
    //              callback(null, userdocs);
    //          });
    //      }
    //  });
    // },

    resetUserPassword: function(req, email, callback) {
        console.log('[user_model.resetUserPassword] email: ' + email);

        //create expire time
        var oneWeek = 1000 * 60 * 60 * 24 * 7;
        var reset_expire = new Date(new Date().getTime() + oneWeek).getTime();

        //create reset token from email and date
        var reset_token = crypto.createHash('md5').update(email + reset_expire).digest("hex");

        userDB.update({
            email: email
        }, {
            $set:{
                'local.reset_token': reset_token,
                'local.reset_expire': reset_expire
            }
        }, {
            multi: false,
            safe: true
        }, function(err, numberAffected, raw) {

            if (err) {
                console.log('[user_model.resetUserPassword] Error: ' + err);
                callback(err, false);
            } else {

                console.log('[user_model.resetUserPassword] [email:' + email + '] The raw response from Mongo was: ' + JSON.stringify(raw));
                //send email
                var transport = nodemailer.createTransport("Gmail", {
                    auth: {
                        user: "support@vibrantdata.is",
                        pass: "vdat*su*1"
                    }
                });
                var mailOptions = {
                    from: "support@vibrantdata.is",
                    to: email,
                    subject: "Password Reset!",
                    text: "Reset your email by clicking the following link: " + req.protocol + "://" + req.get('host') + '/reset_password/' + reset_token + '\n\n'
                };

                transport.sendMail(mailOptions, function(err, res) {
                    if (err) {
                        callback(err, false);
                    } else {
                        callback(null, res);
                    }
                });
            }
        });
    },

    changeUserPassword: function(email, token, password, callback) {
        //make sure hasn't expired
        var curDate = new Date().getTime();
        console.log(email + " : " + token + " : " + curDate);
        userDB.update({
            email: email,
            reset_token: token,
            reset_expire: {
                $gt: curDate
            }
        }, {
            $set: {
                password: password
            },
            $unset: {
                reset_token: '',
                reset_expire: ''
            }
        }, {
            multi: false
        }, function(err, numberAffected, raw) {
            if (err) {
                console.log('[user_model.changeUserPassword] Error: ' + err);
                callback(err, false);
            } else if (numberAffected === 0) {
                console.log('[user_model.changeUserPassword] Error: No rows updated!');
            } else {
                callback(null, {
                    'email': email
                });
            }
        });
    },

    //ADmin
    removeOrgFromUser: function(userEmail, orgId, callback){
        console.log('[user_model.removeOrgFromUser]' + userEmail + ' org->' + orgId);
        userDB.findOne(
            {'email': userEmail},
            function(err, userDoc) {
                if (userDoc){
                    userDoc.orgs = _.reject(userDoc.orgs, 'ref', orgId);
                    console.log('[ user_model.removeOrgFromUser ] org removed from user list for: ' + userEmail);
                    userDoc.save(function(err, user, numberAffected){
                        if(err) callback(err, false);
                        else callback(null, user);
                    });
                }
                else {
                    console.warn('[user_model.removeOrgFromUser] user does not exist with email: ' + userEmail);
                    callback(null, {});
                }
                if(err) console.error('[userModel.removeOrgFromUser] ', err);
            }
        );
    },

    //TODO: Check if useless
    subscribe: function(email, callback) {
        console.log('[user_model.subscribe] Subscribing User Email: ' + email);
        //send email to mailchimp
        mc.lists.subscribe({
            id: '4cc2367aa5',
            email: {
                email: email
            },
            double_optin: false,
            send_welcome: false
        }, function(data) {
            callback(false, {
                "email": email
            });
        },
        function(error) {
            console.log('Error subscribing: ' + JSON.stringify(error.error));
            //TODO: setup error validation in future
            //callback(error, false);
            callback(false, {
                "email": email
            });
        });
    }
};
module.exports = Promise.promisifyAll(api);
