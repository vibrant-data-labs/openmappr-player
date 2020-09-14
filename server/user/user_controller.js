'use strict';

var _ = require('lodash'),
    crypto     = require("crypto"),
    userModel = require("./user_model.js"),
    orgModel     = require("../org/org_model.js"),
    emailService = require("../services/EmailService.js");


module.exports = {

    listAll: function(req, res) {
        //admin only
        userModel.listAll(function(err, docs) {
            if (err) {
                console.log('[userController.listAll] error');
                res.status(500, err);
            } else {
                console.log('[userController.index] num of users found: ' + docs.length);
                docs = _.reject(docs, 'role.bitMask', 4); // Don't return admins
                _.each(docs, user => {
                    user.password = '*';
                });
                res.status(200).send(docs);
            }
        });
    },

    readDoc: function(req, res) {
        console.log('[userController.listById]');
        res.status(200).json(req.user);
    },

    acceptOrgInvite: function(req, res) {
        if(!req.org) {
            res.redirect('404');
            return;
        }

        var logPrefix = '[userController.acceptOrgInvite: ] ',
            pendingUser = _.find(req.org.users.pending, 'token', req.params.inviteToken);

        if(!pendingUser) {
            console.warn(logPrefix + 'token not found');
            res.redirect('/');
            return;
        }
        if(pendingUser.expire < Date.now()) {
            // Token expired
            console.warn(logPrefix + 'token expired');
            res.redirect('/invite_expire');
            return;
        }
        var regen_token = crypto.createHash('md5').update(pendingUser.email + pendingUser.expire).digest("hex");
        if(regen_token !== req.params.inviteToken) {
            console.warn(logPrefix + 'incorrect token');

            return;
        }


        userModel.listByEmailAsync(pendingUser.email)
        .then(function(user) {
            console.log(logPrefix + 'user exists, ask to signin');
            res.redirect('/signin-org?oid=' + req.org._id + '&token=' + req.params.inviteToken + '&email=' + pendingUser.email);
        })
        .catch(function(err) {
            console.log(logPrefix + 'user does not exist in system yet.');
            res.redirect('/signup-org?oid=' + req.org._id + '&token=' + req.params.inviteToken + '&email=' + pendingUser.email + '&first_name=' + pendingUser.first_name + '&last_name=' + pendingUser.last_name);
        });

    },

    // admin only
    updateUser: function(req, res) {
        var logPrefix = '[user_controller: updateUser] ',
            userId = req.params.uid,
            userPostObj = req.body.user;
        if(!userId) {
            res.status(400).send('UserId not found');
            return;
        }
        if(!_.isObject(userPostObj) || _.keys(userPostObj).length === 0) {
            res.status(400).send('No user object found');
            return;
        }

        userModel.listByIdAsync(userId)
        .then(userToUpdate => {
            var subj, templatePath, htmlData;
            if(userToUpdate.isActive !== userPostObj.isActive) {
                // Updating user active status
                if(!userPostObj.isActive) {
                    subj = "Your account has been disabled";
                    templatePath = 'disableUser';
                }
                else {
                    subj = "Your account has been reactivated";
                    templatePath = 'enableUser';
                }
                htmlData = {
                    userName: userToUpdate.first_name
                };

                emailService.sendFromSupport(userToUpdate.email, subj, templatePath, htmlData);
            }

            _.assign(userToUpdate, _.pick(userPostObj, ['name', 'email', 'first_name', 'last_name', 'picture', 'isActive', 'bio', 'url']));
            if(userPostObj.password && !userToUpdate.validPassword(userPostObj.password)) {
                userToUpdate.local.password = userToUpdate.generateHash(userPostObj.password);

                // send email
                subj = 'Password Changed';
                templatePath = "passwordChanged";

                htmlData = {
                    userName: userToUpdate.name,
                    newPassword: userPostObj.password
                };

                emailService.sendFromSupport(userToUpdate.email, subj, templatePath, htmlData);
            }

            return userToUpdate.save();
        })
        .then(updatedUser => {
            console.log(logPrefix + 'user updated successfully');
            console.log(logPrefix + 'updated user email: ' + updatedUser.email);
            res.status(200).send(updatedUser);
        })
        .catch(err => {
            console.error(logPrefix + 'could not update user', err);
            res.status(500).send('could not update user');
        });
    },

    // Available to normal user
    updateProfile: function(req, res) {
        var logPrefix = '[user_controller: updateProfile] ',
            userId = req.params.uid,
            userPostObj = req.body.user;

        if(!userId) {
            return res.status(400).send('UserId not found');
        }
        if(!_.isObject(userPostObj) || _.keys(userPostObj).length === 0) {
            return res.status(400).send('No user object found');
        }

        var propsToUpdate = ['name', 'first_name', 'last_name', 'picture', 'gender', 'bio'];
        _.assign(req.user, _.pick(userPostObj, propsToUpdate));

        req.user.save()
        .then(user => {
            console.log(logPrefix + 'user updated successfully');
            res.status(200).send(user);
        })
        .catch(err => {
            console.error(logPrefix + 'could not update user', err);
            res.status(500).send('could not update user');
        });

    },

    updateAuthInfo: function(req, res) {
        var logPrefix = '[user_controller: updateAuthInfo] ',
            userId = req.params.uid,
            currPassword = req.body.currPassword,
            newPassword = req.body.newPassword;

        if(!userId) {
            return res.status(400).send('UserId not found');
        }
        if(!newPassword || !currPassword) {
            return res.status(400).send('Both passwords not specified');
        }
        if(!req.user.validPassword(currPassword)) {
            return res.status(400).send('Password mismatch');
        }
        if(currPassword === newPassword) {
            return res.status(400).send('New password must be different from old password');
        }

        req.user.local.password = req.user.generateHash(newPassword);

        req.user.save()
        .then(user => {
            console.log(logPrefix + 'password updated successfully for userId: ' + req.user._id);

            // Send email
            var subj = "Your password has been changed",
                templateName = 'passwordChangeInfo',
                htmlData = {
                    userName: user.first_name
                };
            emailService.sendFromSupport(user.email, subj, templateName, htmlData);

            res.status(200).send(user);
        })
        .catch(err => {
            console.error(logPrefix + 'could not update password', err);
            res.status(500).send('could not update password');
        });
    },

    deleteUser: function(req, res) {
        var logPrefix = '[user_controller: deleteUser] ';
        var userDelRef = req.params.uid,
            delUser = null;

        userModel.listByIdAsync(userDelRef)
        .then(userToDelete => {
            delUser = userToDelete;
            return Promise.all(_.map(userToDelete.orgs, org => orgModel.listByIdAsync(org.ref)));
        })
        .then(orgsArr => {

            var saveOrgPArr = _.map(orgsArr, org => {
                org.users.members = _.reject(org.users.members, 'ref', userDelRef);

                return org.save();
            });

            return Promise.all(saveOrgPArr);
        })
        .then(savedOrgs => {
            return userModel.removeByIdAsync(userDelRef);
        })
        .then(removedUser => {
            console.log(logPrefix + 'user deleted successfully');
            console.log(logPrefix + 'deleted user email: ' + delUser.email);
            // var subj = "User Account Deleted!",
            //     templatePath = 'deleteUser',
            //     htmlData = {
            //         userName: delUser.name
            //     };
            res.status(200).send('user deleted');
            // emailService.sendFromSupport(delUser.email, subj, templatePath, htmlData);
        })
        .catch(err => {
            console.error(logPrefix + 'Could not delete user', err);
            res.status(500).send('coult not delete user');
        });

    },

    //ORGS
    listUserOrgs: function(req, res){
        res.status(200).json(req.user.orgs);
    },
    //PROJECTS
    listUserProjects: function(req, res){
        res.status(200).json(req.user.projects);
    }

};
