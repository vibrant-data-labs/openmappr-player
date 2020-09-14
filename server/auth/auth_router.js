'use strict';

var express = require('express'),
    passport = require('passport');

var controller    = require('./auth_controller');

/// /api/users routes
var router = express.Router({mergeParams : true});

router
    .get('/logout', controller.onLogout)
    // register, login and return the user
    .post('/register', controller.onRegister)
    .post('/send_reset_email', controller.sendPswdResetEmail)
    .post('/reset_password', controller.resetPassword)
    .post('/local', passport.authenticate('local',  {}), controller.onLogin)
    // facebook login
    .get('/facebook', passport.authenticate('facebook', { scope : 'email' }))
    .get('/facebook/callback', passport.authenticate('facebook', {
        successRedirect : '/user-projects',
        failureRedirect : '/'
    })
    )
    //twitter
    .get('/twitter', passport.authenticate('twitter'))
    .get('/twitter/callback', passport.authenticate('twitter', {
        successRedirect : '/user-projects',
        failureRedirect : '/'
    })
    )
    //google login
    .get('/google', passport.authenticate('google', { scope : ['profile', 'email'] }))
    .get('/google/callback', passport.authenticate('google', {
        successRedirect : '/user-projects',
        failureRedirect : '/'
    })
    );

module.exports = router;
