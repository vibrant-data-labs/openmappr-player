'use strict';
var userModel = require('../user/user_model'),
    crypto     = require("crypto"),
    emailService = require("../services/EmailService.js");

function onLogout (req, res) {
    req.user = null;
    console.log(req.session);
    req.logout();
    console.log('logged out');
    console.log('-------------- req.session: ', req.session);
    res.status(200).send('logged out');
}

function onRegister (req, res) {
    console.log(req.body);
    var email = req.body.email,
        password = req.body.password,
        first_name = req.body.first_name,
        last_name = req.body.last_name,
        full_name;

    if(first_name){
        //if first name was provided
        full_name = first_name + ' ' + last_name;
    } else {
        //extract name from email
        first_name = email.split('@')[0];
        last_name = "";
        full_name = first_name;
    }

    console.log("[AuthController.onRegister] onRegister Called");
    var newUser = userModel.create();
    newUser.local.password = newUser.generateHash(password);
    newUser.email = email;
    newUser.first_name = first_name,
    newUser.last_name = last_name,
    newUser.name = full_name;

    userModel.add(newUser, function(err, user) {
        if(err) {
            console.log("[AuthController.onRegister] user already exists: ", err);
            return res.status(400).send('User already exists');
        }
        else {
            console.log("[AuthController.onRegister] user created", user.name);
            req.logIn(user, err => {
                if(err) res.status(500).json(err);
                res.cookie('user', JSON.stringify({ _id : req.user.id, role : req.user.role}));
                req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7;
                res.status(200).json(user);
            });
        }
    });
}
function onLogin (req, res) {
    if(!req.user) {
        return res.status(500).send('[AuthController.onLogin] user should exists post login');
    }
    console.log('--------------logged in - req.session---------', req.session);
    res.cookie('user', JSON.stringify({ _id : req.user.id, role : req.user.role}));
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
    return res.status(200).send(req.user);
}

function sendPswdResetEmail(req, res) {
    var p = req.body,
        resetEmail = p.email,
        logPrefix = '[AuthController.sendPswdResetEmail: ] ';
    if(!resetEmail) {
        return res.send(500).send('Email not provided');
    }

    userModel.listByEmailAsync(resetEmail)
    .then(userDoc => {
        if(!userDoc.local && !userDoc.local.password) {
            throw new Error('Not a local user');
        }
        var reset_expire = new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 3)).getTime(), //3 days
            reset_token = crypto.createHash('md5').update(resetEmail + reset_expire).digest("hex");

        userDoc.local.resetToken = reset_token;
        userDoc.local.resetExpire = reset_expire;
        console.log(logPrefix + 'saving tokens in user');
        return userDoc.save();
    })
    .then(savedUser => {
        console.log(logPrefix + 'user updated');
        // Send email
        var subj = "Reset Password",
            templateName = 'resetPassword',
            htmlData = {
                userName: savedUser.first_name,
                resetLink: req.protocol + "://" + req.get('host') + '/reset_password' + '?email=' + resetEmail + '&expire=' + savedUser.local.resetExpire
            };

        console.log(logPrefix + 'sending reset email to ' + resetEmail);
        return emailService.sendFromSupport(resetEmail, subj, templateName, htmlData);
    })
    .then(() => {
        console.log(logPrefix + 'password reset email sent to ' + resetEmail);
        res.status(200).send('Email sent');
    })
    .catch(err => {
        console.error(logPrefix + 'error in sending password reset email to ' + resetEmail);
        res.status(500).json(err);
    });
}

function resetPassword(req, res) {
    var p = req.body,
        logPrefix = '[AuthController.resetPassword: ] ';

    if(!p.email) {
        return res.send(500).send('Email not provided');
    }
    if(!p.expireToken) {
        return res.send(500).send('Token not provided');
    }
    if(!p.password) {
        return res.send(500).send('Password not provided');
    }

    userModel.listByEmailAsync(p.email)
    .then(userDoc => {
        if(!userDoc.local || !userDoc.local.resetToken || !userDoc.local.resetExpire) {
            throw new Error('Password reset info not found');
        }
        var regen_token = crypto.createHash('md5').update(p.email + p.expireToken).digest("hex");
        if(regen_token != userDoc.local.resetToken) {
            throw new Error('Tokens mismatch');
        }
        if(userDoc.local.resetExpire < Date.now()) {
            throw new Error('Token expired');
        }

        userDoc.local.password = userDoc.generateHash(p.password);
        userDoc.local.resetToken = '';
        userDoc.local.resetPassword = '';
        console.log(logPrefix + 'updating user password');
        return userDoc.save();
    })
    .then(savedUser => {
        console.log(logPrefix + 'password changed');
        // Send email
        var subj = "Your password has been changed",
            templateName = 'passwordChangeInfo',
            htmlData = {
                userName: savedUser.first_name
            };

        console.log(logPrefix + 'sending password change info email to ' + p.email);
        emailService.sendFromSupport(p.email, subj, templateName, htmlData);
        console.log(logPrefix + 'password successfully reset for  ' + p.email);
        res.status(200).send('Password Changed');
    })
    .catch(err => {
        console.error(logPrefix + 'error in resetting password for ' + p.email, err);
        res.status(500).json(err);
    });
}

module.exports = {
    onLogout,
    onRegister,
    onLogin,
    sendPswdResetEmail,
    resetPassword
};
