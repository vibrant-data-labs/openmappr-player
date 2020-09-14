'use strict';
var _ = require("lodash"),
    crypto = require("crypto"),
    Promise = require('bluebird');

var orgModel = require("./org_model.js"),
    userModel = require("../user/user_model.js"),
    projModel = require("../project/proj_model.js"),
    projDeleter = require("../project/proj_deleter.js"),
    playerModel = require("../player/player_model.js"),
    surveyTemplateModel = require("../survey/surveyTemplateModel.js"),
    emailService = require("../services/EmailService.js");

//helper utils
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
    getOrgs : function (req, res) {
        var projId = req.query.projectId;
        if(projId) {
            return projModel.getOrgIdAsync(projId)
                .then(function(orgId) {
                    console.log('[orgController.getOrgs] org found:', orgId);
                    return res.status(200).json({
                        orgId : orgId
                    });
                })
                .catch(function(err) {
                    console.warn("[orgController.getOrgs] error in loading org: ", err);
                    return res.status(500).send(err);
                });
        }
        orgModel.listByUserId(req.user.id, function(err, doc) {
            return res.status(200).json(doc);
        });
    },

    listAll: function(req, res) {
        orgModel.listAll(function(err, docs) {
            if (err) {
                console.log('[orgController.listAll] error');
                return res.status(500).send(err);
            } else {
                console.log('[orgController.listAll] num of players found: ' + docs.length);
                res.status(200).send(docs);
            }
        });
    },

    // Admin only
    create: function(req, res) {
        var p = req.body;
        var newOrg = {
            orgName: p.orgName ? p.orgName.toLowerCase() : ('Org-' + Math.random() * 1000),
            settings: p.settings || {
                userLimit: 5,
                projectLimit: 10,
                datapointsLimit: 1000,
                storageLimit: 0 // for future use
            }
        };

        orgModel.addAsync(newOrg)
            .then(orgDocs => res.status(200).send(orgDocs))
            .catch(function(err) {
                console.error(err);
                var errMsg = err.message || (err.cause && err.cause.message);
                return res.status(500).send(errMsg);
            });

    },

    // Admin only
    edit: function(req, res) {
        var p = req.body;

        _.assign(req.org, _.pick(p, ['orgName', 'settings']));

        req.org.save(function(err) {
            if (err) {
                return res.status(500).send(err);
            }
            res.json(req.org);
        });
    },

    // Admin only
    deleteOrg: function(req, res) {
        var logPrefix = '[orgController.deleteOrg]';
        if (!req.org) {
            return res.status(500).send("Org not found");
        }
        console.log(logPrefix, "Deleting org:", req.org._id, "named:", req.org.orgName);
        console.log(logPrefix, "Number of projects:", req.org.projects.length);
        let dummyUser = {
            projects: []
        };
        // Remove org projects
        var projDelP = Promise.mapSeries(req.org.projects,
            proj => {
                console.log(logPrefix, "removing project:", proj.projName);
                return projDeleter.delete(proj.ref, dummyUser, req.org, false);
            }
        );

        //update org members
        var membersDelP = projDelP.then(() => Promise.mapSeries(req.org.users.members,
            member => userModel.removeOrgFromUserAsync(member.email, req.org._id)
        ));

        //update org pending
        var pendingDelP = projDelP.then(() => Promise.mapSeries(req.org.users.pending,
            pending => userModel.removeOrgFromUserAsync(pending.email, req.org._id)
        ));
        // fail if the projects couldn't be deleted
        return Promise.join(membersDelP, pendingDelP, projDelP)
            .then(() => orgModel.removeByIdAsync(req.org._id))
            .then(function(response) {
                console.log(logPrefix, 'org deleted successfully!');
                return res.status(200).json(response);
            })
            .catch(function(err) {
                console.warn(logPrefix, "Error in deleting org:", err);
                return res.status(500).send("Could not delete org");
            });

    },

    inviteUserToOrg: function(req, res) {
        var p = req.body,
            logPrefix = '[orgController.inviteUserToOrg] ';
        console.log(logPrefix + 'start invite user');

        if (!req.org) {
            return res.status(500).send("Org not found");
        }
        if (!p.userToAdd || (p.userToAdd && !p.userToAdd.email)) {
            return res.status(500).send("User to invite not found");
        }
        if (!req.org.settings) {
            // For backwards compatiblity
            req.org.settings = {
                userLimit: 5,
                projectLimit: 10,
                datapointsLimit: 1000,
                storageLimit: 0 // for future use
            };
        }
        if (req.org.users.members.length + req.org.users.pending.length >= req.org.settings.userLimit) {
            return res.status(500).send("userLimitExceeded");
        }

        var userToAdd = p.userToAdd,
            userDoc = null,
            userAlreadyExists = false;

        // sanitize data
        userToAdd.email = userToAdd.email.toLowerCase();

        //decorate name
        var userFirstName, userLastName, userName;
        if (userToAdd.first_name) {
            //if first name was provided
            userFirstName = capitalizeFirstLetter(userToAdd.first_name);
            userLastName = (userToAdd.last_name) ? capitalizeFirstLetter(userToAdd.last_name) : "";
            userName = userFirstName + ' ' + userLastName;
        } else {
            //extract name from email
            userFirstName = capitalizeFirstLetter(userToAdd.email.split('@')[0]);
            userLastName = null;
            userName = userFirstName;
        }

        userModel.listByEmailAsync(userToAdd.email)
            .then(function(user) {
                userDoc = user;
                userAlreadyExists = true;

                //for backwards compatiblity
                if (!userDoc.first_name) {
                    _.assign(userDoc, {
                        first_name: userFirstName,
                        last_name: userLastName
                    });
                } else if (!userDoc.name) {
                    _.assign(userDoc, {
                        name: userName
                    });
                }
            })
            .catch(function() {
                userAlreadyExists = false;
            })
            .finally(function() {
                var addUserP,
                    userObj,
                    inviteExpiryTime = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 3).getTime(), // 3 days
                    inviteToken = crypto.createHash('md5').update(userToAdd.email + inviteExpiryTime).digest("hex");

                if (userAlreadyExists) {
                    addUserP = Promise.resolve(null)
                        .then(function() {
                            // User exists in system
                            if (!userDoc || userDoc._id == null) throw new Error('Something is wrong!');
                            if (_.findIndex(req.org.users.members, 'ref', userDoc._id.toHexString()) > -1) {
                                throw new Error("UserAlreadyMember");
                            } else if (_.findIndex(req.org.users.pending, 'ref', userDoc._id.toHexString()) > -1) {
                                throw new Error("UserAlreadyInvited");
                            } else {

                                //update the user
                                userDoc.orgs.push({
                                    ref: req.org._id,
                                    owner: req.org.owner,
                                    orgName: req.org.orgName,
                                    role: userToAdd.role,
                                    isPending: true,
                                    token: inviteToken
                                });

                                userObj = {
                                    token: inviteToken,
                                    expire: inviteExpiryTime,
                                    first_name: userDoc.first_name,
                                    last_name: userDoc.last_name,
                                    name: userDoc.name,
                                    email: userToAdd.email,
                                    role: userToAdd.role || 'member'
                                };

                                //update org.pending
                                req.org.users.pending.push(userObj);
                            }

                            return userDoc.save()
                                .then(() => req.org.save())
                                .then(function() {
                                    //send invite email
                                    var requesterName = req.user.first_name || req.user.name || req.user.email;
                                    requesterName = capitalizeFirstLetter(requesterName);

                                    var subj = requesterName + " invited you to join " + req.org.orgName, //"Please join my organization!",
                                        templateName = 'inviteUserToOrg',
                                        htmlData = {
                                            requesterName: requesterName,
                                            userName: userDoc.first_name,
                                            orgName: req.org.orgName,
                                            inviteLink: req.protocol + "://" + req.get('host') + '/api/orgs/' + req.org._id + '/accept/' + inviteToken
                                        };
                                    console.log("Invite Url:", req.protocol + "://" + req.get('host') + '/api/orgs/' + req.org._id + '/accept/' + inviteToken);

                                    return emailService.sendFromSupport(userToAdd.email, subj, templateName, htmlData)
                                        .then(result => {
                                            console.log(logPrefix + 'email sent to ' + userToAdd.email);
                                            return result;
                                        }, () => {
                                            // Revert to pre-request state
                                            userDoc.orgs = _.reject(userDoc.orgs, 'ref', req.org._id.toHexString());
                                            req.org.users.pending = _.reject(req.org.users.pending, 'email', userToAdd.email);
                                            userDoc.save();
                                            req.org.save();
                                            throw new Error('Email failure');
                                        });
                                });
                        });
                } else {
                    addUserP = Promise.resolve(null)
                        .then(function() {
                            //check if user is already in pending
                            if (_.findIndex(req.org.users.pending, 'email', userToAdd.email) > -1) {
                                req.org.users.pending = _.reject(req.org.users.pending, 'email', userToAdd.email);
                                console.warn(logPrefix + 'user with email: ' + userToAdd.email + ' already invited, sending invite again.');
                            }

                            userObj = {
                                token: inviteToken,
                                expire: inviteExpiryTime,
                                first_name: userFirstName,
                                last_name: userLastName,
                                name: userName,
                                email: userToAdd.email,
                                role: userToAdd.role || 'member'
                            };

                            req.org.users.pending.push(userObj);

                            return req.org.save()
                                .then(function() {

                                    //send invite email
                                    var requesterName = req.user.first_name || req.user.name || req.user.email;
                                    requesterName = capitalizeFirstLetter(requesterName);

                                    var subj = requesterName + " invited you to join " + req.org.orgName, //"Please join my organization!",
                                        templateName = 'inviteUserToOrg',
                                        htmlData = {
                                            requesterName: requesterName,
                                            userName: userFirstName,
                                            orgName: req.org.orgName,
                                            inviteLink: req.protocol + "://" + req.get('host') + '/api/orgs/' + req.org._id + '/accept/' + inviteToken
                                        };

                                    return emailService.sendFromSupport(userToAdd.email, subj, templateName, htmlData)
                                        .then(result => {
                                            console.log(logPrefix + 'email sent to ' + userToAdd.email);
                                            return result;
                                        }, () => {
                                            // Revert to pre-request state
                                            req.org.users.pending = _.reject(req.org.users.pending, 'email', userToAdd.email);
                                            req.org.save();
                                            throw new Error('Email failure');
                                        });
                                });


                        });
                }


                addUserP
                    .then(function() {
                        console.log(logPrefix + 'User invited successfully');
                        res.status(200).send(userObj);
                    })
                    .catch(function(err) {
                        var errMsg = err.message || 'InviteError';
                        console.error(logPrefix, err);
                        return res.status(500).send(errMsg);
                    });

            });

    },

    cancelUserInvite: function(req, res) {
        var p = req.body,
            logPrefix = '[orgController.cancelUserInvite: ] ';
        console.log(logPrefix + 'start invite cancel');

        if (!req.org) {
            res.status(500).send("Org not found");
            return;
        }
        if (!p.invitedUser || !p.invitedUser.email) {
            res.status(500).send("Invited user\'s email not found");
            return;
        }

        req.org.users.pending = _.reject(req.org.users.pending, 'email', p.invitedUser.email);

        req.org.save()
            .then(() => {
                userModel.listByEmailAsync(p.invitedUser.email)
                    .then(user => {
                        user.orgs = _.reject(user.orgs, 'ref', req.org._id.toHexString());
                        req.user.save((err) => {
                            if (err) {
                                res.status(500).send('could not update user');
                            }
                            else {
                                console.log(logPrefix + 'invite cancelled for user: ' + p.invitedUser.email);
                                // var subj = "Invite cancelled!",
                                //     templateName = 'inviteCancelled',
                                //     htmlData = {
                                //         email: p.invitedUser.email,
                                //         orgName: req.org.orgName
                                //     };

                                //dont send email on invite cancel
                                //emailService.sendFromSupport(p.invitedUser.email, subj, templateName, htmlData);
                                res.status(200).send(user);
                            }
                        });
                    })
                    .catch(() => {
                        // User doesn't exist in system yet
                        console.log(logPrefix + 'invite cancelled for user: ' + p.invitedUser.email);
                        // var subj = "Invite cancelled!",
                        //     templateName = 'inviteCancelled',
                        //     htmlData = {
                        //         orgName: req.org.orgName,
                        //         email: p.invitedUser.email
                        //     };
                        //dont send email on invite cancel
                        //emailService.sendFromSupport(p.invitedUser.email, subj, templateName, htmlData);
                        res.status(200).send('invite cancelled');
                    });
            })
            .catch(err => {
                console.error(logPrefix + 'could not cancel user invite ', err);
                res.status(500).send('could not cancel user invite');
            });

    },

    addUserToOrg: function(req, res) {
        var p = req.body,
            logPrefix = '[orgController.addUserToOrg: ] ';
        console.log(logPrefix + 'start add user');

        if (!req.org) {
            return res.status(500).send("Org not found");
        }
        if (!p.userToAdd || (p.userToAdd && !p.userToAdd.email)) {
            return res.status(500).send("User to add not found");
        }

        var userToAdd = p.userToAdd,
            pendingUser = _.find(req.org.users.pending, 'token', userToAdd.token);

        userModel.listByEmailAsync(userToAdd.email)
            .then(function(userDoc) {
                var userOrg = _.find(userDoc.orgs, 'ref', req.org._id.toHexString());
                if (userOrg) {
                    userDoc.orgs = _.reject(userDoc.orgs, 'ref', req.org._id.toHexString());
                }
                userDoc.orgs.push({
                    ref: req.org._id,
                    owner: req.org.owner,
                    orgName: req.org.orgName,
                    role: pendingUser.role,
                    dateJoined: Date.now(),
                    isPending: false,
                    token: ''
                });


                userDoc.lastSignedIn.orgId = req.org._id;
                return userDoc.save();
            })
            .then(function(userDoc) {
                if (_.findIndex(req.org.users.members, 'ref', userDoc._id.toHexString()) > -1) {
                    throw new Error('User is already a member');
                }

                req.org.users.members.push({
                    ref: userDoc._id,
                    first_name: userDoc.first_name,
                    last_name: userDoc.last_name,
                    name: userDoc.first_name + ' ' + userDoc.last_name,
                    email: userDoc.email,
                    role: pendingUser.role,
                    dateJoined: Date.now()
                });

                //remove user from the org.users.pending list
                req.org.users.pending = _.reject(req.org.users.pending, 'token', userToAdd.token);
                console.log(logPrefix + ' user removed from org.users.pending');

                return req.org.save();
            })
            .then(function() {
                console.log(logPrefix + 'user added to org');
                res.status(200).send('User added to org');
            })
            .catch(function(err) {
                console.error(logPrefix, err);
                return res.status(500).send(err);
            });

    },

    updateUserOrgRole: function(req, res) {
        var logPrefix = '[org_controller: updateUserOrgRole] ';
        if (!req.org) {
            return res.status(500).send('Org not found');
        }

        var updateUserRef = req.params.uid,
            p = req.body,
            newUserRole = p.newUserRole;

        if (!newUserRole) {
            return res.status(500).send('No new user role');
        }
        if (newUserRole != 'member' && newUserRole != 'owner') {
            return res.status(500).send('Inappropriate role');
        }

        userModel.listByIdAsync(updateUserRef)
            .then(userDoc => {
                var userOrg = _.find(userDoc.orgs, 'ref', req.org._id.toHexString());
                userOrg.role = newUserRole;
                return userDoc.save();
            })
            .then(() => {
                var orgUser = _.find(req.org.users.members, 'ref', updateUserRef);
                orgUser.role = newUserRole;
                return req.org.save();
            })
            .then(() => {
                console.log(logPrefix + 'user role updated to ' + newUserRole);
                res.status(200).send(newUserRole);
            })
            .catch(err => {
                console.error(logPrefix + 'user role not updated', err);
                return res.status(500).send(err);
            });

    },

    removeUserFromOrg: function(req, res) {
        var logPrefix = '[org_controller: removeUserFromOrg] ';
        if (!req.org) {
            return res.status(500).send('Org not found');
        }

        var removeUserRef = req.params.uid;
        var userToRemove = _.find(req.org.users.members, 'ref', removeUserRef);
        if (req.user._isOwner && userToRemove.role === 'owner') {
            return res.status(403).send('You can\'t remove a user with admin previlidges');
        }

        //remove member for users.member array
        req.org.users.members = _.reject(req.org.users.members, 'ref', removeUserRef);

        req.org.save(function(err) {
            if (err) {
                res.status(500).send('Could not remove member');
            } else {
                //update member's org references
                userModel.listById(removeUserRef, function(err, userDoc) {
                    if (err) { //warning: ignore
                        console.warn(logPrefix + 'Could not find User');
                    } else {
                        userDoc.orgs = _.reject(userDoc.orgs, 'ref', req.org._id.toHexString());

                        userDoc.lastSignedIn.orgId = '';
                        userDoc.save(function() {
                            //warning: if member not found - simply ignores requests and carries on right now.
                            //design: whenever a request modifies a collection - modified collection is sent back as repsonse
                            res.json(req.org.users.members);

                            // var subj = "Organization update!",
                            //     templateName = 'removeUserFromOrg',
                            //     htmlData = {
                            //         userName: userDoc.name,
                            //         orgName: req.org.orgName
                            //     };

                            //dont send email for user removal
                            //emailService.sendFromSupport(userDoc.email, subj, templateName, htmlData);

                        });
                    }

                });
            }
        });
    },

    readDoc: function(req, res) {
        var orgDoc = req.org.toJSON();

        //update user activity
        req.user.lastSignedIn.orgId = req.org._id;

        var updateUserP = req.user.save();

        console.log('org_controller.readDoc: ] Adding details to org projects');

        var users = {};
        users[req.user._id.toString()] = req.user;

        orgDoc.projects.forEach(orgProj => {
            var ownerId = _.get(orgProj, 'owner.ref');
            var lastViewedUser = _.get(orgProj, 'lastViewed.userRef');
            var lastModifiedUser = _.get(orgProj, 'lastModified.userRef');
            if(ownerId && ownerId.length == 24 && !users[ownerId]) {
                users[ownerId] = userModel.listByIdAsync(ownerId)
                                .catch(err =>  {
                                    console.error('Could not fetch user for id: ' + ownerId, err);
                                    return null;
                                });
            }
            if(lastViewedUser && lastViewedUser.length == 24 && !users[lastViewedUser]) {
                users[lastViewedUser] = userModel.listByIdAsync(lastViewedUser)
                                        .catch(err =>  {
                                            console.warn('Could not fetch user for id: ' + lastViewedUser, err);
                                            return null;
                                        });
            }
            if(lastModifiedUser && lastModifiedUser.length == 24 && !users[lastModifiedUser]) {
                users[lastModifiedUser] = userModel.listByIdAsync(lastModifiedUser)
                                        .catch(err =>  {
                                            console.warn('Could not fetch user for id: ' + lastModifiedUser, err);
                                            return null;
                                        });
            }
        });

        console.log(`[org_controller.readDoc: ] fetching info for ${_.size(users)} users...`);
        var updatedOrgDoc = Promise.props(users)
            .then(function (userMap) {
                console.log(`[org_controller.readDoc: ] fetching info for ${_.size(userMap)} users...done`);
                // add project owner details
                orgDoc.projects.forEach(orgProj => {
                    var projOwnerRef = _.get(orgProj, 'owner.ref');
                    var lastViewedRef = _.get(orgProj, 'lastViewed.userRef');
                    var lastModifiedRef = _.get(orgProj, 'lastModified.userRef') || lastViewedRef;
                    if (projOwnerRef && projOwnerRef.length == 24) {
                        _.assign(orgProj.owner, _.pick(userMap[projOwnerRef], ['first_name', 'last_name', 'name', 'email']));
                    }
                    // add project's most recent user details.
                    if (lastViewedRef && lastViewedRef.length === 24) {
                        _.assign(orgProj.lastViewed, _.pick(userMap[lastViewedRef], ['first_name', 'last_name', 'name', 'email']));
                    }
                    // add project's last modified user details.
                    if (lastModifiedRef && lastModifiedRef.length === 24) {
                        _.assign(orgProj.lastModified, _.pick(userMap[lastModifiedRef], ['first_name', 'last_name', 'name', 'email']));
                    }
                });
                return orgDoc;
            });

        Promise.join(updatedOrgDoc, updateUserP)
            .then(() => {
                console.log('org_controller.readDoc: ] All details were added to org projects successfully');
            })
            .catch(err => {
                console.log('[org_controller.readDoc: ] Some details could not be added to org projects');
                console.log(err);
            })
            .finally(() => {
                res.status(200).json(orgDoc);
            });

    },

    readOrgProjectsDetails: function(req, res) {
        var orgProjects = req.org.projects;
        var projectIds = _.map(orgProjects, 'ref');

        // find player for each projects, reflected promises are always successful
        var playersP = Promise.all(projectIds.map(projId => playerModel.listByProjectIdAsync(projId).reflect()));

        playersP
            .then(function(playerPIs) { // player promise Inspectors
                // _(playerPIs)
                //     .reject(player => player.isFulfilled())
                //     .each(player => { console.log("Player Reject Reason : ", player.reason()); }).value();

                return _(playerPIs)
                    .filter(player => player.isFulfilled()) // remove all rejected promises
                    .map(player => player.value()) // get the value of fulfilled promises
                    .tap(() => {
                        // console.log("Got num players: ", players.length);
                    })
                    .reduce(function(result, player) {
                        var playerUrl = player.isPrivate && player.directAccess ? player.playerUrl + '?access_token=' + player.access_token : player.playerUrl;

                        // console.log('[org_controller.readOrgProjectsDetails] ', player._id, playerUrl);

                        result[player.project.ref] = {
                            playerUrl: playerUrl,
                            metrics: player.metrics,
                            enabled: !player.isDisabled
                        };
                        return result;
                    }, {});
            })
            .then(function(result) {
                res.status(200).json(result);
            })
            .catch(function(errr) {
                var err = errr.stack || errr;
                console.error("[org_controller.readOrgProjectsDetails] Error in fetching . ", errr);
                res.status(404).send(err);
            });
    },

    readOrgSurveysDetails: function(req, res) {
        var counter = Date.now();
        var result = {};

        console.log('[org_controller.readOrgSurveysDetails] start: ', req.org._id, ' ', Date.now() - counter);

        //surveyTemplateModel.readDocsByOrg return only _id, isPublished, isConcluded
        surveyTemplateModel.readDocsByOrg(req.org._id, function(err, surveys) {
            if (err) {
                return res.status(500).send(err);
            }

            _.each(surveys, function(survey) {
                result[survey._id] = {
                    isPublished: survey.isPublished,
                    isConcluded: survey.isConcluded
                };
            });

            console.log('[org_controller.readOrgSurveysDetails] survey result object created: ', Date.now() - counter);
            res.status(200).json(result);
        });
    },

    readOrgPublicDetails: function(req, res) {
        if (!req.org) {
            res.status(500).send('Org not found');
            return;
        }

        var org = req.org;

        res.status(200).send({
            orgName: org.orgName,
            picture: org.picture,
            owner: org.owner
        });
    }
};
